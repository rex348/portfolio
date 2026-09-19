/* ==========================================================================
   app.js — 启动与调度
   职责：读取配置 → 按需渲染章节 → Tab 切换动效 → 灯箱联动 → 状态同步
   ========================================================================== */

(function () {
  'use strict';

  var U = PF.util;
  var config = PF.config;

  var dom = {};
  var cache = Object.create(null);   /* id → { node, items, scroll } ，已渲染的章节缓存，切回无需重建 */
  var activeId = null;
  var pendingTimer = null;           /* 淡出倒计时（160ms 后执行 commit） */
  var pendingCommit = null;          /* 待执行的 commit，新切换进来时先立即落定 */

  /* ---------------------------------------------------------------------- */
  function init() {
    dom.viewport = document.getElementById('viewport');
    dom.hudIdx = document.getElementById('hudIdx');
    dom.hudTotal = document.getElementById('hudTotal');
    dom.hudName = document.getElementById('hudName');
    dom.prevBtn = document.getElementById('prevBtn');
    dom.nextBtn = document.getElementById('nextBtn');

    applyMeta();

    PF.reveal.init(dom.viewport);
    PF.lightbox.init();
    if (PF.cursor) PF.cursor.init();
    if (PF.carousel) PF.carousel.init();
    if (PF.tiles) PF.tiles.init();
    if (PF.stack) PF.stack.init();
    PF.nav.init(config.sections, function (id) { switchTo(id, { focusTab: true }); });

    bindStage();
    bindPager();
    bindHash();
    bindShortcuts();

    /* 滚轮翻章：本章滚到尽头后继续滚动即切上/下一章（方向决定去哪一章） */
    if (PF.wheel) {
      PF.wheel.init(dom.viewport, function (dir) {
        return stepSection(dir, dir > 0 ? 'top' : 'bottom');
      });
    }

    dom.hudTotal.textContent = '/ ' + U.pad(config.sections.length, 2);
    dom.viewport.addEventListener('scroll', U.rafThrottle(updateScrollState), { passive: true });

    /* 首屏：只渲染地址栏指向的章节（默认第一章），其余章节等点到再渲染 */
    var initial = sectionFromHash() || config.sections[0].id;
    switchTo(initial, { immediate: true });
  }

  /* 侧栏品牌信息（侧栏只有品牌 + Tab，无其他内容） */
  function applyMeta() {
    var m = config.meta || {};
    var t = document.getElementById('brandTitle');
    var s = document.getElementById('brandSub');
    if (m.title) { t.textContent = m.title; document.title = m.title + (m.subtitle ? ' · ' + m.subtitle : '') + ' — UI/UX 作品集'; }
    if (m.subtitle) s.textContent = m.subtitle;
  }

  /* ----------------------------------------------------------------------
     章节切换
     ---------------------------------------------------------------------- */
  function getSection(id) {
    return config.sections.filter(function (s) { return s.id === id; })[0];
  }

  /* 按需渲染：第一次访问时才创建 DOM */
  function ensureSection(id) {
    if (cache[id]) return cache[id];
    var sec = getSection(id);
    if (!sec) return null;

    var built = PF.render.createSection(sec);
    /* 首屏若干区块做阶梯式入场（延迟按序号递增，避免所有区块同时动画） */
    Array.prototype.forEach.call(built.node.querySelectorAll('.block'), function (b, i) {
      b.style.setProperty('--i', Math.min(i, 5));
    });

    cache[id] = { node: built.node, items: built.items, scroll: 0 };
    return cache[id];
  }

  function switchTo(id, opts) {
    opts = opts || {};
    var sec = getSection(id);
    if (!sec || (id === activeId && !opts.force)) return;

    /* 上一次切换还在 160ms 淡出倒计时中：先把它立即落定。
       否则两次切换的 commit 会交错执行 —— 本次捕获的 prev 是过期的
       activeId，中间那个章节节点就永远没人移除，堆在页面里造成
       「内容重复」。快速连点 Tab / 连滚加点击时必现 */
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
      if (pendingCommit) pendingCommit();
    }

    var entry = ensureSection(id);
    if (!entry) return;

    /* 记录当前章节的滚动位置，切回时恢复 */
    if (activeId && cache[activeId]) cache[activeId].scroll = dom.viewport.scrollTop;

    var prev = activeId ? cache[activeId] : null;
    var delay = 0;

    if (prev && !opts.immediate) {
      prev.node.classList.add('is-leaving');   /* 旧章节快速淡出，再挂新章节，避免重排抖动 */
      delay = 160;
    }

    var commit = function () {
      pendingTimer = null;
      pendingCommit = null;

      if (prev) {
        PF.reveal.clear(prev.node);
        prev.node.classList.remove('is-leaving', 'is-entering');
        if (prev.node.parentNode) prev.node.parentNode.removeChild(prev.node);
      }

      /* 兜底：正常流程上面已把旧节点摘掉，这里再清一次任何历史残留，
         保证舞台里永远只有当前一个章节 */
      Array.prototype.forEach.call(
        dom.viewport.querySelectorAll('.section'),
        function (n) { if (n !== entry.node && n.parentNode) n.parentNode.removeChild(n); }
      );

      dom.viewport.appendChild(entry.node);

      /* align 由滚轮翻章传入：滚轮是连续滚动的延伸，新章要接在滚动的方向上 ——
         向下滚进来落在新章顶部，向上滚进来落在新章底部；
         其余入口（点 Tab / 方向键 / 翻页按钮）沿用「记住上次位置」 */
      var align = opts.align || '';
      if (align === 'top') setScroll(0);
      else if (align !== 'bottom') setScroll(opts.immediate ? 0 : (entry.scroll || 0));

      PF.reveal.scan(entry.node);
      if (PF.carousel) PF.carousel.sync(entry.node);  /* 轮播组装 + 与上一卡片 80px 间距 */
      if (PF.tiles) PF.tiles.sync(entry.node);        /* 倾斜网格：组装 + 立即取一次滚动进度 */
      if (PF.stack) PF.stack.sync(entry.node);        /* 滚动堆叠：组装 + 80px 间距校准 */

      /* 向上滚翻页：区块尺寸结算完 scrollHeight 才是终值，此时再落到新章底部 */
      if (align === 'bottom') setScroll(dom.viewport.scrollHeight);
      entry.scroll = dom.viewport.scrollTop;          /* 记住本章当前位置，切回时恢复 */

      /* 入场动画期间（堆叠测量、图片落位）高度还会微调，稍后再贴一次边；
         若用户此刻已经自己滚开了，就不打断他 */
      if (align) {
        setTimeout(function () {
          if (activeId !== id) return;
          var v = dom.viewport;
          var nearEdge = align === 'bottom'
            ? v.scrollTop + v.clientHeight >= v.scrollHeight - 120
            : v.scrollTop <= 120;
          if (!nearEdge) return;
          setScroll(align === 'bottom' ? v.scrollHeight : 0);
          entry.scroll = v.scrollTop;
        }, 340);
      }

      /* 入场动效 */
      entry.node.classList.add('is-entering');
      var total = entry.node.querySelectorAll('.block').length;
      setTimeout(function () { entry.node.classList.remove('is-entering'); },
        Math.min(total, 6) * 45 + 520);

      activeId = id;
      PF.nav.setActive(id, !!opts.focusTab);
      if (dom.hudName) dom.hudName.textContent = sec.label || sec.id;
      if (dom.hudTotal) dom.hudTotal.textContent = '/ ' + U.pad(total, 2);

      updatePager();
      updateScrollState();
      if (!opts.silentHash) writeHash(id);
    };

    if (delay) { pendingCommit = commit; pendingTimer = setTimeout(commit, delay); }
    else commit();
  }

  /* 上/下章节按钮 */
  function bindPager() {
    dom.prevBtn.addEventListener('click', function () { stepSection(-1); });
    dom.nextBtn.addEventListener('click', function () { stepSection(1); });
  }

  /** 翻到相邻章节；返回是否真的翻动了（滚轮用它判断是否已到头） */
  function stepSection(dir, align) {
    var idx = indexOf(activeId);
    var next = config.sections[idx + dir];
    if (!next) return false;
    switchTo(next.id, { align: align, silentHash: false });
    return true;
  }

  function indexOf(id) {
    for (var i = 0; i < config.sections.length; i++) {
      if (config.sections[i].id === id) return i;
    }
    return 0;
  }

  function updatePager() {
    var i = indexOf(activeId);
    dom.prevBtn.disabled = i <= 0;
    dom.nextBtn.disabled = i >= config.sections.length - 1;
  }

  /* 滚动定位：临时关掉 smooth，避免恢复位置时出现长距离动画 */
  function setScroll(top) {
    var prev = dom.viewport.style.scrollBehavior;
    dom.viewport.style.scrollBehavior = 'auto';
    dom.viewport.scrollTop = top;
    /* 强制读取一次布局，确保设置立即生效，再恢复 */
    void dom.viewport.offsetHeight;
    dom.viewport.style.scrollBehavior = prev;
  }

  /* 状态条：显示当前所在「第几屏」（滚动时实时更新一条文本，成本极低） */
  function updateScrollState() {
    var entry = activeId ? cache[activeId] : null;
    if (!entry) return;
    var blocks = entry.node.querySelectorAll('.block');
    if (!blocks.length) return;

    var top = dom.viewport.scrollTop + dom.viewport.clientHeight * 0.35;
    var i = 0;
    for (var n = 0; n < blocks.length; n++) {
      if (blocks[n].offsetTop <= top) i = n;
    }
    dom.hudIdx.textContent = U.pad(i + 1, 2);
  }

  /* ----------------------------------------------------------------------
     舞台交互：点击作品 → 打开灯箱
     ---------------------------------------------------------------------- */
  function bindStage() {
    dom.viewport.addEventListener('click', function (e) {
      /* 作品卡片 / 轮播卡片 / 倾斜网格小图 / 堆叠卡片（含克隆，同一套 data-*） */
      var card = closest(e.target, '.media') || closest(e.target, '.gcard') ||
        closest(e.target, '.tile') || closest(e.target, '.scard');
      if (!card) return;

      var id = card.getAttribute('data-section');
      var entry = cache[id];
      if (!entry) return;

      var idx = parseInt(card.getAttribute('data-index'), 10) || 0;
      PF.lightbox.open(entry.items, idx);
    });

    /* 键盘用户：卡片 / 轮播卡片获得焦点后回车 / 空格打开 */
    dom.viewport.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = closest(e.target, '.media') || closest(e.target, '.gcard') ||
        closest(e.target, '.tile') || closest(e.target, '.scard');
      if (!card) return;
      e.preventDefault();
      card.click();
    });
  }

  function closest(node, selector) {
    while (node && node !== document) {
      if (node.nodeType === 1 && node.matches(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  /* ----------------------------------------------------------------------
     地址栏 hash 同步：可直接把链接发给面试官定位到某一章节
     ---------------------------------------------------------------------- */
  function sectionFromHash() {
    var raw = (location.hash || '').replace(/^#\/?/, '');
    if (!raw) return null;
    try { raw = decodeURIComponent(raw); } catch (err) { /* 忽略非法编码 */ }
    return getSection(raw) ? raw : null;
  }

  function writeHash(id) {
    if (sectionFromHash() === id) return;
    /* 用 hash 写入历史：面试时可直接分享 #章节id，浏览器前进/后退也能用 */
    location.hash = id;
  }

  function bindHash() {
    window.addEventListener('hashchange', function () {
      var id = sectionFromHash();
      if (id && id !== activeId) switchTo(id, { focusTab: false, silentHash: true });
    });
  }

  /* ----------------------------------------------------------------------
     键盘快捷键：Alt + ←/→ 切换章节，Home 回到首屏
     ---------------------------------------------------------------------- */
  function bindShortcuts() {
    document.addEventListener('keydown', function (e) {
      if (PF.lightbox.isOpen()) return;
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;

      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); stepSection(-1); }
      else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); stepSection(1); }
      else if (e.key === 'Home' && !e.altKey && !e.ctrlKey) { e.preventDefault(); switchTo(config.sections[0].id); }
    });
  }

  /* 启动 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
