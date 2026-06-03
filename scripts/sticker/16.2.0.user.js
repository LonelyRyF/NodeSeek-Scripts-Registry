(function () {
    'use strict';

    const API = window.NodeSeekUI;
    const MODULE_ID = 'sticker';
    const MODULE_NAME = '自定义表情包';
    const MODULE_VERSION = '16.2.0';
    const STYLE_ID = MODULE_ID + '_css';
    const STICKER_MARK = 'ns-stickers';

    const DEFAULT_GROUPS = [
        {
            tabName: "我的收藏",
            stickers: [
                { name: "滑稽", url: "https://i.imgur.com/example_funny.png" },
                { name: "赞",   url: "https://i.imgur.com/example_like.png" }
            ]
        }
    ];

    const STICKER_TEMPLATE = [
        {
            key: 'mode',
            type: 'select',
            label: '模式',
            default: 'single',
            options: [
                { label: '普通', value: 'single' },
                { label: '序列', value: 'sequence' }
            ]
        },
        { key: 'name', type: 'text', label: '名称', default: '', displayable: (data) => data.mode !== 'sequence' },
        { key: 'url', type: 'text', label: '图片 URL', default: '', displayable: (data) => data.mode !== 'sequence' },
        { key: 'baseUrl', type: 'text', label: '序列 baseUrl', default: '', displayable: (data) => data.mode === 'sequence' },
        { key: 'start', type: 'number', label: '序列起始', default: 1, displayable: (data) => data.mode === 'sequence' },
        { key: 'end', type: 'number', label: '序列结束', default: 10, displayable: (data) => data.mode === 'sequence' },
        { key: 'suffix', type: 'text', label: '序列后缀', default: '.png', displayable: (data) => data.mode === 'sequence' },
        { key: 'pad', type: 'number', label: '补零位数', default: 0, displayable: (data) => data.mode === 'sequence' }
    ];

    const GROUP_TEMPLATE = [
        { key: 'tabName', type: 'text', label: '分组名', default: '新分组' },
        {
            key: 'stickers',
            type: 'object_list',
            label: '表情列表',
            summaryKey: 'name',
            placeholder: '添加表情',
            default: [],
            template: STICKER_TEMPLATE,
            bulkAdd: {
                label: '批量添加',
                placeholder: '每行一条：\nhttps://example.com/a.png\n![名称](https://example.com/b.png)',
                hint: '支持纯图片链接或 Markdown 图片语法，每行一条。重复 URL 会自动跳过。',
                parse: (text, existingList) => parseBulkStickers(text, existingList)
            }
        }
    ];

    const SCHEMA = [
        {
            type: 'section',
            title: '表情分组配置',
            fields: [
                {
                    key: 'groups',
                    type: 'object_list',
                    label: '分组列表',
                    description: '普通表情填写名称和图片 URL。序列表情将按 baseUrl + 编号 + suffix 自动展开。',
                    summaryKey: 'tabName',
                    placeholder: '添加分组',
                    default: DEFAULT_GROUPS,
                    template: GROUP_TEMPLATE
                },
                {
                    type: 'info',
                    text: '支持导入旧版 JSON。字符串会自动转为普通表情，序列对象会保留为序列表情。',
                    severity: 'info'
                },
                {
                    type: 'button',
                    label: '导出 JSON',
                    onClick: (data) => exportGroups(data?.groups)
                },
                {
                    type: 'button',
                    label: '导入 JSON',
                    onClick: (data, onChange) => importGroups(data, onChange)
                }
            ]
        }
    ];

    const CONFIG_FIELDS = [
        {
            key: 'groups',
            default: DEFAULT_GROUPS
        }
    ];

    let stickerObserver = null;

    const SELECTORS = { tabBar: '.expression', contentBox: '.exp-container', tabItem: '.exp-item', customClass: 'ns-custom-element' };
    const REGISTRY = { tabs: [], panels: [], nativePanel: null, activeCustomIndex: -1 };

    // --- 存储桥接 ---
    const loadGroups = () => {
        const config = API.getConfig(MODULE_ID, CONFIG_FIELDS);
        const groups = config?.groups;
        return Array.isArray(groups) && groups.length ? groups : DEFAULT_GROUPS;
    };

    function saveGroupsToConfig(groups, currentConfig) {
        const nextConfig = { ...(currentConfig || {}), groups };
        API.store(MODULE_ID, 'config', nextConfig);
        stopService();
        startService();
        return nextConfig;
    }

    function toExportSticker(sticker) {
        if (!sticker || typeof sticker !== 'object') return null;
        if (sticker.mode === 'sequence' || sticker.baseUrl) {
            return {
                mode: 'sequence',
                baseUrl: sticker.baseUrl || '',
                start: Number.isFinite(Number(sticker.start)) ? Number(sticker.start) : 1,
                end: Number.isFinite(Number(sticker.end)) ? Number(sticker.end) : 10,
                suffix: sticker.suffix || '.png',
                pad: Number.isFinite(Number(sticker.pad)) ? Number(sticker.pad) : 0
            };
        }
        if (sticker.url) {
            if (sticker.name) return { name: sticker.name, url: sticker.url };
            return sticker.url;
        }
        return null;
    }

    function toExportGroups(groups) {
        return normalizeGroupList(groups).map(group => ({
            tabName: group.tabName,
            stickers: group.stickers.map(toExportSticker).filter(Boolean)
        }));
    }

    function normalizeConfigSticker(sticker) {
        if (typeof sticker === 'string') {
            return { mode: 'single', name: '', url: sticker };
        }
        if (!sticker || typeof sticker !== 'object') return null;
        if (sticker.mode === 'sequence' || sticker.baseUrl) {
            return {
                mode: 'sequence',
                name: sticker.name || '',
                url: '',
                baseUrl: sticker.baseUrl || '',
                start: Number.isFinite(Number(sticker.start)) ? Number(sticker.start) : 1,
                end: Number.isFinite(Number(sticker.end)) ? Number(sticker.end) : 10,
                suffix: sticker.suffix || '.png',
                pad: Number.isFinite(Number(sticker.pad)) ? Number(sticker.pad) : 0
            };
        }
        if (sticker.url) {
            return {
                mode: 'single',
                name: sticker.name || '',
                url: sticker.url,
                baseUrl: '',
                start: 1,
                end: 10,
                suffix: '.png',
                pad: 0
            };
        }
        return null;
    }

    function normalizeGroupList(groups) {
        if (!Array.isArray(groups)) return [];
        return groups.map((group, index) => ({
            tabName: group?.tabName || `分组 ${index + 1}`,
            stickers: Array.isArray(group?.stickers)
                ? group.stickers.map(normalizeConfigSticker).filter(Boolean)
                : []
        }));
    }

    function exportGroups(groups) {
        const exported = toExportGroups(groups && groups.length ? groups : loadGroups());
        const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'nodeseek_stickers.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        API.showAlert('已导出 JSON。');
    }

    function importGroups(currentData, onChange) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.onchange = async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                const groups = normalizeGroupList(parsed);
                if (!groups.length) throw new Error('JSON 中没有可导入的分组');
                saveGroupsToConfig(groups, currentData);
                if (typeof onChange === 'function') onChange('groups', groups);
                API.showAlert(`导入成功，共 ${groups.length} 个分组。`);
            } catch (error) {
                API.showAlert(`导入失败：${error.message}`);
            }
        };
        input.click();
    }

    // --- 工具：展开序列 ---
    function expandSequence(s) {
        const list = [];
        for (let i = s.start; i <= s.end; i++)
            list.push({ name: `icon_${i}`, url: `${s.baseUrl}${i.toString().padStart(s.pad || 0, '0')}${s.suffix || '.png'}` });
        return list;
    }

    // --- 工具：批量解析粘贴文本 ---
    // 支持两种格式（按行）：
    //   1. 纯图片链接：https://example.com/a.png
    //   2. Markdown 图片：![名称](https://example.com/a.png)
    // 对 url 去重（与 existingList 已有的 url 比较，且本次内部也去重）。
    // 返回 { items, added, skipped } 供基座统计提示。
    function parseBulkStickers(text, existingList) {
        const lines = String(text || '').split(/\r?\n/);
        const seen = new Set();
        (Array.isArray(existingList) ? existingList : []).forEach(s => {
            if (s && typeof s === 'object' && s.url) seen.add(s.url);
        });

        const items = [];
        let skipped = 0;

        lines.forEach(raw => {
            const line = raw.trim();
            if (!line) return;

            let name = '';
            let url = '';

            const md = line.match(/^!\[(.*?)\]\((.+?)\)$/);
            if (md) {
                name = md[1].trim();
                url = md[2].split(/\s+/)[0].trim();
            } else if (/^https?:\/\/\S+$/i.test(line)) {
                url = line;
            } else {
                skipped++;
                return;
            }

            if (!url || seen.has(url)) {
                skipped++;
                return;
            }
            seen.add(url);

            items.push({
                mode: 'single',
                name,
                url,
                baseUrl: '',
                start: 1,
                end: 10,
                suffix: '.png',
                pad: 0
            });
        });

        return { items, added: items.length, skipped };
    }

    // --- 样式注入 ---
    function injectStyles() {
        API.addStyle(`
            .expression { 
                flex-wrap: wrap !important; 
                height: auto !important; 
                white-space: normal !important; 
                overflow-x: visible !important; 
                row-gap: 8px; 
            } 
            .exp-item { 
                margin-bottom: 2px !important; 
                flex-shrink: 0 !important; 
            } 
            @media (max-width: 600px) { 
                .expression { 
                    max-height: 120px; 
                    overflow-y: auto !important; 
                } 
            }
        `, STYLE_ID);
    }

    function removeStyles() {
        API.removeStyle(STYLE_ID);
    }

    // --- 核心功能 ---
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
        if (typeof item === 'object' && item.url) return { url: item.url, code: `![${item.name || ''}](${item.url} "${STICKER_MARK}")` };
        if (typeof item === 'string') {
            const m = item.match(/!\[(.*?)\]\((.*?)\)/);
            return m ? { url: m[2].split(/\s+"/)[0], code: item.includes(`"${STICKER_MARK}"`) ? item : `![${m[1] || ''}](${m[2]} "${STICKER_MARK}")` } : { url: item, code: `![](${item} "${STICKER_MARK}")` };
        }
        return null;
    }

    const RENDERED_SELECTOR = `.post-content img[title="${STICKER_MARK}"]`;

    function markRenderedStickers(root) {
        (root || document).querySelectorAll(RENDERED_SELECTOR).forEach(img => {
            img.classList.add('sticker');
        });
    }

    // 只处理单个新增节点（含其自身与子树），避免每次 mutation 全文档扫描。
    function markStickersUnder(node) {
        if (!node || node.nodeType !== 1) return;
        if (node.matches(RENDERED_SELECTOR)) node.classList.add('sticker');
        node.querySelectorAll(RENDERED_SELECTOR).forEach(img => {
            img.classList.add('sticker');
        });
    }

    function renderStickerBatch(panel, stickers, vueId, startIndex) {
        const batchSize = 30;
        const endIndex = Math.min(startIndex + batchSize, stickers.length);
        const fragment = document.createDocumentFragment();

        for (let i = startIndex; i < endIndex; i++) {
            const item = normalizeSticker(stickers[i]);
            if (!item) continue;
            const img = document.createElement('img');
            img.src = item.url;
            img.className = 'sticker';
            img.title = item.code;
            img.loading = 'lazy';
            img.decoding = 'async';
            img.style.cssText = 'cursor: pointer; -webkit-tap-highlight-color: transparent;';
            img.onclick = (e) => { e.stopPropagation(); e.preventDefault(); insertSticker(item.code); };
            if (vueId) img.setAttribute(vueId, '');
            fragment.appendChild(img);
        }

        panel.appendChild(fragment);

        if (endIndex < stickers.length) {
            window.requestAnimationFrame(() => renderStickerBatch(panel, stickers, vueId, endIndex));
        }
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
                    Array.from(tabBar.children).forEach(el => {
                        if (!el.classList.contains(SELECTORS.customClass)) el.classList.remove('current-group');
                    });

                    if (panel.dataset.loaded === 'false') {
                        panel.dataset.loaded = 'true';
                        const expandedStickers = [];
                        group.stickers.forEach(s => {
                            if (typeof s === 'object' && s.mode === 'sequence') expandedStickers.push(...expandSequence(s));
                            else expandedStickers.push(s);
                        });
                        renderStickerBatch(panel, expandedStickers, vueId, 0);
                    }
                }
            };

            tabBar.appendChild(tab);
            REGISTRY.tabs.push(tab);
        });

        if (!document.getElementById('ns-sticker-settings-btn')) {
            const btn = document.createElement('div');
            btn.id = 'ns-sticker-settings-btn';
            btn.className = 'exp-item';
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
            btn.style.cssText = 'display: flex; align-items: center; justify-content: center; opacity: 0.5; margin-left: auto; cursor: pointer;';
            btn.onclick = (e) => { e.stopPropagation(); API.openPanel('/manager'); };
            tabBar.appendChild(btn);
        }
    }

    function startService() {
        if (stickerObserver) stickerObserver.disconnect();
        stickerObserver = new MutationObserver(() => {
            const tabBar = document.querySelector(SELECTORS.tabBar);
            if (tabBar && !tabBar.querySelector(`.${SELECTORS.customClass}`)) runInfection();
            markRenderedStickers();
        });
        stickerObserver.observe(document.body, { childList: true, subtree: true });
        runInfection();
        markRenderedStickers();
    }

    function stopService() {
        if (stickerObserver) {
            stickerObserver.disconnect();
            stickerObserver = null;
        }
        document.querySelectorAll(`.${SELECTORS.customClass}`).forEach(el => el.remove());
        document.getElementById('ns-sticker-settings-btn')?.remove();
        removeStyles();
    }

    // --- 注册基座 ---
    API.register({
        id: MODULE_ID,
        name: MODULE_NAME,
        version: MODULE_VERSION,
        description: '在回复框中插入自定义表情包，支持多分组与序列模式。',
        settings: SCHEMA,
        defaults: { groups: DEFAULT_GROUPS },
        execute: function() {
            startService();
        },
        onToggle: function(enabled) {
            if (enabled) {
                startService();
            } else {
                stopService();
            }
        },

        onConfigChange: function() {
            stopService();
            startService();
        }
    });

})();
