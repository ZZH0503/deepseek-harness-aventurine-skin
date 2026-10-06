// dsh-aventurine-skin — 浏览器半（hand-authored client bundle）。
// 该文件由 DSH 客户端模块系统直接以工厂形式加载，无需构建步骤。
//
// 功能：
//  1. 「砂金·戏浪」主题皮肤（深海洋底/浅青两套 --dsw-alias-* token），
//     通过 ThemeRuntime 注册并持久化；
//  2. 多层景深：固定背景层（官方酒吧场景插画，低透明度+视差）
//     + 金色筹码/气泡粒子画布 + 半透明主画布（token 着色）；
//  3. 任务完成互动：全部任务结束运行（running>0 → 0）时右下角弹
//     立绘语音对话框（打字机字幕 + 官方语音台词），含冷却保护；
//  4. 缓存命中率 ≥96% 互动：任务结束时计算本次任务期间
//     cacheRead/(cacheRead+uncachedInput)，达标即丝滑播放 6 秒
//     大招动画（视频 + 立绘切入 + 粒子爆发 + 景深过渡）；
//  5. 设置面板（设置→通用）：总开关/语音/动画/粒子/背景/音量/
//     冷却/试听试播/深浅切换，全部持久化到 localStorage。
//
// 稳定性：所有外部调用（ctx 服务、fetch、Audio、video）均 try/catch；
// 定时器与监听器全部通过 ctx.effect 回收；动画尊重
// prefers-reduced-motion；页面隐藏时粒子暂停；播放冲突互斥。

