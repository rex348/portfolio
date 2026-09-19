/* ==========================================================================
   nav.js — 左侧章节导航
   桌面端：固定侧栏；移动端：抽屉 + 遮罩
   ========================================================================== */

PF.nav = (function () {
  'use strict';

  var U = PF.util;
  var dom = {};
  var sections = [];
  var onSelect = null;
  var veil = null;

  function init(sectionList, selectHandler) {
    sections = sectionList;
    onSelect = selectHandler;

    dom.sidebar = document.getElementById('sidebar');
    dom.nav = document.getElementById('nav');
    dom.menuBtn = document.getElementById('menuBtn');
    dom.topbarTitle = document.getElementById('topbarTitle');

    build();
    bindDrawer();
  }

  /* 生成 Tab 列表 */
  function build() {
    var frag = document.createDocumentFragment();

    sections.forEach(function (sec, i) {
      var btn = U.el('button', {
        class: 'nav__item',
        id: 'tab-' + sec.id,
        type: 'button',
        role: 'tab',
        'aria-selected': 'false',
        'aria-controls': 'sec-' + sec.id,
        'data-id': sec.id,
        tabindex: '-1'
      }, [
        U.el('span', { class: 'nav__no', text: U.pad(i + 1, 2) }),
        U.el('span', { class: 'nav__label' }, [
          document.createTextNode(sec.label || sec.id),
          sec.en ? U.el('span', { class: 'nav__en', text: sec.en }) : null
        ])
      ]);

      btn.addEventListener('click', function () {
        onSelect(sec.id);
        closeDrawer();
      });

      frag.appendChild(btn);
    });

    dom.nav.appendChild(frag);
    dom.items = dom.nav.querySelectorAll('.nav__item');

    /* 上下方向键在 Tab 之间移动（符合 tablist 的无障碍约定） */
    dom.nav.addEventListener('keydown', function (e) {
      var list = Array.prototype.slice.call(dom.items);
      var idx = list.indexOf(document.activeElement);
      if (idx < 0) return;

      var next = null;
      if (e.key === 'ArrowDown') next = list[(idx + 1) % list.length];
      else if (e.key === 'ArrowUp') next = list[(idx - 1 + list.length) % list.length];
      else if (e.key === 'Home') next = list[0];
      else if (e.key === 'End') next = list[list.length - 1];
      if (!next) return;

      e.preventDefault();
      next.focus();
      onSelect(next.getAttribute('data-id'));
    });
  }

  /* 统计章节媒体数量 —— Tab 角标已按要求去掉，此函数保留备用（如需恢复角标直接调用） */
  function countMedia(sec) {
    return (sec.blocks || []).reduce(function (n, b) {
      /* note 文字卡（如「关于我」）没有 items，也计 1，与原版角标一致；
         gallery / tiles / stack（跑马灯、倾斜网格、滚动堆叠）为展示性区块，不计入角标 */
      if (b.items) {
        return n + (b.layout === 'gallery' || b.layout === 'tiles' ||
          b.layout === 'stack' ? 0 : b.items.length);
      }
      return n + (b.layout === 'note' ? 1 : 0);
    }, 0);
  }

  /* 高亮当前 Tab */
  function setActive(id, focusTab) {
    if (!dom.items) return;
    Array.prototype.forEach.call(dom.items, function (btn) {
      var active = btn.getAttribute('data-id') === id;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
      if (active) {
        if (focusTab) btn.focus({ preventScroll: true });
        ensureVisible(btn);
      }
    });

    var sec = sections.filter(function (s) { return s.id === id; })[0];
    if (sec && dom.topbarTitle) dom.topbarTitle.textContent = sec.label || sec.id;
  }

  /* Tab 滚出可视区时自动滚进视野（章节多时很有用） */
  function ensureVisible(btn) {
    var box = dom.nav;
    var top = btn.offsetTop;
    var bottom = top + btn.offsetHeight;
    if (top < box.scrollTop) box.scrollTo({ top: top - 8, behavior: 'smooth' });
    else if (bottom > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: bottom - box.clientHeight + 8, behavior: 'smooth' });
    }
  }

  /**
   * 滚轮已滚到首/末章尽头时的原地反馈：
   * 给当前 Tab 一次朝该方向的短促推动，让「下面/上面没有了」这件事可见。
   * 用 CSS 独立属性 translate 做位移，不与 :hover 的 transform 打架。
   */
  function bump(dir) {
    if (!dom.nav) return;
    var active = dom.nav.querySelector('.nav__item.is-active');
    if (!active) return;

    var cls = dir > 0 ? 'is-bump-down' : 'is-bump-up';
    active.classList.remove('is-bump-down', 'is-bump-up');
    void active.offsetWidth;               /* 强制重排，让连续两次滚动都能重放动画 */
    active.classList.add(cls);
    setTimeout(function () { active.classList.remove(cls); }, 440);
  }

  /* ------------------------- 移动端抽屉 ------------------------------- */
  function bindDrawer() {
    if (!dom.menuBtn) return;

    veil = U.el('div', { class: 'drawer-veil', 'aria-hidden': 'true' });
    veil.addEventListener('click', closeDrawer);
    /* 挂进 .app：与侧栏共享同一个堆叠上下文，保证遮罩(z:35)在侧栏(z:40)之下、顶栏(z:30)之上 */
    var host = document.querySelector('.app') || document.body;
    host.appendChild(veil);

    dom.menuBtn.addEventListener('click', function () {
      if (dom.sidebar.classList.contains('is-open')) closeDrawer();
      else openDrawer();
    });

    /* Esc 关闭抽屉 */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dom.sidebar.classList.contains('is-open')) closeDrawer();
    });
  }

  function openDrawer() {
    veil.classList.add('is-open');
    dom.sidebar.classList.add('is-open');
    dom.menuBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('drawer-open');
  }

  function closeDrawer() {
    veil.classList.remove('is-open');
    dom.sidebar.classList.remove('is-open');
    dom.menuBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-open');
  }

  return { init: init, setActive: setActive, bump: bump, closeDrawer: closeDrawer };
})();
