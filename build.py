# -*- coding: utf-8 -*-
"""把 src/ 下的原始文档统一改造成工作台页面。

用法：python build.py
输入：src/system.html、src/manual.html、src/tuangou.html
输出：system.html、manual.html、tuangou.html、data/search.json
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

PAGES = [
    {
        "key": "system", "src": "src/system.html", "out": "system.html",
        "nav": "监督体系", "no": "01", "tag": "制度",
        "title": "抖音直播监督体系",
        "eyebrow": "模块 01 · 制度底座",
        "desc": "三层防线、六类检查项、红黄线判定、分层排期、评分卡与四级响应——管理层用的整套监督规则。",
    },
    {
        "key": "manual", "src": "src/manual.html", "out": "manual.html",
        "nav": "合规手册", "no": "03", "tag": "手册",
        "title": "电商直播合规手册 · 直播人员版",
        "eyebrow": "模块 03 · 人员读本",
        "desc": "出镜主播/助播/场控视角的十章手册：开播前四件事、出镜规范、六步讲解、红线 19 条、禁用词表。",
    },
    {
        "key": "tuangou", "src": "src/tuangou.html", "out": "tuangou.html",
        "nav": "团购版手册", "no": "05", "tag": "手册",
        "title": "直播人员个人手册 · 团购版 V2.1",
        "eyebrow": "模块 05 · 个人作业本",
        "desc": "团购券销售 + 到店核销口径，含排班纪律、化妆标准、七环节分工、绿幕画面源管理与早班 30 分钟清单。",
    },
]

NAV = [
    ("index.html", "总览", "00"),
    ("system.html", "监督体系", "01"),
    ("scoring.html", "状态评分", "02"),
    ("manual.html", "合规手册", "03"),
    ("check.html", "开播核对卡", "04"),
    ("tuangou.html", "团购版手册", "05"),
    ("live.html", "实时监看", "06"),
]

SHELL = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · 直播监督工作台</title>
<link rel="stylesheet" href="assets/base.css">
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <div class="logo">监</div>
      <div><b>直播监督工作台</b><span>LIVE OPS · V1.0</span></div>
    </div>
    {nav}
    <div class="foot">食品类目电商直播<br>团购券 · 到店核销</div>
  </aside>
  <div class="main">
    <div class="topbar">
      <span class="crumb">{eyebrow}</span>
      <div class="spacer"></div>
      <div class="search">
        <input id="q" type="text" placeholder="在本页内搜索…" autocomplete="off">
        <span class="hits" id="hits"></span>
      </div>
      <button class="btn ghost sm" id="prevHit">上一个</button>
      <button class="btn ghost sm" id="nextHit">下一个</button>
    </div>
    <div class="content">
      <div class="wrap-wide">
        <div class="doc-shell">
          <article class="doc" id="doc">
            <div class="page-h">
              <div class="eyebrow">{eyebrow}</div>
              <h2>{title}</h2>
              <p>{desc}</p>
            </div>
{body}
          </article>
          <aside class="toc-rail">
            <div class="t">本页目录</div>
            {toc}
          </aside>
        </div>
      </div>
    </div>
  </div>
</div>
<script src="assets/app.js"></script>
</body>
</html>
"""


def strip_wrappers(html):
    html = re.sub(r"<style[\s\S]*?</style>", "", html)
    html = re.sub(r"<script[\s\S]*?</script>", "", html)
    html = re.sub(r"<!DOCTYPE[^>]*>", "", html, flags=re.I)
    html = re.sub(r"</?html[^>]*>", "", html, flags=re.I)
    html = re.sub(r"</?head[^>]*>", "", html, flags=re.I)
    html = re.sub(r"<meta[^>]*>", "", html, flags=re.I)
    html = re.sub(r"<title[\s\S]*?</title>", "", html, flags=re.I)
    i = html.find("<body")
    if i >= 0:
        html = html[i:]
        html = re.sub(r"^<body[^>]*>", "", html)
        html = html.replace("</body>", "")
    return html


def drop_cover(html):
    # 原始打印版封面与目录，工作台另有导航
    html = re.sub(r'<section role="cover">[\s\S]*?</section>', "", html)
    html = re.sub(r'<nav class="doc-toc"[\s\S]*?</nav>', "", html)
    html = re.sub(r'<section class="doc-toc"[\s\S]*?</section>', "", html)
    return html


