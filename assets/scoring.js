/* 单场状态评分计算器 —— 口径对齐《直播人员状态评分与扣分表 v1.1》 */
(function () {
  'use strict';

  // ---------- 规则表（改这里即全局生效） ----------
  var RULES = [
    { key: 'cr',      name: '出镜率不达标',     kind: 'ratio', target: 0.90, step: 0.05, unit: 3,    cap: 25, gran: '每 5 个百分点' },
    { key: 'var',     name: '语音活跃率不达标', kind: 'ratio', target: 0.80, step: 0.05, unit: 2.5,  cap: 20, gran: '每 5 个百分点' },
    { key: 'away',    name: '离岗',             kind: 'time',  per: 60,     unit: 2,    cap: 20, gran: '每满 60 秒' },
    { key: 'phone',   name: '玩手机',           kind: 'count', per: 1,      unit: 3,    cap: 15, gran: '每次' },
    { key: 'lie',     name: '趴桌',             kind: 'count', per: 1,      unit: 10,   cap: 30, gran: '每次' },
    { key: 'silence', name: '静音超时',         kind: 'time',  per: 5,      unit: 2,    cap: 10, gran: '每满 5 分钟' },
    { key: 'eat',     name: '进食等无关行为',   kind: 'count', per: 1,      unit: 2,    cap: 8,  gran: '每次' }
  ];

  var LEVELS = [
    { min: 90, key: 'A', label: 'A 级', note: '达标' },
    { min: 80, key: 'B', label: 'B 级', note: '合格' },
    { min: 70, key: 'C', label: 'C 级', note: '需提醒' },
    { min: -1, key: 'D', label: 'D 级', note: '不合格' }
  ];
  var ORDER = ['A', 'B', 'C', 'D'];

  var $ = function (id) { return document.getElementById(id); };
  var num = function (id) { var v = parseFloat(($(id) || {}).value); return isNaN(v) ? 0 : v; };
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var steps = function (shortfall, step) {
    if (shortfall <= 1e-9) return 0;
    return Math.ceil(shortfall / step - 1e-9);
  };

  function compute() {
    var live = num('liveSec'), face = num('faceSec'), voice = num('voiceSec');
    var cr = live > 0 ? clamp(face / live, 0, 1) : 0;
    var va = live > 0 ? clamp(voice / live, 0, 1) : 0;
    var raw = {
      cr: cr, var: va,
      away: num('awaySec'), phone: num('phoneCnt'), lie: num('lieCnt'),
      silence: num('silenceMin'), eat: num('eatCnt')
    };

    var rows = RULES.map(function (r) {
      var measure = 0, deduct = 0;
      if (r.kind === 'ratio') {
        measure = steps(r.target - raw[r.key], r.step);
        deduct = measure * r.unit;
      } else if (r.kind === 'time') {
        measure = Math.floor(raw[r.key] / r.per + 1e-9);
        deduct = measure * r.unit;
      } else {
        measure = Math.floor(raw[r.key] + 1e-9);
        deduct = measure * r.unit;
      }
      deduct = clamp(deduct, 0, r.cap);
      return { rule: r, measure: measure, deduct: deduct, extra: r.kind === 'ratio' ? '' : r.gran };
    });

    var total = rows.reduce(function (s, x) { return s + x.deduct; }, 0);
    var score = clamp(100 - total, 0, 100);

    var rawLevel = LEVELS.find(function (l) { return score >= l.min; }).key;
    var level = rawLevel, reason = '';

    var proxy = ($('proxy') ? $('proxy').value : '0') === '1';
    if (proxy) {
      level = 'D';
      reason = '本场标记为代播或播放录播：不计分、直接判 D，转人工核查，待核期间不计入绩效。';
    } else if (va < 0.70) {
      level = 'D';
      reason = '语音活跃率 ' + (va * 100).toFixed(1) + '%，低于 70%，直接判 D，按未有效讲解处理。';
    } else if (cr < 0.50) {
      level = 'D';
      reason = '出镜率 ' + (cr * 100).toFixed(1) + '%，低于 50%，直接判 D。';
    } else if (va < 0.80) {
      if (ORDER.indexOf(rawLevel) > ORDER.indexOf('C')) {
        level = 'C';
        reason = '语音活跃率 ' + (va * 100).toFixed(1) + '%，低于 80% 硬门槛，等级封顶 C（总分 ' + score.toFixed(1) + '，按 C 计）。';
      } else {
        reason = '语音活跃率低于 80% 硬门槛，但总分未达 B 级，等级仍按 ' + rawLevel + ' 计。';
      }
    } else if (score >= 90) {
      reason = '各项指标达标，可作为标杆场次。';
    } else if (score >= 80) {
      reason = '整体合格，重点看扣分集中项，下场针对性提醒。';
    } else if (score >= 70) {
      reason = '触发提醒线：单场约谈，明确下一场硬指标。';
    } else {
      reason = '低于 70 分，判 D。连续两场 D 级启动管理干预。';
    }

    return { cr: cr, va: va, rows: rows, total: total, score: score, level: level, rawLevel: rawLevel, reason: reason };
  }

  function render() {
    var r = compute();

    $('score').textContent = r.score.toFixed(1);
    var lv = $('level');
    lv.textContent = r.level + ' 级' + (r.level !== r.rawLevel ? '（封顶）' : '');
    lv.className = 'lv lv-' + r.level;
    $('note').textContent = r.reason;

    $('crVal').textContent = (r.cr * 100).toFixed(1) + '%';
    $('varVal').textContent = (r.va * 100).toFixed(1) + '%';
    $('crBadge').innerHTML = r.cr >= 0.90 ? '<span class="badge a">达标</span>'
      : (r.cr < 0.50 ? '<span class="badge d">不达标 · 判 D</span>' : '<span class="badge c">不达标</span>');
    $('varBadge').innerHTML = r.va >= 0.80 ? '<span class="badge a">达标</span>'
      : (r.va < 0.70 ? '<span class="badge d">不达标 · 判 D</span>' : '<span class="badge c">不达标 · 封顶 C</span>');

    var tb = $('deductTable').querySelector('tbody');
    tb.innerHTML = r.rows.map(function (x) {
      var unitTxt = x.rule.kind === 'ratio' ? (x.measure ? x.measure + ' 档' : '0 档') : (x.measure ? x.measure + ' 次' : '0 次');
      if (x.rule.key === 'away') unitTxt = x.measure ? x.measure + ' 分钟' : '0';
      if (x.rule.key === 'silence') unitTxt = x.measure ? x.measure + ' 档（5 分钟）' : '0';
      return '<tr><td>' + x.rule.name + '</td><td class="num">' + unitTxt + '</td><td class="num">'
        + (x.deduct ? '−' + x.deduct.toFixed(1) : '0') + '</td><td class="num">' + x.rule.cap + '</td></tr>';
    }).join('') + '<tr style="background:#F8FAFC;font-weight:600"><td>扣分合计</td><td></td><td class="num">−' + r.total.toFixed(1) + '</td><td></td></tr>';

    $('_state').value = JSON.stringify({ cr: r.cr, va: r.va, score: r.score, level: r.level });
  }

  // ---------- 台账 ----------
  var KEY = 'ls_score_log_v1';

  function loadLog() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function saveLog(list) { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200))); }

  function renderLog() {
    var list = loadLog();
    var tb = $('logTable').querySelector('tbody');
    $('logEmpty').classList.toggle('hide', list.length > 0);
    $('logTable').classList.toggle('hide', list.length === 0);
    tb.innerHTML = list.map(function (it, i) {
      return '<tr><td class="small">' + it.time + '</td><td>' + (it.room || '—') + '</td>'
        + '<td class="num">' + (it.cr * 100).toFixed(0) + '%</td>'
        + '<td class="num">' + (it.va * 100).toFixed(0) + '%</td>'
        + '<td class="num">' + it.score.toFixed(1) + '</td>'
        + '<td><span class="badge ' + it.level.toLowerCase() + '">' + it.level + '</span></td>'
        + '<td class="small"><a href="#" data-del="' + i + '">删除</a></td></tr>';
    }).join('');
  }

  function addLog() {
    var r = compute();
    var room = ($('room').value || '').trim();
    var d = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var time = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    var list = loadLog();
    list.unshift({
      time: time, room: room, cr: r.cr, va: r.va, score: r.score, level: r.level,
      detail: r.rows.map(function (x) { return x.rule.name + ':' + x.deduct; }).join(';')
    });
    saveLog(list);
    renderLog();
    var btn = $('btnSave');
    var old = btn.textContent;
    btn.textContent = '已保存 ✓';
    setTimeout(function () { btn.textContent = old; }, 1400);
  }

  function exportCsv() {
    var list = loadLog();
    if (!list.length) { alert('台账还是空的，先保存一场。'); return; }
    var head = ['时间', '场次', '出镜率', '语音活跃率', '得分', '等级', '扣分明细'];
    var lines = [head.join(',')].concat(list.map(function (it) {
      return [it.time, '"' + (it.room || '') + '"', (it.cr * 100).toFixed(1) + '%',
        (it.va * 100).toFixed(1) + '%', it.score.toFixed(1), it.level, '"' + (it.detail || '') + '"'].join(',');
    }));
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '直播状态评分台账_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- 规则表渲染 ----------
  function renderRules() {
    var tb = $('ruleTable').querySelector('tbody');
    tb.innerHTML = RULES.map(function (r) {
      var gran = r.kind === 'ratio' ? r.gran : (r.key === 'away' ? '每满 60 秒' : r.gran);
      return '<tr><td>' + r.name + '</td><td class="num small">' + gran + '</td>'
        + '<td class="num">' + r.unit + '</td><td class="num">' + r.cap + '</td></tr>';
    }).join('') + '<tr><td>代播或播放录播</td><td class="small">不计分</td><td class="num">—</td><td class="num">直接判 D</td></tr>';
  }

  // ---------- 事件 ----------
  document.addEventListener('DOMContentLoaded', function () {
    // 隐藏状态位（保存时读取）
    var hidden = document.createElement('input');
    hidden.type = 'hidden'; hidden.id = '_state';
    document.body.appendChild(hidden);

    renderRules();
    renderLog();
    render();

    ['liveSec', 'faceSec', 'voiceSec', 'awaySec', 'phoneCnt', 'lieCnt', 'silenceMin', 'eatCnt', 'proxy']
      .forEach(function (id) {
        var el = $(id);
        if (el) el.addEventListener('input', render);
        if (el) el.addEventListener('change', render);
      });

    $('btnSave').addEventListener('click', addLog);
    $('btnCsv').addEventListener('click', exportCsv);
    $('btnClearLog').addEventListener('click', function () {
      if (confirm('清空本机台账？此操作不可恢复。')) { saveLog([]); renderLog(); }
    });
    $('logTable').addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-del') !== null) {
        e.preventDefault();
        var i = parseInt(t.getAttribute('data-del'), 10);
        var list = loadLog();
        list.splice(i, 1);
        saveLog(list);
        renderLog();
      }
    });

    $('btnReset').addEventListener('click', function () {
      ['liveSec', 'faceSec', 'voiceSec', 'awaySec', 'phoneCnt', 'lieCnt', 'silenceMin', 'eatCnt'].forEach(function (id) {
        $(id).value = 0;
      });
      $('room').value = '';
      $('proxy').value = '0';
      render();
    });

    $('btnSample').addEventListener('click', function () {
      $('room').value = '示例场 · 煲珠公 晚场';
      $('liveSec').value = 7200; $('faceSec').value = 6480; $('voiceSec').value = 3960;
      $('awaySec').value = 300; $('phoneCnt').value = 2; $('lieCnt').value = 0;
      $('silenceMin').value = 12; $('eatCnt').value = 0; $('proxy').value = '0';
      render();
    });
  });
})();
