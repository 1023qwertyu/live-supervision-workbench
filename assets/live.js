/* 实时监看页 —— 主页面只回答两件事：有没有问题、问题在哪间；细节点开看 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LV = { A: 'a', B: 'b', C: 'c', D: 'd' };
  var DATA = null;
  var openedFromUrl = false;

  // ---------- 工具 ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ago(sec) {
    if (sec == null) return '未知';
    if (sec < 60) return Math.max(0, Math.round(sec)) + ' 秒前';
    if (sec < 3600) return Math.round(sec / 60) + ' 分钟前';
    return Math.round(sec / 3600) + ' 小时前';
  }
  function hhmmss(iso) { return (iso && iso.length >= 19) ? iso.slice(11, 19) : '—'; }
  function hhmm(iso) { return (iso && iso.length >= 16) ? iso.slice(11, 16) : '—'; }
  function hms(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return h + ' 小时 ' + m + ' 分';
    if (m) return m + ' 分 ' + s + ' 秒';
    return s + ' 秒';
  }
  function pct(v) { return v == null ? '—' : (v * 100).toFixed(1) + '%'; }

  // ---------- 诊断：把原始指标翻译成「哪条规则不达标」 ----------
  // 口径来自《评分与扣分表 v1.1》：语音 <80% 最高 C、<70% 直接 D；出镜率 <50% 直接 D。
  function diagnose(r) {
    var out = [];
    var cr = r.cr == null ? null : r.cr * 100;
    var va = r.var == null ? null : r.var * 100;

    if (cr != null && cr < 50) out.push({ p: 'P0', t: '出镜率 ' + cr.toFixed(1) + '%，低于 50%（硬门槛，直接判 D）' });
    else if (cr != null && cr < 80) out.push({ p: 'P1', t: '出镜率 ' + cr.toFixed(1) + '%，偏低（低于 80%）' });

    if (va != null && va < 70) out.push({ p: 'P0', t: '语音活跃率 ' + va.toFixed(1) + '%，低于 70%（硬门槛，直接判 D）' });
    else if (va != null && va < 80) out.push({ p: 'P1', t: '语音活跃率 ' + va.toFixed(1) + '%，低于 80%（最高只能 C）' });

    if (r.prone_count > 0) out.push({ p: 'P1', t: '趴桌 ' + r.prone_count + ' 次' });
    if (r.away_sec >= 60) out.push({ p: 'P1', t: '离岗 ' + Math.round(r.away_sec) + ' 秒' });
    if (r.silence_min >= 5) out.push({ p: 'P2', t: '静音 ' + r.silence_min + ' 分钟' });
    if (r.phone_count > 0) out.push({ p: 'P2', t: '低头操作手机 ' + r.phone_count + ' 次（待核）' });
    if (r.lagging) out.push({ p: 'P2', t: '数据延迟 ' + Math.round(r.age_sec || 0) + ' 秒，可能在断流重连' });
    if (r.link_drops > 0) out.push({ p: 'P3', t: '本场断流 ' + r.link_drops + ' 次' });
    return out;
  }

  function statusOf(r, issues) {
    var lv = (r.level || '').toUpperCase();
    if (issues.some(function (i) { return i.p === 'P0' || i.p === 'P1'; })) return 'bad';
    if (lv === 'D') return 'bad';
    if (issues.length || lv === 'C') return 'warn';
    return 'ok';
  }

  var RANK = { bad: 0, warn: 1, ok: 2 };

  // ---------- 摘要 ----------
  function renderSummary(rooms, d) {
    var keys = Object.keys(rooms || {});
    var bad = 0, warn = 0;
    keys.forEach(function (k) {
      var r = rooms[k] || {};
      var s = statusOf(r, diagnose(r));
      if (s === 'bad') bad++;
      else if (s === 'warn') warn++;
    });
    $('sLive').textContent = keys.length;
    $('sBad').textContent = bad;
    $('sWarn').textContent = warn;
    var newest = keys.map(function (k) { return rooms[k] && rooms[k].updated_at; })
      .filter(Boolean).sort().pop();
    $('sClock').textContent = hhmmss(newest) || '—';
    return { bad: bad, warn: warn, live: keys.length };
  }

  // ---------- 异常清单：只列 P0/P1，其余留在列表里 ----------
  function renderIssues(rooms) {
    var rows = [];
    Object.keys(rooms || {}).forEach(function (k) {
      var r = rooms[k] || {};
      diagnose(r).forEach(function (i) {
        if (i.p !== 'P0' && i.p !== 'P1') return;
        rows.push({ room: k, p: i.p, text: i.t });
      });
    });
    rows.sort(function (a, b) { return a.p === b.p ? 0 : (a.p === 'P0' ? -1 : 1); });
    if (!rows.length) { $('issues').innerHTML = ''; return; }
    $('issues').innerHTML = rows.slice(0, 6).map(function (x) {
      return '<div class="lv-issue ' + (x.p === 'P0' ? 'p0' : 'p1') + '" data-room="' + esc(x.room) + '">'
        + '<span class="tag">' + x.p + '</span>'
        + '<span class="who">' + esc(x.room) + '</span>'
        + '<span class="txt">' + esc(x.text) + '</span>'
        + '<span class="go">查看 ›</span></div>';
    }).join('');
  }

  // ---------- 房间列表 ----------
  function renderRooms(rooms) {
    var keys = Object.keys(rooms || {});
    if (!keys.length) {
      $('roomList').innerHTML = '<div class="lv-empty">当前没有在采的直播间。未开播或全部已下播。</div>';
      return;
    }
    var arr = keys.map(function (k) {
      var r = rooms[k] || {};
      var iss = diagnose(r);
      return { k: k, r: r, iss: iss, st: statusOf(r, iss) };
    });
    arr.sort(function (a, b) {
      if (RANK[a.st] !== RANK[b.st]) return RANK[a.st] - RANK[b.st];
      return (a.r.score == null ? 999 : a.r.score) - (b.r.score == null ? 999 : b.r.score);
    });

    $('roomList').innerHTML = arr.map(function (o) {
      var r = o.r, lv = (r.level || '').toUpperCase();
      var top = o.iss.length ? o.iss[0].t : '正常';
      var cls = o.st === 'bad' ? 'bad' : (o.st === 'warn' ? 'warn' : '');
      var lag = r.lagging ? ' <span style="color:#B8860B">· 延迟 ' + Math.round(r.age_sec || 0) + '秒</span>' : '';
      return '<div class="lv-row" data-room="' + esc(o.k) + '">'
        + '<span class="lv-dot ' + o.st + '"></span>'
        + '<span class="lv-name">' + esc(o.k) + lag + '</span>'
        + '<span class="lv-score">' + (r.score == null ? '—' : Number(r.score).toFixed(1)) + '<small>分</small></span>'
        + '<span><span class="badge ' + (LV[lv] || 'd') + '">' + (lv || '—') + ' 级</span></span>'
        + '<span class="lv-prob ' + cls + '">' + esc(top) + '</span>'
        + '<span class="lv-time">' + hhmmss(r.updated_at) + '</span>'
        + '<span class="lv-arrow">›</span></div>';
    }).join('');
  }

  // ---------- 抽屉 ----------
  function bar(val, max, good) {
    var w = Math.max(0, Math.min(100, (val / max) * 100));
    var color = good ? '#2E7D32' : '#C62828';
    return '<div class="bar"><i style="width:' + w + '%;background:' + color + '"></i></div>';
  }

  function spark(points) {
    if (!points || points.length < 2) {
      return '<div class="lv-none">趋势点还不够（每 60 秒记一个点，刚接入或刚重启）。</div>';
    }
    var w = 500, h = 90, pad = 8;
    var t0 = points[0][0], t1 = points[points.length - 1][0];
    var span = Math.max(1, t1 - t0);
    // 纵轴按实际数据缩放：分数一直 100 时若固定 0~100，线会贴顶看不出任何波动
    var vals = points.map(function (p) { return p[1]; }).filter(function (v) { return v != null; });
    var lo = vals.length ? Math.min.apply(null, vals) : 0;
    var hi = vals.length ? Math.max.apply(null, vals) : 100;
    var margin = Math.max(1.5, (hi - lo) * 0.25);
    var ymin = Math.max(0, lo - margin), ymax = Math.min(100, hi + margin);
    if (ymax - ymin < 4) { ymin = Math.max(0, ymax - 4); }

    function line(idx, scale) {
      return points.map(function (p) {
        var v = p[idx];
        if (v == null) return null;
        var val = scale ? v * 100 : v;                      // 出镜率是 0~1，换算成百分数
        var x = pad + ((p[0] - t0) / span) * (w - pad * 2);
        var y = h - pad - ((Math.max(ymin, Math.min(ymax, val)) - ymin) / (ymax - ymin)) * (h - pad * 2);
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).filter(Boolean).join(' ');
    }
    var scoreLine = line(1, false);
    var crLine = line(2, true);
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:90px;display:block">'
      + '<line x1="0" y1="' + (h - pad) + '" x2="' + w + '" y2="' + (h - pad) + '" stroke="#EDF1F6" stroke-width="1"/>'
      + (crLine ? '<polyline points="' + crLine + '" fill="none" stroke="#7FB2E5" stroke-width="1.6"/>' : '')
      + (scoreLine ? '<polyline points="' + scoreLine + '" fill="none" stroke="#2E7D32" stroke-width="2"/>' : '')
      + '</svg>'
      + '<div style="display:flex;gap:16px;font-size:11.5px;color:#8A99A8;margin-top:4px">'
      + '<span><i style="display:inline-block;width:14px;height:2px;background:#2E7D32;vertical-align:middle"></i> 得分</span>'
      + '<span><i style="display:inline-block;width:14px;height:2px;background:#7FB2E5;vertical-align:middle"></i> 出镜率</span>'
      + '<span style="margin-left:auto">' + points.length + ' 个点 · ' + ymin.toFixed(0) + '–' + ymax.toFixed(0) + ' 分</span>'
      + '</div>';
  }

  function openDrawer(roomName) {
    var r = (DATA && DATA.rooms && DATA.rooms[roomName]) || null;
    if (!r) return;
    var iss = diagnose(r);
    var st = statusOf(r, iss);
    var lv = (r.level || '').toUpperCase();

    $('dTitle').textContent = roomName;
    var b = $('dBadge');
    b.className = 'badge ' + (LV[lv] || 'd');
    b.textContent = (lv || '—') + ' 级 · ' + (r.score == null ? '—' : Number(r.score).toFixed(1)) + ' 分';

    var html = '';

    html += '<div class="lv-sec"><h4>当前状态</h4>'
      + '<div class="lv-line"><span>数据时间</span><span class="r">' + hhmmss(r.updated_at)
      + (r.lagging ? ' <b style="color:#B8860B">（延迟 ' + Math.round(r.age_sec) + ' 秒）</b>' : '') + '</span></div>'
      + '<div class="lv-line"><span>本场开始</span><span class="r">' + hhmm(r.started_at) + '</span></div>'
      + '<div class="lv-line"><span>已监看</span><span class="r">' + (r.video_sec == null ? '—' : hms(r.video_sec)) + '</span></div>'
      + (r.advice ? '<div class="lv-line"><span>结论</span><span class="r">' + esc(r.advice) + '</span></div>' : '')
      + '</div>';

    html += '<div class="lv-sec"><h4>哪里出了问题</h4>';
    if (!iss.length) {
      html += '<div class="lv-none">没有触发任何规则，指标全部达标。</div>';
    } else {
      html += iss.map(function (i) {
        var c = i.p === 'P0' ? '#C62828' : (i.p === 'P1' ? '#B8860B' : '#6B8199');
        return '<div class="lv-line"><span><b style="color:' + c + '">' + i.p + '</b>　' + esc(i.t) + '</span></div>';
      }).join('');
    }
    html += '</div>';

    var cr = r.cr == null ? null : r.cr * 100;
    var va = r.var == null ? null : r.var * 100;
    html += '<div class="lv-sec"><h4>关键指标</h4><div class="lv-metrics">'
      + '<div class="lv-metric"><div class="l"><span>出镜率</span><span>≥80%</span></div>'
      + '<div class="v" style="color:' + (cr == null ? '#8A99A8' : (cr >= 80 ? '#2E7D32' : '#C62828')) + '">'
      + (cr == null ? '—' : cr.toFixed(1) + '%') + '</div>' + bar(cr || 0, 100, cr >= 80) + '</div>'
      + '<div class="lv-metric"><div class="l"><span>语音活跃率</span><span>≥80%</span></div>'
      + '<div class="v" style="color:' + (va == null ? '#8A99A8' : (va >= 80 ? '#2E7D32' : '#C62828')) + '">'
      + (va == null ? '—' : va.toFixed(1) + '%') + '</div>' + bar(va || 0, 100, va >= 80) + '</div>'
      + '<div class="lv-metric"><div class="l"><span>离岗</span><span>0 秒</span></div>'
      + '<div class="v" style="color:' + ((r.away_sec || 0) < 60 ? '#2E7D32' : '#C62828') + '">'
      + (r.away_sec == null ? '—' : Math.round(r.away_sec) + ' 秒') + '</div>' + bar(r.away_sec || 0, 300, (r.away_sec || 0) < 60) + '</div>'
      + '<div class="lv-metric"><div class="l"><span>静音</span><span>0 分</span></div>'
      + '<div class="v" style="color:' + ((r.silence_min || 0) < 5 ? '#2E7D32' : '#C62828') + '">'
      + (r.silence_min == null ? '—' : r.silence_min + ' 分') + '</div>' + bar(r.silence_min || 0, 20, (r.silence_min || 0) < 5) + '</div>'
      + '<div class="lv-metric"><div class="l"><span>趴桌</span><span>0 次</span></div>'
      + '<div class="v" style="color:' + (!r.prone_count ? '#2E7D32' : '#C62828') + '">'
      + (r.prone_count == null ? '—' : r.prone_count + ' 次') + '</div></div>'
      + '<div class="lv-metric"><div class="l"><span>低头操作手机</span><span>待核</span></div>'
      + '<div class="v" style="color:' + (!r.phone_count ? '#2E7D32' : '#B8860B') + '">'
      + (r.phone_count == null ? '—' : r.phone_count + ' 次') + '</div></div>'
      + '</div></div>';

    html += '<div class="lv-sec"><h4>趋势（最近记录）</h4>' + spark(r.trend) + '</div>';

    html += '<div class="lv-sec"><h4>扣分明细 / 影响范围</h4>';
    var items = (r.items || []).filter(function (i) { return i && (i.points || 0) > 0; });
    if (!items.length) {
      html += '<div class="lv-none">本场没有扣分项（满分）。</div>';
    } else {
      html += items.map(function (i) {
        return '<div class="lv-line"><span>' + esc(i.item) + '　<span style="color:#8A99A8">' + esc(i.measured) + '</span></span>'
          + '<span class="r" style="color:#C62828">-' + i.points + ' 分</span></div>';
      }).join('');
      var total = items.reduce(function (s, i) { return s + (i.points || 0); }, 0);
      html += '<div class="lv-line"><span><b>合计扣分</b></span><span class="r" style="color:#C62828;font-weight:700">-' + total.toFixed(1) + ' 分</span></div>';
    }
    html += '</div>';

    html += '<div class="lv-sec"><h4>最近告警</h4>';
    var alerts = (r.alerts || []).slice().reverse();
    if (!alerts.length) {
      html += '<div class="lv-none">这段时间没有告警。</div>';
    } else {
      html += alerts.map(function (a) {
        return '<div class="lv-alert"><span class="t">' + esc((a.time || '').slice(11, 19)) + '</span>'
          + '<b>' + esc(a.type) + '</b>　' + esc(a.desc || '') + '</div>';
      }).join('');
    }
    html += '</div>';

    html += '<div class="lv-sec"><h4>定位入口</h4><div class="lv-actions">'
      + (DATA && DATA.evidence_url
        ? '<a class="btn sm" href="' + esc(DATA.evidence_url) + '" target="_blank" rel="noopener">打开证据查询台</a>'
        : '<span class="lv-none">证据台地址未探测到（手机同 WiFi 可用 http://本机IP:8771）</span>')
      + '</div></div>';

    $('drawerBody').innerHTML = html;
    $('drawer').classList.add('open');
    $('drawer').setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    $('drawer').classList.remove('open');
    $('drawer').setAttribute('aria-hidden', 'true');
  }

  // ---------- 折叠区：数据源 + 简报 ----------
  function renderSource(d) {
    var live = d.source === 'snapshot';
    var rows = [
      ['数据来源', live ? '实时快照（15 秒一刷）' : '半小时简报'],
      ['最新数据时间', (d.generated_at || '无') + '（' + ago(d.age_seconds) + '）'],
      ['统计窗口', live ? '本场累计' : ((d.window_minutes || '—') + ' 分钟')],
      ['服务端时间', d.server_time || '—']
    ];
    $('sourceTable').innerHTML = rows.map(function (r) {
      return '<tr><td style="width:34%;color:#6B8199">' + r[0] + '</td><td>' + esc(r[1]) + '</td></tr>';
    }).join('');
  }

  function md2html(md) {
    return md.split(/\r?\n/).filter(function (l) { return l.trim(); }).map(function (ln) {
      var t = esc(ln.trim()).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      if (/^#/.test(t)) return '<h3>' + t.replace(/^#+\s*/, '') + '</h3>';
      if (/^[-*] /.test(t)) return '<div style="padding-left:12px">· ' + t.slice(2) + '</div>';
      return '<p style="margin:5px 0">' + t + '</p>';
    }).join('');
  }

  function renderReports(d) {
    var list = d.reports || [];
    if (!list.length) {
      $('reportList').innerHTML = '<span class="small">还没有简报产出。</span>';
      $('reportBody').innerHTML = '<div class="lv-none">没有简报文件。</div>';
      return;
    }
    var m2 = (list[0].name || '').match(/report_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
    var when = m2 ? (m2[1] + '-' + m2[2] + '-' + m2[3] + ' ' + m2[4] + ':' + m2[5]) : '较早';
    var note = d.source === 'snapshot'
      ? '<div style="margin-bottom:10px;color:#8A6D3B;background:#FCF8E3;border:1px solid #F0E0B8;'
        + 'border-radius:8px;padding:9px 12px;font-size:12.8px;line-height:1.6">'
        + '以下是 <b>' + when + '</b> 的历史简报（汇报器没在运行），不是实时数据。</div>'
      : '';

    $('reportList').innerHTML = list.slice(0, 8).map(function (r) {
      var m = r.name.match(/report_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
      var label = m ? (m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5]) : r.name;
      return '<button class="btn sm" data-report="' + esc(r.name) + '">' + label + '</button>';
    }).join('');

    $('reportList').onclick = function (e) {
      var b = e.target.closest('[data-report]');
      if (!b) return;
      fetch('/api/report?name=' + encodeURIComponent(b.getAttribute('data-report')))
        .then(function (r) { return r.json(); })
        .then(function (j) {
          $('reportBody').innerHTML = note + (j.ok ? md2html(j.text) : '<div class="lv-none">读取失败</div>');
        })
        .catch(function () { $('reportBody').innerHTML = '<div class="lv-none">读取失败</div>'; });
    };
    $('reportBody').innerHTML = note + (d.latest_report ? md2html(d.latest_report) : '<div class="lv-none">没有简报正文。</div>');
  }

  // ---------- 状态徽标 ----------
  function setStatus(d) {
    var b = $('statusBadge');
    if (!d) { b.className = 'badge d'; b.textContent = '读不到数据'; return; }
    if (!d.ok) { b.className = 'badge d'; b.textContent = '无数据'; return; }
    if (d.stale) { b.className = 'badge c'; b.textContent = '数据过期 · ' + ago(d.age_seconds); return; }
    b.className = 'badge live';
    b.textContent = '监看中 · ' + ago(d.age_seconds);
  }

  // ---------- 主流程 ----------
  function render(d) {
    DATA = d;
    setStatus(d);
    var s = renderSummary(d.rooms, d);
    renderIssues(d.rooms);
    renderRooms(d.rooms);
    renderSource(d);
    renderReports(d);

    if (!Object.keys(d.rooms || {}).length) {
      $('issues').innerHTML = '';
    }
    // 抽屉开着时，把内容同步刷新一次（不然点开久了数字会停在打开那一刻）
    if ($('drawer').classList.contains('open')) {
      var name = $('dTitle').textContent;
      if (d.rooms && d.rooms[name]) openDrawer(name);
      else closeDrawer();
    }
    // 支持直接打开某间房的详情，方便收藏/分享：live.html?room=房间名
    if (!openedFromUrl) {
      openedFromUrl = true;
      var want = new URLSearchParams(location.search).get('room');
      if (want && d.rooms && d.rooms[want]) openDrawer(want);
    }
    return s;
  }

  function load() {
    fetch('/api/live', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(render)
      .catch(function () {
        setStatus(null);
        $('roomList').innerHTML = '<div class="lv-empty">读不到数据。请确认本地服务在跑：'
          + '<code>python serve.py</code>，然后访问 http://127.0.0.1:8787/live.html</div>';
        $('issues').innerHTML = '';
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    load();
    $('btnRefresh').addEventListener('click', load);
    setInterval(load, 30000);

    // 点异常清单或列表行 → 开抽屉
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-room]');
      if (t) { openDrawer(t.getAttribute('data-room')); return; }
      if (e.target.id === 'drawerMask' || e.target.id === 'drawerClose') closeDrawer();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });
  });
})();