def clean_classes(html):
    html = html.replace('class="lead"', 'data-lead="1"')
    html = html.replace('class="tip"', 'data-tip="tip"')
    html = html.replace('class="warn"', 'data-tip="warn"')
    html = html.replace('class="key"', 'data-tip="key"')
    # 去掉其余 class / style / role
    html = re.sub(r'\s(?:class|style|role|aria-label)="[^"]*"', "", html)
    html = html.replace('<p data-tip="tip">', '<div class="callout tip">')
    html = html.replace('<p data-tip="warn">', '<div class="callout warn">')
    html = html.replace('<p data-tip="key">', '<div class="callout key">')
    html = re.sub(r'<div data-tip="(?:tip|warn|key)">', '<div class="callout">', html)
    # 提示块结尾的 </p> 已在上面统一成 div，这里处理对应的收尾：把 callout 内的 </p> 换成 </div>
    out = []
    depth = 0
    for chunk in re.split(r'(<div class="callout[^"]*">|</p>)', html):
        if chunk.startswith('<div class="callout'):
            depth += 1
            out.append(chunk)
        elif chunk == "</p>" and depth > 0:
            depth -= 1
            out.append("</div>")
        else:
            out.append(chunk)
    html = "".join(out)
    html = html.replace("<p data-lead=\"1\">", '<p class="lead">')
    html = re.sub(r"\n{3,}", "\n\n", html)
    return html


def ensure_ids(html):
    counter = [0]

    def repl(m):
        tag, attrs, text = m.group(1), m.group(2), m.group(3)
        plain = re.sub(r"<[^>]+>", "", text).strip()
        if "id=" in attrs:
            hid = re.search(r'id="([^"]+)"', attrs).group(1)
        else:
            counter[0] += 1
            hid = "h-%d" % counter[0]
            attrs = attrs + ' id="%s"' % hid
        return "<%s%s>%s</%s>" % (tag, attrs, text, tag)

    return re.sub(r"<(h[123])([^>]*)>([\s\S]*?)</\1>", repl, html)


def build_toc(html):
    items = []
    for m in re.finditer(r'<h([12])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)</h\1>', html):
        lv, hid, text = m.group(1), m.group(2), m.group(3)
        text = re.sub(r"<[^>]+>", "", text).strip()
        cls = "lv2" if lv == "2" else ""
        items.append('<a class="%s" href="#%s">%s</a>' % (cls, hid, text))
    return "\n            ".join(items)


def build_index_sections(html, page_key, page_title):
    """按 h1/h2 切片，产出全局检索用的条目。"""
    marks = [(m.start(), m.group(1), m.group(2), re.sub(r"<[^>]+>", "", m.group(3)).strip())
             for m in re.finditer(r'<h([12])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)</h\1>', html)]
    out = []
    for i, (pos, lv, hid, text) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(html)
        body = html[pos:end]
        body = re.sub(r"<[^>]+>", " ", body)
        body = re.sub(r"\s+", " ", body).strip()
        out.append({
            "page": page_key, "pageTitle": page_title,
            "anchor": hid, "level": int(lv), "title": text,
            "text": body[:4000],
        })
    return out


def render_nav(current):
    rows = []
    for href, label, no in NAV:
        cls = "nav-item active" if href == current else "nav-item"
        rows.append('<a class="%s" href="%s"><span class="dot"></span>%s<span class="tag">%s</span></a>'
                    % (cls, href, label, no))
    return "\n    ".join(rows)


def main():
    index = []
    for page in PAGES:
        raw = open(os.path.join(HERE, page["src"]), encoding="utf-8").read()
        html = clean_classes(ensure_ids(drop_cover(strip_wrappers(raw))))
        toc = build_toc(html)
        out = SHELL.format(
            title=page["title"], eyebrow=page["eyebrow"], desc=page["desc"],
            nav=render_nav(page["out"]), body=html, toc=toc,
        )
        open(os.path.join(HERE, page["out"]), "w", encoding="utf-8").write(out)
        index.extend(build_index_sections(html, page["key"], page["title"]))
        print("built %-14s %6d chars, %d sections" % (page["out"], len(out), len(index)))

    os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
    json.dump(index, open(os.path.join(HERE, "data/search.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    print("index  %d sections -> data/search.json" % len(index))


if __name__ == "__main__":
    main()
