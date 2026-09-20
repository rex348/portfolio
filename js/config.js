/* ==========================================================================
   config.js — 唯一需要修改的配置文件
   --------------------------------------------------------------------------
   ┌── 1. meta 站点信息 ────────────────────────────────────────────────────┐
   │  title / subtitle      左侧导航顶部品牌信息                            │
   └───────────────────────────────────────────────────────────────────────┘
   ┌── 2. sections 章节（数组顺序 = 左侧 Tab 顺序）─────────────────────────┐
   │  id       唯一标识，会写入地址栏 #hash（面试时可直接发链接定位章节）    │
   │  label    中文名称        en     英文小字                              │
   │  blocks   该章节下的滚动区块数组（一个区块 = 一屏）                    │
   └───────────────────────────────────────────────────────────────────────┘
   ┌── 3. blocks.layout 排版方式（一屏内放几张图）─────────────────────────┐
   │  'cover'   全屏封面（视频/动图/图片铺满整屏，纯背景，无文案）           │
   │  'single'  一屏 1 张主视觉（16:9 自适应、水平垂直居中）★ 当前主用      │
   │  'duo'     一屏 2 张并排                                              │
   │  'trio'    一屏 3 张并排（引擎保留，当前演示未使用）                    │
   │  'hero'    一屏 3 张：左大图 + 右侧两张小图（引擎保留，当前演示未使用） │
   │  'flow'    一屏 2 张上下错落（宽度 64% / 55%）                        │
   │  'note'    一屏 1 个文字卡片（页面居中，关于我在用）                    │
   │  'gallery' 通栏无限滚动跑马灯（大标题+描述+匀速循环卡片，OA「PC端其他页面」）│
   │  'tiles'   通栏倾斜图片列网格（随滚动反向漂移，OA「移动端其他页面」）     │
   │  'stack'   滚动钉住卡片堆叠（新卡升起压顶、旧卡旋转溶解，动态主题登录页） │
   └───────────────────────────────────────────────────────────────────────┘
   ★ 素材统一按 1920×1080（16:9）准备，任何排版都不会留边或裁切。
   ┌── 4. blocks.items 素材写法 ───────────────────────────────────────────┐
   │  写法 A（最简）：'app-01.jpg'                                         │
   │        → 自动指向 assets/works/app-01.jpg                             │
   │        → 后缀自动识别：.mp4/.webm/.mov 走视频，.gif 走动图，其余为图片 │
   │  写法 B（带文案 / 完整路径 / 视频参数）：                              │
   │        { src:'assets/video/demo.mp4', poster:'assets/poster/demo.jpg', │
   │          title:'交互演示', desc:'6s 循环',                            │
   │          type:'video', autoplay:true, loop:true, controls:false,      │
   │          fill:true }                                                  │
   │  可选字段：title / desc 文案（仅用于无障碍朗读与缺图兜底），fill 填满  │
   └───────────────────────────────────────────────────────────────────────┘
   ★ 替换素材：用同名文件覆盖 assets/works/ 里的图片即可，无需改动本文件。
   ★ 新增素材：把文件丢进 assets/works/，在对应 items 数组里加一行路径。
   ★ 检查素材：命令行运行  python tools/verify_assets.py  可校验路径是否齐全。
   --------------------------------------------------------------------------
   当前章节与作品数量（Tab 角标会自动统计，改完 items 数字随之变化）：
     01 首页 .................. 封面（不计入作品数）
     02 个人简介 .............. 1
     03 一体化协同办公OA ...... 9
     04 企业情感化运营视觉 .... 4
     05 移动端 App ............ 34（app-01 ~ app-33 为图片 + app-34）
     06 网页/中后台 ........... 8
     07 运营banner ............ 7
                            合计 63 件作品
   ========================================================================== */

window.PF = window.PF || {};  /* 命名空间兜底 */

