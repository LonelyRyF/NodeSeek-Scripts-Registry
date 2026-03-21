(function() {
    'use strict';

    const API = window.NodeSeekUI;

    const MODULE_ID = 'ns_pangu';
    const MODULE_NAME = '盘古排版助手';
    const MODULE_VERSION = '3.1.0';
    const MODULE_DESC = '自动在中英文之间添加空格。采用提取-占位-还原架构，完美保护 Markdown 语法及 @提及。';

    const DEFAULT_CONFIG = {
        autoFormatOnSubmit: true, // 发布时自动排版
        showEditorBtn: true,      // 显示编辑器“排版”按钮
    };

    let panguLoaded = false;

    // --- 基座存储桥接 ---
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

    /**
     * 核心排版引擎
     */
    function safePanguFormat(originalText) {
        if (!window.pangu) return originalText;
        
        const protections = [];
        // 定义需要保护的 Markdown 语法规则
        const protectRules = [
            /```[\s\S]*?```/g,          // 1. 多行代码块
            /`[^`\n]+`/g,               // 2. 行内代码
            /@[\w\u4e00-\u9fa5-]+/g,    // 3. @提及 (新增保护)
            /~~[\s\S]+?~~/g,            // 4. 删除线
            /\*\*[\s\S]+?\*\*/g,        // 5. 粗体
            /__[\s\S]+?__/g,            // 6. 下划线/粗体
            /!\[.*?\]\(.*?\)/g,         // 7. 图片
            /\[.*?\]\(.*?\)/g,          // 8. 链接
            /(https?:\/\/[^\s]+)/g      // 9. 纯文本 URL
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

    /**
     * 应用到编辑器
     */
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

    // --- UI 注入逻辑 ---
    let observer = null;
    const CUSTOM_BTN_CLASS = 'ns-pangu-btn';

    function injectFeatures() {
        const cfg = getConfig();
        const candidates = document.querySelectorAll('button, [role="button"]');
        
        for (let btn of candidates) {
            const text = btn.innerText.trim();
            if (['发布帖子', '发布评论', '编辑帖子', '编辑评论'].includes(text) && !btn.classList.contains('ns-pangu-bound')) {
                
                btn.classList.add('ns-pangu-bound');
                const container = btn.parentElement;

                // 1. 注入手动按钮
                if (cfg.showEditorBtn && container && !container.querySelector(`.${CUSTOM_BTN_CLASS}`)) {
                    const panguBtn = document.createElement('button');
                    panguBtn.className = `${CUSTOM_BTN_CLASS} ${btn.className}`;
                    panguBtn.type = 'button';
                    panguBtn.innerText = '排版';
                    panguBtn.style.cssText = `margin-right: 8px !important; background: transparent !important; color: #6b7280 !important; border: 1px solid #d1d5db !important; padding: 0 12px !important;`;
                    
                    panguBtn.onclick = (e) => {
                        e.preventDefault();
                        const changed = applyPanguSpacing();
                        panguBtn.innerText = changed ? '搞定' : '完美';
                        setTimeout(() => { panguBtn.innerText = '排版'; }, 1500);
                    };
                    container.insertBefore(panguBtn, btn);
                }

                // 2. 自动排版拦截
                if (cfg.autoFormatOnSubmit) {
                    btn.addEventListener('click', () => {
                        applyPanguSpacing();
                    }, true);
                }
            }
        }
    }

    function startService() {
        loadPanguLib().then(() => {
            if (observer) observer.disconnect();
            observer = new MutationObserver(injectFeatures);
            observer.observe(document.body, { childList: true, subtree: true });
            injectFeatures();
        });
    }

    function stopService() {
        if (observer) observer.disconnect();
        document.querySelectorAll(`.${CUSTOM_BTN_CLASS}`).forEach(b => b.remove());
        document.querySelectorAll('.ns-pangu-bound').forEach(b => b.classList.remove('ns-pangu-bound'));
    }

    // --- 注册基座 ---

})();