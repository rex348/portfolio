/* ==========================================================================
   carousel.js — 通栏无限滚动卡片跑马灯（layout:'gallery'）
   参考 React Bits Pro「Hero 4 · Infinite scrolling video carousel marquee」：
   · 匀速连续滚动（requestAnimationFrame 驱动 transform），不是「点一下跳一步」
   · 无缝无限循环：整组卡片复制多份填满轨道，位移按「一整组宽度」取模回绕，
     回绕瞬间画面完全等价，肉眼无断层
   · 悬停暂停 / 离开视口暂停 / 页签隐藏暂停 / prefers-reduced-motion 关闭自动滚动
   · 可按住左右拖拽（搓动）手动浏览，松手后自动恢复匀速滚动
   · 点击卡片在灯箱放大预览（拖拽后不误触发点击）
   · 卡片恒为 1440×900（16:10），object-fit:cover 完美呈现不裁切
   ========================================================================== */

PF.carousel = (function () {
  'use strict';

  var SPEED = 62;            /* 匀速滚动速度 px/s（约 1px/帧，柔和不抢戏） */
  var DRAG_RESUME = 900;     /* 拖拽结束后恢复自动滚动的延迟（ms） */
  var CLICK_SLOP = 6;        /* 拖拽位移超过该值即视为拖拽，不再触发点击 */
  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var cars = [];             /* 已组装的轮播实例 */
  var rafId = null;
  var lastTs = 0;
  var resizeBound = false;   /* resize 校正监听只挂一次 */

  /* ---------- 基础取值 ---------- */
  function vpOf(car) { return car.querySelector('.carousel__viewport'); }
  function trackOf(car) { return car.querySelector('.carousel__track'); }
  function cardsOf(car) { return trackOf(car).querySelectorAll('.gcard'); }
  function vwOf(car) { return vpOf(car).clientWidth || window.innerWidth; }

  /* ---------------------------------------------------------------- 测量 */
  /* 「步进」= 卡片宽 + 间隙；「一组宽度」= 步进 × 卡片数
     位移 x 始终落在 (-setW, 0]，回绕时 ±setW —— 相邻两张间距不变，故无断层 */
  function measure(car) {
    var track = trackOf(car);
    var real = car._real || [];
    if (!real.length) return;
    var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    car._gap = gap;
    car._step = real[0].offsetWidth + gap;
    car._setW = car._step * real.length;
  }

  /* ------------------------------------------------------ 复制补位（克隆） */
  /* 轨道总宽须 ≥ 一屏 + 一组：这样无论 x 落在 (-setW, 0] 的何处，
     从屏幕左缘到右缘都被卡片铺满，滚动中不会露出空白 */
  function rebuild(car) {
    var track = trackOf(car);
    var real = car._real || [];
    if (!real.length) return;

    /* 清掉上一次的克隆，回到「只有真实卡片」的状态再测量 */
    Array.prototype.slice.call(track.querySelectorAll('.gcard--clone'))
      .forEach(function (c) { track.removeChild(c); });

    measure(car);
    if (!car._setW) return;

    var copies = Math.max(2, Math.ceil((vwOf(car) + car._setW) / car._setW));

    for (var k = 1; k < copies; k++) {
      real.forEach(function (card) {
        var clone = card.cloneNode(true);
        clone.classList.add('gcard--clone');
        clone.setAttribute('aria-hidden', 'true');
        clone.removeAttribute('tabindex');   /* 克隆不进键盘 Tab 序列 */
        clone.removeAttribute('id');
        track.appendChild(clone);
      });
    }
  }

  /* --------------------------------------------------------------- 位移 */
  function wrap(car) {
    var w = car._setW || 0;
    if (!w) return;
    while (car._x <= -w) car._x += w;
    while (car._x > 0) car._x -= w;
  }

  function render(car) {
    var track = trackOf(car);
    if (track) track.style.transform = 'translate3d(' + car._x.toFixed(2) + 'px, 0, 0)';
  }

  /* 初始取景：把第 2 张真实卡片摆到内容区中轴（与上一版视觉衔接） */
  function centerInit(car) {
    var real = car._real || [];
    if (!real.length) return;
    var i = Math.min(1, real.length - 1);
    car._x = vwOf(car) / 2 - (i * car._step + real[0].offsetWidth / 2);
    wrap(car);
  }

  /* ------------------------------------------------------------ 主循环 */
  function isPaused(car) {
    return !!car._hover || !!car._drag || !!car._offscreen ||
      (car._resumeAt && Date.now() < car._resumeAt) ||   /* 拖拽后短暂静止 */
      document.hidden || REDUCED;
  }

  function tick(ts) {
    var dt = lastTs ? Math.min(ts - lastTs, 80) : 16;   /* 限幅，避免切回页签时跳帧 */
    lastTs = ts;

    /* 章节切换后旧节点已脱离文档，顺手清理 */
    for (var i = cars.length - 1; i >= 0; i--) {
      if (!cars[i].isConnected) cars.splice(i, 1);
    }

    for (var j = 0; j < cars.length; j++) {
      var car = cars[j];
      if (isPaused(car)) continue;
      car._x -= (SPEED * dt) / 1000;     /* 匀速向左 */
      wrap(car);
      render(car);
    }

    rafId = requestAnimationFrame(tick);
  }

  function ensureLoop() {
    if (rafId == null) {
      lastTs = 0;
      rafId = requestAnimationFrame(tick);
    }
  }

  /* ------------------------------------------------------------ 交互绑定 */
  function bind(car) {
    var vp = vpOf(car);

    /* 悬停暂停（方便看清 / 点击卡片） */
    car.addEventListener('pointerenter', function () { car._hover = true; });
    car.addEventListener('pointerleave', function () { car._hover = false; });

    /* 拖拽搓动：按下即接管位移，松手后延时恢复匀速滚动。
       注意不要用 setPointerCapture —— 它会把后续指针事件重定向到捕获元素，
       合成出的 click 事件 target 会变成容器而非卡片，导致「点击放大」失效。
       改用 window 级监听：指针移出元素/窗口也能继续拖，行为更接近原生滚动。 */
    var startX = 0;
    function onMove(e) {
      if (!car._drag) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > Math.abs(car._moved)) car._moved = dx;
      car._x = car._x0 + dx;
      wrap(car);
      render(car);
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (!car._drag) return;
      car._drag = false;
      car.classList.remove('is-dragging');
      car._resumeAt = Date.now() + DRAG_RESUME;    /* 松手后短暂静止再恢复 */
      setTimeout(function () { car._resumeAt = 0; }, DRAG_RESUME + 20);
    }
    vp.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      car._drag = true;
      car._moved = 0;
      startX = e.clientX;
      car._x0 = car._x;
      car.classList.add('is-dragging');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
    window.addEventListener('blur', onUp);

    /* 拖拽后的这一次点击不算「点击卡片」，拦截掉（app.js 的灯箱监听在冒泡阶段） */
    car.addEventListener('click', function (e) {
      if (Math.abs(car._moved) > CLICK_SLOP) {
        e.stopPropagation();
        e.preventDefault();
      }
      car._moved = 0;
    }, true);
  }

  /* ---------------------------------------------- 可见性：进视口才滚动 */
  function observe(car) {
    if (car._io || !('IntersectionObserver' in window)) return;
    car._io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        car._offscreen = !en.isIntersecting;
        if (en.isIntersecting) {
          /* 进入视口后立刻加载全部卡片图（含克隆），避免滚动到空白 */
          Array.prototype.slice.call(cardsOf(car)).forEach(function (c) {
            var img = c.querySelector('img');
            if (img) img.loading = 'eager';
          });
        }
      });
    }, { threshold: 0.15 });
    car._io.observe(vpOf(car));
  }

  /* --------------------------------------------------------------- 组装 */
  function setup(car) {
    if (car.dataset.carReady === 'true') {
      rebuild(car);
      wrap(car);
      render(car);
      observe(car);
      if (cars.indexOf(car) < 0) cars.push(car);
      ensureLoop();
      return;
    }
    car.dataset.carReady = 'true';
    car._real = Array.prototype.slice.call(cardsOf(car));
    if (!car._real.length) return;

    car._x = 0;
    car._moved = 0;
    rebuild(car);
    centerInit(car);
    render(car);
    bind(car);
    observe(car);

    /* 尺寸变化（窗口缩放 / 移动端转向）→ 重算步进与克隆数量 */
    if ('ResizeObserver' in window) {
      var t = null;
      new ResizeObserver(function () {
        if (t) clearTimeout(t);
        t = setTimeout(function () {
          rebuild(car);
          wrap(car);
          render(car);
        }, 120);
      }).observe(vpOf(car));
    }

    if (cars.indexOf(car) < 0) cars.push(car);
    ensureLoop();
  }

  /* ---------- 对外接口 ---------- */

  /** 章节挂载后调用：组装 + 校准「标题距上一卡片 80px」 */
  function sync(root) {
    var scope = root || document;
    scope.querySelectorAll('.gallery__carousel').forEach(setup);
    syncGap(scope);
  }

  function init() {
    document.querySelectorAll('.gallery__carousel').forEach(setup);

    /* 窗口尺寸变化后重跑 80px 校正：挂载时写入的 inline marginTop 覆盖了 CSS calc 兜底，
       而超宽屏触发 media-grid 收敛后 --media-h 会变 —— 不重算的话间距会漂移（实测可到 187px） */
    if (!resizeBound) {
      resizeBound = true;
      var rt = null;
      window.addEventListener('resize', function () {
        if (rt) clearTimeout(rt);
        rt = setTimeout(function () { syncGap(document); }, 160);
      });
    }
  }

  /**
   * 校正「标题距上方最后一个卡片 80px」：
   * CSS 里的 calc 只能覆盖常规桌面（卡片高 = --media-h 的情形），
   * 超宽屏触发 media-grid 1760px 收敛后卡片变矮、留白变大，这里用实测值精确抵消。
   * 幂等：已经校到 80px 时差值恒为 0，重复调用（章节切回 / resize）不会漂移。
   * 需在章节挂载后、入场动效开始前调用（此时布局已稳定且无 transform 干扰）。
   */
  function syncGap(root) {
    var scope = root || document;
    scope.querySelectorAll('.block--gallery').forEach(function (block) {
      var title = block.querySelector('.gallery__title');
      if (!title) return;

      /* 向前找最近一个带作品卡片的区块 */
      var prev = block.previousElementSibling;
      var card = null;
      while (prev && !card) {
        card = prev.querySelector ? prev.querySelector('.media') : null;
        prev = prev.previousElementSibling;
      }
      if (!card) return;

      var gap = title.getBoundingClientRect().top - card.getBoundingClientRect().bottom;
      var cur = parseFloat(getComputedStyle(block).marginTop) || 0;
      block.style.marginTop = (cur + (80 - gap)) + 'px';
    });
  }

  return { init: init, sync: sync, syncGap: syncGap };
})();
