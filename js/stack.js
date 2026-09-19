/* ==========================================================================
   stack.js — 滚动堆叠（layout:'stack'）
   参考 React Bits Pro「Scroll Stack」：Pinned cards that stack, turn and
   dissolve as the page scrolls。
   --------------------------------------------------------------------------
   实现要点：
   · 钉住：.stack__viewport 用 position:sticky 占满一屏；.stack 的高度 =
     视口高 + (N-1)×每卡滚动行程 + 末张停留，全部由本模块按视口 px 精确写入；
   · 堆叠：滚动行程换算成「当前顶部卡序号 idx（可为小数）」，对每张卡按
     d = idx - i 计算 transform / opacity / filter（卡片不旋转，保持端正）——
       d < 0（待入场）：从舞台下方垂直升起，逐渐清晰；
       d = 0（当前顶卡）：归位、清晰、重投影（上下都投影，与身后层级拉开）；
       d > 0（已被覆盖）：逐级上移 46px、缩退、压暗，顶缘亮线露出「纸边」层级；
   · MP4 卡片：默认停在第一帧；鼠标移入播放、移出暂停并回到第一帧；
     卡片被覆盖或区块滚出视口时同样复位，避免看不见的地方继续解码；
   · 性能：数值量化 + 与上次相同则跳过写入；离开视口 / 切走页签暂停结算；
     prefers-reduced-motion 时整块退化为静态纵向列表（CSS .is-static）。
   ========================================================================== */

