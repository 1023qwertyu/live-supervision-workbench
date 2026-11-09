/* 实时监看页 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LV = { A: 'a', B: 'b', C: 'c', D: 'd' };

  function ago(sec) {
    if (sec === null || sec === undefined) return '未知';
    if (sec < 60) return sec + ' 秒前';
    if (sec < 3600) return Math.round(sec / 60) + ' 分钟前';
    return Math.round(sec / 3600) + ' 小时前';
  }

  function md2html(md) {
    var lines = md.split(/\r?\n/);
    var out = [];
    lines.forEach(function (ln) {
      var t = ln.trim();
      if (!t) { return; }
      var b = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      if (/^### /.test(t)) out.push('<h3>' + b.slice(4) + '</h3>');
      else if (/^## /.test(t)) out.push('<h3>' + b.slice(3) + '</h3>');
      else if (/^# /.test(t)) out.push('<h2 style="margin-top:0">' + b.slice(2) + '</h2>');
      else if (/^[-*] /.test(t)) out.push('<div style="padding-left:14px;text-indent:-10px">· ' + b.slice(2) + '</div>');
      else out.push('<p style="margin:6px 0">' + b + '</p>');
    });
    return out.join('');
  }

  function renderRooms(rooms) {
    var keys = Object.keys(rooms || {});
    if (!keys.length) {
      $('roomGrid').innerHTML = '<div class="card" style="flex:1 1 100%"><div class="empty">当前没有直播间数据。可能是汇报器刚重启，或这段时间没有在播房间。</div></div>';
      return;
    }
    keys.sort(function (a, b) {
      var order = { D: 0, C: 1, B: 2, A: 3 };
      var la = order[(rooms[a].level || 'D')], lb = order[(rooms[b].level || 'D')];
      if (la !== lb) return la - lb;
      return (rooms[a].score || 0) - (rooms[b].score || 0);
    });
    $('roomGrid').innerHTML = keys.map(function (k) {
      var r = rooms[k] || {};
      var lv = (r.level || 'D').toUpperCase();
      var cr = r.cr === undefined ? null : r.cr * 100;
      var va = r.var === undefined ? null : r.var * 100;
      return '<div class="card stat" style="flex:1 1 260px;max-width:340px;min-width:240px">'
        + '<div class="row"><span style="font-weight:600;font-size:14.5px">' + k + '</span>'
        + '<span class="badge ' + (LV[lv] || 'd') + '" style="margin-left:auto">' + lv + ' 级</span></div>'
        + '<div class="val">' + (r.score === undefined ? '—' : Number(r.score).toFixed(1)) + '<small>分</small></div>'
        + '<table class="tbl" style="margin-top:10px;font-size:12.6px"><tbody>'
        + '<tr><td style="color:#6B8199;padding-left:0">出镜率</td><td class="num" style="padding-right:0">' + (cr === null ? '—' : cr.toFixed(1) + '%') + '</td></tr>'
        + '<tr><td style="color:#6B8199;padding-left:0">语音活跃率</td><td class="num" style="padding-right:0">' + (va === null ? '—' : va.toFixed(1) + '%') + '</td></tr>'
        + '<tr><td style="color:#6B8199;padding-left:0">异常事件</td><td class="num" style="padding-right:0">' + (r.events === undefined ? '—' : r.events) + ' 条</td></tr>'
        + '<tr><td style="color:#6B8199;padding-left:0">监看时长</td><td class="num" style="padding-right:0">' + (r.video_sec === undefined ? '—' : Math.round(r.video_sec) + ' 秒') + '</td></tr>'
        + '</tbody></table></div>';
    }).join('');
  }

  function renderSource(d) {
    var rows = [
      ['数据目录', '<span class="small">' + (d.periodic_dir || '—') + '</span>'],
      ['最新数据时间', (d.generated_at || '无') + '（' + ago(d.age_seconds) + '）'],
      ['统计窗口', (d.window_minutes || '—') + ' 分钟'],
      ['心跳文件', d.heartbeat ? '有（' + (d.heartbeat.ts || d.heartbeat.time || '已写入') + '）' : '未找到'],
      ['简报期数', (d.reports || []).length + ' 期'],
      ['服务端时间', d.server_time || '—']
    ];
    $('sourceTable').innerHTML = rows.map(function (r) {
      return '<tr><td style="width:38%;color:#6B8199">' + r[0] + '</td><td>' + r[1] + '</td></tr>';
    }).join('');
  }

  function renderReports(d, current) {
    var list = d.reports || [];
    if (!list.length) {
      $('reportList').innerHTML = '<span class="small">还没有简报产出。</span>';
      $('reportBody').innerHTML = '<div class="empty">没有简报文件。</div>';
      return;
    }
    $('reportList').innerHTML = list.slice(0, 8).map(function (r) {
      var m = r.name.match(/report_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
      var label = m ? (m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5]) : r.name;
      var on = current && r.name === current;
      return '<button class="btn sm" data-report="' + r.name + '" style="' + (on ? 'background:#E8F1FB;border-color:#BBD8F2;color:#1565C0' : '') + '">' + label + '</button>';
    }).join('');

    $('reportList').onclick = function (e) {
      var b = e.target.closest('[data-report]');
      if (!b) return;
      var name = b.getAttribute('data-report');
      $('reportList').querySelectorAll('[data-report]').forEach(function (x) {
        x.style.background = ''; x.style.borderColor = ''; x.style.color = '';
      });
      b.style.background = '#E8F1FB'; b.style.borderColor = '#BBD8F2'; b.style.color = '#1565C0';
      fetch('/api/report?name=' + encodeURIComponent(name))
        .then(function (r) { return r.json(); })
        .then(function (j) {
          $('reportBody').innerHTML = j.ok ? md2html(j.text) : '<div class="empty">读取失败：' + (j.error || '未知错误') + '</div>';
        })
        .catch(function () { $('reportBody').innerHTML = '<div class="empty">读取失败。</div>'; });
    };

    $('reportBody').innerHTML = d.latest_report ? md2html(d.latest_report) : '<div class="empty">没有简报正文。</div>';
  }

  function setStatus(d) {
    var b = $('statusBadge');
    if (!d) { b.className = 'badge d'; b.textContent = '读不到数据'; return; }
    if (!d.ok) { b.className = 'badge d'; b.textContent = '无数据文件'; return; }
    if (d.stale) { b.className = 'badge c'; b.textContent = '数据已过期 · ' + ago(d.age_seconds); }
    else { b.className = 'badge live'; b.textContent = '监看中 · ' + ago(d.age_seconds); }
  }

  function renderAlert(d) {
    if (!d) {
      $('alertBox').innerHTML = '<div class="card" style="margin-bottom:16px;border-color:#F3C6C2;background:#FDECEA">'
        + '<div class="card-b" style="font-size:13.4px"><b style="color:#C62828">拿不到实时数据。</b>'
        + '这个页面需要通过本地服务打开，请在工作台目录运行：<br>'
        + '<code style="background:#fff;padding:2px 6px;border-radius:5px;border:1px solid #F3C6C2">python serve.py</code>'
        + '　然后访问 <code style="background:#fff;padding:2px 6px;border-radius:5px;border:1px solid #F3C6C2">http://127.0.0.1:8787/live.html</code>'
        + '</div></div>';
      return;
    }
    if (d.stale) {
      $('alertBox').innerHTML = '<div class="card" style="margin-bottom:16px;border-color:#EFD5A9;background:#FDF3E3">'
        + '<div class="card-b" style="font-size:13.4px"><b style="color:#A96500">数据超过 40 分钟没更新。</b>'
        + '汇报器可能已停止，请检查 LiveVision 的 reporter.py；下面显示的是最后一次写入的数据，不是实时状态。</div></div>';
      return;
    }
    $('alertBox').innerHTML = '';
  }

  function load() {
    fetch('/api/live', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        setStatus(d);
        renderAlert(d);
        renderRooms(d.rooms);
        renderSource(d);
        renderReports(d, null);
      })
      .catch(function () {
        setStatus(null);
        renderAlert(null);
        $('roomGrid').innerHTML = '';
        $('sourceTable').innerHTML = '<tr><td>需要通过 serve.py 打开</td></tr>';
        $('reportList').innerHTML = '';
        $('reportBody').innerHTML = '<div class="empty">需要通过 serve.py 打开。</div>';
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    load();
    $('btnRefresh').addEventListener('click', load);
    setInterval(load, 30000);
  });
})();
