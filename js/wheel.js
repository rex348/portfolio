/* ==========================================================================
   wheel.js — 滚轮翻章
   当前章节滚到尽头（底部 / 顶部）后继续滚动，自动切到上/下一个章节：
     · 向下滚到底 → 下一章，落在新章顶部；
     · 向上滚到顶 → 上一章，落在新章底部。
   --------------------------------------------------------------------------
   手感要点（决定「顺」还是「乱」的三件事）：
   1. 到边才蓄力：只有滚动已经贴住边缘时才开始累计滚动量，累计超过
      THRESHOLD 才翻页 —— 避免「刚滚到底」就被顺手翻走；
   2. 静默解锁：翻页后进入锁定，滚轮还在动就一直推迟解锁（一次惯性滚动
      只翻一章，绝不连跳）；停歇够久且过了冷却才恢复受理；
   3. 方向归零：同一手势里一旦反向，累计量立即清零 —— 用户改主意时不误翻。
   另外横向滑动手势、Ctrl/⌘ 缩放、灯箱打开、移动端抽屉打开时全部放行，
   不参与翻页语义。
   ========================================================================== */

PF.wheel = (function () {
  'use strict';

  var EDGE = 3;           /* 判定「已贴住边缘」的像素容差 */
  var EDGE_BOTTOM = 0.03; /* 底部额外容差（× 视口高）——
                             切换瞬间区块高度还在微调（堆叠测量 / 间距校准），
                             此刻算出的 scrollHeight 可能比终值大十几 px，
                             留一点余量才不会「明明到底了却不翻页」 */
  var THRESHOLD = 100;    /* 贴边后还需继续滚动的累计量（px）才翻页 */
  var QUIET_MS = 170;     /* 滚轮停歇多久算一次手势结束 */
  var COOLDOWN_MS = 420;  /* 翻页后的最短冷却，避免连跳 */
  var LINE_PX = 16;       /* deltaMode = 1（按行）时的换算系数 */

  var root = null;
  var onStep = null;

  var acc = 0;            /* 贴边后的累计滚动量 */
  var lastDir = 0;
  var locked = false;     /* 翻页后吸收后续惯性 */
  var firedAt = 0;
  var lastEventAt = 0;
  var timer = null;

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function atTop() { return root.scrollTop <= EDGE; }
  function atBottom() {
    var slack = Math.max(16, root.clientHeight * EDGE_BOTTOM);
    return root.scrollTop + root.clientHeight >= root.scrollHeight - slack;
  }

  function deltaPx(e) {
    var d = e.deltaY || 0;
    if (e.deltaMode === 1) d *= LINE_PX;
    else if (e.deltaMode === 2) d *= root.clientHeight || 800;
    return d;
  }

  /* 这些情况下的滚轮不属于「章节翻页」，直接放行给浏览器 */
  function skip(e) {
    if (PF.lightbox && PF.lightbox.isOpen()) return true;
    if (document.body.classList.contains('drawer-open')) return true;
    if (e.ctrlKey || e.metaKey || e.altKey) return true;         /* 缩放 / 系统手势 */
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return true;    /* 横向滑动手势 */
    return false;
  }

  function release() {
    if (timer) { clearTimeout(timer); timer = null; }
    locked = false;
    acc = 0;
  }

  /* 翻页后锁定：只要滚轮还在动就不断推迟解锁，一次手势最多翻一章 */
  function hold() {
    if (timer) clearTimeout(timer);
    var wait = Math.max(QUIET_MS, COOLDOWN_MS - (now() - firedAt));
    timer = setTimeout(release, wait);
  }

  function onWheel(e) {
    if (!root || skip(e)) return;

    var t = now();
    var idle = lastEventAt && (t - lastEventAt) > QUIET_MS;   /* 与上一事件之间有过停顿 */
    lastEventAt = t;

    if (locked) {
      /* 停够久且已过冷却 → 当作新手势；否则继续吸收惯性 */
      if (idle && (t - firedAt) >= COOLDOWN_MS) release();
      else { hold(); return; }
    }

    var d = deltaPx(e);
    if (!d) return;

    var dir = d > 0 ? 1 : -1;
    if (dir !== lastDir) { acc = 0; lastDir = dir; }

    /* 该方向还有内容可滚 → 正常滚动，不累计 */
    if (dir > 0 ? !atBottom() : !atTop()) { acc = 0; return; }

    acc += Math.abs(d);
    if (acc < THRESHOLD) return;

    acc = 0;
    if (onStep && onStep(dir)) {
      firedAt = t;
      locked = true;
      hold();
    } else if (PF.nav && PF.nav.bump) {
      PF.nav.bump(dir);        /* 已经是首/末章：原地给一次反向提示 */
    }
  }

  /**
   * @param {HTMLElement} rootEl 纵向滚动容器（.viewport）
   * @param {(dir:number)=>boolean} stepHandler dir=1 下一章 / -1 上一章；
   *        返回 true 表示确实发生了切换，false 表示已到首/末章
   */
  function init(rootEl, stepHandler) {
    if (!rootEl || !stepHandler) return;
    root = rootEl;
    onStep = stepHandler;
    /* passive：绝不拦截默认滚动，只旁听 */
    root.addEventListener('wheel', onWheel, { passive: true });
    /* 滚动位置被程序改动（切章 / 点灯箱……）时清掉累计量，避免跨章误判 */
    root.addEventListener('scroll', function () { acc = 0; }, { passive: true });
  }

  return { init: init };
})();
