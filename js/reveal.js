/* ==========================================================================
   reveal.js — 视口监听：图片逐屏淡入 + 视频按需播放/暂停
   只用一个 IntersectionObserver 实例，避免大量 scroll 监听造成的重绘开销
   ========================================================================== */

PF.reveal = (function () {
  'use strict';

  var rootEl = null;
  var revealObs = null;
  var videoObs = null;

  function onReveal(entries, obs) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var node = entry.target;
      node.classList.add('is-in');
      obs.unobserve(node);   /* 只播一次，滚动中不再计算 */

      /* 动画播完后摘掉 .reveal/.is-in：
         animation-fill-mode:both 会永久接管 transform，导致卡片 hover 的上浮/缩放失效；
         摘除后卡片回到常态，hover 过渡照常生效 */
      var onEnd = function (e) {
        if (e.target !== node || e.animationName !== 'pf-rise') return;
        node.removeEventListener('animationend', onEnd);
        node.classList.remove('reveal', 'is-in');
      };
      node.addEventListener('animationend', onEnd);
    });
  }

  function onVideo(entries) {
    entries.forEach(function (entry) {
      var v = entry.target;
      var canAutoplay = v.getAttribute('data-autoplay') === 'true';

      if (entry.isIntersecting) {
        if (canAutoplay && v.paused) playSafe(v);
      } else if (!v.paused) {
        v.pause();
      }
    });
  }

  function playSafe(v) {
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* 浏览器策略拦截时保持封面，不报错 */ });
  }

  /** 元素当前是否落在滚动容器可视区内（按面积比，阈值与 videoObs 对齐） */
  function inViewport(node) {
    if (!rootEl) return false;
    var r = node.getBoundingClientRect();
    var b = rootEl.getBoundingClientRect();
    var w = Math.min(r.right, b.right) - Math.max(r.left, b.left);
    var h = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
    if (w <= 0 || h <= 0 || !r.width || !r.height) return false;
    return (w * h) / (r.width * r.height) >= 0.4;
  }

  /* 固定定位（如首屏封面）：这类播放器不随滚动移动，
     IntersectionObserver 对它们恒返回「不相交」（intersectionRect 为 0）会误判，
     所以不交给观察器，改用几何判断在章节挂载时直接接续播放 */
  function isPinned(node) {
    var n = node;
    while (n && n.nodeType === 1) {
      if (getComputedStyle(n).position === 'fixed') return true;
      n = n.parentElement;
    }
    return false;
  }

  /** 初始化（传入滚动容器作为观察根） */
  function init(viewportEl) {
    rootEl = viewportEl;

    if ('IntersectionObserver' in window) {
      revealObs = new IntersectionObserver(onReveal, {
        root: rootEl,
        rootMargin: '0px 0px -4% 0px',
        threshold: 0.08
      });
      videoObs = new IntersectionObserver(onVideo, {
        root: rootEl,
        threshold: 0.4
      });
    } else {
      /* 兜底：老浏览器直接全部显示 */
      rootEl.querySelectorAll('.reveal').forEach(function (n) { n.classList.add('is-in'); });
    }
  }

  /** 扫描某个容器内的元素并开始观察（章节切换后调用） */
  function scan(container) {
    if (!container) return;

    /* 自动播放的视频：固定定位的（首屏封面）用几何判断直接接续播放 —— 章节切走再切回时
       <video> 是缓存的同一节点，autoplay 属性不会二次触发，不显式续播就会停住；
       其余流内视频（作品卡片）交给观察器管理 */
    container.querySelectorAll('video[data-autoplay="true"]').forEach(function (v) {
      if (isPinned(v)) {
        if (v.paused && inViewport(v)) playSafe(v);   /* currentTime 保留 → 从离开处继续 */
        return;
      }
      if (videoObs) videoObs.observe(v);
    });

    if (!revealObs) return;
    container.querySelectorAll('.reveal:not(.is-in)').forEach(function (n) { revealObs.observe(n); });
  }

  /** 停止观察容器内的元素（章节移出 DOM 前调用，防止观察者泄漏） */
  function clear(container) {
    if (!container) return;

    container.querySelectorAll('video[data-autoplay="true"]').forEach(function (v) {
      if (videoObs && !isPinned(v)) videoObs.unobserve(v);
      if (!v.paused) v.pause();   /* 切走即停帧，切回从这一帧继续 */
    });

    if (!revealObs) return;
    container.querySelectorAll('.reveal').forEach(function (n) { revealObs.unobserve(n); });
  }

  return { init: init, scan: scan, clear: clear };
})();
