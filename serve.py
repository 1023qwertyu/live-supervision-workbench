# -*- coding: utf-8 -*-
"""直播监督工作台 · 本地服务

用法：python serve.py            # 默认 127.0.0.1:8787
      python serve.py --port 9000

作用：
  1. 把当前目录当作网站根目录提供访问（直接双击 html 拿不到实时数据）
  2. /api/live 聚合 D:/LiveVision/output/periodic/ 下的 latest.json、heartbeat.json 与简报列表
  3. /api/report?name=report_xxx.md 返回指定简报原文
"""
import argparse
import json
import os
import re
import time
import webbrowser
from datetime import datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
LIVE_DIR = os.environ.get("LIVEVISION_DIR", r"D:/LiveVision")
PERIODIC = os.path.join(LIVE_DIR, "output", "periodic")
SNAP_DIR = os.path.join(LIVE_DIR, "output", "live")
SNAP_FRESH_SEC = 180          # 超过这么久没刷新就当这一路已经停了（要能覆盖断流重连）
SNAP_LAG_SEC = 60             # 超过这个还没刷新 = 可能在断流重连，页面上要标出来
REPORT_RE = re.compile(r"^report_[\w\-]+\.md$")


def read_json(path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def snapshot_rooms():
    """读 daemon 每 15 秒写的实时快照（output/live/*.json）

    为什么先读这里：每半小时一份的简报（periodic/latest.json）只有汇报器在跑时才更新，
    汇报器一停，首页就一直显示「数据已过期」，而真正在采的房间其实好好的。
    输出的字段与简报对齐，前端不用改。
    返回 (rooms, 最新一份快照距今秒数, 最新一份快照的时间字符串)。
    """
    rooms, newest, newest_ts = {}, None, None
    try:
        names = os.listdir(SNAP_DIR)
    except OSError:
        return rooms, newest, newest_ts      # 盘没挂上/目录没了，别把整个接口带崩
    now = time.time()
    for name in names:
        if not name.endswith(".json"):
            continue
        d = read_json(os.path.join(SNAP_DIR, name))
        if not isinstance(d, dict) or not d.get("running"):
            continue
        try:
            age = now - time.mktime(time.strptime(d.get("updated_at"), "%Y-%m-%dT%H:%M:%S"))
        except Exception:
            continue
        if age > SNAP_FRESH_SEC:
            continue                     # 快照很久没刷 = 这一路已停，不能当实时
        if age < -5:
            continue                     # 时间戳比现在还超前 = 写端时钟不对，不能当实时
        age = max(0.0, age)              # 几秒的时钟抖动夹到 0，别显示「-2 秒前」
        # 只认 dict：真值但不是 dict（比如被写成字符串）会让 .get 抛 AttributeError，
        # 整页直接断连、前端显示「未启动服务」，比少一间严重得多。
        m = d.get("metrics") if isinstance(d.get("metrics"), dict) else {}
        s = d.get("score") if isinstance(d.get("score"), dict) else {}
        a = d.get("audio") if isinstance(d.get("audio"), dict) else {}
        # 房间名要当字典键：list/dict 不可哈希会抛 TypeError，同样能打挂整个接口
        key = d.get("room")
        if not isinstance(key, str) or not key:
            key = name[:-5]
        # 本场开始时间 = 数据时间往回推「已监看时长」，让页面能显示「本场几点起」
        upd = d.get("updated_at")
        started = None
        try:
            started = (datetime.strptime(upd, "%Y-%m-%dT%H:%M:%S")
                       - timedelta(seconds=float(d.get("video_sec") or 0))
                       ).strftime("%Y-%m-%dT%H:%M:%S")
        except Exception:
            started = None
        rooms[key] = {
            "score": s.get("score"),
            "level": s.get("level"),
            "cr": m.get("cr"),
            "var": m.get("var"),
            "max_silence_sec": a.get("max_silence_sec"),
            "silence_segments": a.get("silence_segments"),
            "speech_segments": a.get("speech_segments"),
            "events": d.get("events"),
            "video_sec": d.get("video_sec"),
            # 每间房各自的时间：数据是什么时候的、本场几点开始
            "updated_at": upd,
            "started_at": started,
            # 这间房自己多久没刷新：断流重连期间 monitor 不写快照，页面要能看出来
            "age_sec": round(age, 1),
            "lagging": age > SNAP_LAG_SEC,
        }
        if newest is None or age < newest:
            newest, newest_ts = age, d.get("updated_at")
    return rooms, newest, newest_ts


def live_payload():
    now = time.time()
    latest = read_json(os.path.join(PERIODIC, "latest.json"))
    beat = read_json(os.path.join(PERIODIC, "heartbeat.json"))

    reports = []
    if os.path.isdir(PERIODIC):
        for name in os.listdir(PERIODIC):
            if REPORT_RE.match(name):
                p = os.path.join(PERIODIC, name)
                try:
                    st = os.stat(p)
                except OSError:
                    continue
                reports.append({"name": name, "mtime": int(st.st_mtime), "size": st.st_size})
        reports.sort(key=lambda r: r["mtime"], reverse=True)

    md_text = ""
    if reports:
        try:
            with open(os.path.join(PERIODIC, reports[0]["name"]), encoding="utf-8") as f:
                md_text = f.read()
        except Exception:
            md_text = ""

    age = None
    if latest and latest.get("generated_at"):
        try:
            age = int(now - time.mktime(time.strptime(latest["generated_at"], "%Y-%m-%dT%H:%M:%S")))
        except Exception:
            age = None

    # 实时快照优先：确实有人在采就以它为准（15 秒一刷），简报只在没人在采时兜底
    snap, snap_age, snap_ts = snapshot_rooms()
    if snap:
        rooms, age, source = snap, int(snap_age or 0), "snapshot"
    else:
        rooms, source = (latest or {}).get("rooms", {}), "periodic"

    # 快照模式下，简报的 generated_at / 心跳 / 窗口都是上一套链路的产物，
    # 原样返回会渲染出「0 秒前」配「8 天前的数据时间」这种自相矛盾的一屏。
    live_mode = source == "snapshot"
    return {
        "ok": bool(latest) or bool(snap),
        "server_time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "periodic_dir": PERIODIC,
        "exists": os.path.isdir(PERIODIC),
        "generated_at": snap_ts if live_mode else (latest or {}).get("generated_at"),
        "window_minutes": None if live_mode else (latest or {}).get("window_minutes"),
        "rooms": rooms,
        "source": source,
        "age_seconds": age,
        "stale": (age is None or age > 40 * 60),
        "heartbeat": None if live_mode else beat,
        "reports": reports[:20],
        "latest_report": md_text,
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def end_headers(self):
        # 前端文件（html/js/css/json）一律不缓存：改完代码后浏览器还在用旧版本，
        # 表现就是「明明改了、页面显示的还是以前那套」（2026-11-18 实际踩到）。
        if self.path.split("?")[0].endswith((".html", ".js", ".css", ".json")):
            self.send_header("Cache-Control", "no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
        super().end_headers()

    def _json(self, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/live":
            return self._json(live_payload())

        if parsed.path == "/api/report":
            name = (parse_qs(parsed.query).get("name") or [""])[0]
            if not REPORT_RE.match(name):
                return self._json({"ok": False, "error": "invalid name"})
            p = os.path.join(PERIODIC, name)
            try:
                with open(p, encoding="utf-8") as f:
                    return self._json({"ok": True, "name": name, "text": f.read()})
            except Exception as e:
                return self._json({"ok": False, "error": str(e)})

        if parsed.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, fmt, *args):
        if "/api/" in self.path:
            return
        print("[%s] %s" % (time.strftime("%H:%M:%S"), fmt % args))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()

    url = "http://127.0.0.1:%d/index.html" % args.port
    print("直播监督工作台已启动：%s" % url)
    print("实时监看数据目录：%s" % PERIODIC)
    print("按 Ctrl+C 停止。")
    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