PF.config = {
  meta: {
    title: '作品集',
    subtitle: 'UI / UX Design'
  },

  sections: [
    /* ====================================================================
       01 首页 —— 全屏封面（只保留背景媒体：MP4 视频 / GIF 动图 / 图片）
       --------------------------------------------------------------------
       media.src 支持三种写法：
         { src:'assets/cover/cover.mp4', type:'video',
           poster:'assets/cover/cover-poster.jpg' }   ← MP4（推荐，体积小）
         { src:'assets/cover/cover.gif' }              ← 动图（直接换文件名）
         { src:'assets/cover/cover.jpg' }              ← 静态图
       视频会静音自动循环播放；编码不被支持时自动退回 poster 封面图。
       ==================================================================== */
    {
      id: 'home',
      label: '首页',
      en: 'Home',
      blocks: [
        {
          layout: 'cover',
          media: {
            src: 'assets/cover/cover.mp4',
            type: 'video',
            poster: 'assets/cover/cover-poster.jpg'
          },
          /* 封面主标题：上下两行超大展示字（斜体重型白字）+ 副标题署名 */
          coverTitle: {
            lines: ['2026', 'Portfolio'],
            sub: '赵煜 · 过往 ~ 2026 UI/UX作品集'
          }
        }
      ]
    },

    /* ====================================================================
       02 个人简介 —— 1 件作品（建议放一张设计好的个人简介 / 履历主视觉）
       ==================================================================== */
    {
      id: 'about',
      label: '个人简介',
      en: 'About Me',
      blocks: [
        { layout: 'single', items: [{ src: 'about-01.jpg', title: '个人简介' }] }
      ]
    },

    /* ====================================================================
       03 一体化协同办公 OA —— 9 件作品
       （「PC端/移动端其他页面」画廊与倾斜网格为展示性区块，不计入角标）
       ==================================================================== */
    {
      id: 'oa',
      label: '一体化协同办公OA',
      en: 'OA Platform',
      blocks: [
        { layout: 'single', items: [{ src: 'oa-01.jpg', title: '工作台总览', desc: '一体化协同办公' }] },
        { layout: 'single', items: [{ src: 'oa-02.jpg', title: '组织架构与权限' }] },
        { layout: 'single', items: [{ src: 'oa-03.jpg', title: '审批流配置' }] },
        { layout: 'single', items: [{ src: 'oa-04.jpg', title: '协同文档' }] },
        { layout: 'single', items: [{ src: 'oa-05.jpg', title: '日程与会议室' }] },
        { layout: 'single', items: [{ src: 'oa-06.jpg', title: '即时沟通' }] },
        { layout: 'single', items: [{ src: 'oa-07.jpg', title: '数据报表' }] },
        { layout: 'single', items: [{ src: 'oa-08.jpg', title: '移动端适配' }] },
        { layout: 'single', items: [{ src: 'oa-09.jpg', title: '上线效果', desc: '效率提升数据' }] },

        /* ----------------------------------------------------------------
           PC端其他页面 —— 通栏无限滚动跑马灯（layout:'gallery'，引擎新支持）
           ----------------------------------------------------------------
           · title    大标题（纯白 · 阿里妈妈数黑体 · 居中，距上一卡片 80px）
           · items    跑马灯卡片素材（建议 1440×900，卡片即 16:10 完美呈现不裁切；
                      点击卡片在灯箱放大预览；卡片内不渲染任何文字）
           · desc     描述段（在标题下方 24px、居中）：字符串为普通文字(50%白)，
                      { t:'...', em:true } 为强调文字(100%白 + 加粗)
           交互：匀速向左无限循环滚动（悬停暂停、可拖拽搓动，无缝回绕，carousel.js）
           注意：画廊不计入 Tab 角标的作品数（角标仍为上方 9 张卡片）
           ---------------------------------------------------------------- */
        {
          layout: 'gallery',
          title: 'PC端其他页面',
          items: [
            { src: 'oa-e10-01.jpg', title: '知识文档' },
            { src: 'oa-e10-02.jpg', title: '发票云' },
            { src: 'oa-e10-03.jpg', title: '数据仓库' },
            { src: 'oa-e10-04.jpg', title: '流程表单' },
            { src: 'oa-e10-05.jpg', title: '门户工作台' },
            { src: 'oa-e10-06.jpg', title: '报表中心' }
          ],
          desc: [
            { t: '【标准E10页面】', em: true },
            '基于E10标准组件库规范完成页面开发与扩展，',
            { t: '整体遵循系统统一交互、视觉风格', em: true },
            '；页面包含多个业务功能管理模块：知识文档、发票云、数据仓库、流程表单等，各模块组件、样式、交互保持与E10体系对齐，',
            { t: '保证系统体验一致性', em: true },
            '。'
          ]
        },

        /* ----------------------------------------------------------------
           移动端其他页面 —— 倾斜网格（layout:'tiles'，React Bits Pro「Tilted Tiles」）
           ----------------------------------------------------------------
           · title    大标题（纯白 · 阿里妈妈数黑体 · 居中，距上方内容 80px）
           · desc     描述段（标题下方 24px、居中）：字符串 50% 白；
                      { t:'...', em:true } 为 100% 白 + 加粗
           · columns  列数（默认 5，窄屏自动收窄为 3）
           · items    网格小图（手机竖版 750×1624，自动轮转分配进各列；
                      点击可在灯箱放大预览；不计入 Tab 角标作品数）
           交互：整组倾斜的图片列网格，滚动时各列按不同速率反向漂移（斜向流动），
                 并叠加一层缓慢的自动呼吸引擎（tiles.js）
           ---------------------------------------------------------------- */
        {
          layout: 'tiles',
          title: '移动端其他页面',
          columns: 9,
          items: [
            { src: 'app-e10-01.jpg', title: '移动端工作台' },
            { src: 'app-e10-02.jpg', title: '移动端审批' },
            { src: 'app-e10-03.jpg', title: '移动端消息' },
            { src: 'app-e10-04.jpg', title: '移动端日程' },
            { src: 'app-e10-05.jpg', title: '移动端文档' },
            { src: 'app-e10-06.jpg', title: '移动端报表' },
            { src: 'app-e10-07.jpg', title: '移动端知识库' },
            { src: 'app-e10-08.jpg', title: '移动端流程' }
          ],
          desc: [
            { t: '包含【E10标准】与【专项】', em: true },
            'E10标准页面与PC端一样，',
            { t: '整体遵循系统统一交互、视觉风格', em: true },
            '。',
            { t: '移动端充分发挥自身特性，对部分功能做适度取舍，聚焦核心，优先保障高频事项的快捷操作体验', em: true },
            '。'
          ]
        }

      ]
    },

    /* ====================================================================
       04 企业情感化运营视觉 —— 2 件作品 + 徽章展示（标题占位）
       ==================================================================== */
    {
      id: 'visual',
      label: '企业情感化运营视觉',
      en: 'Emotional Visual',
      blocks: [
        { layout: 'single', items: [{ src: 'visual-01.jpg', title: '年度视觉主 KV' }] },
        { layout: 'single', items: [{ src: 'visual-02.jpg', title: '情感化运营视觉' }] },

        /* ----------------------------------------------------------------
           徽章展示 —— APNG 徽章墙
           ----------------------------------------------------------------
           · badges  徽章素材（APNG，原样播放不转码）：按提供顺序排列；
                     渲染规则见 render.js createStack —— 标题下方 50px、
                     一行 4 个水平对齐、行间距 40px、每张按原始尺寸等比缩小 3 倍
           · 与「动态主题登录页」同一套标题样式（layout:'stack' 的大标题） */
        {
          layout: 'stack',
          title: '徽章展示',
          items: [],
          badges: [
            'assets/badges/1.png', 'assets/badges/2.png', 'assets/badges/3.png', 'assets/badges/4.png',
            'assets/badges/5.png', 'assets/badges/6.png', 'assets/badges/7.png', 'assets/badges/8.png',
            'assets/badges/10.png', 'assets/badges/12.png', 'assets/badges/15.png', 'assets/badges/16.png',
            'assets/badges/17.png', 'assets/badges/18.png', 'assets/badges/19.png', 'assets/badges/20.png',
            'assets/badges/21.png', 'assets/badges/22.png'
          ]
        },

        /* ----------------------------------------------------------------
           动态主题登录页 —— 滚动堆叠（layout:'stack'，React Bits Pro「Scroll Stack」）
           ----------------------------------------------------------------
           · title    大标题（纯白 · 阿里妈妈数黑体 · 居中，距上一卡片 80px）
           · desc     描述段（标题下方 24px、居中）：字符串 50% 白；
                      { t:'...', em:true } 为 100% 白 + 加粗
           · items    卡片素材（1920×940，卡片同比例完美呈现不裁切；
                      支持图片与 MP4：MP4 默认停在第一帧，鼠标移入播放、
                      移出回到第一帧；卡片宽度与上方作品卡片完全一致）
           交互：随页面滚动卡片被钉住——新卡从下方垂直升起压到顶上（不旋转），
                 旧卡缩小、模糊、溶解（stack.js，Reduced Motion 时静态呈现）
           注意：不计入 Tab 角标的作品数（角标仍为上方 4 张卡片）
           ---------------------------------------------------------------- */
        {
          layout: 'stack',
          title: '动态主题登录页',
          items: [
            { src: 'assets/video/manian-01.mp4', poster: 'assets/poster/manian-01.jpg',
              title: '主题登录页 · 马年' },
            { src: 'assets/video/yuandan-02.mp4', poster: 'assets/poster/yuandan-02.jpg',
              title: '主题登录页 · 元旦' },
            { src: 'assets/video/zq-03.mp4', poster: 'assets/poster/zq-03.jpg',
              title: '主题登录页 · 中秋' },
            { src: 'xn-04.jpg', title: '主题登录页 · 新年' },
            { src: 'assets/video/qiche-05.mp4', poster: 'assets/poster/qiche-05.jpg',
              title: '主题登录页 · 汽车' },
            { src: 'assets/video/jc-06.mp4', poster: 'assets/poster/jc-06.jpg',
              title: '主题登录页 · 春节' }
          ],
          desc: [
            '根据业务需求或客户需求，收集相关主题素材，在标准登录页面的基础上设计，由于账号密码区域是组件的限制，所以无法做过多修改。增加动效，针对页面中的元素增加动效，更好的去表达主题的情绪。'
          ]
        }
      ]
    },

    /* ====================================================================
       05 移动端 App —— 34 件作品（app-01 ~ app-34 全部为图片）
       ==================================================================== */
    {
      id: 'app',
      label: '移动端 App',
      en: 'Mobile App',
      blocks: [
        { layout: 'single', items: [{ src: 'app-01.jpg', title: '首页改版', desc: '核心场景重构' }] },
        { layout: 'single', items: [{ src: 'app-02.jpg', title: '信息架构' }] },
        { layout: 'single', items: [{ src: 'app-03.jpg', title: '关键流程' }] },
        { layout: 'single', items: [{ src: 'app-04.jpg', title: '设计探索', desc: '3 版方案对比' }] },
        { layout: 'single', items: [{ src: 'app-05.jpg', title: '首页' }] },
        { layout: 'single', items: [{ src: 'app-06.jpg', title: '详情页' }] },
        { layout: 'single', items: [{ src: 'app-07.jpg', title: '个人中心' }] },
        { layout: 'single', items: [{ src: 'app-08.jpg', title: '搜索与筛选' }] },
        { layout: 'single', items: [{ src: 'app-09.jpg', title: '空状态 / 加载态' }] },
        { layout: 'single', items: [{ src: 'app-10.jpg', title: '异常兜底' }] },
        { layout: 'single', items: [{ src: 'app-11.jpg', title: '动效说明', desc: '交互节奏与缓动' }] },
        { layout: 'single', items: [{ src: 'app-12.jpg', title: '图标体系' }] },
        { layout: 'single', items: [{ src: 'app-13.jpg', title: '适配规范' }] },
        { layout: 'single', items: [{ src: 'app-14.jpg', title: '登录注册' }] },
        { layout: 'single', items: [{ src: 'app-15.jpg', title: '引导页' }] },
        { layout: 'single', items: [{ src: 'app-16.jpg', title: '消息中心' }] },
        { layout: 'single', items: [{ src: 'app-17.jpg', title: '订单列表' }] },
        { layout: 'single', items: [{ src: 'app-18.jpg', title: '订单详情' }] },
        { layout: 'single', items: [{ src: 'app-19.jpg', title: '支付流程' }] },
        { layout: 'single', items: [{ src: 'app-20.jpg', title: '优惠券' }] },
        { layout: 'single', items: [{ src: 'app-21.jpg', title: '会员体系' }] },
        { layout: 'single', items: [{ src: 'app-22.jpg', title: '积分商城' }] },
        { layout: 'single', items: [{ src: 'app-23.jpg', title: '社区动态' }] },
        { layout: 'single', items: [{ src: 'app-24.jpg', title: '内容详情' }] },
        { layout: 'single', items: [{ src: 'app-25.jpg', title: '评论互动' }] },
        { layout: 'single', items: [{ src: 'app-26.jpg', title: '直播场景' }] },
        { layout: 'single', items: [{ src: 'app-27.jpg', title: '数据看板' }] },
        { layout: 'single', items: [{ src: 'app-28.jpg', title: '设置中心' }] },
        { layout: 'single', items: [{ src: 'app-29.jpg', title: '深色模式' }] },
        { layout: 'single', items: [{ src: 'app-30.jpg', title: '无障碍适配' }] },
        { layout: 'single', items: [{ src: 'app-31.jpg', title: '组件复用' }] },
        { layout: 'single', items: [{ src: 'app-32.jpg', title: '设计走查', desc: '还原度对比' }] },
        { layout: 'single', items: [{ src: 'app-33.jpg', title: '版本迭代' }] },
        { layout: 'single', items: [{ src: 'app-34.jpg', title: '其他页面', desc: '亲子商教 · 名师大咖招 · 遛娃福利' }] }
      ]
    },

    /* ====================================================================
       06 网页 / 中后台 —— 8 件作品
       ==================================================================== */
    {
      id: 'web',
      label: '网页/中后台',
      en: 'Web & Console',
      blocks: [
        { layout: 'single', items: [{ src: 'web-01.jpg', title: '产品官网', desc: '响应式 Web' }] },
        { layout: 'single', items: [{ src: 'web-02.jpg', title: '首页与导航' }] },
        { layout: 'single', items: [{ src: 'web-03.jpg', title: '中后台工作台', desc: '信息密度与效率' }] },
        { layout: 'single', items: [{ src: 'web-04.jpg', title: '列表与筛选' }] },
        { layout: 'single', items: [{ src: 'web-05.jpg', title: '表单与校验' }] },
        { layout: 'single', items: [{ src: 'web-06.jpg', title: '权限与角色' }] },
        { layout: 'single', items: [{ src: 'web-07.jpg', title: '数据看板' }] },
        { layout: 'single', items: [{ src: 'web-08.jpg', title: '设计走查', desc: '还原度对比' }] }
      ]
    },

    /* ====================================================================
       07 运营 banner —— 7 件作品（建议素材按 1920×1080 出图）
       ==================================================================== */
    {
      id: 'banner',
      label: '运营banner',
      en: 'Operation Banner',
      blocks: [
        { layout: 'single', items: [{ src: 'banner-01.jpg', title: '品牌主视觉 Banner' }] },
        { layout: 'single', items: [{ src: 'banner-02.jpg', title: '新品发布' }] },
        { layout: 'single', items: [{ src: 'banner-03.jpg', title: '节日营销' }] },
        { layout: 'single', items: [{ src: 'banner-04.jpg', title: '活动促销' }] },
        { layout: 'single', items: [{ src: 'banner-05.jpg', title: '会员招募' }] },
        { layout: 'single', items: [{ src: 'banner-06.jpg', title: '数据榜单' }] },
        { layout: 'single', items: [{ src: 'banner-07.jpg', title: '品牌联名' }] }
      ]
    },

    /* ====================================================================
       08 关于我 —— 文字卡片（居中弹窗样式，原版还原）
       --------------------------------------------------------------------
       字段：kicker 顶部小徽标 / title 大标题 / text 段落数组 /
             meta 底部信息栏（k=标签 v=内容），角标计 1
       ==================================================================== */
    {
      id: 'me',
      label: '关于我',
      en: 'About Me',
      blocks: [
        {
          layout: 'note',
          kicker: 'ABOUT ME',
          title: '一起做点有价值的产品',
          text: [
            '我习惯先从业务目标与用户路径出发，再用尽可能少的界面把问题解决掉。',
            '擅长跨团队协作与设计系统沉淀，能在快节奏迭代中保持交付质量。'
          ],
          meta: [
            { k: '邮箱', v: 'rexzhaoyu@126.com' },
            { k: '微信', v: '18816533652' },
            { k: '城市', v: '上海' },
            { k: '到岗', v: '本周内' }
          ]
        }
      ]
    }
  ]
};
