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
  // 数值来自外部 json，一律先转数字再拼 HTML：字符串形态的字段既能造 NaN，也能塞标签
  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  // 等级只可能是 A/B/C/D，白名单外的内容一个字都不往页面上放
  function lvOf(r) {
    var v = String((r && r.level) || '').toUpperCase();
    return /^[ABCD]$/.test(v) ? v : '';
  }

  // ---------- 诊断：把原始指标翻译成「哪条规则不达标」 ----------
  // 口径必须和 assets/scoring.js 的 RULES 一致：
  //   出镜率 达标线 90%（每差 5 个点扣 3 分，上限 25）；语音活跃率 达标线 80%（每差 5 点扣 2.5，上限 20）
  //   硬门槛：语音 <70% 直接 D、出镜率 <50% 直接 D；语音 <80% 最高只能 C
  //   离岗每 60 秒扣 2（上限 20）、手机每次 3（上限 15）、趴桌每次 10（上限 30）、
  //   静音每 5 分钟扣 2（上限 10）、进食每次 2（上限 8）
  function diagnose(r) {
    var out = [];
    var cr = r.cr == null ? null : r.cr * 100;
    var va = r.var == null ? null : r.var * 100;

    if (cr != null) {
      if (cr < 50) out.push({ p: 'P0', t: '出镜率 ' + cr.toFixed(1) + '%，低于 50%（硬门槛，直接判 D）' });
      else if (cr < 90) out.push({ p: 'P1', t: '出镜率 ' + cr.toFixed(1) + '%，低于 90% 达标线（每差 5 个点扣 3 分）' });
    }
    if (va != null) {
      if (va < 70) out.push({ p: 'P0', t: '语音活跃率 ' + va.toFixed(1) + '%，低于 70%（硬门槛，直接判 D）' });
      else if (va < 80) out.push({ p: 'P1', t: '语音活跃率 ' + va.toFixed(1) + '%，低于 80%（最高只能 C）' });
    }
    if (n(r.prone_count) > 0) out.push({ p: 'P1', t: '趴桌 ' + n(r.prone_count) + ' 次（每次扣 10 分）' });
    if (n(r.away_sec) >= 60) out.push({ p: 'P1', t: '离岗 ' + Math.round(n(r.away_sec)) + ' 秒（每满 60 秒扣 2 分）' });
    if (n(r.silence_min) >= 5) out.push({ p: 'P2', t: '静音 ' + n(r.silence_min) + ' 分钟（每满 5 分钟扣 2 分）' });
    if (n(r.phone_count) > 0) out.push({ p: 'P2', t: '低头操作手机 ' + n(r.phone_count) + ' 次（待核，每次扣 3 分）' });
    if (n(r.eating_count) > 0) out.push({ p: 'P2', t: '进食等无关行为 ' + n(r.eating_count) + ' 次（每次扣 2 分）' });
    if (n(r.link_drops) > 0) out.push({ p: 'P3', t: '本场断流 ' + n(r.link_drops) + ' 次（平台侧，不计主播）' });
    if (r.lagging) out.push({ p: 'P3', t: '数据延迟 ' + Math.round(n(r.age_sec)) + ' 秒，可能在断流重连' });
    return out;
  }

  var PRANK = { P0: 0, P1: 1, P2: 2, P3: 3 };
  function worstFirst(iss) {
    return iss.slice().sort(function (a, b) { return PRANK[a.p] - PRANK[b.p]; });
  }

  // 状态只由 issues 决定，和清单同源；等级只作兜底，避免「显示异常却列不出异常」
  function statusOf(r, issues) {
    if (issues.some(function (i) { return i.p === 'P0' || i.p === 'P1'; })) return 'bad';
    if (issues.some(function (i) { return i.p === 'P2'; })) return 'warn';
    var lv = lvOf(r);
    if (lv === 'D') return 'bad';
    if (lv === 'C') return 'warn';
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
    // 过期兜底数据不能算「在监」：那份是几天前的汇总，显示成绿色正常等于骗人
    if (d && d.stale) {
      $('sLive').textContent = '—';
      $('sBad').textContent = '—';
      $('sWarn').textContent = '—';
      $('sClock').textContent = ago(d.age_seconds) + '（非实时）';
      return { bad: 0, warn: 0, live: 0, stale: true };
    }
    $('sLive').textContent = keys.length;
    $('sBad').textContent = bad;
    $('sWarn').textContent = warn;
    var newest = keys.map(function (k) { return rooms[k] && rooms[k].updated_at; })
      .filter(Boolean).sort().pop();
    $('sClock').textContent = hhmmss(newest) || '—';
    return { bad: bad, warn: warn, live: keys.length, stale: false };
  }

  // ---------- 异常清单：只列 P0/P1，其余留在列表里 ----------
  function renderIssues(rooms, d) {
    if (d && d.stale) {
      $('issues').innerHTML = '<div class="lv-issue p1" style="cursor:default">'
        + '<span class="tag">提示</span>'
        + '<span class="txt"><b>当前没有实时数据。</b>下面是最后一次汇总（' + esc(ago(d.age_seconds))
        + '），只作历史参考，不代表现在播得怎么样。</span></div>';
      return;
    }
    var rows = [];
    Object.keys(rooms || {}).forEach(function (k) {
      var r = rooms[k] || {};
      diagnose(r).forEach(function (i) {
        if (i.p !== 'P0' && i.p !== 'P1') return;
        rows.push({ room: k, p: i.p, text: i.t });
      });
    });
    rows.sort(function (a, b) { return PRANK[a.p] - PRANK[b.p]; });
    if (!rows.length) { $('issues').innerHTML = ''; return; }
    var more = rows.length > 6 ? '<div style="font-size:12px;color:#8A99A8;margin:2px 0 8px">还有 ' + (rows.length - 6) + ' 条未列出，点房间看全部</div>' : '';
    $('issues').innerHTML = rows.slice(0, 6).map(function (x) {
      return '<div class="lv-issue ' + (x.p === 'P0' ? 'p0' : 'p1') + '" data-room="' + esc(x.room)
        + '" data-issue="' + esc(x.text) + '">'
        + '<span class="tag">' + x.p + '</span>'
        + '<span class="who">' + esc(x.room) + '</span>'
        + '<span class="txt">' + esc(x.text) + '</span>'
        + '<span class="go">查看 ›</span></div>';
    }).join('') + more;
  }

  // ---------- 房间列表 ----------
  function renderRooms(rooms, d) {
    var keys = Object.keys(rooms || {});
    if (!keys.length) {
      $('roomList').innerHTML = '<div class="lv-empty">当前没有在采的直播间。未开播或全部已下播。</div>';
      return;
    }
    var stale = !!(d && d.stale);
    var arr = keys.map(function (k) {
      var r = rooms[k] || {};
      var iss = diagnose(r);
      return { k: k, r: r, iss: iss, st: stale ? 'warn' : statusOf(r, iss) };
    });
    arr.sort(function (a, b) {
      if (RANK[a.st] !== RANK[b.st]) return RANK[a.st] - RANK[b.st];
      return (a.r.score == null ? 999 : a.r.score) - (b.r.score == null ? 999 : b.r.score);
    });

    $('roomList').innerHTML = arr.map(function (o) {
      var r = o.r, lv = lvOf(r);
      // 「主要问题」要取最严重的那条，不是数组里的第一条（原来是 iss[0]，顺序取决于判断先后）
      var top = o.iss.length ? worstFirst(o.iss)[0].t : '正常';
      if (stale) top = '历史数据，非实时';
      var cls = o.st === 'bad' ? 'bad' : (o.st === 'warn' ? 'warn' : '');
      var lag = r.lagging ? ' <span style="color:#B8860B">· 延迟 ' + Math.round(n(r.age_sec)) + '秒</span>' : '';
      return '<div class="lv-row" data-room="' + esc(o.k) + '">'
        + '<span class="lv-dot ' + o.st + '"></span>'
        + '<span class="lv-name">' + esc(o.k) + lag + '</span>'
        + '<span class="lv-score">' + (r.score == null ? '—' : Number(r.score).toFixed(1)) + '<small>分</small></span>'
        + '<span class="lv-lv"><span class="badge ' + (LV[lv] || 'd') + '">' + (lv || '—') + ' 级</span></span>'
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

  // 两条线各自一张小图：共用一根轴时，90 分的场次里 70% 出镜率会被压到图底，看着像 0
  function chart(points, idx, color, label, dynamic, scale) {
    var vals = points.map(function (p) { return p[idx]; }).filter(function (v) { return v != null; });
    if (points.length < 2 || !vals.length) return '';
    var w = 500, h = 62, pad = 6;
    var t0 = points[0][0], t1 = points[points.length - 1][0];
    var span = Math.max(1, t1 - t0);
    var lo = 0, hi = 100;
    if (dynamic) {
      var mn = Math.min.apply(null, vals.map(function (v) { return scale ? v * 100 : v; }));
      var mx = Math.max.apply(null, vals.map(function (v) { return scale ? v * 100 : v; }));
      var mg = Math.max(2, (mx - mn) * 0.3);
      lo = Math.max(0, mn - mg); hi = Math.min(100, mx + mg);
      if (hi - lo < 4) hi = lo + 4;
    }
    var pts = points.map(function (p) {
      var v = p[idx];
      if (v == null) return null;
      var val = scale ? v * 100 : v;
      var x = pad + ((p[0] - t0) / span) * (w - pad * 2);
      var y = h - pad - ((Math.max(lo, Math.min(hi, val)) - lo) / (hi - lo)) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).filter(Boolean).join(' ');
    if (!pts) return '';
    var last = vals[vals.length - 1];
    var lastTxt = (scale ? (last * 100).toFixed(1) + '%' : Number(last).toFixed(1) + ' 分');
    return '<div style="display:flex;justify-content:space-between;font-size:11.5px;color:#8A99A8;margin:6px 0 2px">'
      + '<span>' + label + '</span><span style="color:' + color + ';font-weight:600">' + lastTxt + '</span></div>'
      + '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:62px;display:block">'
      + '<line x1="0" y1="' + (h - pad) + '" x2="' + w + '" y2="' + (h - pad) + '" stroke="#EDF1F6"/>'
      + '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.8"/></svg>';
  }

  var curFocus = null;   // 当前高亮的那条异常，30 秒刷新后要保住

  function openDrawer(roomName, focusText) {
    if (focusText !== undefined) curFocus = focusText;
    var r = (DATA && DATA.rooms && DATA.rooms[roomName]) || null;
    if (!r) return;
    var iss = worstFirst(diagnose(r));
    var lv = lvOf(r);

    $('dTitle').textContent = roomName;
    var b = $('dBadge');
    b.className = 'badge ' + (LV[lv] || 'd');
    b.textContent = (lv || '—') + ' 级 · ' + (r.score == null ? '—' : Number(r.score).toFixed(1)) + ' 分';

    var html = '';

    html += '<div class="lv-sec"><h4>当前状态</h4>'
      + '<div class="lv-line"><span>数据时间</span><span class="r">' + hhmmss(r.updated_at)
      + (r.lagging ? ' <b style="color:#B8860B">（延迟 ' + Math.round(n(r.age_sec)) + ' 秒）</b>' : '') + '</span></div>'
      + '<div class="lv-line"><span>本场开始</span><span class="r">' + hhmm(r.started_at) + '</span></div>'
      + '<div class="lv-line"><span>已监看</span><span class="r">' + (r.video_sec == null ? '—' : hms(n(r.video_sec))) + '</span></div>'
      + (r.advice ? '<div class="lv-line"><span>结论</span><span class="r">' + esc(r.advice) + '</span></div>' : '')
      + '</div>';

    html += '<div class="lv-sec"><h4>哪里出了问题</h4>';
    if (!iss.length) {
      html += '<div class="lv-none">没有触发任何规则，指标全部达标。</div>';
    } else {
      html += iss.map(function (i) {
        // 从异常清单点进来的那条要高亮，否则用户还得自己在列表里找一遍
        var hit = curFocus && i.t === curFocus;
        var c = i.p === 'P0' ? '#C62828' : (i.p === 'P1' ? '#B8860B' : (i.p === 'P2' ? '#6B8199' : '#8A99A8'));
        return '<div class="lv-line" style="' + (hit ? 'background:#FFF9E6;border-radius:6px;padding-left:6px;padding-right:6px' : '') + '">'
          + '<span><b style="color:' + c + '">' + i.p + '</b>　' + esc(i.t) + '</span></div>';
      }).join('');
    }
    html += '</div>';

    var cr = r.cr == null ? null : r.cr * 100;
    var va = r.var == null ? null : r.var * 100;
    html += '<div class="lv-sec"><h4>关键指标</h4><div class="lv-metrics">'
      + '<div class="lv-metric"><div class="l"><span>出镜率</span><span>达标 90%</span></div>'
      + '<div class="v" style="color:' + (cr == null ? '#8A99A8' : (cr >= 90 ? '#2E7D32' : '#C62828')) + '">'
      + (cr == null ? '—' : cr.toFixed(1) + '%') + '</div>' + bar(cr || 0, 100, cr >= 90) + '</div>'
      + '<div class="lv-metric"><div class="l"><span>语音活跃率</span><span>达标 80%</span></div>'
      + '<div class="v" style="color:' + (va == null ? '#8A99A8' : (va >= 80 ? '#2E7D32' : '#C62828')) + '">'
      + (va == null ? '—' : va.toFixed(1) + '%') + '</div>' + bar(va || 0, 100, va >= 80) + '</div>'
      + '<div class="lv-metric"><div class="l"><span>离岗</span><span>0 秒</span></div>'
      + '<div class="v" style="color:' + (n(r.away_sec) < 60 ? '#2E7D32' : '#C62828') + '">'
      + (r.away_sec == null ? '—' : Math.round(n(r.away_sec)) + ' 秒') + '</div>' + bar(n(r.away_sec), 300, n(r.away_sec) < 60) + '</div>'
      + '<div class="lv-metric"><div class="l"><span>静音</span><span>0 分</span></div>'
      + '<div class="v" style="color:' + (n(r.silence_min) < 5 ? '#2E7D32' : '#C62828') + '">'
      + (r.silence_min == null ? '—' : n(r.silence_min) + ' 分') + '</div>' + bar(n(r.silence_min), 20, n(r.silence_min) < 5) + '</div>'
      + '<div class="lv-metric"><div class="l"><span>趴桌</span><span>0 次</span></div>'
      + '<div class="v" style="color:' + (n(r.prone_count) === 0 ? '#2E7D32' : '#C62828') + '">'
      + (r.prone_count == null ? '—' : n(r.prone_count) + ' 次') + '</div></div>'
      + '<div class="lv-metric"><div class="l"><span>低头操作手机</span><span>待核</span></div>'
      + '<div class="v" style="color:' + (n(r.phone_count) === 0 ? '#2E7D32' : '#B8860B') + '">'
      + (r.phone_count == null ? '—' : n(r.phone_count) + ' 次') + '</div></div>'
      + '</div></div>';

    var trend = r.trend || [];
    var c1 = chart(trend, 1, '#2E7D32', '得分（纵轴按实际范围缩放）', true, false);
    var c2 = chart(trend, 2, '#1565C0', '出镜率', false, true);
    html += '<div class="lv-sec"><h4>趋势</h4>'
      + (c1 || c2 ? (c1 + c2 + '<div style="font-size:11px;color:#A8B4C0;margin-top:4px">'
        + trend.length + ' 个点，每 60 秒记一个（只在本页打开时记录）</div>')
        : '<div class="lv-none">趋势点还不够（每 60 秒记一个点，刚接入或刚重启）。</div>')
      + '</div>';

    html += '<div class="lv-sec"><h4>扣分明细 / 影响范围</h4>';
    var items = (r.items || []).filter(function (i) { return i && Number(i.points) > 0; });
    if (!items.length) {
      html += '<div class="lv-none">本场没有扣分项（满分）。</div>';
    } else {
      html += items.map(function (i) {
        return '<div class="lv-line"><span>' + esc(i.item) + '　<span style="color:#8A99A8">' + esc(i.measured) + '</span></span>'
          + '<span class="r" style="color:#C62828">-' + Number(i.points).toFixed(1) + ' 分</span></div>';
      }).join('');
      var total = items.reduce(function (s, i) { return s + Number(i.points || 0); }, 0);
      html += '<div class="lv-line"><span><b>合计扣分（本场累计）</b></span>'
        + '<span class="r" style="color:#C62828;font-weight:700">-' + total.toFixed(1) + ' 分</span></div>';
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
        ? '<a class="btn sm" href="' + esc(DATA.evidence_url) + '" target="_blank" rel="noopener">打开证据查询台看录像</a>'
        : '<span class="lv-none">证据台地址未探测到（手机同 WiFi 可用 http://本机IP:8771）</span>')
      + '</div></div>';

    $('drawerBody').innerHTML = html;
    $('drawer').classList.add('open');
    $('drawer').setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    $('drawer').classList.remove('open');
    $('drawer').setAttribute('aria-hidden', 'true');
    curFocus = null;
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

  var reportPicked = false;   // 用户点过某一期，就别再每 30 秒把阅读位置顶掉

  function renderReports(d) {
    var list = d.reports || [];
    if (!list.length) {
      $('reportList').innerHTML = '<span class="small">还没有简报产出。</span>';
      if (!reportPicked) $('reportBody').innerHTML = '<div class="lv-none">没有简报文件。</div>';
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
      reportPicked = true;
      fetch('/api/report?name=' + encodeURIComponent(b.getAttribute('data-report')))
        .then(function (r) { return r.json(); })
        .then(function (j) {
          $('reportBody').innerHTML = note + (j.ok ? md2html(j.text) : '<div class="lv-none">读取失败</div>');
        })
        .catch(function () { $('reportBody').innerHTML = '<div class="lv-none">读取失败</div>'; });
    };
    // 只在用户没手动翻过的时候才自动填充，否则每 30 秒会把正在读的那期顶掉
    if (!reportPicked) {
      $('reportBody').innerHTML = note + (d.latest_report ? md2html(d.latest_report) : '<div class="lv-none">没有简报正文。</div>');
    }
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
    renderIssues(d.rooms, d);
    renderRooms(d.rooms, d);
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

  var reqSeq = 0;

  function load() {
    var my = ++reqSeq;
    fetch('/api/live', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (my !== reqSeq) return;     // 先发的旧响应后到，直接丢掉，别把页面刷回旧数据
        render(d);
      })
      .catch(function () {
        if (my !== reqSeq) return;
        setStatus(null);
        closeDrawer();                 // 数据没了，抽屉里的旧数字不能留着冒充实时
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
      if (t) {
        // 从异常清单点进来时带上那条描述，抽屉里会高亮它
        openDrawer(t.getAttribute('data-room'), t.getAttribute('data-issue'));
        return;
      }
      if (e.target.id === 'drawerMask' || e.target.id === 'drawerClose') closeDrawer();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });
  });
})();
