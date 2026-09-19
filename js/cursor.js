/* ==========================================================================
   cursor.js — 跟随鼠标的光晕
   · 只创建一个固定定位元素，运动全部走 transform: translate3d（GPU 合成，零重排）
   · 停止移动时立刻停帧，不空转 rAF
   · 触屏设备 / 系统开启「减少动态效果」时自动不启用
   ========================================================================== */

PF.cursor = (function () {
  'use strict';

  var U = PF.util;
  var glow = null;
  var raf = null;
  var tx = 0, ty = 0;   /* 目标位置（指针） */
  var cx = 0, cy = 0;   /* 当前渲染位置（缓动跟随） */
  var started = false;

  /* 缓动系数：0.18 ≈ 柔和但不拖沓 */
  var EASE = 0.18;
  /* 距离阈值：小于它就认为已经贴合，停掉 rAF */
  var EPS = 0.5;

  function tick() {
    cx += (tx - cx) * EASE;
    cy += (ty - cy) * EASE;
    glow.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';

    if (Math.abs(tx - cx) > EPS || Math.abs(ty - cy) > EPS) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;   /* 已贴合：停帧，不消耗 CPU */
    }
  }

  function schedule() {
    if (raf === null) raf = requestAnimationFrame(tick);
  }

  function onMove(e) {
    if (e.pointerType === 'touch') return;
    tx = e.clientX;
    ty = e.clientY;

    if (!started) {          /* 首次进入页面：直接落在指针上并淡入 */
      started = true;
      cx = tx; cy = ty;
      glow.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      glow.classList.add('is-on');
    }
    schedule();
  }

  function onDown(e) { if (e.pointerType !== 'touch') { glow.classList.add('is-press'); schedule(); } }
  function onUp() { glow.classList.remove('is-press'); schedule(); }

  function onLeave() { glow.classList.remove('is-on'); }   /* 鼠标离开窗口：淡出 */

  function onEnter() { if (started) glow.classList.add('is-on'); }

  function init() {
    if (!document.body || U.isTouch) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    glow = document.createElement('div');
    glow.className = 'cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    document.documentElement.addEventListener('mouseenter', onEnter);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) glow.classList.remove('is-on');
      else if (started) glow.classList.add('is-on');
    });
  }

  return { init: init };
})();