window.__ModuleLoader__.load({
  id: "dsh-aventurine-skin",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require("react");
    var ReactDOM = require("react-dom");

    var createElement = React.createElement;
    var Fragment = React.Fragment;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useRef = React.useRef;
    var useCallback = React.useCallback;

    /* ============================================================
     * 常量与配置默认值
     * ============================================================ */
    var NS = "aventurine-skin";
    var LS_PREFIX = "aventurine-skin:";
    var ASSET_BASE = "/aventurine-skin";
    var ASSET_VERSION = "122"; // 资源缓存版本：素材更新后递增，绕过浏览器磁盘缓存

    var DEFAULTS = {
      themeEnabled: true,
      voiceEnabled: false,
      ultEnabled: true,
      particlesEnabled: true,
      backdropEnabled: true,
      figureArt: "float", // float | resort | none —— 壁纸式双立绘层
      figureOpacity: 1,
      figureSize: 95, // vh
      figureBrightness: 1.2,
      petEnabled: true,
      petSize: 118,
      splashEnabled: true,
      scheme: "dark", // dark | light
      volume: 0.6,
      voiceCooldownMs: 60000,
      ultCooldownMs: 180000,
      cacheHitThreshold: 0.96,
      dialogAutoHideMs: 8000,
      taskMinDurationMs: 2500,
    };

    /* 主题 token（依据官方立绘/PV 取色）：
     * 深海洋底：深海蓝青底 + 青蓝分层面板 + 金色强调 + 紫色点缀 */
    var SKIN_DARK = {
      id: "aventurine-waveflair-dark",
      labelKey: "skinDark",
      colorScheme: "dark",
      tokens: {
        "--dsw-alias-bg-base": "#071722",
        "--dsw-alias-bg-layer-1": "rgba(11, 34, 51, 0.72)",
        "--dsw-alias-bg-layer-2": "#10304a",
        "--dsw-alias-bg-layer-3": "rgba(22, 62, 94, 0.66)",
        "--dsw-alias-bg-overlay": "#12374f",
        "--dsw-alias-border-l1": "rgba(122, 211, 222, 0.14)",
        "--dsw-alias-border-l2": "rgba(122, 211, 222, 0.26)",
        "--dsw-alias-label-primary": "#eaf6fa",
        "--dsw-alias-label-secondary": "#a9c6d6",
        "--dsw-alias-label-tertiary": "#7e9fb2",
        "--dsw-alias-brand-primary": "#e5b44e",
        "--dsw-alias-brand-text": "#071722",
        "--dsw-alias-button-primary-hover": "#eec368",
        "--dsw-alias-button-primary-dimmed": "#3a2e14",
        "--dsw-alias-state-business-primary": "#46b9d9",
        "--dsw-alias-state-business-tertiary": "#0e2c40",
        "--dsw-alias-interactive-bg-hover": "rgba(229, 180, 78, 0.13)",
        "--dsw-alias-interactive-bg-active": "rgba(229, 180, 78, 0.22)",
        "--dsw-specific-input-major": "rgba(16, 42, 58, 0.62)",
        "--dsw-alias-markdown-code-block": "#06121c",
        "--dsw-alias-markdown-inline-code": "#0e2a3e",
        "--dsw-specific-sidebar-fill": "#0a1e2e",
        "--dsw-specific-sidebar-nav-item-active": "rgba(229, 180, 78, 0.16)",
        "--dsw-specific-sidebar-nav-item-hover": "rgba(70, 185, 217, 0.10)",
        "--dsw-alias-scrollbar-bg-l1": "#17405c",
        "--dsw-alias-scrollbar-bg-l2": "#1d4e70",
        "--dsw-alias-scrollbar-hover-l1": "#286287",
        "--dsw-alias-scrollbar-hover-l2": "#286287",
      },
    };

    var SKIN_LIGHT = {
      id: "aventurine-waveflair-light",
      labelKey: "skinLight",
      colorScheme: "light",
      tokens: {
        "--dsw-alias-bg-base": "#e9f7fa",
        "--dsw-alias-bg-layer-1": "rgba(220, 239, 245, 0.78)",
        "--dsw-alias-bg-layer-2": "#c9e4ee",
        "--dsw-alias-bg-layer-3": "rgba(181, 216, 229, 0.72)",
        "--dsw-alias-bg-overlay": "#cfe8f0",
        "--dsw-alias-border-l1": "rgba(23, 88, 110, 0.16)",
        "--dsw-alias-border-l2": "rgba(23, 88, 110, 0.30)",
        "--dsw-alias-label-primary": "#0b2c3d",
        "--dsw-alias-label-secondary": "#37606f",
        "--dsw-alias-label-tertiary": "#5d8494",
        "--dsw-alias-brand-primary": "#b8860b",
        "--dsw-alias-brand-text": "#ffffff",
        "--dsw-alias-button-primary-hover": "#c99b2e",
        "--dsw-alias-button-primary-dimmed": "#f1e3be",
        "--dsw-alias-state-business-primary": "#1e7fa5",
        "--dsw-alias-state-business-tertiary": "#d9eef5",
        "--dsw-alias-interactive-bg-hover": "rgba(184, 134, 11, 0.10)",
        "--dsw-alias-interactive-bg-active": "rgba(184, 134, 11, 0.18)",
        "--dsw-specific-input-major": "rgba(255, 255, 255, 0.88)",
        "--dsw-alias-markdown-code-block": "#f2f8fa",
        "--dsw-alias-markdown-inline-code": "#deeef4",
        "--dsw-specific-sidebar-fill": "#e2f1f6",
        "--dsw-specific-sidebar-nav-item-active": "rgba(184, 134, 11, 0.14)",
        "--dsw-specific-sidebar-nav-item-hover": "rgba(30, 127, 165, 0.10)",
        "--dsw-alias-scrollbar-bg-l1": "#a9c8d6",
        "--dsw-alias-scrollbar-bg-l2": "#9bbfce",
        "--dsw-alias-scrollbar-hover-l1": "#8db4c4",
        "--dsw-alias-scrollbar-hover-l2": "#8db4c4",
      },
    };

    /* 语音台词兜底（若 voice.json 加载失败）。台词均来自官方视频
     * 《走近星穹——砂金·戏浪》中角色原话（杨超然配音）。 */
    var FALLBACK_LINES = [
      { file: "", text: "所有，或一无所有。" },
      { file: "", text: "朋友，来点乐子如何？" },
      { file: "", text: "运气也是实力的一部分。" },
    ];

    /* ============================================================
     * 持久化
     * ============================================================ */
    function readStorage(key, fallback) {
      try {
        var raw = localStorage.getItem(LS_PREFIX + key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    }
    function writeStorage(key, value) {
      try {
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
      } catch {}
    }
    function readConfig() {
      var saved = readStorage("config", null);
      var out = {};
      for (var k in DEFAULTS) {
        out[k] = saved && typeof saved[k] !== "undefined" ? saved[k] : DEFAULTS[k];
      }
      return out;
    }

    /* 事件通知（设置面板 → 主逻辑），沿用 dsh-skin 的 window 事件模式 */
    var CFG_EVENT = "aventurine-skin:config";

    /* ============================================================
     * 样式注入
     * ============================================================ */
    var CSS = [
      /* —— 背景景深层 —— */
      ".av-bg{position:fixed;inset:0;z-index:-3;pointer-events:none;background-size:cover;background-position:center 30%;background-repeat:no-repeat;opacity:.5;will-change:transform;transform:scale(1.06) translate3d(0,0,0);}",
      ".av-bg-vignette{position:fixed;inset:0;z-index:-3;pointer-events:none;background:radial-gradient(ellipse at 50% 38%, rgba(7,23,34,0) 0%, rgba(7,23,34,.35) 100%);}",
      ".av-bg-waves{position:fixed;inset:0;z-index:-3;pointer-events:none;opacity:.16;background:repeating-linear-gradient(115deg, transparent 0 46px, rgba(70,185,217,.16) 46px 47px, transparent 47px 92px), repeating-linear-gradient(155deg, transparent 0 64px, rgba(229,180,78,.14) 64px 65px, transparent 65px 128px);}",
      /* 弥散光氛围层（柔和光斑：右侧金色日光 / 左侧青蓝 / 底部淡紫） */
      ".av-ambient{position:fixed;inset:0;z-index:-2;pointer-events:none;background:radial-gradient(640px 520px at 84% 12%, rgba(229,180,78,.14), transparent 70%), radial-gradient(760px 620px at 8% 30%, rgba(70,185,217,.12), transparent 70%), radial-gradient(900px 700px at 60% 105%, rgba(154,107,255,.08), transparent 72%);}",
      /* 内容遮罩层：保护左侧/中央文字可读，右侧留给立绘（壁纸平衡） */
      ".av-wash{position:fixed;inset:0;z-index:-1;pointer-events:none;}",
      /* 中部光桥：弥合左右立绘之间的割裂，让两图连成一景 */
      ".av-bridge{position:fixed;inset:0;z-index:-2;pointer-events:none;background:linear-gradient(90deg, rgba(70,185,217,0) 0%, rgba(70,185,217,.3) 34%, rgba(247,217,138,.24) 50%, rgba(70,185,217,.3) 66%, rgba(70,185,217,0) 100%),radial-gradient(760px 460px at 50% 56%, rgba(229,180,78,.2), transparent 70%);}",
      /* 浪花涌动层：fixed 悬浮覆盖，JS 内联 transform 驱动 */
      ".av-nav-wave-el{position:fixed;pointer-events:none;z-index:2147483050;border-radius:10px;overflow:hidden;background:linear-gradient(100deg, rgba(70,185,217,0) 0%, rgba(70,185,217,.55) 38%, rgba(247,217,138,.6) 50%, rgba(255,255,255,.5) 56%, rgba(70,185,217,0) 72%);background-size:200% 100%;will-change:transform,left,top,width,height;}",
      /* —— 终端边缘微光（沉浸式：光线从屏幕边缘渗入，无生硬边框、不遮挡系统控件） —— */
      ".av-edge{position:fixed;inset:0;pointer-events:none;z-index:2147482985;background:linear-gradient(180deg, rgba(229,180,78,.20), rgba(229,180,78,0) 10px) top/100% 10px no-repeat, linear-gradient(0deg, rgba(70,185,217,.24), rgba(70,185,217,0) 16px) bottom/100% 16px no-repeat, linear-gradient(90deg, rgba(229,180,78,.09), transparent 30px) left/30px 100% no-repeat, linear-gradient(270deg, rgba(229,180,78,.09), transparent 30px) right/30px 100% no-repeat;}",
      /* 动画期间立绘隐退/复现 */
      ".av-figure.hide,.av-figure-left.hide{opacity:0!important;transform:translateY(14px) scale(.98)!important;transition:opacity .6s ease,transform .6s ease;}",
      /* —— 粒子画布 —— */
      ".av-particles{position:fixed;inset:0;z-index:2147483000;pointer-events:none;}",
      /* —— 壁纸式立绘层（左右等高双立绘：alpha 已烘焙进 PNG，天然无边框） —— */
      ".av-figure{position:fixed;right:-16px;bottom:-6px;z-index:-2;pointer-events:none;transform-origin:bottom right;will-change:transform,opacity;opacity:0;transition:opacity .8s ease;}",
      ".av-figure img{display:block;height:95vh;max-height:102vh;width:auto;filter:saturate(1.04);}",
      ".av-figure.float img{animation:av-figure-float 7.5s ease-in-out infinite;}",
      ".av-figure.enter img{animation:av-figure-in .9s cubic-bezier(.2,.9,.3,1) both;}",
      ".av-figure.celebrate img{animation:av-figure-float 7.5s ease-in-out infinite, av-figure-cheer .9s ease-out 2;}",
      "@keyframes av-figure-float{0%,100%{transform:translateY(0) rotate(-.5deg)}50%{transform:translateY(-10px) rotate(.5deg)}}",
      "@keyframes av-figure-in{from{transform:translateY(46px) scale(.96);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}",
      "@keyframes av-figure-cheer{0%,100%{filter:saturate(1.06) brightness(1)}40%{filter:saturate(1.2) brightness(1.22) drop-shadow(0 0 46px rgba(229,180,78,.75))}}",
      "@media (prefers-reduced-motion: reduce){.av-figure.float img,.av-figure.celebrate img{animation:none}}",
      /* 沉浸式左侧立绘：与右侧等高、alpha 已烘焙、沉入终端左侧区域 */
      ".av-figure-left{position:fixed;left:-30px;bottom:-6px;z-index:-2;pointer-events:none;transform-origin:bottom left;will-change:transform,opacity;opacity:0;transition:opacity .9s ease;}",
      ".av-figure-left img{display:block;height:95vh;max-height:102vh;width:auto;filter:saturate(1.04);}",
      ".av-figure-left.float img{animation:av-figure-float 9s ease-in-out infinite;}",
      ".av-figure-left.enter img{animation:av-figure-in 1s cubic-bezier(.2,.9,.3,1) both;}",
      "@media (prefers-reduced-motion: reduce){.av-figure-left.float img{animation:none}}",
      /* —— 大胆化覆盖（针对本机桌面壳真实类名，版本锁定） —— */
      "._2H3hWW_root{border-right:1px solid rgba(229,180,78,.12)!important;}",
      "._2H3hWW_panelRow{position:relative;}",
      "._2H3hWW_panelRow:hover{background:rgba(229,180,78,.08)!important;}",
      "._2H3hWW_panelRow._2H3hWW_panelActive{background:linear-gradient(90deg, rgba(229,180,78,.2), rgba(229,180,78,.04)),linear-gradient(100deg, rgba(70,185,217,0) 0%, rgba(70,185,217,.55) 40%, rgba(247,217,138,.6) 50%, rgba(255,255,255,.35) 56%, rgba(70,185,217,0) 70%) !important;background-size:100% 100%, 240% 100% !important;border-radius:10px;color:#f7d98a!important;box-shadow:0 0 16px rgba(229,180,78,.14), inset 0 0 0 1px rgba(229,180,78,.28);animation:av-nav-wave 2.6s linear infinite !important;overflow:hidden;}",
      "._2H3hWW_panelRow._2H3hWW_panelActive::before{content:'';position:absolute;left:-1px;top:50%;width:7px;height:7px;transform:translateY(-50%) rotate(45deg);background:linear-gradient(135deg,#ffe9ad,#b8860b);box-shadow:0 0 9px rgba(229,180,78,.95);}",
      "._2H3hWW_panelRow._2H3hWW_panelActive::after{content:'';position:absolute;right:12px;top:50%;width:6px;height:6px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #ffe9ad, #b8860b);transform:translateY(-50%);box-shadow:-16px -7px 0 -2px rgba(229,180,78,.75), 15px 5px 0 -2.5px rgba(229,180,78,.55), 0 -13px 0 -2px rgba(247,217,138,.6);animation:av-nav-pulse 2.4s ease-in-out infinite;}",
      "@keyframes av-nav-wave{0%{background-position:0 0, 130% 0}100%{background-position:0 0, -50% 0}}",
      "@keyframes av-nav-pulse{0%,100%{opacity:.7;filter:none}50%{opacity:1;filter:drop-shadow(0 0 7px rgba(229,180,78,.95))}}",
      "@media (prefers-reduced-motion: reduce){._2H3hWW_panelRow._2H3hWW_panelActive{animation:none !important}._2H3hWW_panelRow._2H3hWW_panelActive::after{animation:none}}",
      ".cJsG2q_bubble{border:1px solid rgba(229,180,78,.14)!important;box-shadow:0 6px 22px rgba(3,12,18,.35);backdrop-filter:blur(8px);}",
      /* —— 砂金桌宠（立绘头像化设计：圆形头像 + 金环 + 环绕筹码 + 状态光环） —— */
      ".av-pet{position:fixed;right:26px;bottom:44px;z-index:2147483100;cursor:grab;user-select:none;-webkit-user-select:none;width:110px;height:110px;filter:drop-shadow(0 10px 24px rgba(3,12,18,.55));touch-action:none;}",
      ".av-pet-body{position:relative;width:100%;height:100%;}",
      ".av-pet-face{position:absolute;inset:6%;width:88%;height:88%;border-radius:50%;pointer-events:none;transition:box-shadow .4s ease;}",
      ".av-pet-ring{position:absolute;inset:-2%;border-radius:50%;border:2px dashed rgba(229,180,78,.85);box-shadow:0 0 14px rgba(229,180,78,.35);animation:av-pet-spin 14s linear infinite;pointer-events:none;}",
      ".av-pet-ring::after{content:'';position:absolute;inset:-7px;border-radius:50%;border:1px solid rgba(229,180,78,.35);}",
      ".av-pet-dot{position:absolute;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 32% 30%, #ffe9ad, #e5b44e 55%, #8a6116);box-shadow:0 0 10px rgba(229,180,78,.9), inset 0 -2px 3px rgba(90,60,10,.55);pointer-events:none;}",
      ".av-pet-dot.d1{animation:av-pet-orbit 6s linear infinite;}",
      ".av-pet-dot.d2{animation:av-pet-orbit 8.5s linear infinite reverse;width:7px;height:7px;opacity:.85;}",
      ".av-pet-dot.d3{animation:av-pet-orbit 11s linear infinite;width:5px;height:5px;opacity:.7;}",
      "@keyframes av-pet-spin{to{transform:rotate(360deg)}}",
      "@keyframes av-pet-orbit{from{transform:rotate(0deg) translateX(66px) rotate(0deg)}to{transform:rotate(360deg) translateX(66px) rotate(-360deg)}}",
      ".av-pet:active{cursor:grabbing}",
      ".av-pet.thinking .av-pet-ring{border-color:rgba(70,185,217,.8);animation-duration:6s;}",
      ".av-pet.thinking .av-pet-face{box-shadow:0 0 26px rgba(70,185,217,.55);}",
      ".av-pet.celebrate .av-pet-face{box-shadow:0 0 34px rgba(229,180,78,.85);}",
      ".av-pet.celebrate{animation:av-pet-bounce .5s cubic-bezier(.3,1.6,.5,1) 3;}",
      ".av-pet.react{animation:av-pet-bounce .45s cubic-bezier(.3,1.6,.5,1) 2;}",
      ".av-pet.lifted{transform:translateY(-230px);transition:transform .7s cubic-bezier(.3,1.1,.4,1);animation:none;}",
      ".av-pet-bubble{position:absolute;bottom:calc(100% + 14px);left:50%;transform:translateX(calc(-50% + 28px)) perspective(640px) rotateX(5deg);background:rgba(10,26,40,.72);border:1px solid rgba(229,180,78,.45);color:#eaf6fa;font-size:12.5px;line-height:1.55;padding:8px 12px;border-radius:12px;max-width:250px;width:max-content;box-shadow:0 18px 40px rgba(3,12,18,.5), 0 0 22px rgba(70,185,217,.14), inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(10px) saturate(1.15);-webkit-backdrop-filter:blur(10px) saturate(1.15);pointer-events:none;white-space:pre-wrap;animation:av-bubble-bob 3.4s ease-in-out infinite;transform-origin:bottom center;}",
      ".av-pet-bubble::before{content:'';position:absolute;inset:0;border-radius:12px;background:linear-gradient(135deg, rgba(255,255,255,.10), transparent 46%);pointer-events:none;}",
      "@keyframes av-bubble-bob{0%,100%{transform:translateX(calc(-50% + 28px)) perspective(640px) rotateX(5deg) translateY(0)}50%{transform:translateX(calc(-50% + 28px)) perspective(640px) rotateX(5deg) translateY(-5px)}}",
      "@keyframes av-bubble-bob-anchored{0%,100%{transform:perspective(640px) rotateX(5deg) translateY(0)}50%{transform:perspective(640px) rotateX(5deg) translateY(-5px)}}",
      ".av-pet-bubble.left,.av-pet-bubble.right{animation:av-bubble-bob-anchored 3.4s ease-in-out infinite;}",
      "@media (prefers-reduced-motion: reduce){.av-pet-bubble{animation:none}}",
      ".av-pet-bubble::after{content:'';position:absolute;top:100%;left:50%;margin-left:-6px;border:6px solid transparent;border-top-color:rgba(11,34,51,.97);}",
      ".av-pet-bubble.left{left:0;right:auto;transform:perspective(640px) rotateX(5deg);}",
      ".av-pet-bubble.left::after{left:26px;right:auto;margin-left:0;}",
      ".av-pet-bubble.right{left:auto;right:-14px;transform:perspective(640px) rotateX(5deg);}",
      ".av-pet-bubble.right::after{left:auto;right:26px;margin-left:0;}",
      "@keyframes av-pet-bounce{0%,100%{transform:translateY(0)}45%{transform:translateY(-12px)}}",
      "@media (prefers-reduced-motion: reduce){.av-pet-ring,.av-pet-dot,.av-pet.thinking .av-pet-ring{animation:none}.av-pet.celebrate,.av-pet.react{animation:none}}",
      /* —— 语音对话框（右下角）—— */
      ".av-dialog{position:fixed;right:22px;bottom:22px;z-index:2147483600;display:flex;width:400px;max-width:calc(100vw - 44px);pointer-events:auto;cursor:pointer;transform:translateY(26px) scale(.97);opacity:0;filter:blur(6px);transition:transform .45s cubic-bezier(.22,1.2,.36,1),opacity .4s ease,filter .4s ease;}",
      ".av-dialog.on{transform:translateY(0) scale(1);opacity:1;filter:blur(0);}",
      ".av-dialog-card{position:relative;display:flex;width:100%;border:1px solid rgba(229,180,78,.55);border-radius:16px;overflow:hidden;box-shadow:0 18px 50px rgba(3,12,18,.6),0 0 0 1px rgba(70,185,217,.14),0 0 34px rgba(229,180,78,.18);background:linear-gradient(150deg, rgba(11,34,51,.96) 0%, rgba(7,23,34,.97) 60%);backdrop-filter:blur(14px);}",
      ".av-dialog-art{flex:none;width:128px;background-size:cover;background-position:center top;border-right:1px solid rgba(229,180,78,.3);}",
      ".av-dialog-body{flex:1;min-width:0;padding:14px 16px 12px;display:flex;flex-direction:column;gap:6px;}",
      ".av-dialog-name{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;letter-spacing:.06em;color:#e5b44e;}",
      ".av-dialog-name::before{content:'';width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 35% 35%, #f7d98a, #b8860b 70%);box-shadow:0 0 10px rgba(229,180,78,.6);}",
      ".av-dialog-text{font-size:14px;line-height:1.65;color:#eaf6fa;min-height:44px;word-break:break-word;}",
      ".av-dialog-text .cursor{display:inline-block;width:2px;height:1em;margin-left:2px;vertical-align:-2px;background:#e5b44e;animation:av-blink .8s steps(1) infinite;}",
      ".av-dialog-hint{font-size:11px;color:rgba(126,159,178,.9);text-align:right;letter-spacing:.02em;}",
      "@keyframes av-blink{50%{opacity:0}}",
      /* —— 大招动画覆盖层 —— */
      ".av-ult{position:fixed;inset:0;z-index:2147483500;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;visibility:hidden;will-change:opacity;transition:opacity .8s ease,visibility 0s linear .8s;}",
      ".av-ult.on{opacity:1;visibility:visible;transition:opacity .8s ease;}",
      ".av-ult.out{opacity:0;visibility:visible;transition:opacity 1.1s ease,visibility 0s linear 1.1s;}",
      ".av-ult.instant{opacity:1;visibility:visible;transition:none;}",
      ".av-ult-cover{position:absolute;inset:0;background:#02080e;opacity:1;transition:opacity .6s ease;}",
      ".av-ult-cover.gone{opacity:0;}",
      ".av-ult-backdrop{position:absolute;inset:0;background:radial-gradient(ellipse at center, rgba(10,34,48,.5) 0%, rgba(4,14,22,.96) 100%);backdrop-filter:blur(16px);}",
      ".av-ult-stage{position:relative;width:100%;height:100%;transform-style:preserve-3d;perspective:900px;display:flex;align-items:center;justify-content:center;overflow:hidden;}",
      ".av-ult-video{display:block;width:100vw;height:100vh;object-fit:cover;transform:translateZ(0);filter:brightness(1.03) saturate(1.05);animation:av-splash-zoom 9s ease-out both;}",
      "@keyframes av-splash-zoom{from{transform:translateZ(0) scale(1.0)}to{transform:translateZ(0) scale(1.05)}}",
      ".av-ult-dim{position:absolute;inset:0;background:rgba(2,8,14,1);pointer-events:none;opacity:0;transition:opacity 1.4s ease;}",
      ".av-ult.dim .av-ult-dim{opacity:1;}",
      ".av-ult.dim .av-ult-video{animation:av-splash-settle 1.2s ease-out both;}",
      "@keyframes av-splash-settle{from{transform:translateZ(0) scale(1.05)}to{transform:translateZ(0) scale(1.0)}}",
      ".av-ult-cutin{display:none;}",
      ".av-ult-flash{position:absolute;inset:0;background:radial-gradient(circle at center, rgba(247,217,138,.5), rgba(229,180,78,.12) 40%, transparent 70%);opacity:0;pointer-events:none;}",
      ".av-ult.on .av-ult-flash{animation:av-flash 1.1s ease-out;}",
      "@keyframes av-flash{0%{opacity:0}12%{opacity:.85}100%{opacity:0}}",
      ".av-ult-chip{position:absolute;width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 32% 30%, #f7d98a, #c9971f 72%);box-shadow:0 0 12px rgba(229,180,78,.8);}",
      ".av-ult-ring{position:absolute;border-radius:50%;border:2px solid rgba(229,180,78,.5);box-shadow:0 0 24px rgba(229,180,78,.35) inset;}",
      "@media (prefers-reduced-motion: reduce){.av-dialog,.av-ult,.av-bg{transition:none!important}.av-dialog-text .cursor{animation:none}}",
      /* —— 设置面板 —— */
      ".av-brand-chip{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:12px;border:1px solid rgba(229,180,78,.45);color:#e5b44e;font-size:12px;letter-spacing:.06em;white-space:nowrap;background:rgba(229,180,78,.08);}",
      "body.av-no-sideart .av-side-art{display:none}",
      ".av-row{display:flex;flex-direction:column;gap:10px;padding:14px 2px;border-bottom:1px solid var(--dsw-alias-border-l2);}",
      ".av-row:last-child{border-bottom:none}",
      ".av-row-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}",
      ".av-row-title::before{content:'';width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,#f7d98a,#1e7fa5);box-shadow:0 0 8px rgba(229,180,78,.5)}",
      ".av-row-desc{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.6}",
      ".av-switches{display:flex;flex-wrap:wrap;gap:8px}",
      ".av-switch{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer;transition:all .18s ease}",
      ".av-switch:hover{background:var(--dsw-alias-interactive-bg-hover)}",
      ".av-switch.on{border-color:rgba(229,180,78,.6);background:rgba(229,180,78,.14);color:#e5b44e}",
      ".av-ctl{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--dsw-alias-label-secondary)}",
      ".av-ctl input[type=range]{flex:1;accent-color:#e5b44e}",
      ".av-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font-size:13px;cursor:pointer;transition:all .18s ease}",
      ".av-btn:hover{border-color:rgba(229,180,78,.55)}",
      ".av-scheme{display:inline-flex;gap:0;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;overflow:hidden}",
      ".av-scheme button{flex:1;padding:6px 16px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer}",
      ".av-scheme button.on{background:var(--dsw-alias-interactive-bg-active);color:#e5b44e}",
    ].join("\n");

    function injectStyle() {
      if (typeof document === "undefined") return;
      var tagId = "dsh-aventurine-skin/styles";
      if (!document.querySelector('style[data-plugin-css="' + tagId + '"]')) {
        var tag = document.createElement("style");
        tag.dataset.plugin = NS;
        tag.dataset.pluginCss = tagId;
        tag.textContent = CSS;
        document.head.appendChild(tag);
      }
    }

    /* ============================================================
     * 小工具
     * ============================================================ */
    function safe(fn, fallback) {
      try {
        return fn();
      } catch {
        return fallback;
      }
    }

    function makeSource(initial) {
      var state = initial;
      var listeners = new Set();
      return {
        getSnapshot: function () {
          return state;
        },
        set: function (next) {
          state = next;
          listeners.forEach(function (l) {
            try {
              l();
            } catch {}
          });
        },
        subscribe: function (listener) {
          listeners.add(listener);
          return function () {
            listeners.delete(listener);
          };
        },
      };
    }

    var reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ============================================================
     * 插件主体
     * ============================================================ */
    var inject = ["slots", "sessions", "locale", "theme", "timer"];

    function apply(ctx, rawConfig) {
      var defaults = {};
      for (var k in DEFAULTS) defaults[k] = DEFAULTS[k];
      var patchCfg = rawConfig || {};
      var cfg = readConfig();
      // 补丁里的 config 只做首启兜底：若 localStorage 无记录且补丁有值则采用补丁值
      var savedRaw = readStorage("config", null);
      if (!savedRaw) {
        for (var k2 in defaults) {
          if (typeof patchCfg[k2] !== "undefined") cfg[k2] = patchCfg[k2];
        }
      }

      var disposed = false;

      injectStyle();

      /* —— 开屏兜底遮罩：apply 内同步创建，最早时刻盖住窗口（绝不让终端界面先闪现） —— */
      var bootCoverEl = null;
      var bootCoverSafety = null;
      try {
        if (typeof document !== "undefined" && document.documentElement) {
          bootCoverEl = document.createElement("div");
          bootCoverEl.className = "av-ult instant";
          var bootBackdrop = document.createElement("div");
          bootBackdrop.className = "av-ult-backdrop";
          var bootCoverInner = document.createElement("div");
          bootCoverInner.className = "av-ult-cover";
          bootCoverEl.appendChild(bootBackdrop);
          bootCoverEl.appendChild(bootCoverInner);
          (document.body || document.documentElement).appendChild(bootCoverEl);
        }
      } catch {}
      function dismissBootCover() {
        try {
          if (bootCoverSafety) {
            clearTimeout(bootCoverSafety);
            bootCoverSafety = null;
          }
          if (bootCoverEl && bootCoverEl.parentNode) bootCoverEl.parentNode.removeChild(bootCoverEl);
        } catch {}
        bootCoverEl = null;
      }
      // 兜底：12 秒后强制移除（视频加载失败也不得卡住终端）
      bootCoverSafety = setTimeout(dismissBootCover, 12000);

      /* ---------- 本地化 ---------- */
      var dictZh = {
        skinTitle: "砂金·戏浪皮肤",
        skinDesc: "《崩坏：星穹铁道》砂金·戏浪主题：深海青蓝 × 金色筹码。语音与大招动画素材来自米哈游官方渠道。",
        voiceSwitch: "任务完成语音",
        ultSwitch: "命中率大招动画",
        particlesSwitch: "筹码粒子",
        petSwitch: "砂金桌宠",
        petSize: "桌宠大小",
        petReset: "重置桌宠位置",
        splashSwitch: "开屏动画",
        backdropSwitch: "背景景深",
        figureLabel: "壁纸立绘",
        figureNone: "关闭",
        figureFloat: "水下漂浮",
        figureResort: "海滨回眸",
        figureOpacity: "立绘不透明度",
        figureSize: "立绘大小",
        figureBrightness: "立绘亮度",
        themeSwitch: "主题皮肤",
        volume: "音量",
        voiceCooldown: "语音冷却（秒）",
        ultCooldown: "动画冷却（分钟）",
        testVoice: "试听语音",
        testUlt: "试播开屏动画",
        tierDesc: "开屏动画：终端启动时全屏播放角色PV精选片段，立绘隐退→沉浸播放→丝滑复现",
        scheme: "配色",
        schemeDark: "深海洋底",
        schemeLight: "浅青假日",
        dialogHint: "点击关闭",
        voiceName: "砂金·戏浪",
      };
      var dictEn = {
        skinTitle: "Aventurine · Waveflair Skin",
        skinDesc: "Honkai: Star Rail Aventurine · Waveflair theme: deep-ocean teal × golden chips. Voice & animation from official HoYoverse media.",
        voiceSwitch: "Voice on task done",
        ultSwitch: "Ultimate on cache hit",
        particlesSwitch: "Chip particles",
        petSwitch: "Aventurine pet",
        petSize: "Pet size",
        petReset: "Reset pet position",
        splashSwitch: "Splash animation",
        backdropSwitch: "Depth backdrop",
        figureLabel: "Wallpaper art",
        figureNone: "Off",
        figureFloat: "Underwater float",
        figureResort: "Resort glance",
        figureOpacity: "Art opacity",
        figureSize: "Art size",
        figureBrightness: "Art brightness",
        themeSwitch: "Theme skin",
        volume: "Volume",
        voiceCooldown: "Voice cooldown (s)",
        ultCooldown: "Ult cooldown (min)",
        testVoice: "Preview voice",
        testUlt: "Preview splash",
        tierDesc: "Splash: full-screen character PV clip on launch with cinematic hide/reveal of the artwork",
        scheme: "Scheme",
        schemeDark: "Deep ocean",
        schemeLight: "Aqua holiday",
        dialogHint: "Click to dismiss",
        voiceName: "Aventurine · Waveflair",
      };

      var locale = ctx.get("locale");
      var t = function (key) {
        try {
          if (locale && typeof locale.bind === "function") {
            var bound = locale.bind(NS);
            return bound(key);
          }
        } catch {}
        return dictZh[key] || key;
      };
      if (locale && typeof locale.register === "function") {
        safe(function () {
          ctx.effect(function () {
            return locale.register(NS, { zh: dictZh, en: dictEn });
          }, NS + ": dictionaries");
        });
      }

      /* ---------- 主题注册与应用 ---------- */
      var themeDisposers = [];
      var theme = ctx.get("theme");

      function registerSkins() {
        if (!theme || typeof theme.register !== "function") return;
        try {
          themeDisposers.push(theme.register(SKIN_DARK));
        } catch (e) {}
        try {
          themeDisposers.push(theme.register(SKIN_LIGHT));
        } catch (e) {}
      }
      registerSkins();
      ctx.effect(function () {
        return function () {
          themeDisposers.forEach(function (d) {
            try {
              d();
            } catch {}
          });
          themeDisposers = [];
        };
      }, NS + ": theme registration");

      function activeSkinId() {
        return cfg.scheme === "light" ? SKIN_LIGHT.id : SKIN_DARK.id;
      }

      /**
       * 单源掌控配色的关键（dsh-theme「独立 CSS 接入」模式）：
       * 宿主外观设置会把主题运行时写的内联 token 覆盖回 system/light，
       * 因此直接把全部 --dsw-* token 以 !important 注入样式表——
       * 内联非 !important 声明无法战胜它，配色不再被宿主重置。
       * 主画布/侧栏在此直接使用半透明值（不再依赖 overrideTokens），
       * 负 z 层立绘与壁纸稳定透出。
       */
      function buildTokenCss(scheme) {
        var skin = scheme === "light" ? SKIN_LIGHT : SKIN_DARK;
        var tokens = {};
        for (var key in skin.tokens) tokens[key] = skin.tokens[key];
        var alpha = scheme === "light" ? 0.48 : 0.40;
        var sideAlpha = scheme === "light" ? 0.52 : 0.44;
        tokens["--dsw-alias-bg-base"] = toRgbaRaw(
          scheme === "light" ? "#e9f7fa" : "#071722",
          alpha
        );
        tokens["--dsw-specific-sidebar-fill"] = toRgbaRaw(
          scheme === "light" ? "#e2f1f6" : "#0a1e2e",
          sideAlpha
        );
        var rules = [];
        for (var k2 in tokens) {
          rules.push(k2 + ":" + tokens[k2] + " !important;");
        }
        return ":root,body{" + rules.join("") + "}";
      }

      function toRgbaRaw(color, alpha) {
        var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color).trim());
        if (hex) {
          var d = hex[1];
          if (d.length === 3) d = d.split("").map(function (c) { return c + c; }).join("");
          var n = parseInt(d, 16);
          return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + alpha + ")";
        }
        return String(color);
      }

      var tokenStyleEl = null;
      function applyTokenCss() {
        if (typeof document === "undefined") return;
        if (!cfg.themeEnabled) {
          if (tokenStyleEl) tokenStyleEl.remove();
          tokenStyleEl = null;
          if (document.body) document.body.removeAttribute("data-ds-dark-theme");
          return;
        }
        var dark = cfg.scheme !== "light";
        if (!tokenStyleEl) {
          tokenStyleEl = document.createElement("style");
          tokenStyleEl.setAttribute("data-plugin", NS);
          tokenStyleEl.setAttribute("data-plugin-css", NS + "/tokens");
          document.head.appendChild(tokenStyleEl);
        }
        tokenStyleEl.textContent = buildTokenCss(cfg.scheme);
        if (document.body) {
          if (dark) document.body.setAttribute("data-ds-dark-theme", "");
          else document.body.removeAttribute("data-ds-dark-theme");
        }
      }

      // 宿主可能随时把 data-ds-dark-theme 摘掉：观察并重新断言
      var themeAttrObserver = null;
      function watchDarkAttr() {
        if (typeof MutationObserver === "undefined" || themeAttrObserver) return;
        themeAttrObserver = new MutationObserver(function () {
          if (cfg.themeEnabled && cfg.scheme !== "light" && document.body && !document.body.hasAttribute("data-ds-dark-theme")) {
            document.body.setAttribute("data-ds-dark-theme", "");
          }
        });
        themeAttrObserver.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
      }

      function applyTheme() {
        applyTokenCss();
        watchDarkAttr();
        if (!theme || typeof theme.setTheme !== "function") return;
        if (!cfg.themeEnabled) {
          // 关闭主题皮肤 → 一键恢复原生外观（EAC 经验）
          safe(function () {
            theme.setTheme("system");
          });
          return;
        }
        safe(function () {
          theme.setTheme(activeSkinId());
        });
      }

      // 首启应用 + 补时重放（宿主设置可能在插件注册后重置外观）
      applyTheme();
      var reassertTimers = [setTimeout(applyTheme, 0), setTimeout(applyTheme, 120)];
      ctx.effect(function () {
        return function () {
          reassertTimers.forEach(clearTimeout);
        };
      }, NS + ": theme reassert");

      /* ---------- 背景景深层（波纹纹理 -3 / 弥散光 -2 / 光桥 -2 / 遮罩 -1 / 边缘微光 / 玻璃 UI） ---------- */
      var bgWavesEl = null;
      var bgVignetteEl = null;
      var ambientEl = null;
      var bridgeEl = null;
      var washEl = null;
      var edgeEl = null;
      var parallaxRaf = null;
      var pointerX = 0;
      var pointerY = 0;

      function washGradient() {
        var isLight = cfg.scheme === "light";
        var c = isLight ? "233, 247, 250" : "7, 23, 34";
        var a1 = isLight ? 0.72 : 0.68;
        var a2 = isLight ? 0.4 : 0.38;
        return (
          "linear-gradient(90deg, rgba(" + c + "," + a1 + ") 0%, rgba(" + c + "," + a2 + ") 48%, rgba(" + c + ",0) 80%)"
        );
      }

      function onThemeChange() {
        // 半透明 token 由注入样式表单源掌控；此处只需刷新遮罩与深色属性
        if (washEl) washEl.style.background = washGradient();
        applyTokenCss();
      }

      function ensureBackdrop() {
        if (!document.body) return;
        if (!cfg.backdropEnabled || !cfg.themeEnabled) {
          if (bgWavesEl) bgWavesEl.remove();
          if (bgVignetteEl) bgVignetteEl.remove();
          if (ambientEl) ambientEl.remove();
          if (bridgeEl) bridgeEl.remove();
          if (edgeEl) edgeEl.remove();
          if (washEl) washEl.remove();
          bgWavesEl = bgVignetteEl = ambientEl = bridgeEl = edgeEl = washEl = null;
          return;
        }
        if (!bgVignetteEl) {
          bgVignetteEl = document.createElement("div");
          bgVignetteEl.className = "av-bg-vignette";
          document.body.prepend(bgVignetteEl);
        }
        if (!bgWavesEl) {
          bgWavesEl = document.createElement("div");
          bgWavesEl.className = "av-bg-waves";
          document.body.prepend(bgWavesEl);
        }
        if (!ambientEl) {
          ambientEl = document.createElement("div");
          ambientEl.className = "av-ambient";
          document.body.prepend(ambientEl);
        }
        if (!bridgeEl) {
          bridgeEl = document.createElement("div");
          bridgeEl.className = "av-bridge";
          document.body.prepend(bridgeEl);
        }
        if (!edgeEl) {
          edgeEl = document.createElement("div");
          edgeEl.className = "av-edge";
          document.body.appendChild(edgeEl);
        }
        if (!washEl) {
          washEl = document.createElement("div");
          washEl.className = "av-wash";
          washEl.style.background = washGradient();
          document.body.prepend(washEl);
        }
      }

      function onPointerMove(e) {
        pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
        pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
        if (parallaxRaf === null) {
          parallaxRaf = requestAnimationFrame(function () {
            parallaxRaf = null;
            // 立绘层用更大的视差系数（前景层，随指针同向移动形成纵深差）
            if (figureEl && !reducedMotion) {
              figureEl.style.transform =
                "translate3d(" + pointerX * 16 + "px," + pointerY * 10 + "px,0)";
            }
            if (figureElLeft && !reducedMotion) {
              figureElLeft.style.transform =
                "translate3d(" + pointerX * -8 + "px," + pointerY * 6 + "px,0)";
            }
          });
        }
      }

      /* ---------- 壁纸式立绘层（右侧 137 / 左侧 139 双立绘，互为对景） ---------- */
      var figureEl = null;
      var figureElLeft = null;

      function figurePair() {
        var art = cfg.figureArt || "float";
        if (art === "resort") {
          return { right: "figure_resort.jpg", left: "figure_float.jpg" };
        }
        return { right: "figure_float.jpg", left: "figure_resort.jpg" };
      }

      function figureBrightnessFilter() {
        return "saturate(1.04) brightness(" + (Number(cfg.figureBrightness) || 1.2) + ")";
      }

      function ensureFigure() {
        if (!document.body) return;
        var art = cfg.figureArt || "float";
        if (!cfg.themeEnabled || !cfg.backdropEnabled || art === "none") {
          if (figureEl) {
            figureEl.remove();
            figureEl = null;
          }
          if (figureElLeft) {
            figureElLeft.remove();
            figureElLeft = null;
          }
          return;
        }
        var pair = figurePair();
        if (!figureEl) {
          figureEl = document.createElement("div");
          figureEl.className = "av-figure" + (art === "float" ? " float" : "");
          var figImg = document.createElement("img");
          figImg.alt = "";
          figureEl.appendChild(figImg);
          document.body.prepend(figureEl);
          requestAnimationFrame(function () {
            if (figureEl) {
              figureEl.style.opacity = String(cfg.figureOpacity ?? 1);
              figureEl.classList.add("enter");
            }
          });
        }
        figureEl.className = "av-figure" + (art === "float" ? " float" : "");
        var img = figureEl.firstChild;
        if (img) {
          img.src = ASSET_BASE + "/img/" + (pair.right === "figure_float.jpg" ? "figure_float_cut.png" : "figure_resort_cut.png") + "?v=" + ASSET_VERSION;
          img.style.height = (Number(cfg.figureSize) || 95) + "vh";
          img.style.filter = figureBrightnessFilter();
        }
        figureEl.style.opacity = String(cfg.figureOpacity ?? 1);

        // 左侧沉浸立绘（无框、大尺寸、渐隐沉入）
        if (!figureElLeft) {
          figureElLeft = document.createElement("div");
          figureElLeft.className = "av-figure-left" + (art === "float" ? " float" : "");
          var figImgL = document.createElement("img");
          figImgL.alt = "";
          figureElLeft.appendChild(figImgL);
          document.body.prepend(figureElLeft);
          requestAnimationFrame(function () {
            if (figureElLeft) {
              figureElLeft.style.opacity = String(cfg.figureOpacity ?? 1);
              figureElLeft.classList.add("enter");
            }
          });
        }
        figureElLeft.className = "av-figure-left" + (art === "float" ? " float" : "");
        var imgL = figureElLeft.firstChild;
        if (imgL) {
          imgL.src = ASSET_BASE + "/img/" + (pair.left === "figure_float.jpg" ? "figure_float_cut.png" : "figure_resort_cut.png") + "?v=" + ASSET_VERSION;
          imgL.style.height = (Number(cfg.figureSize) || 95) + "vh";
          imgL.style.filter = figureBrightnessFilter();
        }
        figureElLeft.style.opacity = String(cfg.figureOpacity ?? 1);
      }

      /** 任务完成时立绘庆祝反应（金色光晕脉冲，2 秒后回落）。 */
      function figureCelebrate() {
        var art = cfg.figureArt || "float";
        [figureEl, figureElLeft].forEach(function (el) {
          if (!el) return;
          if (el === figureEl) {
            el.className = "av-figure" + (art === "float" ? " float" : "") + " celebrate";
          } else {
            el.className = "av-figure-left" + (art === "float" ? " float" : "");
          }
        });
        setTimeout(function () {
          if (figureEl) figureEl.className = "av-figure" + (art === "float" ? " float" : "");
          if (figureElLeft) figureElLeft.className = "av-figure-left" + (art === "float" ? " float" : "");
        }, 2200);
      }

      /* ---------- 砂金桌宠（可拖动 / 点击互动 / 任务状态联动） ---------- */
      var petEl = null;
      var petBubbleEl = null;
      var petMood = "idle"; // idle | thinking | celebrate
      var petPos = readStorage("petPos", null);
      var petDrag = null;
      var petMoved = false;
      var petReactTimer = null;

      function petClassName() {
        var cls = "av-pet";
        if (petMood === "thinking") cls += " thinking";
        else if (petMood === "celebrate") cls += " celebrate";
        return cls;
      }

      function showPetBubble(text) {
        if (!petEl || !petBubbleEl) return;
        petBubbleEl.textContent = text;
        var rect = petEl.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        petBubbleEl.classList.remove("left", "right");
        if (centerX > window.innerWidth * 0.62) {
          // 靠右：气泡右缘对齐宠物右缘，向左展开，避免被右边界裁切
          petBubbleEl.classList.add("right");
        } else if (centerX < window.innerWidth * 0.38) {
          petBubbleEl.classList.add("left");
        }
        petBubbleEl.style.display = "";
      }

      function hidePetBubble() {
        if (petBubbleEl) petBubbleEl.style.display = "none";
      }

      function petSetMood(mood) {
        petMood = mood;
        if (petEl) petEl.className = petClassName();
        if (mood === "idle") {
          if (petReactTimer) {
            clearTimeout(petReactTimer);
            petReactTimer = null;
          }
          hidePetBubble();
        }
      }

      function applyPetPos() {
        if (!petEl) return;
        if (!petPos || petPos.x == null) {
          petEl.style.left = "auto";
          petEl.style.top = "auto";
          petEl.style.right = "26px";
          petEl.style.bottom = "40px";
          return;
        }
        petEl.style.right = "auto";
        petEl.style.bottom = "auto";
        petEl.style.left = Math.max(0, Math.min(window.innerWidth - 90, petPos.x)) + "px";
        petEl.style.top = Math.max(0, Math.min(window.innerHeight - 90, petPos.y)) + "px";
      }

      function ensurePet() {
        if (!document.body) return;
        if (!cfg.petEnabled) {
          if (petEl) {
            petEl.remove();
            petEl = null;
            petBubbleEl = null;
          }
          return;
        }
        if (!petEl) {
          petEl = document.createElement("div");
          petEl.className = petClassName();
          var pBody = document.createElement("div");
          pBody.className = "av-pet-body";
          var pFace = document.createElement("img");
          pFace.className = "av-pet-face";
          pFace.src = ASSET_BASE + "/img/pet_face.png?v=" + ASSET_VERSION;
          pFace.alt = "";
          pFace.draggable = false;
          var pRing = document.createElement("div");
          pRing.className = "av-pet-ring";
          pBody.appendChild(pFace);
          pBody.appendChild(pRing);
          for (var di = 1; di <= 3; di++) {
            var dot = document.createElement("span");
            dot.className = "av-pet-dot d" + di;
            pBody.appendChild(dot);
          }
          petBubbleEl = document.createElement("div");
          petBubbleEl.className = "av-pet-bubble";
          petBubbleEl.style.display = "none";
          petEl.appendChild(petBubbleEl);
          petEl.appendChild(pBody);
          document.body.appendChild(petEl);

          petEl.addEventListener("pointerdown", function (e) {
            if (!petEl) return;
            petDrag = { sx: e.clientX, sy: e.clientY, ox: petPos ? petPos.x : null, oy: petPos ? petPos.y : null, baseLeft: petEl.offsetLeft, baseTop: petEl.offsetTop };
            petMoved = false;
            try {
              petEl.setPointerCapture(e.pointerId);
            } catch {}
            e.preventDefault();
          });
          petEl.addEventListener("pointermove", function (e) {
            if (!petDrag || !petEl) return;
            var dx = e.clientX - petDrag.sx;
            var dy = e.clientY - petDrag.sy;
            if (Math.abs(dx) + Math.abs(dy) > 6) petMoved = true;
            if (petMoved) {
              var nx = petDrag.baseLeft + dx;
              var ny = petDrag.baseTop + dy;
              nx = Math.max(0, Math.min(window.innerWidth - 90, nx));
              ny = Math.max(0, Math.min(window.innerHeight - 90, ny));
              petEl.style.left = nx + "px";
              petEl.style.top = ny + "px";
              petEl.style.right = "auto";
              petEl.style.bottom = "auto";
            }
          });
          var endDrag = function (e) {
            if (!petDrag || !petEl) return;
            var dx = e.clientX - petDrag.sx;
            var dy = e.clientY - petDrag.sy;
            if (petMoved) {
              petPos = {
                x: Math.max(0, Math.min(window.innerWidth - 90, petDrag.baseLeft + dx)),
                y: Math.max(0, Math.min(window.innerHeight - 90, petDrag.baseTop + dy)),
              };
              writeStorage("petPos", petPos);
            }
            petDrag = null;
            try {
              petEl.releasePointerCapture(e.pointerId);
            } catch {}
          };
          petEl.addEventListener("pointerup", endDrag);
          petEl.addEventListener("pointercancel", endDrag);
          petEl.addEventListener("click", function () {
            if (petMoved) {
              petMoved = false;
              return;
            }
            // 点击互动：随机台词文字气泡 + 弹跳（文字聊天泡方案，不播放音频）
            var line = pickLine();
            if (line.text) showPetBubble(line.text);
            petMood = "idle";
            if (petEl) petEl.className = "av-pet react";
            if (petReactTimer) clearTimeout(petReactTimer);
            petReactTimer = setTimeout(function () {
              petReactTimer = null;
              if (petEl) {
                petEl.className = petClassName();
                hidePetBubble();
              }
            }, 4200);
          });
        }
        var petPx = Number(cfg.petSize) || 110;
        petEl.style.width = petPx + "px";
        petEl.style.height = petPx + "px";
        if (!petDrag) applyPetPos();
      }

      var THINKING_LINES = [
        "正在处理任务……",
        "让我看看这局牌面……",
        "下注之前，先看看风向……",
        "稍等，正盯着浪尖呢……",
        "筹码已经推上桌了……",
      ];
      function pickThinkingLine() {
        return THINKING_LINES[Math.floor(Math.random() * THINKING_LINES.length)];
      }

      function petOnTaskStart() {
        petSetMood("thinking");
        showPetBubble(pickThinkingLine());
        if (petReactTimer) clearTimeout(petReactTimer);
        petReactTimer = setTimeout(function () {
          petReactTimer = null;
          if (petMood === "thinking") petSetMood("idle");
        }, 8000);
      }

      function petOnTaskDone() {
        petSetMood("celebrate");
        var line = pickLine();
        showPetBubble("任务完成！" + (line.text ? " " + line.text : ""));
        if (petReactTimer) clearTimeout(petReactTimer);
        petReactTimer = setTimeout(function () {
          petReactTimer = null;
          petSetMood("idle");
        }, 6500);
      }

      /** 设置面板：重置桌宠位置 */
      function petResetPos() {
        petPos = null;
        writeStorage("petPos", null);
        applyPetPos();
      }

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      // 启动初始化整体加保护：任何异常都不得拖垮应用（教训：v15 崩溃）
      safe(function () {
        ensureBackdrop();
        ensureFigure();
        ensurePet();
        applyTheme();
        watchDarkAttr();
      });

      // 开屏动画：终端打开即播放（同步遮罩已盖住窗口 → 视频加载期间只见深海黑幕）
      var splashTimer = setTimeout(function () {
        if (disposed) return;
        // 防重放：同一会话内客户端重注入时不得再次播放（任务中重复动画的根因）
        var played = false;
        try {
          played = sessionStorage.getItem(NS + ":splash-played") === "1";
        } catch {}
        if (!cfg.splashEnabled || !cfg.ultEnabled || played) {
          dismissBootCover();
          return;
        }
        try {
          sessionStorage.setItem(NS + ":splash-played", "1");
        } catch {}
        showUltimate("pv_intro.mp4", bootCoverEl);
      }, 0);
      ctx.effect(function () {
        return function () {
          clearTimeout(splashTimer);
        };
      }, NS + ": splash timer");

      // 外观/深浅切换时重新着色半透明层（保持景深可见且跟随新配色）
      var themeChangeUnsub = null;
      safe(function () {
        if (typeof ctx.on === "function") {
          themeChangeUnsub = ctx.on("theme/change", onThemeChange);
        }
      });

      /* ---------- 粒子画布（金色筹码 + 气泡） ---------- */
      var particleCanvas = null;
      var particleCtx = null;
      var particleRaf = null;
      var particles = [];
      var particleRunning = false;

      function initParticles() {
        if (!document.body) return;
        if (!cfg.particlesEnabled) {
          if (particleCanvas) {
            particleCanvas.remove();
            particleCanvas = null;
            particleCtx = null;
          }
          return;
        }
        if (!particleCanvas) {
          particleCanvas = document.createElement("canvas");
          particleCanvas.className = "av-particles";
          document.body.appendChild(particleCanvas);
          particleCtx = particleCanvas.getContext("2d");
          particles = [];
          var count = reducedMotion ? 8 : 26;
          for (var i = 0; i < count; i++) {
            particles.push(spawnParticle(true));
          }
        }
        if (!particleRunning) {
          particleRunning = true;
          particleRaf = requestAnimationFrame(particleTick);
        }
      }

      function spawnParticle(anywhere) {
        var chip = Math.random() < 0.62;
        return {
          x: Math.random() * window.innerWidth,
          y: anywhere ? Math.random() * window.innerHeight : window.innerHeight + 30,
          r: chip ? 4 + Math.random() * 5 : 2 + Math.random() * 3,
          vy: -(0.25 + Math.random() * 0.6),
          vx: (Math.random() - 0.5) * 0.3,
          drift: Math.random() * Math.PI * 2,
          chip: chip,
          alpha: 0.25 + Math.random() * 0.45,
        };
      }

      function particleTick() {
        if (!particleRunning || !particleCtx || !particleCanvas) return;
        var w = (particleCanvas.width = window.innerWidth);
        var h = (particleCanvas.height = window.innerHeight);
        particleCtx.clearRect(0, 0, w, h);
        var hidden = document.hidden === true;
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          if (!hidden) {
            p.y += p.vy;
            p.x += p.vx + Math.sin(p.drift) * 0.12;
            p.drift += 0.01;
          }
          if (p.y < -40 || p.x < -40 || p.x > w + 40) particles[i] = spawnParticle(false);
          particleCtx.globalAlpha = p.alpha;
          if (p.chip) {
            var g = particleCtx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, 1, p.x, p.y, p.r);
            g.addColorStop(0, "#f7d98a");
            g.addColorStop(0.65, "#e5b44e");
            g.addColorStop(1, "#8a6116");
            particleCtx.fillStyle = g;
            particleCtx.beginPath();
            particleCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            particleCtx.fill();
            particleCtx.globalAlpha = p.alpha * 0.8;
            particleCtx.strokeStyle = "#5c4210";
            particleCtx.lineWidth = 1;
            particleCtx.stroke();
          } else {
            particleCtx.fillStyle = "rgba(150, 220, 235, 1)";
            particleCtx.beginPath();
            particleCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            particleCtx.fill();
          }
        }
        particleRaf = requestAnimationFrame(particleTick);
      }

      initParticles();

      /* ---------- 语音台词清单 ---------- */
      var lines = FALLBACK_LINES.slice();
      function loadLines() {
        safe(function () {
          fetch(ASSET_BASE + "/voice.json", { cache: "no-store" })
            .then(function (r) {
              return r.ok ? r.json() : Promise.reject(null);
            })
            .then(function (data) {
              if (disposed || !data || !Array.isArray(data.lines) || data.lines.length === 0) return;
              lines = data.lines;
            })
            .catch(function () {});
        });
      }
      loadLines();

      /* ---------- 音频播放 ---------- */
      var audioEl = null;
      function playAudio(url) {
        return safe(
          function () {
            if (!audioEl) audioEl = new Audio();
            try {
              audioEl.pause();
            } catch {}
            audioEl.src = url;
            audioEl.volume = Math.max(0, Math.min(1, Number(cfg.volume) || 0));
            var p = audioEl.play();
            if (p && typeof p.catch === "function") {
              p.catch(function () {});
            }
          },
          null
        );
      }

      function pickLine() {
        if (lines.length === 0) return { file: "", text: "" };
        var line = lines[Math.floor(Math.random() * lines.length)];
        return { file: line.file || "", text: line.text || "" };
      }

      /* ---------- 语音对话框 ---------- */
      var dialogEl = null;
      var dialogTimer = null;
      var typeTimer = null;

      function dismissDialog() {
        if (!dialogEl) return;
        dialogEl.classList.remove("on");
        if (typeTimer) {
          clearInterval(typeTimer);
          typeTimer = null;
        }
        if (dialogTimer) {
          clearTimeout(dialogTimer);
          dialogTimer = null;
        }
        var el = dialogEl;
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 460);
        dialogEl = null;
        if (audioEl) {
          safe(function () {
            audioEl.pause();
          });
        }
      }

      function showVoiceDialog() {
        if (disposed || !cfg.voiceEnabled || !document.body) return;
        dismissDialog();
        var line = pickLine();
        if (!line.file && !line.text) return;

        var card = document.createElement("div");
        card.className = "av-dialog-card";
        var art = document.createElement("div");
        art.className = "av-dialog-art";
        art.style.backgroundImage = "url(" + ASSET_BASE + "/img/dialog_art.jpg?v=" + ASSET_VERSION + ")";
        var body = document.createElement("div");
        body.className = "av-dialog-body";
        var nameEl = document.createElement("div");
        nameEl.className = "av-dialog-name";
        nameEl.textContent = t("voiceName");
        var textEl = document.createElement("div");
        textEl.className = "av-dialog-text";
        var hintEl = document.createElement("div");
        hintEl.className = "av-dialog-hint";
        hintEl.textContent = t("dialogHint");
        body.appendChild(nameEl);
        body.appendChild(textEl);
        body.appendChild(hintEl);
        card.appendChild(art);
        card.appendChild(body);

        dialogEl = document.createElement("div");
        dialogEl.className = "av-dialog";
        dialogEl.appendChild(card);
        dialogEl.addEventListener("click", dismissDialog);
        document.body.appendChild(dialogEl);

        requestAnimationFrame(function () {
          if (dialogEl) dialogEl.classList.add("on");
        });

        // 打字机字幕
        var full = line.text;
        var pos = 0;
        textEl.innerHTML = "";
        var cursor = document.createElement("span");
        cursor.className = "cursor";
        textEl.appendChild(cursor);
        typeTimer = setInterval(function () {
          if (!dialogEl) {
            clearInterval(typeTimer);
            typeTimer = null;
            return;
          }
          pos += 1;
          if (pos > full.length) {
            clearInterval(typeTimer);
            typeTimer = null;
            textEl.replaceChild(document.createTextNode(full), textEl.firstChild);
            return;
          }
          var shown = full.slice(0, pos);
          if (textEl.firstChild && textEl.firstChild.nodeType === 3) {
            textEl.firstChild.textContent = shown;
          } else {
            textEl.insertBefore(document.createTextNode(shown), cursor);
          }
        }, reducedMotion ? 18 : 46);

        // 语音
        if (line.file) {
          playAudio(ASSET_BASE + "/audio/" + line.file);
        }

        var hideMs = Number(cfg.dialogAutoHideMs) || 8000;
        dialogTimer = setTimeout(dismissDialog, hideMs);
      }

      /* ---------- 大招动画覆盖层 ---------- */
      var ultEl = null;
      var ultVideo = null;
      var ultChips = [];
      var ultHideTimer = null;
      var ultPlaying = false;

      /* 命中率分级动画（96-98 → 大招；98-99 → 普通欢愉技；100 → 强化欢愉技）。
       * 启动时用 HEAD 探测素材是否存在；缺失档位自动降级到下一档。 */
      var ANIM_TIERS = [
        { file: "elation_enhanced.mp4", min: 0.999, fallback: "elation.mp4" },
        { file: "elation.mp4", min: 0.98, fallback: "ult.mp4" },
        { file: "ult.mp4", min: 0.96, fallback: null },
      ];
      var animAvailable = {};
      function probeAnims() {
        ANIM_TIERS.forEach(function (tier) {
          safe(function () {
            fetch(ASSET_BASE + "/video/" + tier.file, { method: "HEAD", cache: "no-store" })
              .then(function (r) {
                animAvailable[tier.file] = r.ok;
              })
              .catch(function () {
                animAvailable[tier.file] = false;
              });
          });
        });
      }
      probeAnims();

      function pickAnimation(rate) {
        var tier = null;
        for (var i = 0; i < ANIM_TIERS.length; i++) {
          if (rate >= ANIM_TIERS[i].min) {
            tier = ANIM_TIERS[i];
            break;
          }
        }
        if (!tier) return null;
        // 目标档位素材存在则用目标档位；否则沿降级链找第一个可用素材
        var cur = tier;
        while (cur) {
          if (animAvailable[cur.file] === true) return cur.file;
          cur = ANIM_TIERS.find(function (x) {
            return x.file === cur.fallback;
          }) || null;
        }
        return null;
      }

      function clearUltChips() {
        for (var i = 0; i < ultChips.length; i++) {
          var c = ultChips[i];
          if (c.parentNode) c.parentNode.removeChild(c);
        }
        ultChips = [];
      }

      function hideUltimate() {
        if (!ultEl) return;
        // 丝滑退场：先淡出 1s，再移除；立绘同步复现
        if (figureEl) figureEl.classList.remove("hide");
        if (figureElLeft) figureElLeft.classList.remove("hide");
        if (ultVideo) {
          safe(function () {
            ultVideo.pause();
          });
        }
        ultEl.classList.remove("on");
        ultEl.classList.remove("instant");
        ultEl.classList.add("out");
        var el = ultEl;
        if (el === bootCoverEl) bootCoverEl = null;
        setTimeout(function () {
          clearUltChips();
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 1050);
        ultEl = null;
        ultVideo = null;
        ultPlaying = false;
        if (ultHideTimer) {
          clearTimeout(ultHideTimer);
          ultHideTimer = null;
        }
      }

      function showUltimate(videoName, reuseEl) {
        if (disposed || !cfg.ultEnabled || !document.body || ultPlaying) return;
        hideUltimate();
        ultPlaying = true;

        // 沉浸式呈现：两张背景立绘丝滑隐退，把整片景深留给动画
        if (figureEl) figureEl.classList.add("hide");
        if (figureElLeft) figureElLeft.classList.add("hide");

        var overlay = reuseEl && reuseEl.parentNode ? reuseEl : null;
        if (!overlay) {
          overlay = document.createElement("div");
          overlay.className = "av-ult instant";
          var backdrop = document.createElement("div");
          backdrop.className = "av-ult-backdrop";
          var cover = document.createElement("div");
          cover.className = "av-ult-cover";
          overlay.appendChild(backdrop);
          overlay.appendChild(cover);
        } else if (bootCoverEl === overlay) {
          // 复用开屏兜底遮罩：由开屏流程接管，取消兜底定时器
          if (bootCoverSafety) {
            clearTimeout(bootCoverSafety);
            bootCoverSafety = null;
          }
        }
        var flash = document.createElement("div");
        flash.className = "av-ult-flash";
        var stage = document.createElement("div");
        stage.className = "av-ult-stage";

        var video = document.createElement("video");
        video.className = "av-ult-video";
        video.src = ASSET_BASE + "/video/" + videoName + "?v=" + ASSET_VERSION;
        video.autoplay = true;
        video.muted = false;
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.setAttribute("preload", "auto");
        try {
          video.volume = Math.max(0, Math.min(1, Number(cfg.volume) || 0.7));
        } catch {}
        stage.appendChild(video);

        // 结尾过渡层：提前渐暗（声音渐弱 + 画面渐暗 → 丝滑落回终端）
        var dim = document.createElement("div");
        dim.className = "av-ult-dim";

        var coverInOverlay = overlay.querySelector(".av-ult-cover");
        if (!coverInOverlay) {
          coverInOverlay = document.createElement("div");
          coverInOverlay.className = "av-ult-cover";
          overlay.appendChild(coverInOverlay);
        }
        var backdropInOverlay = overlay.querySelector(".av-ult-backdrop");
        if (!backdropInOverlay) {
          backdropInOverlay = document.createElement("div");
          backdropInOverlay.className = "av-ult-backdrop";
          overlay.insertBefore(backdropInOverlay, coverInOverlay);
        }
        overlay.appendChild(stage);
        overlay.appendChild(dim);
        overlay.appendChild(flash);
        document.body.appendChild(overlay);
        ultEl = overlay;
        ultVideo = video;

        // 丝滑进入：遮罩即时盖住终端；视频第一帧就绪后遮罩 0.6s 交叉淡出
        var fadeIn = function () {
          if (ultEl) ultEl.classList.add("on");
          coverInOverlay.classList.add("gone");
        };
        var canplayFired = false;
        video.addEventListener("canplay", function () {
          if (!canplayFired) {
            canplayFired = true;
            fadeIn();
          }
        });
        setTimeout(function () {
          if (ultEl && !canplayFired) {
            canplayFired = true;
            fadeIn();
          }
        }, 2200);

        // 结尾斜坡：最后 1.5 秒声音渐弱 + 画面渐暗
        var rampStarted = false;
        var rampHandle = null;
        video.addEventListener("timeupdate", function () {
          if (rampStarted || !video.duration) return;
          if (video.currentTime >= video.duration - 1.5) {
            rampStarted = true;
            if (ultEl) ultEl.classList.add("dim");
            var startVol = video.volume;
            var steps = 30;
            var step = 0;
            rampHandle = setInterval(function () {
              step++;
              safe(function () {
                video.volume = Math.max(0, startVol * (1 - step / steps));
              });
              if (step >= steps && rampHandle) {
                clearInterval(rampHandle);
                rampHandle = null;
              }
            }, 50);
          }
        });
        video.addEventListener("ended", function () {
          if (rampHandle) {
            clearInterval(rampHandle);
            rampHandle = null;
          }
        });

        var playPromise = safe(function () {
          return video.play();
        }, null);
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(function () {
            safe(function () {
              video.muted = true;
              video.play().catch(function () {});
            });
          });
        }

        // 单次播放完成后自动退场（含过渡）
        var onEnded = function () {
          hideUltimate();
        };
        video.addEventListener("ended", onEnded);
        video.addEventListener("error", onEnded);
        // 兜底：超过 16 秒强制退场
        ultHideTimer = setTimeout(function () {
          if (ultPlaying) hideUltimate();
        }, 16000);
      }

      /* ---------- 会话用量快照（缓存命中率统计） ---------- */
      function sessionUsage(sessionId) {
        return safe(function () {
          var binding = ctx.sessions && ctx.sessions.binding ? ctx.sessions.binding(sessionId) : undefined;
          if (!binding || !binding.session || !binding.session.projections) return undefined;
          var face = binding.session.projections.faceOf("tokenUsage");
          if (!face || typeof face.getSnapshot !== "function") return undefined;
          return face.getSnapshot();
        }, undefined);
      }

      var usageSnapshot = null; // {id: {cacheRead, uncachedInput}}

      function snapshotUsage() {
        var map = {};
        safe(function () {
          var list = ctx.get("sessions");
          if (!list || typeof list.list !== "function") return;
          var arr = list.list();
          if (!Array.isArray(arr)) return;
          for (var i = 0; i < arr.length; i++) {
            var s = arr[i];
            if (!s || !s.id) continue;
            var u = sessionUsage(s.id);
            if (u) {
              map[s.id] = {
                cacheRead: Number(u.cacheReadTokens) || 0,
                uncachedInput: Number(u.uncachedInputTokens) || 0,
              };
            }
          }
        });
        return map;
      }

      /* ---------- 任务完成监测（宿主状态桥 /aventurine-skin/status 轮询） ---------- */
      var pollHandle = null;
      var prevRunning = false;
      var taskStartAt = 0;
      var lastVoiceAt = 0;
      var lastUltAt = 0;
      var lastSeenDoneAt = 0;

      function onTaskCompleted(rate) {
        var now = Date.now();
        var duration = now - taskStartAt;
        if (duration < (Number(cfg.taskMinDurationMs) || 2500)) return;
        // 任务完成统一由桌宠气泡呈现（原独立语音卡片已按用户要求移除）
      }

      function startWatcher() {
        if (pollHandle) return;
        pollHandle = setInterval(function () {
          if (disposed) return;
          fetch(ASSET_BASE + "/status", { cache: "no-store" })
            .then(function (r) {
              return r.ok ? r.json() : null;
            })
            .then(function (s) {
              if (!s || disposed) return;
              var running = !!s.running;
              if (running && !prevRunning) {
                taskStartAt = s.startedAt || Date.now();
                petOnTaskStart();
              } else if (prevRunning && !running) {
                // 任何 running→idle 转变即视为任务结束（不依赖 lastDoneAt 字段）
                var doneAt = s.lastDoneAt || Date.now();
                if (doneAt !== lastSeenDoneAt) {
                  lastSeenDoneAt = doneAt;
                  // 气泡优先且必定执行；语音/立绘逻辑单独保护，任何异常不得吞掉气泡
                  petOnTaskDone();
                  safe(function () {
                    onTaskCompleted(typeof s.lastHitRate === "number" ? s.lastHitRate : null);
                  });
                }
              }
              prevRunning = running;
            })
            .catch(function () {});
        }, 1000);
      }
      startWatcher();

      /* ---------- 配置变更（设置面板 → 主逻辑） ---------- */
      function applyConfig() {
        cfg = readConfig();
        // 补丁配置仅在无本地记录时生效
        if (!readStorage("config", null)) {
          for (var k3 in DEFAULTS) {
            if (typeof patchCfg[k3] !== "undefined") cfg[k3] = patchCfg[k3];
          }
        }
        ensureBackdrop();
        ensureFigure();
        ensurePet();
        initParticles();
        applyTheme();
      }

      function onConfigEvent() {
        applyConfig();
      }
      window.addEventListener(CFG_EVENT, onConfigEvent);

      /* ---------- 设置面板（设置→通用） ---------- */
      var settingsStore = makeSource(readConfig());

      function persistConfig(next) {
        writeStorage("config", next);
        cfg = next;
        settingsStore.set(next);
        window.dispatchEvent(new CustomEvent(CFG_EVENT));
      }

      function Switch(props) {
        return createElement(
          "button",
          {
            type: "button",
            className: "av-switch" + (props.on ? " on" : ""),
            onClick: function () {
              props.onToggle(!props.on);
            },
          },
          props.label
        );
      }

      function SettingsRow(props) {
        // 槽位契约（对照 ui-settings-general 内置行）：inject 返回的键
        // 会直接作为组件 props 传入；locale 命名空间的 t 也由槽位注入。
        // 本行自管理状态，渲染异常时回退为空，绝不拖垮设置页。
        try {
          var getConfig = typeof props.getConfig === "function" ? props.getConfig : null;
          var setConfig = typeof props.setConfig === "function" ? props.setConfig : null;
          var initialCfg = getConfig ? getConfig() : settingsStore.getSnapshot();
          var cfgState = useState(initialCfg);
          var cfgNow = cfgState[0];
          var setCfgNow = cfgState[1];

          // 订阅配置源，外部变化（如重新加载）也能刷新面板
          useEffect(
            function () {
              var unsub = settingsStore.subscribe(function () {
                setCfgNow(settingsStore.getSnapshot());
              });
              return unsub;
            },
            []
          );

          var set = function (patch) {
            var next = {};
            for (var k in cfgNow) next[k] = cfgNow[k];
            for (var k2 in patch) next[k2] = patch[k2];
            if (setConfig) setConfig(next);
            else persistConfig(next);
            setCfgNow(next);
          };

        var voiceCooldownSec = Math.round((Number(cfgNow.voiceCooldownMs) || 60000) / 1000);
        var ultCooldownMin = Math.round((Number(cfgNow.ultCooldownMs) || 600000) / 60000);

        return createElement(
          "div",
          null,
          createElement(
            "div",
            { className: "av-row" },
            createElement("div", { className: "av-row-title" }, t("skinTitle") + " · v23"),
            createElement("div", { className: "av-row-desc" }, t("skinDesc"))
          ),
          createElement(
            "div",
            { className: "av-row" },
            createElement(
              "div",
              { className: "av-switches" },
              createElement(Switch, {
                label: t("themeSwitch"),
                on: !!cfgNow.themeEnabled,
                onToggle: function (v) {
                  set({ themeEnabled: v });
                },
              }),
              createElement(Switch, {
                label: t("ultSwitch"),
                on: !!cfgNow.ultEnabled,
                onToggle: function (v) {
                  set({ ultEnabled: v });
                },
              }),
              createElement(Switch, {
                label: t("particlesSwitch"),
                on: !!cfgNow.particlesEnabled,
                onToggle: function (v) {
                  set({ particlesEnabled: v });
                },
              }),
              createElement(Switch, {
                label: t("petSwitch"),
                on: !!cfgNow.petEnabled,
                onToggle: function (v) {
                  set({ petEnabled: v });
                },
              }),
              createElement(Switch, {
                label: t("splashSwitch"),
                on: !!cfgNow.splashEnabled,
                onToggle: function (v) {
                  set({ splashEnabled: v });
                },
              }),
              createElement(Switch, {
                label: t("backdropSwitch"),
                on: !!cfgNow.backdropEnabled,
                onToggle: function (v) {
                  set({ backdropEnabled: v });
                },
              })
            )
          ),
          createElement(
            "div",
            { className: "av-row" },
            createElement(
              "div",
              { className: "av-ctl" },
              createElement("span", null, t("scheme")),
              createElement(
                "div",
                { className: "av-scheme" },
                createElement(
                  "button",
                  {
                    type: "button",
                    className: cfgNow.scheme === "dark" ? "on" : "",
                    onClick: function () {
                      set({ scheme: "dark" });
                    },
                  },
                  t("schemeDark")
                ),
                createElement(
                  "button",
                  {
                    type: "button",
                    className: cfgNow.scheme === "light" ? "on" : "",
                    onClick: function () {
                      set({ scheme: "light" });
                    },
                  },
                  t("schemeLight")
                )
              )
            )
          ),
          createElement(
            "div",
            { className: "av-row" },
            createElement(
              "div",
              { className: "av-ctl" },
              createElement("span", null, t("figureLabel")),
              createElement(
                "div",
                { className: "av-scheme" },
                createElement(
                  "button",
                  {
                    type: "button",
                    className: cfgNow.figureArt === "float" ? "on" : "",
                    onClick: function () {
                      set({ figureArt: "float" });
                    },
                  },
                  t("figureFloat")
                ),
                createElement(
                  "button",
                  {
                    type: "button",
                    className: cfgNow.figureArt === "resort" ? "on" : "",
                    onClick: function () {
                      set({ figureArt: "resort" });
                    },
                  },
                  t("figureResort")
                ),
                createElement(
                  "button",
                  {
                    type: "button",
                    className: cfgNow.figureArt === "none" ? "on" : "",
                    onClick: function () {
                      set({ figureArt: "none" });
                    },
                  },
                  t("figureNone")
                )
              )
            )
          ),
          createElement(
            "div",
            { className: "av-row" },
            createElement(
              "div",
              { className: "av-ctl" },
              createElement("span", null, t("figureOpacity")),
              createElement("input", {
                type: "range",
                min: "0.2",
                max: "1",
                step: "0.05",
                value: String(cfgNow.figureOpacity ?? 0.95),
                onChange: function (e) {
                  set({ figureOpacity: Number(e.target.value) });
                },
              })
            ),
            createElement(
              "div",
              { className: "av-ctl" },
              createElement("span", null, t("figureSize")),
              createElement("input", {
                type: "range",
                min: "50",
                max: "100",
                step: "2",
                value: String(cfgNow.figureSize ?? 95),
                onChange: function (e) {
                  set({ figureSize: Number(e.target.value) });
                },
              })
            ),
            createElement(
              "div",
              { className: "av-ctl" },
              createElement("span", null, t("figureBrightness")),
              createElement("input", {
                type: "range",
                min: "0.5",
                max: "1.5",
                step: "0.05",
                value: String(cfgNow.figureBrightness ?? 1.35),
                onChange: function (e) {
                  set({ figureBrightness: Number(e.target.value) });
                },
              })
            )
          ),
          createElement(
            "div",
            { className: "av-row" },
            createElement(
              "div",
              { className: "av-ctl" },
              createElement("span", null, t("petSize")),
              createElement("input", {
                type: "range",
                min: "80",
                max: "220",
                step: "4",
                value: String(cfgNow.petSize ?? 118),
                onChange: function (e) {
                  set({ petSize: Number(e.target.value) });
                },
              }),
              createElement(
                "button",
                {
                  type: "button",
                  className: "av-btn",
                  onClick: function () {
                    petResetPos();
                  },
                },
                t("petReset")
              )
            )
          ),
          createElement(
            "div",
            { className: "av-row" },
            createElement(
              "div",
              { className: "av-ctl" },
              createElement("span", null, t("volume")),
              createElement("input", {
                type: "range",
                min: "0",
                max: "1",
                step: "0.05",
                value: String(Number(cfgNow.volume) || 0),
                onChange: function (e) {
                  set({ volume: Number(e.target.value) });
                },
              })
            )
          ),
          createElement(
            "div",
            { className: "av-row" },
            createElement(
              "div",
              { className: "av-ctl" },
              createElement("span", null, t("voiceCooldown")),
              createElement("input", {
                type: "range",
                min: "0",
                max: "600",
                step: "10",
                value: String(voiceCooldownSec),
                onChange: function (e) {
                  set({ voiceCooldownMs: Number(e.target.value) * 1000 });
                },
              }),
              createElement("span", null, voiceCooldownSec + "s")
            )
          ),
          createElement(
            "div",
            { className: "av-row" },
            createElement(
              "div",
              { className: "av-ctl" },
              createElement("span", null, t("ultCooldown")),
              createElement("input", {
                type: "range",
                min: "0",
                max: "120",
                step: "1",
                value: String(ultCooldownMin),
                onChange: function (e) {
                  set({ ultCooldownMs: Number(e.target.value) * 60000 });
                },
              }),
              createElement("span", null, ultCooldownMin + "min")
            )
          ),
          createElement(
            "div",
            { className: "av-row" },
            createElement(
              "div",
              { className: "av-switches" },
              createElement(
                "button",
                {
                  type: "button",
                  className: "av-btn",
                  onClick: function () {
                    showUltimate("pv_intro.mp4");
                  },
                },
                t("testUlt")
              )
            ),
            createElement("div", { className: "av-row-desc" }, t("tierDesc"))
          )
        );
        } catch (renderError) {
          return null;
        }
      }

      function settingsInjected() {
        return {
          getConfig: function () {
            return settingsStore.getSnapshot();
          },
          setConfig: function (next) {
            persistConfig(next);
          },
        };
      }

      safe(function () {
        ctx.slots.inject("settings.general.item", function () {
          return ctx.slots.register(
            {
              name: "settings.general.item",
              id: "aventurine-skin",
              order: 40,
              label: function () {
                return t("skinTitle");
              },
              locale: NS,
              inject: settingsInjected,
            },
            SettingsRow
          );
        });
      });

      /* —— 输入工具行品牌标识（对话区的戏浪元素） —— */
      function BrandChip() {
        return createElement("span", { className: "av-brand-chip" }, "⚜ " + t("voiceName"));
      }
      safe(function () {
        ctx.slots.inject("conversation.input.right", function () {
          return ctx.slots.register(
            {
              name: "conversation.input.right",
              id: "aventurine-skin-brand",
              order: -200,
              label: function () {
                return t("skinTitle");
              },
              locale: NS,
            },
            BrandChip
          );
        });
      });

      /* ---------- 清理 ---------- */
      ctx.effect(function () {
        return function () {
          disposed = true;
          if (pollHandle) {
            clearInterval(pollHandle);
            pollHandle = null;
          }
          if (particleRunning && particleRaf) {
            cancelAnimationFrame(particleRaf);
            particleRunning = false;
          }
          if (parallaxRaf) cancelAnimationFrame(parallaxRaf);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener(CFG_EVENT, onConfigEvent);
          try {
            if (themeChangeUnsub) themeChangeUnsub();
          } catch {}
          try {
            if (themeAttrObserver) themeAttrObserver.disconnect();
          } catch {}
          if (tokenStyleEl) {
            try {
              tokenStyleEl.remove();
            } catch {}
          }
          if (dialogEl) dismissDialog();
          if (ultEl) hideUltimate();
          if (bgWavesEl) bgWavesEl.remove();
          if (bgVignetteEl) bgVignetteEl.remove();
          if (ambientEl) ambientEl.remove();
          if (bridgeEl) bridgeEl.remove();
          if (washEl) washEl.remove();
          if (edgeEl) edgeEl.remove();
          dismissBootCover();
          if (figureEl) figureEl.remove();
          if (figureElLeft) figureElLeft.remove();
          if (petEl) petEl.remove();
          if (petReactTimer) clearTimeout(petReactTimer);
          if (particleCanvas) particleCanvas.remove();
          if (audioEl) {
            safe(function () {
              audioEl.pause();
              audioEl.src = "";
            });
          }
        };
      }, NS + ": cleanup");
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
