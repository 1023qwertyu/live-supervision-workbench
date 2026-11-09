/* 总览页：实时概览 + 全库搜索 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  // ---------- 实时概览 ----------
  function ago(sec) {
    if (sec === null || sec === undefined) return '未知';
    if (sec < 60) return sec + ' 秒';
    if (sec < 3600) return Math.round(sec / 60) + ' 分钟';
    return Math.round(sec / 3600) + ' 小时';
  }

  function loadLive() {
    fetch('/api/live', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var rooms = d.rooms || {};
        var keys = Object.keys(rooms);
        $('kRooms').textContent = keys.length || '0';
        $('kRoomsSub').textContent = keys.length ? keys.join(' · ') : '当前没有在监房间';

        if (keys.length) {
          var worst = keys.map(function (k) { return rooms[k]; })
            .sort(function (a, b) { return (a.score || 0) - (b.score || 0); })[0];
          var lv = (worst.level || '').toUpperCase();
          $('kMin').innerHTML = Number(worst.score || 0).toFixed(1) + '<small>分</small>';
          $('kMinSub').textContent = lv
            ? '等级 ' + lv + (lv === 'A' || lv === 'B' ? '　·　全部达标' : '　·　需要关注')
            : '等级 —';
        } else {
          $('kMin').textContent = '—';
          $('kMinSub').textContent = '无数据';
        }

        $('kAge').textContent = d.ok ? ago(d.age_seconds) : '—';
        $('kAgeSub').textContent = d.stale ? '数据已过期，检查汇报器' : '当前正常';

        var b = $('liveBadge');
        if (!d.ok) { b.className = 'badge d'; b.textContent = '无数据'; }
        else if (d.stale) { b.className = 'badge c'; b.textContent = '数据过期 · ' + ago(d.age_seconds) + '前'; }
        else { b.className = 'badge live'; b.textContent = '监看中'; }
      })
      .catch(function () {
        $('kRooms').textContent = '—';
        $('kRoomsSub').innerHTML = '<a href="live.html">需启动 serve.py</a>';
        $('kMin').textContent = '—';
        $('kMinSub').textContent = '无数据';
        $('kAge').textContent = '—';
        $('kAgeSub').textContent = '未启动本地服务';
        var b = $('liveBadge');
        b.className = 'badge'; b.textContent = '离线（未启动服务）';
      });
  }

  // ---------- 今日核对完成度 ----------
  function loadCheck() {
    try {
      var o = JSON.parse(localStorage.getItem('ls_check_v1') || '{}');
      var today = new Date().toISOString().slice(0, 10);
      if (o.date !== today) { $('kCheck').textContent = '0%'; return; }
      var n = Object.keys(o.checked || {}).length;
      $('kCheck').textContent = n ? n + ' 项' : '0%';
    } catch (e) { $('kCheck').textContent = '0%'; }
  }

  // ---------- 全库搜索 ----------
  var INDEX = null;
  var loading = false;

  function loadIndex(cb) {
    if (INDEX) return cb();
    if (loading) return;
    loading = true;
    fetch('data/search.json')
      .then(function (r) { return r.json(); })
      .then(function (j) { INDEX = j; cb(); })
      .catch(function () { $('gqCount').textContent = '索引读取失败'; });
  }

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }

  function search(q) {
    var term = q.trim();
    var box = $('gqResult');
    if (!term) { box.innerHTML = ''; $('gqCount').textContent = ''; return; }
    if (!INDEX) return;

    var lower = term.toLowerCase();
    var hits = [];
    INDEX.forEach(function (s) {
      var t = (s.title || '').toLowerCase();
      var b = (s.text || '').toLowerCase();
      var score = 0;
      if (t.indexOf(lower) >= 0) score += 10;
      var idx = b.indexOf(lower);
      if (idx >= 0) score += 1;
      if (score > 0) hits.push({ s: s, score: score, idx: idx });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    hits = hits.slice(0, 10);

    $('gqCount').textContent = hits.length ? (hits.length + ' 条结果') : '无结果';

    if (!hits.length) {
      box.innerHTML = '<div class="empty">没有找到「' + esc(term) + '」。换个词试试，比如「红线」「出镜率」「核销」。</div>';
      return;
    }

    box.innerHTML = hits.map(function (h) {
      var s = h.s;
      var snippet = '';
      if (h.idx >= 0) {
        var start = Math.max(0, h.idx - 30);
        snippet = (start > 0 ? '…' : '') + esc(s.text.slice(start, h.idx + 70)) + '…';
        var re = new RegExp('(' + esc(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        snippet = snippet.replace(re, '<mark>$1</mark>');
      }
      return '<a href="' + s.page + '.html#' + s.anchor + '" style="display:block;padding:11px 12px;border-radius:9px;border:1px solid #EDF2F7;margin-top:8px;text-decoration:none">'
        + '<div class="row" style="gap:8px"><b style="color:#10243A;font-size:13.6px">' + esc(s.title) + '</b>'
        + '<span class="badge" style="margin-left:auto">' + esc(s.pageTitle) + '</span></div>'
        + (snippet ? '<div class="small" style="margin-top:5px;line-height:1.7">' + snippet + '</div>' : '')
        + '</a>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadLive();
    loadCheck();

    var input = $('gq');
    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var v = input.value;
      timer = setTimeout(function () { loadIndex(function () { search(v); }); }, 200);
    });
    input.addEventListener('focus', function () { loadIndex(function () { search(input.value); }); });

    $('btnRefresh').addEventListener('click', loadLive);
    setInterval(loadLive, 60000);

    // 支持 /index.html?q=关键词 直接出结果（方便分享与自测）
    var q0 = new URLSearchParams(location.search).get('q');
    if (q0) {
      input.value = q0;
      loadIndex(function () { search(q0); });
    }
  });
})();
