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
        bgUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2560&auto=format&fit=crop', // 默认雪山背景
        bgBlur: 10,
        enableGlass: true,
        glassOpacity: 0.7,
        enableSmoothing: true
    };

    // 严格遵循基座文档：Schema 必须是扁平数组，不支持 group
    const SCHEMA = [
        { key: 'bgUrl', type: 'text', label: '自定义背景图 URL', description: '留空则使用默认。支持图片链接或 Base64。', default: DEFAULTS.bgUrl },
        { key: 'bgBlur', type: 'number', label: '背景模糊度 (px)', description: '范围 0-50。', min: 0, max: 50, step: 1, default: DEFAULTS.bgBlur },
        { key: 'enableGlass', type: 'switch', label: '开启主体毛玻璃/玻璃拟态', default: DEFAULTS.enableGlass },
        { key: 'glassOpacity', type: 'number', label: '毛玻璃背景透明度', description: '范围 0.1-1.0。数字越小越透明。', min: 0.1, max: 1.0, step: 0.1, default: DEFAULTS.glassOpacity },
        { key: 'enableSmoothing', type: 'switch', label: '开启字体平滑与高级过渡', default: DEFAULTS.enableSmoothing }
    ];

    /**
     * 生成并注入 CSS
     */
    function applyStyles() {
        const cfg = API.getConfig(MODULE_ID, SCHEMA);
        let css = '';

        // 1. 字体平滑与现代化设定
        if (cfg.enableSmoothing) {
            css += `
                html {
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    scroll-behavior: smooth;
                }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                }
            `;
        }

        // 2. 动态背景层 (使用伪元素避免污染子元素)
        const currentBgUrl = cfg.bgUrl && cfg.bgUrl.trim() !== '' ? cfg.bgUrl : DEFAULTS.bgUrl;
        css += `
            body {
                background: none !important;
                position: relative;
                z-index: 0;
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
                filter: blur(${cfg.bgBlur}px) brightness(95%);
                transform: scale(1.1); /* 放大一点切除模糊产生的白边 */
            }
            body::after {
                content: "";
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                z-index: -1; 
                background: rgba(0,0,0, ${ (1.0 - cfg.glassOpacity) / 2 }); /* 智能遮罩暗度 */
            }
        `;

        // 3. 毛玻璃效果 (Glassmorphism)
        if (cfg.enableGlass) {
            const targetSelectors = [
                'main.v-main',             
                '.layout-wrapper',          
                '.card', '.v-card',         
                '.navbar', '.v-toolbar',    
                '.list-item', '.v-list-item', 
                '.dialog', '.v-dialog'       
            ].join(', ');

            // 计算背景色，自适应透明度
            const isDark = (1.0 - cfg.glassOpacity) > 0.5;
            const baseColor = isDark ? 'rgba(30, 30, 30, ' : 'rgba(255, 255, 255, ';
            const rgba = `${baseColor}${cfg.glassOpacity})`;

            css += `
                ${targetSelectors} {
                    background-color: ${rgba} !important;
                    backdrop-filter: blur(15px) saturate(180%) !important;
                    -webkit-backdrop-filter: blur(15px) saturate(180%) !important;
                    border: 1px solid rgba(255, 255, 255, 0.08) !important;
                    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2) !important;
                }
                .v-card, .v-sheet, .card, .v-dialog, input, button {
                    border-radius: 12px !important;
                }
            `;
        } else {
            // 如果不开启毛玻璃，使用纯色微透
            css += `
                main.v-main, .v-card, .card {
                    background-color: rgba(255,255,255,0.92) !important;
                }
            `;
        }

        // 4. 交互过渡动画
        if (cfg.enableSmoothing) {
            css += `
                .v-card, .card, .v-btn, .navbar, .list-item {
                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
                }
                .v-card:hover, .card:hover {
                    box-shadow: 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22) !important;
                    transform: translateY(-2px);
                }
            `;
        }

        // 使用基座提供的标准 API 注入样式
        API.addStyle(css, STYLE_TAG_ID);
    }

    // 注册到基座
    API.register({
        id: MODULE_ID,
        name: 'UI 主站美化',
        version: '1.0.1',
        description: '提供现代化的 UI 视觉增强，支持自定义模糊背景、主框架毛玻璃效果。',
        
        render: function(container) {
            const currentConfig = API.getConfig(MODULE_ID, SCHEMA);
            const form = API.UI.buildConfigForm(SCHEMA, currentConfig, function(newConfig) {
                API.store(MODULE_ID, 'config', newConfig);
                applyStyles(); // 保存配置后即刻刷新样式
            });
            container.appendChild(form);
        },
        
        execute: function() {
            // 模块启用且页面加载时注入
            applyStyles();
            // 防止动态组件覆盖，在 DOMContentLoaded 时再稳固一次
            window.addEventListener('DOMContentLoaded', applyStyles);
        },
        
        onToggle: function(enabled) {
            if (enabled) {
                applyStyles();
            } else {
                // 标准做法：禁用时通过基座 API 卸载样式，恢复原状
                API.removeStyle(STYLE_TAG_ID);
            }
        }
    });
})();