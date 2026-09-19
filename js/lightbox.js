/* ==========================================================================
   lightbox.js — 大图查看层
   功能：缩放（滚轮 / 双击 / 按钮）、放大后拖拽平移、前后切换、键盘操作
   ========================================================================== */

PF.lightbox = (function () {
  'use strict';

  var U = PF.util;
  var MIN_SCALE = 1;
  var MAX_SCALE = 5;

  var dom = {};
  var items = [];
  var current = 0;
  var scale = 1;
  var tx = 0, ty = 0;
  var isOpen = false;
  var lastFocus = null;
  var drag = null;

  /* ---------------------------------------------------------------------- */
  function init() {
    dom.root = document.getElementById('lightbox');
    dom.stage = document.getElementById('lbStage');
    dom.prev = document.getElementById('lbPrev');
    dom.next = document.getElementById('lbNext');
    dom.zoomIn = document.getElementById('lbZoomIn');
    dom.zoomOut = document.getElementById('lbZoomOut');
    dom.zoomReset = document.getElementById('lbZoomReset');
    dom.raw = document.getElementById('lbRaw');
    dom.close = document.getElementById('lbClose');
    dom.backdrop = dom.root.querySelector('.lightbox__backdrop');

    dom.backdrop.addEventListener('click', close);
    dom.close.addEventListener('click', close);
    dom.prev.addEventListener('click', function () { step(-1); });
    dom.next.addEventListener('click', function () { step(1); });
    dom.zoomIn.addEventListener('click', function () { zoomBy(1.35); });
    dom.zoomOut.addEventListener('click', function () { zoomBy(1 / 1.35); });
    dom.zoomReset.addEventListener('click', resetView);

    dom.stage.addEventListener('dblclick', function () {
      if (scale > 1.01) resetView(); else zoomBy(2.2);
    });
    dom.stage.addEventListener('wheel', onWheel, { passive: false });

    /* 拖拽平移 */
    dom.stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', function () {
      if (!isOpen) return;
      resetView();
      fitStage(dom.stage.firstElementChild);   /* 窗口变化后重算舞台比例 */
    });

    /* 键盘 */
    document.addEventListener('keydown', onKeydown);
  }

  /* --------------------------- 打开 / 关闭 ------------------------------ */
  function open(list, index) {
    items = list || [];
    if (!items.length) return;
    lastFocus = document.activeElement;
    isOpen = true;
    dom.root.hidden = false;
    document.documentElement.classList.add('is-locked');
    requestAnimationFrame(function () { dom.root.classList.add('is-open'); });
    show(index || 0);
    dom.close.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    dom.root.classList.remove('is-open');
    document.documentElement.classList.remove('is-locked');
    setTimeout(function () {
      dom.root.hidden = true;
      clearStage();
    }, 240);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function clearStage() {
    var v = dom.stage.querySelector('video');
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    dom.stage.innerHTML = '';
  }

  /* --------------------------- 渲染当前张 ------------------------------ */
  function show(i) {
    if (!items.length) return;
    current = (i + items.length) % items.length;
    resetView();
    clearStage();

    var item = items[current];
    var node;

    if (item.type === 'video') {
      node = U.el('video', {
        src: item.src,
        poster: item.poster || null,
        controls: true,
        autoplay: true,
        loop: item.loop,
        muted: item.muted,
        playsinline: true
      });
      node.addEventListener('error', function () { node.remove(); failHint(); });
    } else {
      node = U.el('img', { src: item.src, alt: item.alt || '' });
      node.addEventListener('error', function () { node.remove(); failHint(); });
      node.addEventListener('load', function () { fitStage(node); });
      preloadNeighbour(1);
      preloadNeighbour(-1);
    }

    dom.stage.appendChild(node);
    if (node.tagName === 'VIDEO') node.addEventListener('loadedmetadata', function () { fitStage(node); });
    fitStage(node);   /* 已缓存时 naturalWidth 可立即读到，首帧就是正确比例 */

    dom.raw.href = item.src;

    /* 视频不需要缩放，禁用缩放按钮 */
    var isVideo = item.type === 'video';
    [dom.zoomIn, dom.zoomOut, dom.zoomReset].forEach(function (b) { b.disabled = isVideo; });
  }

  /* ----------------------------------------------------------------------
     舞台尺寸 = 「可用上限之内、与素材同比例」的最大矩形
     于是素材正好铺满舞台：不留背景空白、不裁切、不拉伸（见 css/lightbox.css）
     ---------------------------------------------------------------------- */
  function bounds() {
    var vw = window.innerWidth, vh = window.innerHeight;
    if (vw <= 720) return { w: vw * 0.94, h: vh * 0.8 };          /* 与 lightbox.css 断点一致 */
    return { w: Math.min(1560, vw * 0.9), h: Math.min(vh * 0.86, 1000) };
  }

  function fitStage(node) {
    if (!node || node.parentNode !== dom.stage) return;           /* 快速切换时忽略过期回调 */
    var isVideo = node.tagName === 'VIDEO';
    var nw = isVideo ? node.videoWidth : node.naturalWidth;
    var nh = isVideo ? node.videoHeight : node.naturalHeight;
    if (!nw || !nh) return;                                       /* 尺寸未知：等 load / loadedmetadata */
    var b = bounds();
    var k = Math.min(b.w / nw, b.h / nh);
    dom.stage.style.width = Math.round(nw * k) + 'px';
    dom.stage.style.height = Math.round(nh * k) + 'px';
  }

  function failHint() {
    dom.stage.appendChild(U.el('div', { class: 'lb-fail', text: '原图未找到，请检查素材路径' }));
  }

  /** 预载相邻图片，切换时无白屏 */
  function preloadNeighbour(dir) {
    var next = items[(current + dir + items.length) % items.length];
    if (!next || next.type === 'video') return;
    var img = new Image();
    img.decoding = 'async';
    img.src = next.src;
  }

  function step(dir) {
    if (!items.length) return;
    show(current + dir);
  }

  /* --------------------------- 缩放 / 平移 ------------------------------ */
  function applyTransform(animate) {
    var node = dom.stage.firstElementChild;
    if (!node) return;
    node.style.transition = animate === false ? 'none' : '';
    node.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) scale(' + scale + ')';
    dom.stage.classList.toggle('is-zoomed', scale > 1.01);
  }

  function resetView() {
    scale = 1; tx = 0; ty = 0;
    applyTransform();
  }

  function zoomBy(factor, origin) {
    var next = U.clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    if (Math.abs(next - scale) < 0.001) return;

    /* 以鼠标位置为中心缩放（未传坐标时以中心为原点） */
    if (origin && scale > 0) {
      var rect = dom.stage.getBoundingClientRect();
      var ox = origin.x - rect.left - rect.width / 2;
      var oy = origin.y - rect.top - rect.height / 2;
      var ratio = next / scale;
      tx = ox - (ox - tx) * ratio;
      ty = oy - (oy - ty) * ratio;
    }

    scale = next;
    if (scale <= 1.01) { tx = 0; ty = 0; }
    clampPan();
    applyTransform();
  }

  function clampPan() {
    var node = dom.stage.firstElementChild;
    if (!node) return;
    var stageRect = dom.stage.getBoundingClientRect();
    var w = node.offsetWidth, h = node.offsetHeight;
    if (!w || !h) return;
    /* 放大后最多拖到内容边缘，避免把图拖出屏幕 */
    var maxX = Math.max(0, (w * scale - stageRect.width) / 2);
    var maxY = Math.max(0, (h * scale - stageRect.height) / 2);
    tx = U.clamp(tx, -maxX, maxX);
    ty = U.clamp(ty, -maxY, maxY);
  }

  function onWheel(e) {
    if (!isOpen) return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, { x: e.clientX, y: e.clientY });
  }

  function onPointerDown(e) {
    if (scale <= 1.01) return;
    drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
    dom.stage.classList.add('is-panning');
    dom.stage.setPointerCapture && dom.stage.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drag) return;
    tx = drag.tx + (e.clientX - drag.x);
    ty = drag.ty + (e.clientY - drag.y);
    clampPan();
    applyTransform(false);
  }

  function onPointerUp() {
    if (!drag) return;
    drag = null;
    dom.stage.classList.remove('is-panning');
    applyTransform();
  }

  /* --------------------------- 键盘 ------------------------------------ */
  function onKeydown(e) {
    if (!isOpen) return;
    switch (e.key) {
      case 'Escape': e.preventDefault(); close(); break;
      case 'ArrowLeft': e.preventDefault(); step(-1); break;
      case 'ArrowRight': e.preventDefault(); step(1); break;
      case '+': case '=': e.preventDefault(); zoomBy(1.35); break;
      case '-': case '_': e.preventDefault(); zoomBy(1 / 1.35); break;
      case '0': e.preventDefault(); resetView(); break;
      case 'Tab': trapFocus(e); break;
      default: break;
    }
  }

  /** 简易焦点循环，保证键盘用户不会 Tab 到背后的页面 */
  function trapFocus(e) {
    var focusables = dom.root.querySelectorAll('button:not([disabled]), a[href]');
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  return {
    init: init,
    open: open,
    close: close,
    isOpen: function () { return isOpen; }
  };
})();
