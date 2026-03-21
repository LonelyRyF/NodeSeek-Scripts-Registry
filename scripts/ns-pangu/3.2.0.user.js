(function() {
    'use strict';

    const API = window.NodeSeekUI;
    const MODULE_ID = 'ns_pangu';
    const MODULE_NAME = '盘古排版助手';
    const MODULE_VERSION = '3.2.0';
    const MODULE_DESC = '自动在中英文之间添加空格。采用提取-占位-还原架构，完美保护 Markdown 语法及 @提及。';

    const SCHEMA = [
        { key: 'autoFormatOnSubmit', type: 'switch', label: '发布时自动排版', description: '点击发布按钮时，自动对内容进行格式化', inlineLabel: '启用', default: true },
        { key: 'showEditorBtn', type: 'switch', label: '显示快捷排版按钮', description: '在编辑器发布按钮旁边显示一个手动的排版按钮', inlineLabel: '启用', default: true }
    ];

    let panguLoaded = false;

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
            spacedText = spacedText.replace(`NSPGMACROX${i}X`, match);
        });
        return spacedText;
    }

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

    let observer = null;
    const CUSTOM_BTN_CLASS = 'ns-pangu-btn';

    function injectFeatures() {
        const cfg = API.getConfig(MODULE_ID, SCHEMA);
        const candidates = document.querySelectorAll('button, [role="button"]');
        for (let btn of candidates) {
            const text = btn.innerText.trim();
            if (['发布帖子', '发布评论', '编辑帖子', '编辑评论'].includes(text) && !btn.classList.contains('ns-pangu-bound')) {
                btn.classList.add('ns-pangu-bound');
                const container = btn.parentElement;
                if (cfg.showEditorBtn && container && !container.querySelector(`.${CUSTOM_BTN_CLASS}`)) {
                    const panguBtn = document.createElement('button');
                    panguBtn.className = `${CUSTOM_BTN_CLASS} ${btn.className}`;
                    panguBtn.type = 'button';
                    panguBtn.innerText = '排版';
                    panguBtn.style.cssText = 'margin-right: 8px !important; background: transparent !important; color: #6b7280 !important; border: 1px solid #d1d5db !important; padding: 0 12px !important;';
                    panguBtn.onclick = (e) => {
                        e.preventDefault();
                        const changed = applyPanguSpacing();
                        panguBtn.innerText = changed ? '搞定' : '完美';
                        setTimeout(() => { panguBtn.innerText = '排版'; }, 1500);
                    };
                    container.insertBefore(panguBtn, btn);
                }
                if (cfg.autoFormatOnSubmit) {
                    btn.addEventListener('click', () => { applyPanguSpacing(); }, true);
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

    API.register({
        id: MODULE_ID,
        name: MODULE_NAME,
        version: MODULE_VERSION,
        description: MODULE_DESC,
        execute() {
            startService();
        },
        onToggle(enabled) {
            if (enabled) startService();
            else stopService();
        },
        render(container) {
            const cfg = API.getConfig(MODULE_ID, SCHEMA);
            container.innerHTML = '';
            const fieldset = document.createElement('fieldset');
            fieldset.innerHTML = `<h2 style="margin: 10px 0; border-bottom: 2px solid #2ea44f; padding-bottom: 8px;">${MODULE_NAME} 设置</h2>`;
            const form = API.UI.buildConfigForm(SCHEMA, cfg, (data) => {
                API.store(MODULE_ID, 'config', data);
                if (API.isEnabled(MODULE_ID)) startService();
            });
            fieldset.appendChild(form);
            container.appendChild(fieldset);
        }
    });

})();
