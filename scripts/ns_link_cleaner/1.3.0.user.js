(function() {
    const API = window.NodeSeekUI;
    const MODULE_ID = 'ns_link_cleaner';
    
    // 支持的跳转路径模式（相对路径）
    const JUMP_PATHS = ['/jump?to='];
    
    // Schema
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

    // 检查是否包含跳转路径
    function containsJumpPath(url) {
        if (!url) return false;
        return JUMP_PATHS.some(path => url.includes(path));
    }

    // 解码跳转URL（支持相对和绝对路径）
    function decodeJumpUrl(jumpUrl) {
        try {
            const urlObj = new URL(jumpUrl, window.location.origin);
            const target = urlObj.searchParams.get('to');
            return target ? decodeURIComponent(target) : null;
        } catch (e) {
            return null;
        }
    }

    // 检查当前是否在跳转页面
    function isOnJumpPage() {
        return window.location.pathname === '/jump' && 
               window.location.search.startsWith('?to=');
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
        if (!href || !containsJumpPath(href)) return false;
        
        const targetUrl = decodeJumpUrl(href);
        if (!targetUrl) return false;
        
        // 替换 href 为直接链接
        element.setAttribute('href', targetUrl);
        element.setAttribute('data-cleaned', 'true');
        element.setAttribute('title', '已净化: ' + targetUrl);
        
        // 替换链接文本（如果文本是URL或包含跳转路径）
        const text = element.textContent.trim();
        if (text.includes('/jump?to=') || text.includes('nodeseek.com') || text.includes('deepflood.com')) {
            element.textContent = targetUrl;
        }
        
        return true;
    }

    // 清理页面所有链接
    function cleanAllLinks() {
        // 使用属性选择器匹配包含 jump?to= 的链接
        const links = document.querySelectorAll('a[href*="/jump?to="]');
        let count = 0;
        links.forEach(link => {
            if (cleanLink(link)) count++;
        });
        if (count > 0) {
            console.log(`[${MODULE_ID}] 已净化 ${count} 个跳转链接`);
        }
    }

    // 动态监听
    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;
                    
                    // 检查新增节点本身
                    if (node.tagName === 'A') {
                        const href = node.getAttribute('href');
                        if (href && containsJumpPath(href)) {
                            cleanLink(node);
                        }
                    }
                    
                    // 检查子节点
                    if (node.querySelectorAll) {
                        node.querySelectorAll('a[href*="/jump?to="]').forEach(cleanLink);
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
        
        // 优先处理自动跳转
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
        version: '1.3.0',
        description: '净化 NodeSeek/DeepFlood 跳转链接为直接链接',
        
        render: function(container) {
            const currentConfig = API.getConfig(MODULE_ID, SCHEMA);
            
            const info = document.createElement('div');
            info.innerHTML = `
                <div style="background: #f6f8fa; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; color: #586069;">
                    自动将 <code>/jump?to=...</code> 格式的链接净化为直接链接
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
            if (enabled) executeMain();
        }
    });
})();