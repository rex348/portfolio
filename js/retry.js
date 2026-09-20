/* ==========================================================================
   retry.js — 素材加载失败自动重试（弱网 / 大陆访问 CDN 波动兜底）
   机制：
   · <img> 失败：捕获全局 error 事件（捕获阶段，error 不冒泡）
   · <video> 失败：Chrome 的媒体元素网络失败往往只置 el.error 而不派发
     error 事件 —— 用 2s 轮询扫描兜底（每章仅数个 video，开销可忽略）
   · 首次失败 ~ 800ms 后带 _pfretry=1 参数重试，之后 2s / 4s 退避重试，共 3 次
   · 重试期间不触发卡片「加载失败」样式；3 次耗尽才放行失败兜底
     （img 走原生 error 事件冒泡；video 主动派发合成 error 事件，
      复用 render.js 原有的 is-failed / 封面退回 poster 逻辑）
   · 浏览器恢复在线（online 事件）时，把彻底失败的素材再整体救一轮
   说明：自动挂载，无需在 app.js 里 init；对轮播克隆节点同样生效
   ========================================================================== */

PF.retry = (function () {
  'use strict';

  var MAX = 3;                       /* 最多重试 3 次 */
  var DELAYS = [800, 2000, 4000];    /* 每次重试前的退避等待 */
  var failed = [];                   /* 3 次耗尽仍失败的元素，等网络恢复再救 */

  /* 找到素材所在的卡片容器（复用现有 .is-failed 样式体系） */
  function cardOf(node) {
    while (node && node !== document) {
      if (node.nodeType === 1 && node.classList &&
        (node.classList.contains('media') || node.classList.contains('gcard') ||
          node.classList.contains('tile') || node.classList.contains('scard'))) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  /* 记住原始 src（不带重试参数），重试始终从干净地址出发 */
  function rememberSrc(el) {
    if (el.getAttribute('data-pfsrc')) return;
    var s = el.getAttribute('src');
    if (s) el.setAttribute('data-pfsrc', s);
  }

  /** 尝试重试；返回 false 表示次数耗尽，应走失败兜底 */
  function attempt(el) {
    if (el.getAttribute('data-pfgaveup')) return false;   /* 已判死刑，等 online 再救 */

    var n = (parseInt(el.getAttribute('data-pfretry'), 10) || 0) + 1;
    rememberSrc(el);
    var base = el.getAttribute('data-pfsrc');
    if (!base || n > MAX) {
      el.removeAttribute('data-pfretry');
      el.setAttribute('data-pfgaveup', '1');
      if (failed.indexOf(el) === -1) failed.push(el);
      return false;
    }

    el.setAttribute('data-pfretry', String(n));
    el.setAttribute('data-pfbusy', '1');   /* 退避等待期间不再重复触发 */
    var card = cardOf(el);
    if (card) card.classList.remove('is-failed');

    setTimeout(function () {
      el.removeAttribute('data-pfbusy');
      if (!el.isConnected) return;   /* 章节已切走，节点被移除则放弃 */
      el.src = base + (base.indexOf('?') > -1 ? '&' : '?') + '_pfretry=' + n;
      if (el.tagName === 'VIDEO') el.load();
    }, DELAYS[n - 1]);
    return true;
  }

  /* error（捕获阶段）：img 加载失败 → 先自行重试 */
  document.addEventListener('error', function (e) {
    var el = e.target;
    if (!el || el.nodeType !== 1) return;
    if (el.tagName !== 'IMG' && el.tagName !== 'VIDEO') return;
    if (!el.getAttribute('src')) return;
    if (attempt(el)) e.stopPropagation();
  }, true);

  /* video 专用兜底：Chrome 媒体元素网络失败不派发 error 事件，
     每 2s 扫一遍当前 DOM 里的 video，发现 el.error 已置位即接手重试 */
  setInterval(function () {
    if (!document.querySelector) return;
    var vids = document.querySelectorAll('video[src]');
    for (var i = 0; i < vids.length; i++) {
      var v = vids[i];
      if (!v.error || v.getAttribute('data-pfgaveup') || v.getAttribute('data-pfbusy')) continue;
      if (!attempt(v)) {
        /* 耗尽：派发合成 error 事件，让 render.js 的原有兜底生效
           （.is-failed 提示 / 封面视频退回 poster） */
        v.dispatchEvent(new Event('error'));
      }
    }
  }, 2000);

  /* 加载成功：清掉重试标记，下次失败仍享有完整 3 次机会 */
  function onOk(e) {
    var el = e.target;
    if (!el || (el.tagName !== 'IMG' && el.tagName !== 'VIDEO')) return;
    el.removeAttribute('data-pfretry');
    el.removeAttribute('data-pfsrc');
    el.removeAttribute('data-pfgaveup');
    var i = failed.indexOf(el);
    if (i > -1) failed.splice(i, 1);
  }
  document.addEventListener('load', onOk, true);        /* img */
  document.addEventListener('loadeddata', onOk, true);  /* video 首帧可播 */

  /* 网络恢复在线：把彻底失败的素材再整体救一轮 */
  window.addEventListener('online', function () {
    var list = failed.splice(0);
    list.forEach(function (el) {
      if (el.isConnected) {
        el.removeAttribute('data-pfretry');
        el.removeAttribute('data-pfgaveup');
        attempt(el);
      }
    });
  });

  return { attempt: attempt };
})();
