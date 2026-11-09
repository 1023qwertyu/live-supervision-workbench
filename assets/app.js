/* 工作台通用脚本：页内搜索、目录联动、侧栏高亮 */
(function () {
  'use strict';

  // ---------- 页内搜索 ----------
  var doc = document.getElementById('doc');
  var input = document.getElementById('q');
  var hits = document.getElementById('hits');
  var original = null;
  var marks = [];
  var cursor = -1;

  function clearMarks() {
    if (original !== null) return;
  }

  function doSearch(term) {
    if (!doc) return;
    if (original === null) original = doc.innerHTML;
    // 还原
    doc.innerHTML = original;
    marks = [];
    cursor = -1;
    if (!term || term.trim().length === 0) {
      if (hits) hits.textContent = '';
      return;
    }
    var t = term.trim();
    var walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'MARK') return NodeFilter.FILTER_REJECT;
        return node.nodeValue.indexOf(t) >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(function (node) {
      var text = node.nodeValue;
      var frag = document.createDocumentFragment();
      var pos = 0, idx;
      while ((idx = text.indexOf(t, pos)) >= 0) {
        if (idx > pos) frag.appendChild(document.createTextNode(text.slice(pos, idx)));
        var mk = document.createElement('mark');
        mk.textContent = t;
        frag.appendChild(mk);
        marks.push(mk);
        pos = idx + t.length;
      }
      if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
      node.parentNode.replaceChild(frag, node);
    });

    if (hits) hits.textContent = marks.length ? ('0 / ' + marks.length) : '无结果';
    if (marks.length) goto(0);
  }

  function goto(i) {
    if (!marks.length) return;
    if (cursor >= 0 && marks[cursor]) marks[cursor].classList.remove('on');
    cursor = (i + marks.length) % marks.length;
    var mk = marks[cursor];
    mk.classList.add('on');
    mk.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (hits) hits.textContent = (cursor + 1) + ' / ' + marks.length;
  }

  if (input) {
    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var v = input.value;
      timer = setTimeout(function () { doSearch(v); }, 220);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); goto(cursor + (e.shiftKey ? -1 : 1)); }
      if (e.key === 'Escape') { input.value = ''; doSearch(''); }
    });
    var pv = document.getElementById('prevHit');
    var nx = document.getElementById('nextHit');
    if (pv) pv.addEventListener('click', function () { goto(cursor - 1); });
    if (nx) nx.addEventListener('click', function () { goto(cursor + 1); });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); input.focus(); input.select(); }
    });
    // 支持 /system.html?q=关键词
    var q0 = new URLSearchParams(location.search).get('q');
    if (q0) { input.value = q0; doSearch(q0); }
  }

  // ---------- 目录联动 ----------
  var rail = document.querySelector('.toc-rail');
  if (rail && doc) {
    var links = Array.prototype.slice.call(rail.querySelectorAll('a'));
    var targets = links.map(function (a) {
      var id = decodeURIComponent(a.getAttribute('href').slice(1));
      return document.getElementById(id);
    }).filter(Boolean);

    function onScroll() {
      var y = window.scrollY + 120;
      var current = null;
      for (var i = 0; i < targets.length; i++) {
        if (targets[i].offsetTop <= y) current = targets[i];
      }
      links.forEach(function (a) {
        var on = current && a.getAttribute('href').slice(1) === current.id;
        a.classList.toggle('on', !!on);
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---------- 通用：数字格式化 ----------
  window.fmt = function (n, d) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toFixed(d === undefined ? 1 : d);
  };
})();
