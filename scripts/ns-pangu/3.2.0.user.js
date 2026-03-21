(function() {
    'use strict';

    const API = window.NodeSeekUI;
    const UI = API.UI;

    const MODULE_ID = 'ns_pangu';
    const MODULE_NAME = '盘古排版助手';
    const MODULE_VERSION = '3.1.0';
    const MODULE_DESC = '自动在中英文之间添加空格。采用提取-占位-还原架构，完美保护 Markdown 语法及 @提及。';
    const STYLE_ID = MODULE_ID + '_css';

    const SCHEMA = [
        { key: 'autoFormatOnSubmit', type: 'switch', label: '发布时自动排版', description: '点击发布按钮时自动对内容进行排版', default: true },
        { key: 'showEditorBtn', type: 'switch', label: '显示编辑器"排版"按钮', description: '在编辑器工具栏添加手动排版按钮', default: true }
    ];

    let panguLoaded = false;
    let observer = null;
    const CUSTOM_BTN_CLASS = 'ns-pangu-btn';

    // --- 配置管理 ---
    const getConfig = () => API.getConfig(MODULE_ID, SCHEMA);
    const saveConfig = (data) => API.store(MODULE_ID, 'config', data);

    // --- 动态加载 Pangu.js ---
    const loadPanguLib = () => {
        if (window.pangu) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/pangu@4.0.7/dist/browser/pangu.min.js';
            script.onload = () => { panguLoaded = true; resolve(); };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // --- 核心排版引擎 ---
    function safePanguFormat(originalText) {
        if (!window.pangu) return originalText;
        
        const protections = [];
        const protectRules = [
            /```[\s\S]*?```/g,
            /`[^`\n]+`/g,
            /@[\w\u4e00-\u9fa5-]+/g,
            /~~[\s\S]+?~~/g,
            /\*\*[\s\S]+?\*\*/g,
            /__[\s\S]+?__/g,
            /!\[.*?\]\(.*?\)/g,
            /\[.*?\]\(.*?\)/g,
            /(https?:\/\/[^\s]+)/g
        ];

        let tempText = originalText;
        protectRules.forEach((regex) => {
            tempText = tempText.replace(regex, (match) => {
                protections.push(match);
                return `NSPGMACROX${protections.length - 1}X`;
            });
        });

        let spacedText = window.pangu.spacing(tempText);

        protections.forEach((match, i) => {
            const placeholder = `NSPGMACROX${i}X`;
            spacedText = spacedText.replace(placeholder, match);
        });

        return spacedText;
    }

    // --- 应用到编辑器 ---
    function applyPanguSpacing() {
        const cm = document.querySelector('.CodeMirror')?.CodeMirror;
        let isChanged = false;

        if (cm) {
            const doc = cm.getDoc();
            const originalText = doc.getValue();
            const newText = safePanguFormat(originalText);
            if (originalText !== newText) {
                const cursor = doc.getCursor();
                doc.setValue(newText);
                doc.setCursor(cursor);
                isChanged = true;
            }
        } else {
            const ta = document.querySelector('textarea');
            if (ta) {
                const originalText = ta.value;
                const newText = safePanguFormat(originalText);
                if (originalText !== newText) {
                    ta.value = newText;
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                    isChanged = true;
                }
            }
        }
        return isChanged;
    }

    // --- UI 注入 ---
    function injectFeatures() {
        const cfg = getConfig();
        const candidates = document.querySelectorAll('button, [role="button"]');
        
        for (let btn of candidates) {
            const text = btn.innerText.trim();
            if (['发布帖子', '发布评论', '编辑帖子', '编辑评论'].includes(text) && !btn.classList.contains('ns-pangu-bound')) {
                
                btn.classList.add('ns-pangu-bound');
                const container = btn.parentElement;

                // 注入手动按钮
                if (cfg.showEditorBtn && container && !container.querySelector(`.${CUSTOM_BTN_CLASS}`)) {
                    const panguBtn = document.createElement('button');
                    panguBtn.className = `${CUSTOM_BTN_CLASS} ${btn.className}`;
                    panguBtn.type = 'button';
                    panguBtn.innerText = '排版';
                    
                    panguBtn.onclick = (e) => {
                        e.preventDefault();
                        const changed = applyPanguSpacing();
                        panguBtn.innerText = changed ? '搞定' : '完美';
                        setTimeout(() => { panguBtn.innerText = '排版'; }, 1500);
                    };
                    container.insertBefore(panguBtn, btn);
                }

                // 自动排版拦截
                if (cfg.autoFormatOnSubmit) {
                    btn.addEventListener('click', () => {
                        applyPanguSpacing();
                    }, true);
                }
            }
        }
    }

    // --- 样式注入 ---
    function injectStyles() {
        API.addStyle(`
            .${CUSTOM_BTN_CLASS} {
                margin-right: 8px !important;
                background: transparent !important;
                color: #6b7280 !important;
                border: 1px solid #d1d5db !important;
                padding: 0 12px !important;
            }
        `, STYLE_ID);
    }

    // --- 服务控制 ---
    function startService() {
        injectStyles();
        loadPanguLib().then(() => {
            if (observer) observer.disconnect();
            observer = new MutationObserver(injectFeatures);
            observer.observe(document.body, { childList: true, subtree: true });
            injectFeatures();
        });
    }

    function stopService() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        document.querySelectorAll(`.${CUSTOM_BTN_CLASS}`).forEach(b => b.remove());
        document.querySelectorAll('.ns-pangu-bound').forEach(b => b.classList.remove('ns-pangu-bound'));
        API.removeStyle(STYLE_ID);
    }

    // --- 渲染设置面板 ---
    function renderSettings(container) {
        const cfg = getConfig();
        const form = UI.buildConfigForm(SCHEMA, cfg, (newData) => {
            saveConfig(newData);
            // 重新加载以应用新配置
            stopService();
            startService();
        });
        
        const fieldset = document.createElement('fieldset');
        fieldset.innerHTML = `<h2 style="margin: 10px 0; border-bottom: 2px solid #2ea44f; padding-bottom: 8px;">${MODULE_NAME}</h2><p style="font-size:13px;color:#888;margin-bottom:16px;">${MODULE_DESC}</p>`;
        fieldset.appendChild(form);
        container.appendChild(fieldset);
    }

    // --- 注册基座 ---
    API.register({
        id: MODULE_ID,
        name: MODULE_NAME,
        version: MODULE_VERSION,
        description: MODULE_DESC,
        
        // 渲染设置面板
        render: renderSettings,
        
        // 【关键】页面加载时基座自动调用
        execute: function() {
            startService();
        },
        
        // 热切换：管理中心启用/禁用时调用
        onToggle: function(enabled) {
            if (enabled) {
                startService();
            } else {
                stopService();
            }
        }
    });

})();
