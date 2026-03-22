(function() {
    const API = window.NodeSeekUI;
    if (!API) {
        console.error('[NS Beautify] 未检测到 NodeSeek UI 基座');
        return;
    }

    const MODULE_ID = 'ns_beautify';
    const STYLE_TAG_ID = 'ns-beautify-styles';

    // ==========================================
    // 1. 默认配置 
    // ==========================================
    const DEFAULTS = {
        enableBg: true,
        bgUrl: 'https://file.8888998.xyz/2025/09/23/1758618109392-4xswnf.webp',
        bgBlur: 10,
        enableGlassmorphism: true, 
        glassOpacity: 0.45,
        glassBlur: 20, 
        disableBgProtection: false, // 🚀 新增：底层遮罩保护开关
        avatarStyle: 'liquid',
        enableSmoothing: true,
        enableCustomCursor: false,
        defaultCursorUrl: 'https://npm.elemecdn.com/kang-static/Hexo/img/default.cur',
        pointerCursorUrl: 'https://npm.elemecdn.com/kang-static/Hexo/img/pointer.cur',
        textCursorUrl: '',
        enableCustomScrollbar: true,
        scrollbarColor: '#888888',
        scrollbarHoverColor: '#555555'
    };

    const SCHEMA = [
        { key: 'enableBg', type: 'switch', label: '开启全局背景图', default: DEFAULTS.enableBg },
        { key: 'bgUrl', type: 'text', label: '背景图 URL', description: '留空则无背景', default: DEFAULTS.bgUrl },
        { key: 'bgBlur', type: 'number', label: '背景图模糊度 (px)', min: 0, max: 50, step: 1, default: DEFAULTS.bgBlur },
        { key: 'enableGlassmorphism', type: 'switch', label: '启用全局毛玻璃 UI', default: DEFAULTS.enableGlassmorphism },
        { key: 'glassOpacity', type: 'number', label: '全局毛玻璃底色透明度', description: '0为纯透明。侧边栏与编辑器受保护区不受此限制。', min: 0.0, max: 1.0, step: 0.1, default: DEFAULTS.glassOpacity },
        { key: 'glassBlur', type: 'number', label: '全局毛玻璃模糊度 (px)', description: '数值越大，玻璃背后的图案越模糊', min: 0, max: 50, step: 1, default: DEFAULTS.glassBlur },
        
        // 🚀 新增的傲娇开关
        { key: 'disableBgProtection', type: 'switch', label: '我认为我不需要底色保护', description: '开启后将彻底移除背景图上的黑/白纱遮罩，实现 100% 裸奔。若文字融入背景导致瞎眼，请自行承担后果！', default: DEFAULTS.disableBgProtection },
        
        { key: 'avatarStyle', type: 'select', label: '头像与元素样式', options: [{text: '默认 (方角)', value: 'default'}, {text: '纯圆形', value: 'circle'}, {text: '液态玻璃', value: 'liquid'}], default: DEFAULTS.avatarStyle },
        
        { key: 'enableCustomCursor', type: 'switch', label: '启用自定义鼠标指针', default: DEFAULTS.enableCustomCursor },
        { key: 'defaultCursorUrl', type: 'text', label: '普通指针 URL', description: '留空则使用系统默认', default: DEFAULTS.defaultCursorUrl },
        { key: 'pointerCursorUrl', type: 'text', label: '悬停指针 URL (链接/按钮)', description: '留空则使用系统默认小手', default: DEFAULTS.pointerCursorUrl },
        { key: 'textCursorUrl', type: 'text', label: '文本输入指针 URL', description: '打字框的光标，留空则使用系统默认', default: DEFAULTS.textCursorUrl },
        
        { key: 'enableCustomScrollbar', type: 'switch', label: '启用自定义滚动条', default: DEFAULTS.enableCustomScrollbar },
        { key: 'scrollbarColor', type: 'color', label: '滚动条颜色', default: DEFAULTS.scrollbarColor },
        { key: 'scrollbarHoverColor', type: 'color', label: '滚动条悬停颜色', default: DEFAULTS.scrollbarHoverColor },
        
        { key: 'enableSmoothing', type: 'switch', label: '启用现代化平滑动画', default: DEFAULTS.enableSmoothing }
    ];

    function applyStyles() {
        const cfg = API.getConfig(MODULE_ID, SCHEMA);
        let css = '';

        const baseOpacity = parseFloat(cfg.glassOpacity);
        const lightOpacity = Math.min(baseOpacity + 0.1, 0.85);
        const blurValue = cfg.glassBlur !== undefined ? cfg.glassBlur : 20;

        // 核心功能区专属保护
        const protectedLightBg = Math.max(0.65, lightOpacity);
        const protectedDarkBg = Math.max(0.65, baseOpacity);

        // 🚀 底层遮罩保护逻辑：根据傲娇开关决定生死
        // 如果开启了“不需要保护”，遮罩透明度直接为 0。否则根据毛玻璃透明度动态分配白纱/黑纱。
        const overlayLightAlpha = cfg.disableBgProtection ? 0 : (cfg.enableGlassmorphism ? ((1.0 - baseOpacity) * 0.5) : 0.3);
        const overlayDarkAlpha  = cfg.disableBgProtection ? 0 : (cfg.enableGlassmorphism ? ((1.0 - baseOpacity) * 0.5) : 0.3);

        // --- 1. 动态 CSS 变量 ---
        css += `
            :root {
                --ns-glass-bg: rgba(255, 255, 255, ${lightOpacity});
                --ns-protected-bg: rgba(255, 255, 255, ${protectedLightBg}); 
                --ns-glass-border: rgba(255, 255, 255, 0.25);
                --ns-glass-shadow: rgba(0, 0, 0, 0.05);
                --ns-avatar-border: #fff;
                --ns-avatar-hover-border: #eee;
                --ns-input-bg: rgba(255, 255, 255, 0.8);
                --ns-bg-overlay: rgba(255, 255, 255, ${overlayLightAlpha}); /* 亮色模式白纱遮罩 */
            }
            body.dark-layout {
                --ns-glass-bg: rgba(40, 40, 40, ${baseOpacity});
                --ns-protected-bg: rgba(40, 40, 40, ${protectedDarkBg}); 
                --ns-glass-border: rgba(255, 255, 255, 0.1);
                --ns-glass-shadow: rgba(0, 0, 0, 0.35);
                --ns-avatar-border: #555;
                --ns-avatar-hover-border: #999;
                --ns-input-bg: rgba(0, 0, 0, 0.4);
                --ns-bg-overlay: rgba(0, 0, 0, ${overlayDarkAlpha}); /* 暗色模式黑纱遮罩 */
            }
        `;

        // --- 2. 背景图层 ---
        if (cfg.enableBg) {
            const currentBgUrl = cfg.bgUrl && cfg.bgUrl.trim() !== '' ? cfg.bgUrl : DEFAULTS.bgUrl;
            css += `
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
                                url("${currentBgUrl}") center/cover no-repeat;
                    filter: blur(${cfg.bgBlur}px);
                    transform: scale(1.05);
                }
            `;
        }

        // --- 3. 核心全局毛玻璃引擎 ---
        if (cfg.enableGlassmorphism) {
            const glassmorphismCss = `
                background-color: var(--ns-glass-bg) !important;
                backdrop-filter: blur(${blurValue}px) saturate(180%) !important;
                -webkit-backdrop-filter: blur(${blurValue}px) saturate(180%) !important;
                border: 1px solid var(--ns-glass-border) !important;
                box-shadow: 0 4px 16px 0 var(--ns-glass-shadow) !important;
            `;

            const protectedGlassCss = `
                background-color: var(--ns-protected-bg) !important;
                backdrop-filter: blur(20px) saturate(180%) !important;
                -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
            `;

            css += `
                #nsk-body { position: relative; background: transparent !important; box-shadow: none !important; }
                
                #nsk-body::before {
                    content: ""; position: absolute; inset: 0; z-index: -1;
                    ${glassmorphismCss}
                    border-radius: inherit !important; pointer-events: none; 
                }
                
                header, .mobile-nav, .nav-menu, .nav-menu-container {
                    ${glassmorphismCss}
                    border-radius: 0 !important;
                    border: none !important;
                }
                header > div, .mobile-nav > div, .nav-menu > div { border-radius: 0 !important; }

                #left-slide-panel, body.dark-layout #left-slide-panel,
                #nsk-left-panel-container .category-list, body.dark-layout #nsk-left-panel-container .category-list {
                    ${protectedGlassCss}
                    border-radius: 0 !important; 
                    border: none !important;
                    border-right: 1px solid var(--ns-glass-border) !important;
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
                    ${glassmorphismCss}
                    border-radius: 20px !important;
                }
                
                .msc-overlay {
                    background-color: rgba(0, 0, 0, 0.4) !important;
                    backdrop-filter: blur(5px) !important;
                    opacity: 1 !important;
                    z-index: 10020 !important;
                }
                .msc-content { z-index: 10021 !important; }
                .msc-close { z-index: 10022 !important; }

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
                .paginator, .post-content, .comment-container, 
                .vditor-reset, .terminal-padding, 
                .ruling-log table, .ruling-log tr, .ruling-log th, .ruling-log td,
                .content-item table, .content-item tr, .content-item th, .content-item td,
                .user-stat, .stat-block, .stat-block div,
                .user-card-container, .user-card, .user-head, .user-head .menu,
                .category-mobile, .category-mobile-box, .category-mobile-wrapper,
                #nsk-head, footer .contain, footer .col, footer .foot,
                body .md-editor #editor-body, body .md-editor .mde-toolbar, 
                div.expression, div.exp-container, div.exp-item,
                body .md-editor .markHtml-wrapper,
                body .md-editor .CodeMirror, body .md-editor .CodeMirror-gutters {
                    background-color: transparent !important;
                    background: transparent !important;
                    box-shadow: none !important;
                    border: none !important;
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

                .search-hint, .image-box, .msc-confirm, .nsk-notification, #fast-nav-button-group {
                    z-index: 2147483647 !important;
                }

                body:not(.dark-layout) .category-mobile:not(.meta-button),
                body:not(.dark-layout) .category-mobile h2,
                body:not(.dark-layout) .category-mobile a:not(.meta-button),
                body:not(.dark-layout) .category-mobile span,
                body:not(.dark-layout) #left-slide-panel a,
                body:not(.dark-layout) #left-slide-panel span,
                body:not(.dark-layout) #left-slide-panel h4,
                body:not(.dark-layout) #left-slide-panel div,
                body:not(.dark-layout) #nsk-left-panel-container .category-list a,
                body:not(.dark-layout) #nsk-left-panel-container .category-list span,
                body:not(.dark-layout) #nsk-left-panel-container .category-list h4,
                body:not(.dark-layout) #nsk-left-panel-container .category-list div,
                body:not(.dark-layout) .title-input input,
                body:not(.dark-layout) .tab-select:not(.mde-toolbar *),
                body:not(.dark-layout) .tab-select:not(.mde-toolbar *) label,
                body:not(.dark-layout) .tab-select:not(.mde-toolbar *) span,
                body:not(.dark-layout) .topic-select:not(.mde-toolbar *),
                body:not(.dark-layout) .topic-select:not(.mde-toolbar *) label,
                body:not(.dark-layout) .topic-select:not(.mde-toolbar *) span {
                    color: #333 !important;
                }
                
                body:not(.dark-layout) .category-mobile svg:not(.meta-button svg),
                body:not(.dark-layout) #left-slide-panel svg,
                body:not(.dark-layout) #left-slide-panel .iconpark-icon,
                body:not(.dark-layout) #nsk-left-panel-container .category-list svg,
                body:not(.dark-layout) #nsk-left-panel-container .category-list .iconpark-icon,
                body:not(.dark-layout) .tab-select:not(.mde-toolbar *) svg,
                body:not(.dark-layout) .tab-select:not(.mde-toolbar *) .iconpark-icon,
                body:not(.dark-layout) .topic-select:not(.mde-toolbar *) svg,
                body:not(.dark-layout) .topic-select:not(.mde-toolbar *) .iconpark-icon {
                    fill: #333 !important;
                    color: #333 !important;
                }

                body.dark-layout .title-input input,
                body.dark-layout .tab-select:not(.mde-toolbar *),
                body.dark-layout .tab-select:not(.mde-toolbar *) label,
                body.dark-layout .tab-select:not(.mde-toolbar *) span,
                body.dark-layout .topic-select:not(.mde-toolbar *),
                body.dark-layout .topic-select:not(.mde-toolbar *) label,
                body.dark-layout .topic-select:not(.mde-toolbar *) span {
                    color: #aaa !important;
                }
                
                body.dark-layout .tab-select:not(.mde-toolbar *) svg,
                body.dark-layout .tab-select:not(.mde-toolbar *) .iconpark-icon,
                body.dark-layout .topic-select:not(.mde-toolbar *) svg,
                body.dark-layout .topic-select:not(.mde-toolbar *) .iconpark-icon {
                    fill: #aaa !important;
                    color: #aaa !important;
                }

                .pure-form input, .pure-form textarea, .pure-form select,
                body.dark-layout .pure-form input, body.dark-layout .pure-form textarea, body.dark-layout .pure-form select,
                .search-box input {
                    background-color: var(--ns-input-bg) !important;
                    border: 1px solid var(--ns-glass-border) !important;
                    border-radius: 6px !important;
                    color: inherit !important;
                }
                body:not(.dark-layout) .pure-form label,
                body:not(.dark-layout) .pure-form .description,
                body:not(.dark-layout) .ns-config-form {
                    color: #333 !important;
                }

                .signature { max-height: 50px !important; overflow-y: auto !important; padding-right: 4px; }
                .signature::-webkit-scrollbar { width: 4px; height: 4px; }

                body .md-editor .CodeMirror, .vditor-reset, .comment-container textarea {
                    background-color: var(--ns-input-bg) !important;
                    border-radius: 8px !important;
                    border: 1px solid var(--ns-glass-border) !important;
                    box-shadow: inset 0 2px 4px var(--ns-glass-shadow) !important;
                }

                footer {
                    margin-bottom: 20px !important; width: calc(100% - 40px) !important;
                    margin-left: auto !important; margin-right: auto !important; max-width: 1200px !important; 
                }
                table, th, td { border-color: var(--ns-glass-border) !important; }
                body .md-editor .mde-toolbar, body .md-editor .tab-select, 
                div.expression, body .md-editor .CodeMirror-gutters, div.exp-item { border-color: var(--ns-glass-border) !important; }
                
                #editor-body.fullscreen-editor {
                    background-color: var(--ns-glass-bg) !important;
                    backdrop-filter: blur(40px) saturate(200%) !important;
                    -webkit-backdrop-filter: blur(40px) saturate(200%) !important;
                    border-radius: 0 !important; border: none !important; 
                    z-index: 999 !important; 
                }
                #editor-body.fullscreen-editor .tab-select, #editor-body.fullscreen-editor .mde-toolbar,
                #editor-body.fullscreen-editor .CodeMirror, #editor-body.fullscreen-editor .vditor-reset {
                    border-radius: 0 !important; border-left: none !important; border-right: none !important;
                }
                #editor-body.fullscreen-editor .CodeMirror { box-shadow: none !important; }
            `;
        }

        // --- 4. 头像与按钮 ---
        if (cfg.avatarStyle === 'circle') {
            css += ` .avatar-wrapper img, .avatar-normal, .avatar-sm { border-radius: 50% !important; } `;
        } else if (cfg.avatarStyle === 'liquid') {
            css += `
                .avatar+.icon { display: none !important; }
                .avatar { border: 3px solid var(--ns-avatar-border) !important; transition: all 0.3s ease-in-out; }
                .avatar:hover { border-color: var(--ns-avatar-hover-border) !important; box-shadow: 0 0 15px rgba(138, 180, 248, 0.4); }
                .avatar-normal, .sorter, .btn, .paginator a { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important; transition: all 0.3s ease-in-out; }
                .avatar-normal:hover, .sorter:hover, .btn:hover, .paginator a:hover {
                    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5), 0 0 10px rgba(138, 180, 248, 0.3) !important;
                    transform: translateY(-2px);
                }
                .avatar-normal { border-radius: 20px; }
            `;
        }

        // --- 5. 滚动条 ---
        if (cfg.enableCustomScrollbar) {
            css += `
                ::-webkit-scrollbar { width: 8px; height: 8px; }
                ::-webkit-scrollbar-track { background-color: transparent; }
                ::-webkit-scrollbar-thumb { background-color: ${cfg.scrollbarColor}; border-radius: 2em; border: 2px solid transparent; background-clip: padding-box; }
                ::-webkit-scrollbar-thumb:hover { background-color: ${cfg.scrollbarHoverColor}; }
            `;
        }

        // --- 6. 动态指针 ---
        if (cfg.enableCustomCursor) {
            const defCur = cfg.defaultCursorUrl ? `url('${cfg.defaultCursorUrl}'), auto` : 'auto';
            const ptrCur = cfg.pointerCursorUrl ? `url('${cfg.pointerCursorUrl}'), pointer` : 'pointer';
            const txtCur = cfg.textCursorUrl ? `url('${cfg.textCursorUrl}'), text` : 'text';
            
            css += ` 
                *, body, html { cursor: ${defCur} !important; } 
                a, a *, button, button *, .btn, .nav-item-btn, img, i:hover, svg:hover, .transition:hover, .msc-close:hover, div.exp-item:hover { cursor: ${ptrCur} !important; } 
                input, textarea, .CodeMirror, .CodeMirror-lines, .title-input input { cursor: ${txtCur} !important; }
            `;
        }

        // --- 7. 悬浮引擎优化 ---
        if (cfg.enableSmoothing) {
            css += `
                html { scroll-behavior: smooth; }
                button, input, .v-card, .board-item, .ruling-item { transition: background-color 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.3s ease, box-shadow 0.3s ease !important; }
                .v-card:hover, .board-item:hover, .ruling-item:hover {
                    transform: translateY(-2px); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3) !important; border-color: rgba(255, 255, 255, 0.2) !important;
                }
            `;
        }

        API.addStyle(css, STYLE_TAG_ID);
    }

    API.register({
        id: MODULE_ID,
        name: '全站动态美化引擎',
        version: '2.3.0',
        description: '新增底层遮罩强制关闭开关与亮色保护机制。',
        
        render: function(container) {
            const currentConfig = API.getConfig(MODULE_ID, SCHEMA);
            const form = API.UI.buildConfigForm(SCHEMA, currentConfig, function(newConfig) {
                API.store(MODULE_ID, 'config', newConfig);
                applyStyles();
            });
            container.appendChild(form);
        },
        
        execute: function() { applyStyles(); },
        onToggle: function(enabled) { enabled ? applyStyles() : API.removeStyle(STYLE_TAG_ID); }
    });
})();