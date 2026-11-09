/* 核对清单数据与交互 */
window.CHECK_DATA = [
  {
    id: 't30', no: 'A', title: '开播前 30 秒 · 三步核对，缺一步不开播',
    sub: '独立直播间 · 绿幕场景。对应《个人手册》附录六（五）与《开播前30秒核对卡》V1.0。',
    groups: [
      {
        title: '01 门 · 关好了吗',
        items: [
          { t: '门已关闭并上锁', s: '门常闭；钥匙在当班人手上' },
          { t: '门外红灯已亮（正在推流）', s: '红灯是给外面人看的，不亮等于没设防' },
          { t: '传递窗已关闭', s: '窗口位置在取景框之外' }
        ]
      },
      {
        title: '02 画面 · 只有白名单',
        items: [
          { t: '主播本人', s: '六类白名单之一' },
          { t: '绿幕与已审定背景', s: '无褶皱、无影子、无穿帮' },
          { t: '商品实物', s: '本场要讲的东西已经在手边' },
          { t: '固定道具 / 已过审素材', s: '素材按本场清单，未过审不上' },
          { t: '无连线、无投屏、无屏幕共享', s: '投屏与共享已断开' }
        ]
      },
      {
        title: '03 留痕 · 报过了吗',
        items: [
          { t: '群里已报「本场画面源：主播＋商品＋素材 X」', s: '一句话，运营督导能看到' },
          { t: '关键帧工具已启动', s: '开播、每小时、切素材、下播前各截一张' }
        ]
      }
    ],
    foot: '关键帧必须截<b>合成后</b>的画面。录到绿幕原片，等于没有证据。'
  },
  {
    id: 't60', no: 'B', title: '开播前 60 秒 · 最后四件事',
    sub: '对应《个人手册》附录五「最后一步：开播前 60 秒」。',
    groups: [
      {
        title: '',
        items: [
          { t: '附录三「十分钟自查清单」十项全打勾', s: '没打完不开播' },
          { t: '妆容与着装复查一遍', s: '补一次口红与控油' },
          { t: '主推券三句话在嘴里过一遍', s: '原价、团购价、有效期' },
          { t: '看一眼评论区，先回一句开场', s: '有人等就先接住' }
        ]
      }
    ],
    foot: '这一步只花 60 秒，但能挡掉当天最常见的三类翻车：妆容、口径、冷场。'
  },
  {
    id: 'morning', no: 'C', title: '早班到岗 30 分钟核清单',
    sub: '对应《个人手册》附录五。早班没有上一场状态可接，全靠这 30 分钟把信息、货盘、设备、画面拉起来。',
    groups: [
      {
        title: '第一段 · 0–5 分钟：签到与交接',
        items: [
          { t: '签到，确认今日排班与直播账号', s: '账号、时段、门店与排班表一致' },
          { t: '打开工作群，看前一晚的通知并置顶保存', s: '找到券面、价格、时段、活动的官方口径' },
          { t: '翻前一日遗留事项', s: '券库存异常、核销卡单、未闭环投诉，逐条有结论' },
          { t: '确认今日主推券与限量数', s: '与通知一致，且知道先讲哪一支' }
        ]
      },
      {
        title: '第二段 · 5–10 分钟：货盘核对（逐支过）',
        items: [
          { t: '今日在售券清单，逐支点开', s: '券种数量与通知一致，没有多也没有少' },
          { t: '每支券的品项、份量、适合人数', s: '与券面文字逐字一致' },
          { t: '原价与团购价', s: '与门店收银系统一致，两边价差为 0' },
          { t: '有效期、可用时段、是否需预约', s: '与通知一致，能一口说出到期日' },
          { t: '限购数与券库存份数', s: '后台库存可支撑今日预计销量' },
          { t: '昨日下架的券是否已下架', s: '链接点开显示已下架或售罄' },
          { t: '今日新增或改价的券', s: '已生效，且已拿到新的口播口径' },
          { t: '实物库存与备货', s: '主推券对应菜品原料够今日量，缺货提前报' }
        ]
      },
      {
        title: '第三段 · 10–18 分钟：设备核对',
        items: [
          { t: '直播手机或相机', s: '镜头擦净无指纹，电量 80% 以上或已插电，存储空间充足' },
          { t: '麦克风', s: '试录 15 秒回放，无电流声、无回声、人声清楚' },
          { t: '补光灯', s: '亮度色温合适，画面不过曝，眼镜与菜品不反光' },
          { t: '支架与线材', s: '稳固不晃，线不外露、不绊人' },
          { t: '网络', s: '主 Wi-Fi 与备用 4G/5G 都通，切换一次确认能续播' },
          { t: '核销设备', s: '开机试扫一张测试券，能验、能显示品项，测试券当日归还' },
          { t: '备用物资', s: '充电宝、备用机、备用麦克风电池到位' }
        ]
      },
      {
        title: '第四段 · 18–25 分钟：四类画面（录 30 秒回放再看）',
        items: [
          { t: '主播画面', s: '取景胸部以上、居中、头部留白合适；妆容完成、发不遮脸、工牌可见', bad: '头顶切掉、画面偏斜、脸偏黄或过曝' },
          { t: '商品画面', s: '菜品用托盘端出、标签朝外、份量能对比；展示位在镜头中央', bad: '菜品堆叠杂乱、标签反着、看不出份量' },
          { t: '门店画面', s: '台面干净、桌椅整齐、后厨门关闭、垃圾桶移出画面、旧价签撤掉', bad: '台面有水渍、后厨敞开、垃圾桶入镜' },
          { t: '环境画面', s: '无顾客正脸、无员工私物、无外卖盒、无竞品物料', bad: '有顾客正脸、有拖把清洁剂、有竞品包装' },
          { t: '边缘再看一眼', s: '画面四角、背景墙、地面。出问题的地方几乎都在边角，不在正中间', bad: '角落堆货、地面电线、背景墙贴纸' }
        ]
      },
      {
        title: '第五段 · 25–30 分钟：对着昨晚通知核四类信息',
        items: [
          { t: '价格', s: '原价、团购价、限购数、是否含服务费', bad: '不一致就停：不改价、不口播，报运营督导' },
          { t: '时段', s: '可用时段、不可用日期、是否需预约、提前多久', bad: '停，按通知口径讲，不按自己记忆讲' },
          { t: '券面', s: '品项、份量、适合人数、能否打包、能否叠加', bad: '停，以券面为准，通知与券面冲突即刻上报' },
          { t: '活动', s: '今日是否有临时活动、加赠、限量、专场', bad: '有则按通知补进口播，无则绝不自己加' }
        ]
      }
    ],
    foot: '发现不一致只做三件事：<b>停</b>（不按旧口径开播）、<b>报</b>（截图发运营督导，说明哪项不符）、<b>留证</b>（通知截图与券面截图都存下）。三件事做完等回复，不自己拍板。'
  },
  {
    id: 'green', no: 'D', title: '绿幕场景条件自检（每场一次）',
    sub: '对应《个人手册》附录六（四）。条件不满足不是"注意点"，是直接停播项。',
    groups: [
      {
        title: '',
        items: [
          { t: '房间独立性', s: '实体墙＋可关闭的门，不是帘子隔断', bad: '声音、反光、人员进出都控不住' },
          { t: '绿幕覆盖', s: '取景范围内不露墙体、门缝、地面接缝', bad: '门外走动会从边缘露出来' },
          { t: '布光均匀', s: '左右 45° 双灯＋顶部补光，色温统一 5600K', bad: '抠像边缘闪烁，一动就毛边' },
          { t: '站位距离', s: '主播离绿幕 1.5 米以上，地面贴 U 型定位', bad: '绿光反射到脸和头发，抠完发绿' },
          { t: '服装颜色', s: '禁止绿、青绿、黄绿系；避免亮片镜面', bad: '衣服被抠出"透明洞"、边缘发虚' },
          { t: '半透物体', s: '玻璃杯、蒸汽、烟雾单独处理或改机位', bad: '抠像带出一片绿，无法修补' },
          { t: '录制图层', s: '录制走合成后输出', bad: '留痕无效，关键帧是绿幕原片' },
          { t: '网络', s: '直播独立带宽，不与收银、监控共用', bad: '断流、掉帧，关键帧时间对不上' }
        ]
      }
    ],
    foot: '这一页的检查项，任何一项不满足都要先停下来解决；解决不了就报运营督导，不要带着问题开播。'
  }
];

