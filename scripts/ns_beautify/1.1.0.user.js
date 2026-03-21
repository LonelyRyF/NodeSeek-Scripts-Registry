(function() {
    const API = window.NodeSeekUI;
    if (!API) {
        console.error('[NS Beautify] 未检测到 NodeSeek UI 基座');
        return;
    }

    const MODULE_ID = 'ns_beautify';
    const STYLE_TAG_ID = 'ns-beautify-styles';

    // 默认配置
    const DEFAULTS = {
        enableBg: true,
        bgUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2560&auto=format&fit=crop',
        bgBlur: 10,
        enableGlassHeader: true,
        enableGlassContent: true,
        glassOpacity: 0.7,
        circularAvatar: true,
        enableSmoothing: true
    };

    // 配置表单 Schema (提供丰富的颗粒化开关)
    const SCHEMA = [
        { key: 'enableBg', type: 'switch', label: '开启自定义全局背景图', default: DEFAULTS.enableBg },
        { key: 'bgUrl', type: 'text', label: '背景图 URL', description: '支持图片链接或 Base64。', default: DEFAULTS.bgUrl },
        { key: 'bgBlur', type: 'number', label: '背景模糊度 (px)', description: '范围 0-50。', min: 0, max: 50, step: 1, default: DEFAULTS.bgBlur },
        { key: 'enableGlassHeader', type: 'switch', label: '导航栏毛玻璃特效', description: '让顶部栏变得微透模糊', default: DEFAULTS.enableGlassHeader },
        { key: 'enableGlassContent', type: 'switch', label: '内容区毛玻璃特效', description: '覆盖帖子、回复、侧边栏等容器', default: DEFAULTS.enableGlassContent },
        { key: 'glassOpacity', type: 'number', label: '毛玻璃底色透明度', description: '范围 0.1(极透) - 1.0(不透)。', min: 0.1, max: 1.0, step: 0.1, default: DEFAULTS.glassOpacity },
        { key: 'circularAvatar', type: 'switch', label: '启用圆形头像', default: DEFAULTS.circularAvatar },
        { key: 'enableSmoothing', type: 'switch', label: '启用现代化圆角与平滑动画', default: DEFAULTS.enableSmoothing }
    ];

    /**
     * 生成并注入 CSS
     */
    function applyStyles() {
        const cfg = API.getConfig(MODULE_ID, SCHEMA);
        let css = '';

        // 定义 CSS 变量：智能适配 NodeSeek 的白天/夜间模式 (dark-layout)
        css += `
            :root {
                --ns-glass-bg: rgba(255, 255, 255, ${cfg.glassOpacity});
                --ns-glass-border: rgba(255, 255, 255, 0.4);
                --ns-glass-shadow: rgba(0, 0, 0, 0.1);
            }
            body.dark-layout {
                --ns-glass-bg: rgba(30, 30, 32, ${cfg.glassOpacity});
                --ns-glass-border: rgba(255, 255, 255, 0.08);
                --ns-glass-shadow: rgba(0, 0, 0, 0.3);
            }
        `;

        // 1. 自定义背景图层
        if (cfg.enableBg) {
            const currentBgUrl = cfg.bgUrl && cfg.bgUrl.trim() !== '' ? cfg.bgUrl : DEFAULTS.bgUrl;
            css += `
                body {
                    background: none !important;
                    background-color: transparent !important;
                }
                body::before {
                    content: "";
                    position: fixed;
                    top: 0; left: 0; width: 100%; height: 100%;
                    z-index: -2;
                    background-image: url("${currentBgUrl}");
                    background-size: cover;
                    background-position: center;
                    background-attachment: fixed;
                    background-repeat: no-repeat;
                    filter: blur(${cfg.bgBlur}px) brightness(90%);
                    transform: scale(1.05); /* 裁切模糊白边 */
                }
            `;
        }

        // 毛玻璃核心样式模板
        const glassmorphismCss = `
            background-color: var(--ns-glass-bg) !important;
            backdrop-filter: blur(15px) saturate(180%) !important;
            -webkit-backdrop-filter: blur(15px) saturate(180%) !important;
            border: 1px solid var(--ns-glass-border) !important;
            box-shadow: 0 4px 20px var(--ns-glass-shadow) !important;
        `;

        // 2. 导航栏毛玻璃
        if (cfg.enableGlassHeader) {
            css += `
                header, .mobile-nav {
                    ${glassmorphismCss}
                    border-radius: 0 0 12px 12px !important; /* 底部圆角 */
                }
            `;
        }

        // 3. 内容区域毛玻璃 (精准适配 NodeSeek 结构)
        if (cfg.enableGlassContent) {
            // 包含了帖子块、评论块、右侧边栏面板、基座配置面板、悬浮按钮
            const contentSelectors = [
                '.content-item', 
                '.right-side fieldset', 
                '.selector-right-side fieldset',
                '#ns-custom-panels-wrapper',
                '#fast-nav-button-group',
                '.search-box',
                '.v-card', '.card'
            ].join(', ');

            css += `
                ${contentSelectors} {
                    ${glassmorphismCss}
                }
                /* 修复部分输入框或内层元素的背景冲突 */
                .post-content, .comment-container {
                    background: transparent !important;
                }
                .search-box {
                    border-radius: 20px !important; /* 搜索框变圆润 */
                }
            `;
        }

        // 4. 圆形头像
        if (cfg.circularAvatar) {
            css += `
                .avatar-wrapper img, .avatar-normal, .avatar-sm {
                    border-radius: 50% !important;
                }
            `;
        }

        // 5. 现代化平滑与圆角
        if (cfg.enableSmoothing) {
            css += `
                html {
                    scroll-behavior: smooth;
                }
                .content-item, fieldset, #ns-custom-panels-wrapper, button, input, .search-box {
                    border-radius: 12px !important;
                    transition: background-color 0.3s ease, transform 0.2s ease, box-shadow 0.2s ease !important;
                }
                /* 鼠标悬浮轻微上浮效果 */
                .content-item:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px var(--ns-glass-shadow) !important;
                }
                #fast-nav-button-group {
                    border-radius: 20px !important;
                    overflow: hidden;
                }
            `;
        }

        // 通过基座 API 注入样式
        API.addStyle(css, STYLE_TAG_ID);
    }

    // 注册到基座
    API.register({
        id: MODULE_ID,
        name: 'UI 主站美化',
        version: '1.1.0',
        description: '深度适配 NodeSeek 的全局美化插件。支持颗粒化开关：自定义背景、分块毛玻璃、圆形头像等，完美兼容日/夜间模式。',
        
        render: function(container) {
            const currentConfig = API.getConfig(MODULE_ID, SCHEMA);
            const form = API.UI.buildConfigForm(SCHEMA, currentConfig, function(newConfig) {
                API.store(MODULE_ID, 'config', newConfig);
                applyStyles(); // 保存配置后即刻刷新
            });
            container.appendChild(form);
        },
        
        execute: function() {
            applyStyles();
            window.addEventListener('DOMContentLoaded', applyStyles);
        },
        
        onToggle: function(enabled) {
            if (enabled) {
                applyStyles();
            } else {
                API.removeStyle(STYLE_TAG_ID); // 禁用时无痕卸载
            }
        }
    });
})();