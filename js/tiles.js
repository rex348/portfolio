/* ==========================================================================
   tiles.js — 倾斜网格（layout:'tiles'）
   参考 React Bits Pro「Tilted Tiles」：A tilted grid of image columns
   that drift as you scroll —— 倾斜的图片列网格，随页面滚动各列以不同速率、
   不同方向漂移，叠加 CSS 的整组 -12° 倾斜，形成「斜向流动」的视差。
   --------------------------------------------------------------------------
   实现要点：
   · 滚动视差：把「区块经过视口的进度 p ∈ [0,1]」换算成每列 translateY，
     监听站点滚动容器 #viewport 的 scroll（rAF 节流），逐帧写入 transform；
   · 自动呼吸：叠加一层极缓的正弦漂移（有界、不累积），网格在没有滚动时
     也保持「活着」的微动；离开视口 / 切走页签 / reduced-motion 时停住；
   · 间距校准：挂载时把「大标题距上方内容」精确校正到 80px（同 carousel.js）。
   ========================================================================== */

PF.tiles = (function () {
  'use strict';

  /* 每列的漂移速率（正 = 随下滚向上漂，负 = 反向）；列数多于数组时循环取用 */
  var SPEEDS = [1, -0.72, 1.18, -0.9, 0.82, -1.1, 1.05, -0.65];
  var MAX_SPEED = 1.2;       /* |SPEEDS| 上限（补齐计算用，改 SPEEDS 时同步） */
  var MAX_TRAVEL = 320;      /* 单列滚动漂移行程上限 px（随区块高度自适应） */
  var BREATH_AMP = 46;       /* 自动呼吸幅度 px（有界往复，不累积位移） */
  var BREATH_SPEED = 0.00042;/* 自动呼吸角速度（越小越慢） */
  var STAGGER_MAX = 170;     /* 列间静态错位幅度上限 px（与 measure 保持一致） */
  var TILT_DEG = 12;         /* 整组倾斜角度（与 tiles.css rotate(-12deg) 保持一致） */
  var GAP = 80;              /* 大标题距上方内容的目标间距 px */
  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var boxes = [];            /* 已组装的网格实例 */
  var bound = false;
  var rafId = null;

  var U = PF.util;

  /* 站点的滚动容器是 #viewport（不是 window），兼容兜底到文档根 */
  function scrollRoot() {
    return document.getElementById('viewport') ||
      document.scrollingElement || document.documentElement;
  }

  /* ---------------------------------------------------------------- 测量 */
  function measure(box) {
    box._cols = Array.prototype.slice.call(box.querySelectorAll('.tiles__col'));
    box._cols.forEach(function (col, i) {
      col._speed = SPEEDS[i % SPEEDS.length];
      /* 列间静态错位：奇偶交替，避免每列初始都对齐中轴（更有节奏感） */
      col._stagger = (i % 2 ? 1 : -1) * Math.min(STAGGER_MAX, box.clientWidth * 0.065);
      col._phase = i * 1.15;                       /* 呼吸相位错开 */
    });
    ensureFill(box);
  }

  /* ------------------------------------------------------------ 内容补齐 */
  /* 保证「任意漂移状态下，视窗四角与四边都被小图铺满，不露背景」：
     视窗（100vw × 区块高）映射进倾斜坐标系后的纵向半径为
       (W/2)·sinθ + (H/2)·cosθ，
     再叠加单列最大位移（滚动行程 × 速率 + 静态错位 + 呼吸幅度）与安全余量，
     得到每列需要的纵向内容高度 → 不足时用本列已有小图克隆补齐（.tile--fill）。
     窗口缩放 / 列宽变化时 measure 会重新执行，先清掉旧补齐再按新尺寸算。 */
  function ensureFill(box) {
    var cols = box._cols || [];
    if (!cols.length) return;
    var tile0 = box.querySelector('.tile');
    if (!tile0) return;

    var gap = parseFloat(getComputedStyle(cols[0]).rowGap) || 0;
    var step = tile0.offsetHeight + gap;           /* 单张步进 = 图高 + 列内间距 */
    if (step <= 0) return;

    var theta = TILT_DEG * Math.PI / 180;
    var w = box.clientWidth, h = box.clientHeight;
    var maxDrift = Math.min(h * 0.3, MAX_TRAVEL) * MAX_SPEED + STAGGER_MAX + BREATH_AMP + 40;
    var need = Math.ceil((w * Math.sin(theta) + h * Math.cos(theta) + maxDrift * 2 + gap) / step);

    cols.forEach(function (col) {
      /* 先清掉上一轮的补齐克隆，回到「基础小图」状态再按新尺寸补 */
      Array.prototype.slice.call(col.querySelectorAll('.tile--fill'))
        .forEach(function (t) { col.removeChild(t); });
      var base = Array.prototype.slice.call(col.children);
      if (!base.length) return;
      var i = 0;
      while (col.children.length < need) {
        var clone = base[i % base.length].cloneNode(true);
        clone.classList.add('tile--fill');
        col.appendChild(clone);
        i++;
      }
    });
  }

  /* ------------------------------------------------------------ 间距校准 */
  /* 「大标题」距上方最近内容块 80px：上一区块的内边距会额外撑开间距，
     这里用实测值把差值抵消掉（挂载时布局稳定、入场动画尚未开始，测量准确） */
  function syncGap(scope) {
    var block = scope.querySelector('.block--tiles');
    if (!block) return;
    var title = block.querySelector('.gallery__title');
    if (!title) return;

    var prev = block.previousElementSibling;
    var content = null;
    while (prev && !content) {
      content = prev.querySelector
        ? prev.querySelector('.gallery__carousel, .media')
        : null;
      prev = prev.previousElementSibling;
    }
    if (!content) return;

    var gap = title.getBoundingClientRect().top - content.getBoundingClientRect().bottom;
    var cur = parseFloat(getComputedStyle(block).marginTop) || 0;
    block.style.marginTop = (cur + (GAP - gap)) + 'px';
  }

  /* ---------------------------------------------------------------- 漂移 */
  /* 滚动进度 p：0 = 区块上缘刚进入视口下沿；1 = 区块下缘完全离开视口上沿。
     y = 滚动视差 + 静态错位 + 自动呼吸（三项相加，逐帧写入 transform） */
  function update(box, t) {
    if (!box._cols || !box._cols.length || box._hidden) return;

    var rect = box.getBoundingClientRect();
    var vh = window.innerHeight;
    var visible = rect.bottom > -120 && rect.top < vh + 120;
    if (!visible) return;                          /* 视口外不结算，省开销 */

    var total = rect.height + vh;
    var p = U.clamp((vh - rect.top) / total, 0, 1);
    var travel = Math.min(rect.height * 0.3, MAX_TRAVEL);
    var breath = REDUCED ? 0 : t * BREATH_SPEED;

    box._cols.forEach(function (col) {
      var auto = Math.sin(breath + col._phase) * BREATH_AMP;
      var y = (0.5 - p) * 2 * travel * col._speed + col._stagger + auto;
      col.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
    });
  }

  function updateAll(t) {
    /* 章节切换后旧节点已脱离文档，顺手清理 */
    for (var i = boxes.length - 1; i >= 0; i--) {
      if (!boxes[i].isConnected) boxes.splice(i, 1);
    }
    for (var j = 0; j < boxes.length; j++) update(boxes[j], t);
  }

  /* 主循环：滚动时由 scroll 事件驱动，静止时用 rAF 维持自动呼吸
     （页面隐藏 / 减少动效时停住，避免无谓消耗） */
  function tick(ts) {
    if (!document.hidden && !REDUCED) updateAll(ts);
    rafId = requestAnimationFrame(tick);
  }

  /* --------------------------------------------------------------- 组装 */
  function setup(box) {
    if (box.dataset.tilesReady === 'true') {
      measure(box);
      update(box, performance.now());
      if (boxes.indexOf(box) < 0) boxes.push(box);
      return;
    }
    box.dataset.tilesReady = 'true';
    measure(box);
    if (boxes.indexOf(box) < 0) boxes.push(box);
    update(box, performance.now());
  }

  /* 事件只绑一次：滚动容器全程存在，不会随章节切换销毁 */
  function bindOnce() {
    if (bound) return;
    bound = true;

    scrollRoot().addEventListener('scroll', U.rafThrottle(function () {
      updateAll(performance.now());
    }), { passive: true });

    window.addEventListener('resize', U.rafThrottle(function () {
      boxes.forEach(function (b) { measure(b); update(b, performance.now()); });
    }), { passive: true });

    if (rafId == null) rafId = requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------ 对外接口 */
  function init() {
    bindOnce();
    document.querySelectorAll('[data-tiles]').forEach(setup);
  }

  /** 章节挂载后调用：组装新网格、结算当前位置、校准标题上方 80px 间距 */
  function sync(rootEl) {
    var scope = rootEl || document;
    scope.querySelectorAll('[data-tiles]').forEach(setup);
    syncGap(scope);
  }

  return { init: init, sync: sync, syncGap: syncGap };
})();
