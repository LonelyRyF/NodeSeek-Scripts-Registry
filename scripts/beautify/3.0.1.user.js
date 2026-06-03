(function() {
    'use strict';

    const API = window.NodeSeekUI;
    if (!API) return;

    const MODULE_ID = 'beautify';
    const STYLE_IDS = {
        vars:      'ns-beautify-vars',
        bg:        'ns-beautify-bg',
        glass:     'ns-beautify-glass',
        avatar:    'ns-beautify-avatar',
        scrollbar: 'ns-beautify-scrollbar',
        cursor:    'ns-beautify-cursor',
        smoothing: 'ns-beautify-smoothing',
    };

    const DEFAULTS = {
        enableBg:             true,
        bgUrl:                'https://www.nodeseek.com/static/image/bg.jpg',
        bgBlur:               12,
        enableGlassmorphism:  true,
        glassColor:           '#1f2933',
        glassBlur:            18,
        enableCustomScrollbar:true,
        scrollbarColor:       'rgba(255,255,255,0.35)',
        scrollbarHoverColor:  'rgba(255,255,255,0.6)',
        enableCustomCursor:   false,
        defaultCursorUrl:     '',
        pointerCursorUrl:     '',
        textCursorUrl:        '',
        enableSmoothing:      true,
        avatarStyle:          'liquid',
    };

    const SCHEMA = [
        { key: 'enableBg',     label: '开启全局背景图',          type: 'switch', default: DEFAULTS.enableBg },
        { key: 'bgUrl',        label: '背景图 URL',              type: 'text',    default: DEFAULTS.bgUrl },
        { key: 'bgBlur',       label: '背景模糊强度(0-20)',      type: 'number',  default: DEFAULTS.bgBlur },
        { key: 'enableGlassmorphism', label: '开启毛玻璃效果',  type: 'switch', default: DEFAULTS.enableGlassmorphism },
        { key: 'glassColor',   label: '毛玻璃主色',              type: 'text',   default: DEFAULTS.glassColor },
        { key: 'glassBlur',    label: '毛玻璃模糊强度',          type: 'number',  default: DEFAULTS.glassBlur },
        { key: 'enableCustomScrollbar', label: '自定义滚动条',  type: 'switch', default: DEFAULTS.enableCustomScrollbar },
        { key: 'scrollbarColor',      label: '滚动条颜色',        type: 'text',   default: DEFAULTS.scrollbarColor },
        { key: 'scrollbarHoverColor', label: '滚动条 Hover 颜色', type: 'text',  default: DEFAULTS.scrollbarHoverColor },
        { key: 'enableCustomCursor',  label: '自定义光标',        type: 'switch', default: DEFAULTS.enableCustomCursor },
        { key: 'defaultCursorUrl',    label: '默认光标 URL',      type: 'text',   default: DEFAULTS.defaultCursorUrl },
        { key: 'pointerCursorUrl',    label: '指针光标 URL',      type: 'text',   default: DEFAULTS.pointerCursorUrl },
        { key: 'textCursorUrl',       label: '文字光标 URL',      type: 'text',   default: DEFAULTS.textCursorUrl },
        { key: 'enableSmoothing',     label: '启用现代化平滑动画', type: 'switch', default: DEFAULTS.enableSmoothing },
        { key: 'avatarStyle',         label: '头像样式',           type: 'select',  default: DEFAULTS.avatarStyle,
          options: [
              { label: '默认', value: 'default' },
              { label: '圆形', value: 'circle' },
              { label: '液态玻璃', value: 'liquid' },
          ],
        },
    ];

    function hexToRgb(hex) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!m) return { r: 31, g: 41, b: 51 };
        return {
            r: parseInt(m[1], 16),
            g: parseInt(m[2], 16),
            b: parseInt(m[3], 16),
        };
    }

    function blendWithDark(rgb, factor) {
        return {
            r: Math.round(rgb.r * (1 - factor)),
            g: Math.round(rgb.g * (1 - factor)),
            b: Math.round(rgb.b * (1 - factor)),
        };
    }

    function upsertStyle(id, cssText) {
        let style = document.getElementById(id);
        if (!cssText) {
            if (style) style.remove();
            return;
        }
        if (!style) {
            style = document.createElement('style');
            style.id = id;
            document.head.appendChild(style);
        }
        style.textContent = cssText;
    }

    function removeAllStyles() {
        Object.values(STYLE_IDS).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }

    function buildVarsCss(cfg, lightRgb, darkRgb) {
        const baseOpacity    = 0.70;
        const protectedLight = 0.88;
        const protectedDark  = 0.70;
        const overlayAlpha   = 0.40;
        return `
            :root {
                --ns-glass-bg:       rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},${baseOpacity});
                --ns-protected-bg:   rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},${protectedLight});
                --ns-glass-border:   rgba(255,255,255,0.32);
                --ns-glass-shadow:   rgba(15,23,42,0.65);
                --ns-avatar-border:  rgba(${lightRgb.r + 30},${lightRgb.g + 30},${lightRgb.b + 30},0.9);
                --ns-avatar-hover-border: rgba(${lightRgb.r + 60},${lightRgb.g + 60},${lightRgb.b + 60},0.95);
                --ns-input-bg:       rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},0.8);
                --ns-bg-overlay:     rgba(${lightRgb.r},${lightRgb.g},${lightRgb.b},${overlayAlpha});
                --ns-accent-r:       ${lightRgb.r};
                --ns-accent-g:       ${lightRgb.g};
                --ns-accent-b:       ${lightRgb.b};
            }
            body.dark-layout {
                --ns-glass-bg:       rgba(${darkRgb.r},${darkRgb.g},${darkRgb.b},${baseOpacity});
                --ns-protected-bg:   rgba(${darkRgb.r},${darkRgb.g},${darkRgb.b},${protectedDark});
                --ns-glass-border:   rgba(255,255,255,0.1);
                --ns-glass-shadow:   rgba(0,0,0,0.35);
                --ns-avatar-border:  rgba(${darkRgb.r + 40},${darkRgb.g + 40},${darkRgb.b + 40},0.9);
                --ns-avatar-hover-border: rgba(${darkRgb.r + 80},${darkRgb.g + 80},${darkRgb.b + 80},0.9);
                --ns-input-bg:       rgba(${darkRgb.r},${darkRgb.g},${darkRgb.b},0.6);
                --ns-bg-overlay:     rgba(0,0,0,${overlayAlpha});
            }
        `;
    }

    function buildBgCss(cfg) {
        if (!cfg.enableBg) return '';
        const url = cfg.bgUrl && cfg.bgUrl.trim() !== '' ? cfg.bgUrl : DEFAULTS.bgUrl;
        return `
            body, .bg1, .bg2 {
                background: none !important;
                background-color: transparent !important;
            }
            body::before {
                content: "";
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                z-index: -2;
                background: linear-gradient(var(--ns-bg-overlay), var(--ns-bg-overlay)),
                            url("${url}") center/cover no-repeat;
                filter: blur(${Math.max(0, Math.min(cfg.bgBlur, 20))}px);
            }
        `;
    }

    function buildGlassCss(cfg) {
        if (!cfg.enableGlassmorphism) return '';
        const blur = cfg.glassBlur !== undefined ? cfg.glassBlur : 20;

        const glassHeavyCss = `
            background-color: var(--ns-glass-bg) !important;
            backdrop-filter: blur(${blur}px) saturate(180%) !important;
            -webkit-backdrop-filter: blur(${blur}px) saturate(180%) !important;
            border: 1px solid var(--ns-glass-border) !important;
            box-shadow: 0 4px 16px 0 var(--ns-glass-shadow) !important;
        `;
        const glassLightCss = `
            background-color: var(--ns-glass-bg) !important;
            border: 1px solid var(--ns-glass-border) !important;
            box-shadow: 0 4px 16px 0 var(--ns-glass-shadow) !important;
        `;
        const protectedGlassCss = `
            background-color: var(--ns-protected-bg) !important;
            backdrop-filter: blur(20px) saturate(180%) !important;
            -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
        `;

        return `
            html, body {
                max-width: 100% !important;
                overflow-x: hidden !important;
            }

            #nsk-body { position: relative; background: transparent !important; box-shadow: none !important; }

            #nsk-body::before {
                content: ""; position: absolute; inset: 0; z-index: -1;
                ${glassLightCss}
                border-radius: 16px !important;
                pointer-events: none;
            }

            header {
                ${glassHeavyCss}
                border-radius: 0 !important;
                border: none !important;
            }

            #nsk-head {
                background: transparent !important;
                border: none !important;
            }

            #nsk-head .nav-menu {
                background: transparent !important;
                border-radius: 0 !important;
                border: none !important;
            }

            #nsk-left-panel-container .category-list {
                ${protectedGlassCss}
                border-radius: 16px !important;
                border: 1px solid var(--ns-glass-border) !important;
                box-shadow: 4px 0 24px var(--ns-glass-shadow) !important;
            }

            #left-slide-panel, body.dark-layout #left-slide-panel {
                ${protectedGlassCss}
                border-radius: 12px !important;
                border: 1px solid var(--ns-glass-border) !important;
                box-shadow: 4px 0 24px var(--ns-glass-shadow) !important;
            }

            .md-editor, body.dark-layout .md-editor {
                ${protectedGlassCss}
                border-radius: 12px !important;
                border: 1px solid var(--ns-glass-border) !important;
                box-shadow: 0 8px 32px var(--ns-glass-shadow) !important;
            }

            .hover-user-card, body.dark-layout .hover-user-card,
            .ns-config-form, body.dark-layout .ns-config-form {
                ${protectedGlassCss}
                border-radius: 12px !important;
                border: 1px solid var(--ns-glass-border) !important;
                box-shadow: 0 8px 32px var(--ns-glass-shadow) !important;
            }

            .ns-config-form { padding: 16px !important; }

            .msc-content, #stardust-receive-editor-mount > div, footer {
                ${glassLightCss}
                border-radius: 20px !important;
            }

            .msc-overlay {
                background-color: rgba(0,0,0,0.4) !important;
                backdrop-filter: blur(5px) !important;
                opacity: 1 !important;
                z-index: 10020 !important;
            }
            .msc-content { z-index: 10021 !important; }
            .msc-close   { z-index: 10022 !important; }

            .carousel-mask[data-v-8db19fce], body.dark-layout .carousel-mask[data-v-8db19fce] {
                background: none !important; box-shadow: none !important; border: none !important;
            }

            .title-input,
            .title-input input,
            body.dark-layout .title-input,
            body.dark-layout .title-input input {
                background-color: transparent !important;
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
            }
            .md-editor .title-input {
                border-bottom: 1px solid var(--ns-glass-border) !important;
                border-radius: 0 !important;
            }

            .md-editor .mde-toolbar { gap: 0 !important; }
            .md-editor .mde-toolbar .toolbar-item,
            .md-editor .mde-toolbar .editor-top-button,
            .md-editor .toolbar-item,
            .md-editor .editor-top-button {
                margin: 0 1px !important;
                min-width: unset !important;
            }

            body.dark-layout .user-card .user-stat, body .user-card .user-stat,
            body.dark-layout .md-editor .expression, body .md-editor .expression,
            body.dark-layout .tab-select, body .tab-select,
            body.dark-layout .topic-select, body .topic-select,
            body.dark-layout .message-item .content-column .content {
                background-color: transparent !important;
                background: transparent !important;
                box-shadow: none !important;
                border: none !important;
            }

            #nsk-frame, #nsk-body-left, #nsk-body-right,
            .content-item, .nsk-panel, .v-card, .card,
            .provider-card, .provider-item, .board-item, .stat-card,
            .friend-item, .friend-link, .ruling-log, .ruling-item,
            .paginator, .comment-container,
            .vditor-reset, .terminal-padding,
            .user-stat, .stat-block, .stat-block div,
            .user-card-container, .user-card, .user-head, .user-head .menu,
            .category-mobile, .category-mobile-box, .category-mobile-wrapper,
            footer .contain, footer .col, footer .foot,
            body .md-editor #editor-body, body .md-editor .mde-toolbar,
            div.expression, div.exp-container, div.exp-item,
            body .md-editor .markHtml-wrapper,
            body .md-editor .CodeMirror, body .md-editor .CodeMirror-gutters {
                background-color: transparent !important;
                background: transparent !important;
                box-shadow: none !important;
                border: none !important;
            }

            /* board 进度 / 签到页美化 */
            #board-root {
                ${protectedGlassCss}
                border-radius: 16px !important;
                border: 1px solid var(--ns-glass-border) !important;
                box-shadow: 0 10px 30px var(--ns-glass-shadow) !important;
                padding: 16px 20px !important;
                box-sizing: border-box;
            }

            #board-root .board-timeline {
                margin: 0;
                padding: 0;
                list-style: none;
            }

            #board-root .board-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 14px !important;
                margin-bottom: 8px !important;
                border-radius: 10px !important;
                background-color: rgba(0, 0, 0, 0.25) !important;
                border: 1px solid var(--ns-glass-border) !important;
            }

            #board-root .board-item-main {
                display: flex;
                flex-direction: column;
                gap: 2px;
                overflow: hidden;
            }

            #board-root .board-item-title {
                font-size: 14px;
                font-weight: 500;
            }

            #board-root .board-item-meta {
                font-size: 12px;
                opacity: 0.8;
            }

            #board-root .board-item-status {
                margin-left: 12px;
                font-size: 12px;
                white-space: nowrap;
            }

            .nav-menu .meta-button, .mobile-nav .meta-button {
                background-color: #000 !important;
                color: #fff !important;
                border-radius: 4px !important;
            }
            .nav-menu .meta-button svg, .mobile-nav .meta-button svg { fill: #fff !important; }
            body.dark-layout .nav-menu .meta-button, body.dark-layout .mobile-nav .meta-button {
                background-color: #074d26 !important;
            }

            .search-hint, .image-box, .msc-confirm, .nsk-notification {
                z-index: 20000 !important;
            }
            #fast-nav-button-group {
                z-index: 19000 !important;
            }
        `;
    }

    function buildAvatarCss(cfg) {
        if (cfg.avatarStyle === 'circle') {
            return `.avatar-wrapper img, .avatar-normal, .avatar-sm { border-radius: 50% !important; }`;
        }
        if (cfg.avatarStyle === 'liquid') {
            return `
                .avatar+.icon { display: none !important; }
                .avatar { border: 3px solid var(--ns-avatar-border) !important; }
                .avatar-normal { border-radius: 20px; }
            `;
        }
        return '';
    }

    function buildScrollbarCss(cfg) {
        if (!cfg.enableCustomScrollbar) return '';
        return `
            ::-webkit-scrollbar { width: 8px; height: 8px; }
            ::-webkit-scrollbar-track { background-color: transparent; }
            ::-webkit-scrollbar-thumb { background-color: ${cfg.scrollbarColor}; border-radius: 2em; border: 2px solid transparent; background-clip: padding-box; }
            ::-webkit-scrollbar-thumb:hover { background-color: ${cfg.scrollbarHoverColor}; }
        `;
    }

    function buildCursorCss(cfg) {
        if (!cfg.enableCustomCursor) return '';
        const defCur = cfg.defaultCursorUrl ? `url('${cfg.defaultCursorUrl}'), auto` : 'auto';
        const ptrCur = cfg.pointerCursorUrl ? `url('${cfg.pointerCursorUrl}'), pointer` : 'pointer';
        const txtCur = cfg.textCursorUrl    ? `url('${cfg.textCursorUrl}'), text` : 'text';
        return `
            *, body, html { cursor: ${defCur} !important; }
            a, a *, button, button *, .btn, .nav-item-btn, img, i:hover, svg:hover,
            .transition:hover, .msc-close:hover, div.exp-item:hover { cursor: ${ptrCur} !important; }
            input, textarea, .CodeMirror, .CodeMirror-lines, .title-input input { cursor: ${txtCur} !important; }
        `;
    }

    function buildSmoothingCss(cfg) {
        if (!cfg.enableSmoothing) return '';
        return `
            html { scroll-behavior: smooth; }
        `;
    }

    function applyStyles() {
        const cfg = API.getConfig(MODULE_ID, SCHEMA);
        const hex = cfg.glassColor || DEFAULTS.glassColor;
        const lightRgb = hexToRgb(hex);
        const darkRgb  = blendWithDark(lightRgb, 0.85);

        upsertStyle(STYLE_IDS.vars,      buildVarsCss(cfg, lightRgb, darkRgb));
        upsertStyle(STYLE_IDS.bg,        buildBgCss(cfg));
        upsertStyle(STYLE_IDS.glass,     buildGlassCss(cfg));
        upsertStyle(STYLE_IDS.avatar,    buildAvatarCss(cfg));
        upsertStyle(STYLE_IDS.scrollbar, buildScrollbarCss(cfg));
        upsertStyle(STYLE_IDS.cursor,    buildCursorCss(cfg));
        upsertStyle(STYLE_IDS.smoothing, buildSmoothingCss(cfg));
    }

    API.register({
        id:          MODULE_ID,
        name:        '全站动态美化引擎',
        version:     '3.0.1',
        description: '3.0.1：收敛全局覆盖范围，优化毛玻璃性能，减少对帖子内容排版的干扰。',
        settings: SCHEMA,
        execute()         { applyStyles(); },
        onToggle(enabled) { enabled ? applyStyles() : removeAllStyles(); },
        onConfigChange(newConfig) {
            API.store(MODULE_ID, 'config', newConfig);
            applyStyles();
        },
    });
})();
