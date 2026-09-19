/* ==========================================================================
   util.js — 全局命名空间与基础工具函数
   （无依赖，最先加载；其它模块都挂在 window.PF 下，避免全局污染）
   ========================================================================== */

window.PF = window.PF || {};

PF.util = (function () {
  'use strict';

  /* 素材默认目录：config 里写纯文件名时，自动拼到这里 */
  var MEDIA_DIR = 'assets/works/';

  /**
   * 把 config 中的 src 解析为可用路径
   * 'brand-01.jpg'            → 'assets/works/brand-01.jpg'
   * 'assets/video/demo.mp4'   → 原样返回
   * 'https://…' / 'data:…'    → 原样返回
   */
  function resolveSrc(src) {
    if (!src) return '';
    if (/^(https?:|data:|blob:|\/|\.\/|\.\.\/)/i.test(src)) return src;
    if (src.indexOf('/') > -1) return src; // 已带目录，视为相对站点根目录
    return MEDIA_DIR + src;
  }

  /** 由扩展名判断媒体类型：video / gif / image */
  function detectType(src) {
    var clean = String(src || '').split('?')[0].split('#')[0].toLowerCase();
    if (/\.(mp4|webm|ogv|ogg|mov|m4v)$/.test(clean)) return 'video';
    if (/\.gif$/.test(clean)) return 'gif';
    return 'image';
  }

  /** 把 config 里的一条素材（字符串或对象）标准化为统一结构 */
  function normalizeItem(item, index) {
    var raw = typeof item === 'string' ? { src: item } : (item || {});
    var src = resolveSrc(raw.src);
    var type = raw.type === 'video' || raw.type === 'gif' || raw.type === 'image'
      ? raw.type
      : detectType(src);

    return {
      index: index,
      src: src,
      type: type,
      poster: raw.poster ? resolveSrc(raw.poster) : '',
      title: raw.title || '',
      desc: raw.desc || '',
      alt: raw.alt || raw.title || '',
      fill: raw.fill === true,
      autoplay: raw.autoplay !== false, // 视频默认静音自动播放
      loop: raw.loop !== false,
      muted: raw.muted !== false,
      controls: raw.controls === true
    };
  }

  /** 创建元素：el('div', { class:'a', text:'x' }, [子元素]) */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'class') node.className = v;
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (!c) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  /** 创建内联 SVG 图标 */
  function icon(pathD, size) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    if (size) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', pathD);
    svg.appendChild(p);
    return svg;
  }

  /** 数字补零：7 → '07' */
  function pad(n, len) {
    var s = String(n);
    while (s.length < (len || 2)) s = '0' + s;
    return s;
  }

  /** requestAnimationFrame 节流（滚动等高频事件用） */
  function rafThrottle(fn) {
    var ticking = false;
    return function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        fn();
      });
    };
  }

  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

  /** 是否触摸设备（用于决定 hover / 点击行为） */
  var isTouch = window.matchMedia('(hover: none)').matches;

  return {
    MEDIA_DIR: MEDIA_DIR,
    resolveSrc: resolveSrc,
    detectType: detectType,
    normalizeItem: normalizeItem,
    el: el,
    icon: icon,
    pad: pad,
    rafThrottle: rafThrottle,
    clamp: clamp,
    isTouch: isTouch
  };
})();
