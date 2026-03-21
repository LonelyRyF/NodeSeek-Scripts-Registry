(function () {
    'use strict';

    const API = window.NodeSeekUI;

    const MODULE_ID = 'ns_sticker';
    const MODULE_NAME = '自定义表情包';
    const MODULE_VERSION = '16.1.1';

    const DEFAULT_GROUPS = [
        {
            tabName: "我的收藏",
            stickers: [
                { name: "滑稽", url: "https://i.imgur.com/example_funny.png" },
                { name: "赞",   url: "https://i.imgur.com/example_like.png" }
            ]
        }
    ];

    let stickerObserver = null;

    // --- 存储桥接 ---
    const loadGroups = () => {
        if (!API) return DEFAULT_GROUPS;
        const raw = API.load(MODULE_ID, 'groups', null);
        if (!raw) return DEFAULT_GROUPS;
        try { 
            return typeof raw === 'string' ? JSON.parse(raw) : raw; 
        } catch { 
            return DEFAULT_GROUPS; 
        }
    };

    const saveGroups = (groups) => {
        if (API) API.store(MODULE_ID, 'groups', groups);
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
        if (document.getElementById('ns-sticker-style-fix')) return;
        const style = document.createElement('style');
        style.id = 'ns-sticker-style-fix';
        style.textContent = `.expression { flex-wrap: wrap !important; height: auto !important; white-space: normal !important; overflow-x: visible !important; row-gap: 8px; } .exp-item { margin-bottom: 2px !important; flex-shrink: 0 !important; } @media (max-width: 600px) { .expression { max-height: 120px; overflow-y: auto !important; } }`;
        document.head.appendChild(style);
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

        // 重置注册表
        REGISTRY.tabs = [];
        REGISTRY.panels = [];

        // 拦截原生 Tab 点击
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
                    Array.from(tabBar.children).forEach(el => {
                        if (!el.classList.contains(SELECTORS.customClass)) el.classList.remove('current-group');
                    });

                    // 懒加载填充
                    if (panel.dataset.loaded === 'false') {
                        panel.dataset.loaded = 'true';
                        const expandedStickers = [];
                        group.stickers.forEach(s => {
                            if (typeof s === 'object' && s.mode === 'sequence') expandedStickers.push(...expandSequence(s));
                            else expandedStickers.push(s);
                        });

                        expandedStickers.forEach(s => {
                            const item = normalizeSticker(s);
                            if (!item) return;
                            const img = document.createElement('img');
                            img.src = item.url;
                            img.className = 'sticker';
                            img.title = item.code;
                            img.style.cssText = 'cursor: pointer; -webkit-tap-highlight-color: transparent;';
                            img.onclick = (e) => { e.stopPropagation(); e.preventDefault(); insertSticker(item.code); };
                            if (vueId) img.setAttribute(vueId, '');
                            panel.appendChild(img);
                        });
                    }
                }
            };

            tabBar.appendChild(tab);
            REGISTRY.tabs.push(tab);
        });

        // 设置快捷按钮
        if (!document.getElementById('ns-sticker-settings-btn')) {
            const btn = document.createElement('div');
            btn.id = 'ns-sticker-settings-btn';
            btn.className = 'exp-item';
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
            btn.style.cssText = 'display: flex; align-items: center; justify-content: center; opacity: 0.5; margin-left: auto; cursor: pointer;';
            btn.onclick = (e) => { e.stopPropagation(); location.hash = '#ns_sticker'; };
            tabBar.appendChild(btn);
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
    }

    // =================================================================
    // 设置面板逻辑 (适配基座 UI)
    // =================================================================
    function renderSettings(container, base) {
        const { UI } = base;
        container.innerHTML = '';
        const fieldset = document.createElement('fieldset');
        fieldset.innerHTML = `<h2 style="margin: 10px 0; border-bottom: 2px solid #2ea44f; padding-bottom: 8px;">${MODULE_NAME}</h2>`;
        container.appendChild(fieldset);

        const editorRoot = UI._el('div');
        fieldset.appendChild(editorRoot);

        let groups = JSON.parse(JSON.stringify(loadGroups()));

        // 样式微调
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
                    row.append(UI._el('span', { text: '序', style: 'font-size:10px;color:#2ea44f' }), baseUrl, start, UI._el('span',{text:'~'}), end, del);
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
                btnStyle(UI.createButton({ text: '+ 普通', onClick: () => { groups[gi].stickers.push({name:'', url:''}); rebuildCardBody(gi, cardBody); } })),
                btnStyle(UI.createButton({ text: '+ 序列', onClick: () => { groups[gi].stickers.push({mode:'sequence', baseUrl:'', start:1, end:10, suffix:'.png', pad:0}); rebuildCardBody(gi, cardBody); } }))
            );
            cardBody.appendChild(footer);
        }

        const render = () => {
            editorRoot.innerHTML = '';
            groups.forEach((g, gi) => {
                const card = UI._el('div', { style: 'border:1px solid var(--border-color); border-radius:6px; margin-bottom:10px; padding:10px; background:var(--glass-color)' });
                const head = UI._el('div', { style: 'display:flex; gap:8px; align-items:center; margin-bottom:8px' });
                head.append(
                    compact(UI.createInput({ value: g.tabName, onChange: v => g.tabName = v })),
                    btnStyle(UI.createButton({ text: '删除分组', type: 'danger', onClick: () => { groups.splice(gi, 1); render(); } }))
                );
                const body = UI._el('div');
                rebuildCardBody(gi, body);
                card.append(head, body);
                editorRoot.appendChild(card);
            });
            
            const bottom = UI._el('div', { style: 'margin-top:15px; display:flex; gap:10px' });
            bottom.append(
                UI.createButton({ text: '+ 添加分组', onClick: () => { groups.push({tabName:'新分组', stickers:[]}); render(); } }),
                UI.createButton({ text: '保存配置', type: 'primary', onClick: () => { saveGroups(groups); base.showAlert('配置已保存，刷新生效。'); } })
            );
            editorRoot.appendChild(bottom);
        };
        render();
    }

    // =================================================================
    // 启动与注册
    // =================================================================

})();