(function () {
    'use strict';

    const API = window.NodeSeekUI;
    const MODULE_ID = 'ns_sticker';
    const MODULE_NAME = '自定义表情包';
    const MODULE_VERSION = '16.2.0';
    const STYLE_ID = 'ns_sticker_css';

    const DEFAULT_GROUPS = [
        {
            tabName: '我的收藏',
            stickers: [
                { name: '滑稽', url: 'https://i.imgur.com/example_funny.png' },
                { name: '赞',   url: 'https://i.imgur.com/example_like.png' }
            ]
        }
    ];

    let stickerObserver = null;

    // --- 存储桥接 ---
    const loadGroups = () => {
        const raw = API.load(MODULE_ID, 'groups', null);
        if (!raw) return DEFAULT_GROUPS;
        try {
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
            return DEFAULT_GROUPS;
        }
    };

    const saveGroups = (groups) => {
        API.store(MODULE_ID, 'groups', groups);
    };

    // --- 工具：展开序列 ---
    function expandSequence(s) {
        const list = [];
        for (let i = s.start; i <= s.end; i++)
            list.push({ name: `icon_${i}`, url: `${s.baseUrl}${i.toString().padStart(s.pad || 0, '0')}${s.suffix || '.png'}` });
        return list;
    }

    // =================================================================
    // 功能主体：表情注入
    // =================================================================
    const SELECTORS = { tabBar: '.expression', contentBox: '.exp-container', tabItem: '.exp-item', customClass: 'ns-custom-element' };
    const REGISTRY = { tabs: [], panels: [], nativePanel: null, activeCustomIndex: -1 };

    function injectStyles() {
        API.addStyle(
            `.expression { flex-wrap: wrap !important; height: auto !important; white-space: normal !important; overflow-x: visible !important; row-gap: 8px; } .exp-item { margin-bottom: 2px !important; flex-shrink: 0 !important; } @media (max-width: 600px) { .expression { max-height: 120px; overflow-y: auto !important; } }`,
            STYLE_ID
        );
    }

    function insertSticker(text) {
        const isMobile = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const cm = document.querySelector('.CodeMirror')?.CodeMirror;
        if (cm) {
            const doc = cm.getDoc();
            let cursor = doc.getCursor();
            if (cursor.line === 0 && cursor.ch === 0 && doc.getValue().length > 0 && !cm.hasFocus()) {
                const last = doc.lineCount() - 1;
                cursor = { line: last, ch: doc.getLine(last).length };
            }
            doc.replaceRange(` ${text} `, cursor);
            if (!isMobile()) cm.focus();
            doc.setCursor({ line: cursor.line, ch: cursor.ch + text.length + 2 });
        } else {
            const ta = document.querySelector('textarea');
            if (ta) {
                if (ta.selectionStart === 0 && ta.selectionEnd === 0 && ta.value.length > 0) ta.selectionStart = ta.selectionEnd = ta.value.length;
                ta.setRangeText(` ${text} `, ta.selectionStart, ta.selectionEnd, 'end');
                if (!isMobile()) ta.focus();
            }
        }
    }

    function normalizeSticker(item) {
        if (typeof item === 'object' && item.url) return { url: item.url, code: `![${item.name || ''}](${item.url})` };
        if (typeof item === 'string') {
            const m = item.match(/!\[(.*?)\]\((.*?)\)/);
            return m ? { url: m[2], code: item } : { url: item, code: `![](${item})` };
        }
        return null;
    }

    function runInfection() {
        const tabBar = document.querySelector(SELECTORS.tabBar);
        const nativeContentBox = document.querySelector(SELECTORS.contentBox);
        if (!tabBar || !nativeContentBox || tabBar.querySelector(`.${SELECTORS.customClass}`)) return;

        injectStyles();
        const groups = loadGroups();
        REGISTRY.nativePanel = nativeContentBox;
        const vueId = nativeContentBox.getAttributeNames().find(n => n.startsWith('data-v-'));
        const referenceTab = tabBar.querySelector(SELECTORS.tabItem);

        REGISTRY.tabs = [];
        REGISTRY.panels = [];

        Array.from(tabBar.children).forEach(t => {
            if (t.id !== 'ns-sticker-settings-btn') {
                t.addEventListener('click', () => {
                    REGISTRY.activeCustomIndex = -1;
                    REGISTRY.panels.forEach(p => { p.style.display = 'none'; p.classList.remove('open'); });
                    if (REGISTRY.nativePanel) { REGISTRY.nativePanel.style.display = ''; REGISTRY.nativePanel.classList.add('open'); }
                    REGISTRY.tabs.forEach(t => t.classList.remove('current-group'));
                });
            }
        });

        groups.forEach((group, idx) => {
            const panel = document.createElement('div');
            panel.className = `exp-container ${SELECTORS.customClass}`;
            panel.style.display = 'none';
            panel.dataset.loaded = 'false';
            if (vueId) panel.setAttribute(vueId, '');
            nativeContentBox.parentNode.insertBefore(panel, nativeContentBox.nextSibling);
            REGISTRY.panels.push(panel);

            const tab = referenceTab.cloneNode(true);
            tab.innerText = group.tabName;
            tab.classList.remove('current-group');
            tab.classList.add(SELECTORS.customClass);
            tab.removeAttribute('id');

            tab.onclick = (e) => {
                e.stopPropagation();
                if (REGISTRY.activeCustomIndex === idx) {
                    REGISTRY.activeCustomIndex = -1;
                    REGISTRY.panels.forEach(p => { p.style.display = 'none'; p.classList.remove('open'); });
                    REGISTRY.nativePanel.style.display = '';
                    REGISTRY.nativePanel.classList.remove('open');
                    REGISTRY.tabs.forEach(t => t.classList.remove('current-group'));
                } else {
                    REGISTRY.activeCustomIndex = idx;
                    REGISTRY.nativePanel.style.display = 'none';
                    REGISTRY.nativePanel.classList.remove('open');
                    REGISTRY.panels.forEach((p, i) => {
                        p.style.display = i === idx ? 'block' : 'none';
                        p.classList.toggle('open', i === idx);
                    });
                    REGISTRY.tabs.forEach((t, i) => t.classList.toggle('current-group', i === idx));

                    if (panel.dataset.loaded === 'false') {
                        panel.dataset.loaded = 'true';
                        const allStickers = [];
                        group.stickers.forEach(s => {
                            if (s && s.mode === 'sequence') {
                                expandSequence(s).forEach(item => allStickers.push(item));
                            } else {
                                const n = normalizeSticker(s);
                                if (n) allStickers.push(n);
                            }
                        });
                        allStickers.forEach(({ url, code }) => {
                            const item = document.createElement('div');
                            item.className = `exp-item ${SELECTORS.customClass}`;
                            if (vueId) item.setAttribute(vueId, '');
                            const img = document.createElement('img');
                            img.src = url;
                            img.style.cssText = 'width:40px;height:40px;object-fit:contain;cursor:pointer;border-radius:4px;';
                            img.title = code;
                            img.onclick = () => insertSticker(code);
                            item.appendChild(img);
                            panel.appendChild(item);
                        });
                    }
                }
            };

            tabBar.appendChild(tab);
            REGISTRY.tabs.push(tab);
        });

        // 设置按钮
        if (!document.getElementById('ns-sticker-settings-btn')) {
            const settingsBtn = document.createElement('div');
            settingsBtn.id = 'ns-sticker-settings-btn';
            settingsBtn.className = SELECTORS.tabItem;
            settingsBtn.innerText = '管理';
            settingsBtn.style.cssText = 'color: #888; font-size: 11px;';
            if (vueId) settingsBtn.setAttribute(vueId, '');
            settingsBtn.onclick = (e) => {
                e.stopPropagation();
                window.location.hash = '#ns_sticker';
            };
            tabBar.appendChild(settingsBtn);
        }
    }

    function startService() {
        if (stickerObserver) stickerObserver.disconnect();
        stickerObserver = new MutationObserver(() => {
            const tabBar = document.querySelector(SELECTORS.tabBar);
            if (tabBar && !tabBar.querySelector(`.${SELECTORS.customClass}`)) runInfection();
        });
        stickerObserver.observe(document.body, { childList: true, subtree: true });
        runInfection();
    }

    function stopService() {
        if (stickerObserver) stickerObserver.disconnect();
        document.querySelectorAll(`.${SELECTORS.customClass}`).forEach(el => el.remove());
        document.getElementById('ns-sticker-settings-btn')?.remove();
        API.removeStyle(STYLE_ID);
    }

    // =================================================================
    // 设置面板逻辑
    // =================================================================
    function renderSettings(container) {
        const { UI } = API;
        container.innerHTML = '';
        const fieldset = document.createElement('fieldset');
        fieldset.innerHTML = `<h2 style="margin: 10px 0; border-bottom: 2px solid #2ea44f; padding-bottom: 8px;">${MODULE_NAME}</h2>`;
        container.appendChild(fieldset);

        const editorRoot = UI._el('div');
        fieldset.appendChild(editorRoot);

        let groups = JSON.parse(JSON.stringify(loadGroups()));

        const compact = (el) => { el.style.padding = '3px 7px'; el.style.fontSize = '12px'; el.style.height = '28px'; return el; };
        const btnStyle = (el) => { el.style.padding = '3px 8px'; el.style.fontSize = '12px'; el.style.lineHeight = 'normal'; return el; };

        function rebuildCardBody(gi, cardBody) {
            cardBody.innerHTML = '';
            groups[gi].stickers.forEach((s, si) => {
                const isSeq = s && s.mode === 'sequence';
                const row = UI._el('div', { style: 'display: flex; gap: 4px; align-items: center; margin-bottom: 4px; flex-wrap: wrap;' });
                if (isSeq) {
                    const baseUrl = compact(UI.createInput({ value: s.baseUrl, placeholder: 'baseUrl', onChange: v => s.baseUrl = v }));
                    const start = compact(UI.createNumber({ value: s.start, onChange: v => s.start = v })); start.style.width = '50px';
                    const end = compact(UI.createNumber({ value: s.end, onChange: v => s.end = v })); end.style.width = '50px';
                    const del = btnStyle(UI.createButton({ text: '✕', type: 'danger', onClick: () => { groups[gi].stickers.splice(si, 1); rebuildCardBody(gi, cardBody); } }));
                    row.append(UI._el('span', { text: '序', style: 'font-size:10px;color:#2ea44f' }), baseUrl, start, UI._el('span', { text: '~' }), end, del);
                } else {
                    const name = compact(UI.createInput({ value: s.name, placeholder: '名', onChange: v => s.name = v })); name.style.width = '70px';
                    const url = compact(UI.createInput({ value: s.url, placeholder: 'URL', onChange: v => s.url = v }));
                    const del = btnStyle(UI.createButton({ text: '✕', type: 'danger', onClick: () => { groups[gi].stickers.splice(si, 1); rebuildCardBody(gi, cardBody); } }));
                    row.append(name, url, del);
                }
                cardBody.appendChild(row);
            });
            const footer = UI._el('div', { style: 'display:flex; gap:8px; margin-top:8px' });
            footer.append(
                btnStyle(UI.createButton({ text: '+ 普通', onClick: () => { groups[gi].stickers.push({ name: '', url: '' }); rebuildCardBody(gi, cardBody); } })),
                btnStyle(UI.createButton({ text: '+ 序列', onClick: () => { groups[gi].stickers.push({ mode: 'sequence', baseUrl: '', start: 1, end: 10, suffix: '.png', pad: 0 }); rebuildCardBody(gi, cardBody); } }))
            );
            cardBody.appendChild(footer);
        }

        const render = () => {
            editorRoot.innerHTML = '';
            groups.forEach((g, gi) => {
                const card = UI._el('div', { style: 'border:1px solid var(--border-color);border-radius:6px;padding:10px;margin-bottom:12px;' });
                const head = UI._el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:8px;' });
                const nameInput = compact(UI.createInput({ value: g.tabName, onChange: v => g.tabName = v }));
                nameInput.style.width = '120px';
                head.append(
                    nameInput,
                    btnStyle(UI.createButton({ text: '删除分组', type: 'danger', onClick: () => { groups.splice(gi, 1); render(); } }))
                );
                const body = UI._el('div');
                rebuildCardBody(gi, body);
                card.append(head, body);
                editorRoot.appendChild(card);
            });
            const bottom = UI._el('div', { style: 'margin-top:15px; display:flex; gap:10px' });
            bottom.append(
                UI.createButton({ text: '+ 添加分组', onClick: () => { groups.push({ tabName: '新分组', stickers: [] }); render(); } }),
                UI.createButton({ text: '保存配置', type: 'primary', onClick: () => { saveGroups(groups); API.showAlert('配置已保存，刷新生效。'); } })
            );
            editorRoot.appendChild(bottom);
        };
        render();
    }

    // =================================================================
    // 启动与注册
    // =================================================================
    API.register({
        id: MODULE_ID,
        name: MODULE_NAME,
        version: MODULE_VERSION,
        description: '在回复框中插入自定义表情包，支持多分组与序列模式。',
        execute: function() {
            startService();
        },
        onToggle: function(enabled) {
            if (enabled) startService();
            else stopService();
        },
        render: function(c) { return renderSettings(c); }
    });

})();
