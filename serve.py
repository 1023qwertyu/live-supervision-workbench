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
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
LIVE_DIR = os.environ.get("LIVEVISION_DIR", r"D:/LiveVision")
PERIODIC = os.path.join(LIVE_DIR, "output", "periodic")
REPORT_RE = re.compile(r"^report_[\w\-]+\.md$")


def read_json(path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


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

    return {
        "ok": bool(latest),
        "server_time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "periodic_dir": PERIODIC,
        "exists": os.path.isdir(PERIODIC),
        "generated_at": (latest or {}).get("generated_at"),
        "window_minutes": (latest or {}).get("window_minutes"),
        "rooms": (latest or {}).get("rooms", {}),
        "age_seconds": age,
        "stale": (age is None or age > 40 * 60) if latest else True,
        "heartbeat": beat,
        "reports": reports[:20],
        "latest_report": md_text,
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

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