(function () {
  'use strict';
  var KEY = 'ls_check_v1';
  var today = new Date().toISOString().slice(0, 10);

  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || '{}');
      return o.date === today ? o.checked || {} : {};
    } catch (e) { return {}; }
  }
  function save(checked) {
    localStorage.setItem(KEY, JSON.stringify({ date: today, checked: checked }));
  }

  var checked = load();

  function render() {
    var host = document.getElementById('blocks');
    host.innerHTML = window.CHECK_DATA.map(function (block) {
      var total = 0, done = 0;
      var groups = block.groups.map(function (g) {
        var items = g.items.map(function (it, i) {
          total++;
          var id = block.id + '-' + total;
          var on = !!checked[id];
          if (on) done++;
          return '<label class="ck' + (on ? ' done' : '') + '" data-id="' + id + '">'
            + '<input type="checkbox" ' + (on ? 'checked' : '') + '>'
            + '<span><b style="font-weight:600">' + it.t + '</b>'
            + '<span class="std">' + it.s + (it.bad ? '　·　不合格表现：' + it.bad : '') + '</span></span></label>';
        }).join('');
        return (g.title ? '<div style="margin:18px 0 8px;font-size:13px;font-weight:650;color:#33475B">' + g.title + '</div>' : '')
          + '<div class="checklist">' + items + '</div>';
      }).join('');

      var pct = total ? Math.round(done / total * 100) : 0;
      return '<section class="card" style="margin-bottom:16px" id="blk-' + block.id + '">'
        + '<div class="card-h"><div class="row"><h3>' + block.no + '　' + block.title + '</h3>'
        + '<span class="badge ' + (done === total ? 'a' : '') + '" data-badge="' + block.id + '">' + done + ' / ' + total + '</span></div>'
        + '<p>' + block.sub + '</p>'
        + '<div class="bar' + (done === total ? ' ok' : '') + '" style="margin-top:12px" data-bar="' + block.id + '"><i style="width:' + pct + '%"></i></div>'
        + '</div><div class="card-b" style="padding-top:4px">' + groups
        + '<div class="callout ' + (block.id === 't30' || block.id === 'green' ? 'warn' : 'key') + '" style="margin-top:18px;font-size:13px">' + block.foot + '</div>'
        + '</div></section>';
    }).join('');
    host.querySelectorAll('.ck').forEach(function (el) {
      el.querySelector('input').addEventListener('change', function (e) {
        var id = el.getAttribute('data-id');
        if (e.target.checked) checked[id] = 1; else delete checked[id];
        el.classList.toggle('done', e.target.checked);
        save(checked);
        updateCounters();
      });
    });
    updateCounters();
  }

  function updateCounters() {
    var all = 0, done = 0;
    window.CHECK_DATA.forEach(function (b) {
      var total = 0, d = 0;
      b.groups.forEach(function (g, gi) { g.items.forEach(function () { total++; }); });
      // 重新按 DOM 统计
      var sec = document.getElementById('blk-' + b.id);
      if (sec) {
        var inputs = sec.querySelectorAll('.ck input');
        total = inputs.length;
        inputs.forEach(function (i) { if (i.checked) d++; });
        var badge = sec.querySelector('[data-badge]');
        if (badge) {
          badge.textContent = d + ' / ' + total;
          badge.className = 'badge ' + (d === total ? 'a' : '');
        }
        var bar = sec.querySelector('[data-bar]');
        if (bar) {
          bar.classList.toggle('ok', d === total);
          bar.querySelector('i').style.width = Math.round(d / total * 100) + '%';
        }
      }
      all += total; done += d;
    });
    var pct = all ? Math.round(done / all * 100) : 0;
    var st = document.getElementById('sideStat');
    if (st) {
      st.innerHTML = '<div class="val">' + done + '<small>/ ' + all + '</small></div>'
        + '<div class="bar' + (done === all ? ' ok' : '') + '" style="margin-top:10px"><i style="width:' + pct + '%"></i></div>'
        + '<div class="sub">' + (done === all ? '全部通过，可以开播。' : '还有 ' + (all - done) + ' 项没打勾。') + '</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    render();
    document.getElementById('btnResetCheck').addEventListener('click', function () {
      if (!confirm('清空今天的全部勾选？')) return;
      checked = {};
      save(checked);
      render();
    });
    var d = document.getElementById('todayLabel');
    if (d) d.textContent = today;
  });
})();
