(function() {
    const API = window.NodeSeekUI;
    // 强制依赖基座，如果基座未加载则不执行
    if (!API) {
        console.error('未检测到 NodeSeek UI 基座');
        return;
    }

    const MODULE_ID = 'ns_exact_time';
    let timer = null; // 用于保存定时器，方便禁用时清理

    // 定义配置项：让用户可以自定义扫描间隔
    const SCHEMA = [
        {
            key: 'interval',
            type: 'number',
            label: '扫描频率 (毫秒)',
            description: '扫描页面新加载时间的频率，默认 2000 毫秒。如果感觉有延迟可以调低，如果不常翻页可以调高。',
            min: 500,
            max: 10000,
            step: 500,
            default: 2000
        }
    ];

    // 核心业务逻辑：替换相对时间为绝对时间
    function replaceRelativeTimeWithAbsolute() {
        const processedAttr = 'data-ns-time-replaced';
        // 只选中带有 title 属性且尚未被处理过的元素
        const elements = document.querySelectorAll(`[title]:not([${processedAttr}])`);
        
        elements.forEach(function (element) {
            try {
                const titleText = element.getAttribute('title') || '';
                if (!titleText) return;
                
                const originalText = (element.textContent || '').trim();
                const lowerText = originalText.toLowerCase();
                
                // 仅处理看起来是相对时间的文本
                const looksLikeRelative = /\bago\b/.test(lowerText) || /刚刚|分钟前|小时|天前|月前|年前/.test(originalText);
                if (!looksLikeRelative) return;

                let displayText = titleText;
                if (/\bedited\b/.test(lowerText)) {
                    // 去掉 title 开头可能自带的 "Edited " 或中文 "编辑于 " 前缀
                    let clean = titleText.replace(/^\s*edited\s*/i, '').replace(/^\s*编辑于\s*/i, '');
                    displayText = '编辑时间 ' + clean;
                }

                element.textContent = displayText;
                // 打上标记，避免后续重复处理消耗性能
                element.setAttribute(processedAttr, 'true');
            } catch (e) {
                // 忽略单个元素异常，防止阻塞整个循环
            }
        });
    }

    // 启动监听
    function start() {
        stop(); // 确保不会重复创建定时器
        const cfg = API.getConfig(MODULE_ID, SCHEMA);
        
        replaceRelativeTimeWithAbsolute(); // 启动时立刻执行一次
        timer = setInterval(replaceRelativeTimeWithAbsolute, cfg.interval);
    }

    // 停止监听
    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    // 注册到 NodeSeek UI 基座
    API.register({
        id: MODULE_ID,
        name: '精确时间显示',
        version: '1.0.0',
        description: '将页面上的相对时间（如“3小时前”）自动替换为悬停提示中的完整绝对时间。',
        
        // 渲染设置面板
        render: function(container) {
            const currentConfig = API.getConfig(MODULE_ID, SCHEMA);
            const form = API.UI.buildConfigForm(SCHEMA, currentConfig, function(newConfig) {
                // 用户点击保存后触发
                API.store(MODULE_ID, 'config', newConfig);
                // 如果当前模块正在运行，重新启动以应用新频率
                if (timer) {
                    start();
                }
            });
            container.appendChild(form);
        },
        
        // 核心启动钩子：基座判定模块已开启，且页面初次加载时触发
        execute: function() {
            start();
        },
        
        // 热切换钩子：用户在管理中心手动点击"启用/禁用"时触发
        onToggle: function(enabled) {
            if (enabled) {
                start();
            } else {
                stop();
                // 注意：这里没有将被替换的时间还原回"相对时间"，
                // 因为这需要额外缓存原始文本，性价比不高。禁用后停止后续的自动替换即可。
            }
        }
    });
})();