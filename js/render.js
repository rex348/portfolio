/* ==========================================================================
   render.js — 把 config 渲染成 DOM
   只做「数据 → 结构」，不掺交互逻辑（交互在 reveal / lightbox / app 中）
   ========================================================================== */

PF.render = (function () {
  'use strict';

  var U = PF.util;
  var el = U.el;

  /* 图标路径（24×24，线性风格，和整体调性一致） */
  var ICONS = {
    expand: 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
    play: 'M8 5l11 7-11 7z'
  };

  /* ------------------------------------------------------------------------
     单条素材 → 作品卡片
     ---------------------------------------------------------------------- */
  function createMedia(item, sectionId) {
    var isVideo = item.type === 'video';
    var card = el('figure', {
      class: 'media reveal',
      'data-index': item.index,
      'data-type': item.type,
      'data-section': sectionId,
      'data-zoomable': 'true',
      'data-fill': item.fill ? 'true' : 'false',
      'data-fallback': item.title
        ? '「' + item.title + '」素材未找到\n' + item.src
        : '素材未找到\n' + item.src,
      tabindex: '0',
      role: 'button',
      'aria-label': (item.title || '作品') + ' — 查看大图'
    });

    var mediaEl;
    if (isVideo) {
      mediaEl = el('video', {
        class: 'media__el',
        src: item.src,
        poster: item.poster || null,
        muted: item.muted,
        loop: item.loop,
        playsinline: true,
        preload: 'metadata',
        controls: item.controls
      });
      /* 视频默认静音自动播放：由 reveal.js 在进入视口时 play()，离开时 pause() */
      mediaEl.setAttribute('data-autoplay', item.autoplay ? 'true' : 'false');
      /* Chrome 对动态创建的 video 不识别 muted 内容属性，必须用 JS 属性赋值 */
      mediaEl.muted = item.muted !== false;
    } else {
      mediaEl = el('img', {
        class: 'media__el',
        src: item.src,
        alt: item.alt,
        loading: 'lazy',      /* 原生懒加载：首屏只加载可见图片 */
        decoding: 'async',
        draggable: 'false'
      });
      mediaEl.setAttribute('data-loading', 'true');
      mediaEl.addEventListener('load', function () {
        mediaEl.removeAttribute('data-loading');
        card.classList.add('is-loaded');
      }, { once: true });
    }

    /* 加载失败兜底：提示正确的素材路径，方便替换图片时排查 */
    mediaEl.addEventListener('error', function () {
      card.classList.add('is-failed');
    }, { once: true });

    card.appendChild(mediaEl);

    /* 视频 / GIF 角标 */
    if (isVideo || item.type === 'gif') {
      card.appendChild(el('span', { class: 'media__tag', 'aria-hidden': 'true' }, [
        el('i'),
        isVideo ? 'Video' : 'GIF'
      ]));
    }

    /* 缩放提示按钮 */
    card.appendChild(el('button', {
      class: 'media__zoom',
      type: 'button',
      tabindex: '-1',
      'aria-hidden': 'true'
    }, [U.icon(ICONS.expand)]));

    /* 只保留画面本身：卡片角落不再渲染任何文案（title/desc 仅用于无障碍与兜底提示） */

    return card;
  }

  /* ------------------------------------------------------------------------
     区块标题条
     ---------------------------------------------------------------------- */
  function createHead(block, no) {
    if (!block.title && !block.desc) return null;
    return el('header', { class: 'block__head' }, [
      el('span', { class: 'block__no', text: U.pad(no, 2) }),
      block.title ? el('h3', { class: 'block__title', text: block.title }) : null,
      block.desc ? el('span', { class: 'block__desc', text: block.desc }) : null
    ]);
  }

  /* ------------------------------------------------------------------------
     文字卡片内容（封面 / 关于我 / 封面浮层共用）
     ---------------------------------------------------------------------- */
  function buildNoteCard(block, extraClass) {
    var card = el('div', { class: 'note' + (extraClass ? ' ' + extraClass : '')
      + (block.noteWide ? ' note--wide' : '') });

    if (block.kicker) card.appendChild(el('span', { class: 'note__kicker', text: block.kicker }));
    if (block.title) card.appendChild(el('h2', { class: 'note__title', text: block.title }));

    (block.text || []).forEach(function (t) {
      card.appendChild(el('p', { class: 'note__text', text: t }));
    });

    if (block.meta && block.meta.length) {
      var dl = el('dl', { class: 'note__meta' });
      block.meta.forEach(function (m) {
        dl.appendChild(el('div', { class: 'note__metaItem' }, [
          el('dt', { text: m.k }),
          el('dd', { text: m.v })
        ]));
      });
      card.appendChild(dl);
    }

    return card;
  }

  function createNote(block) {
    return el('div', { class: 'block block--note' }, [buildNoteCard(block, '')]);
  }

  /* ------------------------------------------------------------------------
     通栏无限滚动跑马灯区块（layout:'gallery'）
     大标题 + 居中的描述 + 铺满窗口宽度的匀速无限滚动卡片
     · 默认卡片 1440×900（16:10）；block.ratio:'portrait' 时为手机竖版 750×1624
     · 匀速连续滚动 + 无缝循环 + 拖拽（carousel.js）；点击卡片放大预览（app.js 灯箱）
     ---------------------------------------------------------------------- */
  function createGallery(block, sectionId, items) {
    var node = el('div', { class: 'block block--gallery' });
    if (block.ratio === 'portrait') node.classList.add('block--gallery--portrait');
    items = items || [];

    if (block.title) {
      var h = el('h2', { class: 'gallery__title reveal', text: block.title });
      h.style.setProperty('--ri', 0);
      node.appendChild(h);
    }

    /* 描述段落：位于标题下方（24px），居中显示
       字符串 = 普通文字（50% 白）；{ t, em:true } = 强调（100% 白 + 加粗） */
    if (block.desc && block.desc.length) {
      var p = el('p', { class: 'gallery__desc reveal' });
      p.style.setProperty('--ri', 1);
      block.desc.forEach(function (seg) {
        if (typeof seg === 'string') {
          p.appendChild(document.createTextNode(seg));
        } else if (seg && seg.t) {
          p.appendChild(el('strong', { class: 'gallery__em', text: seg.t }));
        }
      });
      node.appendChild(p);
    }

    if (items.length) {
      var car = el('div', { class: 'gallery__carousel reveal' });
      car.style.setProperty('--ri', 2);

      var vp = el('div', {
        class: 'carousel__viewport',
        role: 'region',
        'aria-roledescription': '轮播',
        'aria-label': block.title || '图片轮播'
      });

      var track = el('div', { class: 'carousel__track', role: 'list' });
      items.forEach(function (item, i) {
        var card = el('figure', {
          class: 'gcard',
          role: 'listitem',
          tabindex: '0',
          'aria-label': (item.title || '第 ' + (i + 1) + ' 张') + ' — 点击放大预览',
          /* 交给灯箱打开大图预览（与作品卡片同一套机制）
             —— 循环克隆会复制这份 data-*，因此克隆卡片也能正确打开对应大图 */
          'data-zoomable': 'true',
          'data-index': item.index,
          'data-type': item.type,
          'data-section': sectionId
        });

        var media = el('span', { class: 'gcard__media' }, [
          el('img', {
            class: 'gcard__img',
            src: item.src,
            alt: item.alt || item.title || '',
            loading: 'lazy',
            decoding: 'async',
            draggable: 'false'
          })
        ]);
        media.addEventListener('error', function () {
          media.classList.add('is-failed');
        }, { once: true });

        card.appendChild(media);
        /* 卡片内不渲染任何文字提示 */
        track.appendChild(card);
      });

      vp.appendChild(track);
      car.appendChild(vp);

      /* 通栏无限滚动跑马灯：无左右箭头（连续滚动 + 可拖拽），
         自动滚动的启停 / 克隆补位 / 拖拽交互全在 carousel.js */
      node.appendChild(car);
    }

    return node;
  }

  /* ------------------------------------------------------------------------
     倾斜网格区块（layout:'tiles'）—— 参考 React Bits Pro「Tilted Tiles」
     通栏高度受限的倾斜图片列网格：整组绕 Z 轴微倾，滚动时各列按不同速率
     反向漂移（视差）。交互细节在 tiles.js（滚动进度驱动，逐帧写 transform）。
     · title / desc  可选，与画廊同一套排版（大标题 + 居中富文本描述）
     · items     参与网格的素材（自动轮转分配到各列，并纵向重复铺满漂移行程）
     · columns   列数（可选，默认 5，窄屏由 CSS 自动收窄到 3）
     · 点击小图同样可在灯箱放大预览
     ---------------------------------------------------------------------- */
  function createTiles(block, sectionId, items) {
    var node = el('div', { class: 'block block--tiles' });
    items = items || [];

    if (block.title) {
      var h = el('h2', { class: 'gallery__title reveal', text: block.title });
      h.style.setProperty('--ri', 0);
      node.appendChild(h);
    }

    /* 描述段落：与画廊同一套写法（字符串 = 50% 白；{ t, em:true } = 100% 白 + 加粗） */
    if (block.desc && block.desc.length) {
      var p = el('p', { class: 'gallery__desc reveal' });
      p.style.setProperty('--ri', 1);
      block.desc.forEach(function (seg) {
        if (typeof seg === 'string') {
          p.appendChild(document.createTextNode(seg));
        } else if (seg && seg.t) {
          p.appendChild(el('strong', { class: 'gallery__em', text: seg.t }));
        }
      });
      node.appendChild(p);
    }

    if (items.length) {
      var wrap = el('div', { class: 'tiles reveal', 'data-tiles': 'true' });
      wrap.style.setProperty('--ri', 2);

      var cols = Math.max(2, block.columns || 5);
      var colNodes = [];
      var inner = el('div', { class: 'tiles__inner' });
      for (var c = 0; c < cols; c++) {
        var col = el('div', { class: 'tiles__col' });
        colNodes.push(col);
        inner.appendChild(col);
      }

      /* 素材分配：每列基础张数严格一致（列内循环取材、列间错位起步），
         旧写法按 items 序号取模分列，items 不能整除列数时右侧几列会明显偏短，
         滚动到下半段就会出现「右下角露底」；这里保证各列等高起步，
         不足的部分再由 tiles.js 的 ensureFill 按实际视口尺寸自动补齐 */
      var REPEAT = 3;
      for (var c = 0; c < cols; c++) {
        for (var r = 0; r < REPEAT; r++) {
          colNodes[c].appendChild(createTile(items[(c + r * cols) % items.length], sectionId));
        }
      }

      wrap.appendChild(inner);
      node.appendChild(wrap);
    }

    return node;
  }

  /* 单块倾斜网格小图（可点击放大，但默认不进键盘 Tab 序列，装饰性弱化） */
  function createTile(item, sectionId) {
    var tile = el('figure', {
      class: 'tile',
      'data-zoomable': 'true',
      'data-index': item.index,
      'data-type': item.type,
      'data-section': sectionId,
      'aria-label': (item.title || '作品') + ' — 点击放大预览'
    }, [
      el('img', {
        class: 'tile__img',
        src: item.src,
        alt: item.alt || item.title || '',
        loading: 'lazy',
        decoding: 'async',
        draggable: 'false'
      })
    ]);
    tile.querySelector('img').addEventListener('error', function () {
      tile.classList.add('is-failed');
    }, { once: true });
    return tile;
  }

  /* ------------------------------------------------------------------------
     滚动堆叠区块（layout:'stack'）—— 参考 React Bits Pro「Scroll Stack」
     「Pinned cards that stack, turn and dissolve as the page scrolls」：
     卡片随页面滚动被钉住（sticky），新卡从下方垂直升起压到顶上（不旋转），
     旧卡被压入卡堆：缩小、模糊、溶解。交互细节在 stack.js。
     · title / desc  可选，与画廊同一套排版（大标题 + 居中富文本描述）
     · items         卡片素材（1920×940，卡片同比例完美呈现不裁切；
                     支持图片与 MP4 —— MP4 默认停第一帧，悬停播放、移出复位）
     · 点击卡片同样可在灯箱放大预览
     ---------------------------------------------------------------------- */
  function createStack(block, sectionId, items) {
    var node = el('div', { class: 'block block--stack' });
    items = items || [];

    if (block.title) {
      var h = el('h2', { class: 'gallery__title reveal', text: block.title });
      h.style.setProperty('--ri', 0);
      node.appendChild(h);
    }

    /* 描述段落：与画廊同一套写法（字符串 = 50% 白；{ t, em:true } = 100% 白 + 加粗） */
    if (block.desc && block.desc.length) {
      var p = el('p', { class: 'gallery__desc reveal' });
      p.style.setProperty('--ri', 1);
      block.desc.forEach(function (seg) {
        if (typeof seg === 'string') {
          p.appendChild(document.createTextNode(seg));
        } else if (seg && seg.t) {
          p.appendChild(el('strong', { class: 'gallery__em', text: seg.t }));
        }
      });
      node.appendChild(p);
    }

    /* 徽章网格（block.badges）：标题下方 50px，一行 4 个，行距 40px；
       APNG 原样用 <img> 呈现（浏览器原生播动画，不做任何转码/改格式），
       每张按素材原始尺寸等比缩小 3 倍显示（onload 后按 naturalWidth/3 设宽） */
    if (block.badges && block.badges.length) {
      var badges = el('div', { class: 'badges reveal' });
      badges.style.setProperty('--ri', block.desc && block.desc.length ? 2 : 1);

      block.badges.forEach(function (raw) {
        var src = typeof raw === 'string' ? raw : (raw && raw.src);
        if (!src) return;
        var img = el('img', {
          class: 'badges__img',
          src: src,
          alt: (raw && raw.title) || '徽章',
          loading: 'lazy',
          decoding: 'async',
          draggable: 'false'
        });
        img.addEventListener('load', function () {
          /* 宽高等比缩小 3 倍：以素材原始尺寸为准，高度交给比例自适应 */
          img.style.width = Math.round(img.naturalWidth / 3) + 'px';
        }, { once: true });
        badges.appendChild(img);
      });

      node.appendChild(badges);
    }

    if (items.length) {
      var wrap = el('div', { class: 'stack reveal', 'data-stack': 'true' });
      wrap.style.setProperty('--ri', 2);

      var stage = el('div', { class: 'stack__stage' });
      items.forEach(function (item, i) {
        var isVideo = item.type === 'video';
        var card = el('figure', {
          class: 'scard' + (isVideo ? ' scard--video' : ''),
          tabindex: '0',
          'aria-label': (item.title || '第 ' + (i + 1) + ' 张') + ' — 点击放大预览',
          'data-zoomable': 'true',
          'data-index': item.index,
          'data-type': item.type,
          'data-section': sectionId
        });

        var mediaEl;
        if (isVideo) {
          /* MP4 卡片：默认停在第一帧；悬停播放、移出回到第一帧（交互在 stack.js） */
          mediaEl = el('video', {
            class: 'scard__img',
            src: item.src,
            poster: item.poster || null,
            muted: true,
            loop: item.loop,
            playsinline: true,
            preload: 'metadata'
          });
          /* Chrome 对动态创建的 video 不识别 muted 内容属性，必须用 JS 属性赋值 */
          mediaEl.muted = true;
          mediaEl.setAttribute('data-hoverplay', 'true');
        } else {
          mediaEl = el('img', {
            class: 'scard__img',
            src: item.src,
            alt: item.alt || item.title || '',
            loading: 'lazy',
            decoding: 'async',
            draggable: 'false'
          });
        }
        card.appendChild(mediaEl);
        mediaEl.addEventListener('error', function () {
          card.classList.add('is-failed');
        }, { once: true });

        /* 视频角标：提示可悬停播放，播放时淡出（.scard.is-playing） */
        if (isVideo) {
          card.appendChild(el('span', { class: 'scard__tag', 'aria-hidden': 'true' }, [
            el('i'), 'Video'
          ]));
        }
        stage.appendChild(card);
      });

      /* sticky 钉住层（占满一屏、overflow 裁切）> 卡片舞台（stack.js 驱动变换） */
      var vp = el('div', { class: 'stack__viewport' });
      vp.appendChild(stage);
      wrap.appendChild(vp);
      node.appendChild(wrap);
    }

    return node;
  }

  /* ------------------------------------------------------------------------
     全屏封面区块：媒体铺满整屏（纯背景，无文案时只留一层极轻的边缘压暗）
     media 支持 video（MP4，推荐）/ gif / image；视频不可播时自动退回 poster
     配置了 kicker / title / text / meta 时才会渲染文案浮层（向后兼容）
     ---------------------------------------------------------------------- */
  function createCover(block) {
    var m = U.normalizeItem(block.media || {}, 0);
    var ct = block.coverTitle || null;          /* 封面大标题（coverTitle.lines 上下两行 + sub 副标题） */
    var hasText = !!(ct || block.kicker || block.title ||
      (block.text && block.text.length) || (block.meta && block.meta.length));
    var wrap = el('div', { class: 'cover' + (hasText ? '' : ' cover--bare') });
    var mediaEl;

    if (m.type === 'video') {
      mediaEl = el('video', {
        class: 'cover__media',
        src: m.src,
        poster: m.poster || null,
        muted: true,          /* 浏览器策略：静音才允许自动播放 */
        loop: true,
        playsinline: true,
        autoplay: true,
        preload: 'auto'
      });
      mediaEl.setAttribute('data-autoplay', 'true');   /* reveal.js 入视口自动播放 */
      /* Chrome 对动态创建的 video 不识别 muted 内容属性，必须用 JS 属性赋值 */
      mediaEl.muted = true;
      /* 编码不支持 / 视频加载失败 → 退回封面图，保证任何浏览器都有画面 */
      mediaEl.addEventListener('error', function () {
        if (!m.poster) return;
        wrap.replaceChild(
          el('img', { class: 'cover__media', src: m.poster, alt: block.title || '封面' }),
          mediaEl
        );
      }, { once: true });
    } else {
      mediaEl = el('img', { class: 'cover__media', src: m.src, alt: block.title || '封面', decoding: 'async' });
    }

    wrap.appendChild(mediaEl);
    wrap.appendChild(el('div', { class: 'cover__scrim' }));

    if (hasText) {
      var body = el('div', { class: 'cover__body' });
      if (ct && ct.lines && ct.lines.length) {
        /* 封面主标题：上下结构的超大展示字（样式见 cover.css .cover__hero） */
        var hero = el('h1', { class: 'cover__hero' });
        ct.lines.forEach(function (line, i) {
          var span = el('span', { class: 'cover__heroLine', text: line });
          span.style.setProperty('--ci', i);
          hero.appendChild(span);
        });
        body.appendChild(hero);
        if (ct.sub) {
          body.appendChild(el('p', { class: 'cover__sub', text: ct.sub }));
        }
      } else {
        body.appendChild(buildNoteCard(block, 'note--bare'));
      }
      wrap.appendChild(body);
    }

    return el('div', { class: 'block block--cover' }, [wrap]);
  }

  /* ------------------------------------------------------------------------
     媒体区块：single / duo / trio / hero / flow
     ---------------------------------------------------------------------- */
  function createMediaBlock(block, sectionId, no, normalized) {
    var layout = block.layout || 'single';
    var node = el('div', { class: 'block block--' + layout });

    var head = createHead(block, no);
    if (head) node.appendChild(head);

    var grid = el('div', { class: 'media-grid' });

    if (layout === 'hero') {
      /* 左大右二：主视觉单独一列，其余纵向堆叠（保证三张都是 16:9 不留边） */
      var main = createMedia(normalized[0], sectionId);
      main.classList.add('hero__main');
      var side = el('div', { class: 'hero__side' });
      normalized.slice(1).forEach(function (item) {
        side.appendChild(createMedia(item, sectionId));
      });
      grid.appendChild(main);
      grid.appendChild(side);
    } else if (layout === 'flow') {
      /* 上下错落：两行，左右交替 */
      var rowA = el('div', { class: 'flow__row' });
      var rowB = el('div', { class: 'flow__row' });
      normalized.forEach(function (item, i) {
        (i % 2 === 0 ? rowA : rowB).appendChild(createMedia(item, sectionId));
      });
      grid.appendChild(rowA);
      grid.appendChild(rowB);
    } else {
      normalized.forEach(function (item) {
        grid.appendChild(createMedia(item, sectionId));
      });
    }

    node.appendChild(grid);

    /* 同屏多张卡片依次升起：给第 2 张起递增序号，配合 .reveal.is-in 的动画延迟 */
    Array.prototype.forEach.call(grid.querySelectorAll('.media'), function (m, i) {
      if (i) m.style.setProperty('--ri', i);
    });

    return node;
  }

  /* ------------------------------------------------------------------------
     一个章节 → DOM（返回节点 + 该章节扁平化的素材索引，供灯箱前后切换）
     ---------------------------------------------------------------------- */
  function createSection(section) {
    var node = el('section', {
      class: 'section',
      id: 'sec-' + section.id,
      'data-id': section.id,
      role: 'tabpanel',
      'aria-labelledby': 'tab-' + section.id,
      tabindex: '-1'
    });

    var flat = [];   /* 扁平素材列表，与 DOM 中的 data-index 一一对应 */
    var blockNo = 0;

    (section.blocks || []).forEach(function (block) {
      if (block.layout === 'note') {
        node.appendChild(createNote(block));
        return;
      }

      if (block.layout === 'gallery') {
        /* 画廊素材也进扁平列表 → 点击面板可在灯箱里放大预览（与作品卡片一致） */
        var galleryItems = (block.items || []).map(function (raw) {
          var gItem = U.normalizeItem(raw, flat.length);
          flat.push(gItem);
          return gItem;
        });
        node.appendChild(createGallery(block, section.id, galleryItems));
        return;
      }

      if (block.layout === 'tiles') {
        /* 倾斜网格素材同样进扁平列表（可点击放大；不计入 Tab 角标作品数） */
        var tileItems = (block.items || []).map(function (raw) {
          var tItem = U.normalizeItem(raw, flat.length);
          flat.push(tItem);
          return tItem;
        });
        node.appendChild(createTiles(block, section.id, tileItems));
        return;
      }

      if (block.layout === 'stack') {
        /* 滚动堆叠素材同样进扁平列表（可点击放大；不计入 Tab 角标作品数） */
        var stackItems = (block.items || []).map(function (raw) {
          var sItem = U.normalizeItem(raw, flat.length);
          flat.push(sItem);
          return sItem;
        });
        node.appendChild(createStack(block, section.id, stackItems));
        return;
      }

      if (block.layout === 'cover') {
        node.appendChild(createCover(block));
        return;
      }

      blockNo += 1;

      /* 先归一化本区块的素材，push 进扁平列表后再生成卡片 */
      var normalized = (block.items || []).map(function (raw) {
        var item = U.normalizeItem(raw, flat.length);
        flat.push(item);
        return item;
      });

      node.appendChild(createMediaBlock(block, section.id, blockNo, normalized));
    });

    return { node: node, items: flat };
  }

  return {
    createSection: createSection,
    createMedia: createMedia,
    ICONS: ICONS
  };
})();