PF.stack = (function () {
  'use strict';

  var STEP_RATIO = 0.62;     /* 每张卡片的滚动行程（× 视口高） */
  var HOLD_RATIO = 0.45;     /* 最后一张卡片落位后的停留行程（× 视口高） */
  var GAP = 80;              /* 大标题距上方内容的目标间距 px */
  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var stacks = [];
  var bound = false;

  var U = PF.util;

  function scrollRoot() {
    return document.getElementById('viewport') ||
      document.scrollingElement || document.documentElement;
  }

  /* --------------------------------------------------------------- 尺寸 */
  /* 行程参数用 px 写入（--stack-step / --stack-hold），CSS 里 height 公式生效；
     px 而非 vh 是为了与 JS 计算进度的分母完全一致，避免取整误差 */
  function measure(box) {
    var vh = window.innerHeight || 800;
    var n = box._cards ? box._cards.length : 0;
    var step = Math.round(vh * STEP_RATIO);
    var hold = Math.round(vh * HOLD_RATIO);
    box._step = step;
    box.style.setProperty('--stack-step', step + 'px');
    box.style.setProperty('--stack-hold', hold + 'px');
    box.style.height = (vh + Math.max(0, n - 1) * step + hold) + 'px';
  }

  /* ------------------------------------------------------------ 间距校准 */
  /* 「大标题」距上方最近内容块 80px：实测差值抵消（与 carousel / tiles 同一套）
     一章里可能有多个 stack 区块（如「动态主题登录页」+「徽章展示」），
     逐个校准；按 DOM 顺序处理，前一个写回后的重排会被后一个测量到 */
  function syncGap(scope) {
    var blocks = scope.querySelectorAll('.block--stack');
    Array.prototype.forEach.call(blocks, function (block) {
      var title = block.querySelector('.gallery__title');
      if (!title) return;

      var prev = block.previousElementSibling;
      var content = null;
      while (prev && !content) {
        if (prev.querySelector) {
          /* 取上一块里「最后一个内容元素」作为基准（文档序最后者）：
             · 带卡片的 stack → .stack__stage；带徽章墙的块 → .badges（而非其标题）
             · 单图卡 → .media；纯标题占位块（无任何内容）→ 退回 .gallery__title */
          var els = prev.querySelectorAll('.media, .gallery__carousel, .tiles, .stack__stage, .badges, .gallery__title');
          content = els.length ? els[els.length - 1] : null;
        }
        prev = prev.previousElementSibling;
      }
      if (!content) return;

      var gap = title.getBoundingClientRect().top - content.getBoundingClientRect().bottom;
      var cur = parseFloat(getComputedStyle(block).marginTop) || 0;
      block.style.marginTop = (cur + (GAP - gap)) + 'px';
    });
  }

  /* ---------------------------------------------------------------- 结算 */
  /* 把滚动位置换算成 idx（0..N-1，可为小数），再对每张卡写状态 */
  function update(box) {
    if (!box._cards || !box._cards.length || box._hidden) return;

    var rect = box.getBoundingClientRect();
    var vh = window.innerHeight;
    if (rect.bottom < -80 || rect.top > vh + 80) return;   /* 视口外不结算 */

    /* idx：当前顶卡序号（可为小数）。wrapper 顶边到 scrollport 顶部的距离
       除以每卡行程；未钉住前为负 → clamp 到 0，滚出后 clamp 到 N-1（末张停留） */
    var idx = U.clamp(-rect.top / box._step, 0, box._cards.length - 1);

    box._cards.forEach(function (card, i) {
      var d = idx - i;
      card.classList.toggle('is-active', Math.round(idx) === i);

      /* 指针事件：只有当前顶卡可接收——被覆盖/待入场的半透明卡不拦截悬停与点击，
         MP4 的悬停播放（pointerenter）才能准确命中顶卡 */
      var pe = (d > -0.05 && d < 0.05) ? '' : 'none';
      if (card._pe !== pe) { card.style.pointerEvents = pe; card._pe = pe; }

      /* 视频卡被覆盖后立即复位（停止解码、回到第一帧） */
      if (card._video && d > 0.5 && !card._video.paused) resetVideo(card._video);

      var y = 0, sc = 1, op = 1, blur = 0, br = 1;

      /* 已被覆盖的卡挂上 is-covered（顶缘亮线，堆叠出「一叠纸」的层次） */
      card.classList.toggle('is-covered', d > 0.05);

      if (d < 0) {
        /* 待入场：在舞台下方等待，随进度垂直升起、逐渐清晰（不旋转） */
        var t = Math.min(-d, 1);
        y = t * vh * 0.95;
        sc = 1 - t * 0.05;
        op = 1 - t * 0.55;
        blur = t * 2.5;
        br = 1 - t * 0.25;
      } else {
        /* 当前顶卡 / 已被覆盖：按深度逐级上移、缩退、压暗 ——
           每级上移 46px，让后方卡片的顶边从顶卡上方露出一条清晰的「纸边」，
           亮度逐级递减形成前后层级；溶解幅度收敛，保证各层都看得见 */
        var dep = Math.min(d, 3);
        y = -dep * 46;
        sc = 1 - dep * 0.04;
        op = Math.max(0.5, 1 - dep * 0.18);
        blur = dep * 1.1;
        br = 1 - dep * 0.18;
      }

      /* 量化后与上次相同则跳过写入（卡片保持端正：仅垂直位移 + 缩放） */
      var tf = 'translate3d(-50%,-50%,0) translate3d(0,' +
        (Math.round(y * 2) / 2) + 'px,0) scale(' + (Math.round(sc * 1000) / 1000) + ')';
      if (card._tf !== tf) { card.style.transform = tf; card._tf = tf; }

      var o = Math.round(op * 100) / 100;
      if (card._op !== o) { card.style.opacity = o; card._op = o; }

      var f = blur > 0.25
        ? 'blur(' + (Math.round(blur * 2) / 2) + 'px) brightness(' +
          (Math.round(br * 100) / 100) + ')'
        : 'brightness(' + (Math.round(br * 100) / 100) + ')';
      if (card._fx !== f) { card.style.filter = f; card._fx = f; }
    });
  }

  /* ------------------------------------------------------------- 视频卡片 --
     MP4：默认停在第一帧；鼠标移入播放、移出暂停并回到第一帧。
     preload="metadata" 时 Chrome 不会绘制首帧，seek 到 0.001s 强制出帧。 */
  function primeFirstFrame(v) {
    var seek = function () { try { v.currentTime = 0.001; } catch (e) { /* 忽略 */ } };
    if (v.readyState >= 1) seek();
    else v.addEventListener('loadedmetadata', seek, { once: true });
  }

  function resetVideo(v) {
    if (!v.paused) v.pause();
    try { v.currentTime = 0; } catch (e) { /* 忽略 */ }
    var card = v.closest ? v.closest('.scard') : null;
    if (card) card.classList.remove('is-playing');
  }

  function resetAllVideos(box) {
    (box._videos || []).forEach(resetVideo);
  }

  function bindVideos(box) {
    box._videos = [];
    box._cards.forEach(function (card) {
      var v = card.querySelector('video[data-hoverplay]');
      if (!v) return;
      card._video = v;
      box._videos.push(v);
      primeFirstFrame(v);

      card.addEventListener('pointerenter', function () {
        if (document.hidden) return;
        card.classList.add('is-playing');
        var p = v.play();
        if (p && p.catch) {
          p.catch(function () { card.classList.remove('is-playing'); });
        }
      });
      card.addEventListener('pointerleave', function () { resetVideo(v); });
    });
  }

  function updateAll() {
    /* 章节切换后旧节点已脱离文档，顺手清理 */
    for (var i = stacks.length - 1; i >= 0; i--) {
      if (!stacks[i].isConnected) stacks.splice(i, 1);
    }
    if (document.hidden) {
      stacks.forEach(resetAllVideos);          /* 切走页签：全部复位回第一帧 */
      return;
    }
    for (var j = 0; j < stacks.length; j++) update(stacks[j]);
  }

  /* --------------------------------------------------------------- 组装 */
  function setup(box) {
    if (box.dataset.stackReady === 'true') {
      measure(box);
      update(box);
      if (stacks.indexOf(box) < 0) stacks.push(box);
      return;
    }
    box.dataset.stackReady = 'true';
    box._cards = Array.prototype.slice.call(box.querySelectorAll('.scard'));
    if (REDUCED) box.classList.add('is-static');
    bindVideos(box);

    /* 层序：按序号固定 z-index（i 越大越靠上）——
       顶卡永远盖住更早的卡；待入场的新卡在升起过程中盖住当前顶卡，
       落位后自然成为最上层。与「新卡压到顶上」的堆叠语义一致 */
    box._cards.forEach(function (card, i) { card.style.zIndex = 100 + i; });

    measure(box);
    update(box);
    if (stacks.indexOf(box) < 0) stacks.push(box);
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    scrollRoot().addEventListener('scroll', U.rafThrottle(updateAll), { passive: true });
    window.addEventListener('resize', U.rafThrottle(function () {
      stacks.forEach(function (b) { measure(b); update(b); });
    }), { passive: true });
  }

  /* ------------------------------------------------------------ 对外接口 */
  function init() {
    bindOnce();
    document.querySelectorAll('[data-stack]').forEach(setup);
  }

  /** 章节挂载后调用：组装新堆叠、结算当前位置、校准标题上方 80px 间距 */
  function sync(rootEl) {
    var scope = rootEl || document;
    scope.querySelectorAll('[data-stack]').forEach(setup);
    syncGap(scope);
  }

  return { init: init, sync: sync, syncGap: syncGap };
})();
