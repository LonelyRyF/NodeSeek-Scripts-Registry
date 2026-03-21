(function() {
    const API = window.NodeSeekUI;
    const MODULE_ID = 'ns_link_cleaner';
    const STYLE_ID = MODULE_ID + '_css';
    
    // 支持的跳转链接前缀
    const JUMP_PREFIXES = [
        'https://www.nodeseek.com/jump?to=',
        'https://www.deepflood.com/jump?to='
    ];
    
    // 简化后的 Schema：仅两个核心选项
    const SCHEMA = [
        {
            key: 'cleanLinks',
            type: 'switch',
            label: '净化页面链接',
            description: '将页面中的跳转链接替换为直接链接',
            default: true
        },
        {
            key: 'autoRedirect',
            type: 'switch',
            label: '自动跳转',
            description: '访问跳转页面时直接跳转到目标地址',
            default: false
        }
    ];

    // 检查链接是否包含跳转前缀
    function containsJumpPrefix(url) {
        return JUMP_PREFIXES.some(prefix => url.includes(prefix));
    }

    // 获取链接对应的跳转前缀
    function getJumpPrefix(url) {
        return JUMP_PREFIXES.find(prefix => url.includes(prefix));
    }

    // 解码跳转URL
    function decodeJumpUrl(jumpUrl) {
        const prefix = getJumpPrefix(jumpUrl);
        if (!prefix) return null;
        
        try {
            const urlObj = new URL(jumpUrl);
            const target = urlObj.searchParams.get('to');
            return target ? decodeURIComponent(target) : null;
        } catch (e) {
            const idx = jumpUrl.indexOf(prefix);
            if (idx !== -1) {
                const encoded = jumpUrl.substring(idx + prefix.length);
                const endIdx = encoded.indexOf('&');
                const finalEncoded = endIdx !== -1 ? encoded.substring(0, endIdx) : encoded;
                return decodeURIComponent(finalEncoded);
            }
            return null;
        }
    }

    // 检查当前是否在跳转页面
    function isOnJumpPage() {
        return JUMP_PREFIXES.some(prefix => window.location.href.startsWith(prefix));
    }

    // 执行自动跳转
    function performAutoRedirect() {
        const targetUrl = decodeJumpUrl(window.location.href);
        if (targetUrl) {
            window.location.replace(targetUrl);
        }
    }

    // 清理单个链接
    function cleanLink(element) {
        const href = element.getAttribute('href');
        if (!href || !containsJumpPrefix(href)) return false;
        
        const cleanUrl = decodeJumpUrl(href);
        if (!cleanUrl) return false;
        
        element.setAttribute('href', cleanUrl);
        element.setAttribute('data-cleaned', 'true');
        
        // 如果链接文本就是URL本身，也替换掉
        if (element.textContent.includes('jump?to=')) {
            element.textContent = cleanUrl;
        }
        
        return true;
    }

    // 清理页面所有链接
    function cleanAllLinks() {
        const selector = JUMP_PREFIXES.map(p => `a[href*="${p}"]`).join(', ');
        const links = document.querySelectorAll(selector);
        links.forEach(cleanLink);
    }

    // 动态监听新链接
    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;
                    
                    if (node.tagName === 'A') {
                        const href = node.getAttribute('href');
                        if (href && containsJumpPrefix(href)) {
                            cleanLink(node);
                        }
                    }
                    
                    if (node.querySelectorAll) {
                        const selector = JUMP_PREFIXES.map(p => `a[href*="${p}"]`).join(', ');
                        node.querySelectorAll(selector).forEach(cleanLink);
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 主执行函数
    function executeMain() {
        const cfg = API.getConfig(MODULE_ID, SCHEMA);
        
        // 优先处理自动跳转（页面会刷新，无需后续操作）
        if (cfg.autoRedirect && isOnJumpPage()) {
            performAutoRedirect();
            return;
        }
        
        // 净化页面链接
        if (cfg.cleanLinks) {
            cleanAllLinks();
            setupObserver();
        }
    }

    // 注册模块
    API.register({
        id: MODULE_ID,
        name: '链接清理器',
        version: '1.2.0',
        description: '净化 NodeSeek 和 DeepFlood 跳转链接，支持自动跳转',
        
        render: function(container) {
            const currentConfig = API.getConfig(MODULE_ID, SCHEMA);
            
            const info = document.createElement('div');
            info.innerHTML = `
                <div style="background: #f6f8fa; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; color: #586069;">
                    支持自动净化 <code>nodeseek.com</code> 和 <code>deepflood.com</code> 的跳转链接为直接链接
                </div>
            `;
            container.appendChild(info);
            
            const form = API.UI.buildConfigForm(SCHEMA, currentConfig, function(newConfig) {
                API.store(MODULE_ID, 'config', newConfig);
                API.showAlert('配置已保存，刷新页面后生效');
            });
            
            container.appendChild(form);
        },
        
        execute: function() {
            executeMain();
        },
        
        onToggle: function(enabled) {
            if (enabled) {
                executeMain();
            }
        }
    });
})();