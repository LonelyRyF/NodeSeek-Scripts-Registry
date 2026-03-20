// ==UserScript==
// @name         NodeSeek Setting Framework (UI基座)
// @namespace    http://tampermonkey.net/
// @version      4.3
// @description  NodeSeek / DeepFlood 扩展基座。支持沙盒穿透、Schema表单渲染、内置原生 UI 组件库、脚本市场。
// @author       浅霖
// @match        https://www.nodeseek.com/*
// @match        https://www.deepflood.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-start
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    'use strict';

    const _win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (_win.NodeSeekUI) return;

    const _ORIGINAL_HASH = window.location.hash;
    let moduleStates = GM_getValue('ns_module_states', {});

    const REGISTRY_URL = 'https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/registry.json';
    const STORE_PREFIX = 'ns_store_';
    const INSTALLED_PREFIX = 'ns_installed_';

    // ==========================================
    // GM_xmlhttpRequest 封装
    // ==========================================
    function gmFetch(url) {
    return fetch(url + '?t=' + Math.floor(Date.now() / 60000))
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
        });
}

    // ==========================================
    // UI 组件库
    // ==========================================
    const UI = {
        _inputStyle: `width: 100%; padding: 8px 12px; border: 1px solid var(--border-color, #e1e4e8); border-radius: 6px; background-color: var(--glass-color, #fafbfc); color: var(--text-color, #24292e); box-sizing: border-box; font-size: 14px; outline: none; transition: border-color 0.2s, box-shadow 0.2s;`,

        _el(tag, attrs = {}) {
            const el = document.createElement(tag);
            if (attrs.style) el.style.cssText = attrs.style;
            if (attrs.text) el.textContent = attrs.text;
            if (attrs.html) el.innerHTML = attrs.html;
            if (attrs.className) el.className = attrs.className;
            if (attrs.children) attrs.children.forEach(c => c && el.appendChild(c));
            return el;
        },

        _bindFocus(el) {
            el.addEventListener('focus', () => {
                el.style.borderColor = '#0366d6';
                el.style.boxShadow = '0 0 0 3px rgba(3, 102, 214, 0.3)';
            });
            el.addEventListener('blur', () => {
                el.style.borderColor = '';
                el.style.boxShadow = '';
            });
        },

        _createInput(type, attrs = {}) {
            const input = this._el('input', { style: this._inputStyle });
            input.type = type;
            Object.entries(attrs).forEach(([k, v]) => { if (v !== undefined) input[k] = v; });
            this._bindFocus(input);
            return input;
        },

        createInput({ value = '', placeholder = '', onChange }) {
            const input = this._createInput('text', { value, placeholder });
            if (onChange) input.addEventListener('input', (e) => onChange(e.target.value));
            return input;
        },

        createNumber({ value = 0, min, max, step = 1, onChange }) {
            const input = this._createInput('number', { value, min, max, step });
            if (onChange) input.addEventListener('change', (e) => onChange(Number(e.target.value)));
            return input;
        },

        createSelect({ options = [], value, onChange }) {
            const select = this._el('select', { style: this._inputStyle + 'cursor: pointer; appearance: auto;' });
            options.forEach(opt => {
                const isObj = typeof opt === 'object';
                const optVal = isObj ? opt.value : opt;
                const option = this._el('option', { text: isObj ? opt.label : opt });
                option.value = optVal;
                if (String(optVal) === String(value)) option.selected = true;
                select.appendChild(option);
            });
            this._bindFocus(select);
            if (onChange) select.addEventListener('change', (e) => onChange(e.target.value));
            return select;
        },

        createSwitch({ checked = false, label = '', onChange }) {
            const wrapper = this._el('label', {
                style: 'display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 14px; color: var(--text-color);'
            });

            const checkbox = this._el('input', { style: 'display: none;' });
            checkbox.type = 'checkbox';
            checkbox.checked = checked;

            const track = this._el('div', {
                style: `position: relative; width: 50px; height: 22px; border-radius: 11px; transition: background-color 0.3s; background-color: ${checked ? '#2ea44f' : '#bfcbd9'}; flex-shrink: 0;`
            });

            const thumb = this._el('div', {
                style: `position: absolute; top: 3px; width: 16px; height: 16px; border-radius: 100%; background-color: #fff; transition: transform 0.3s; transform: translateX(${checked ? '31px' : '3px'});`
            });

            const labelOn = this._el('span', {
                style: `position: absolute; top: 0; left: 10px; line-height: 22px; font-size: 10px; font-weight: 600; color: #fff; display: ${checked ? 'inline' : 'none'};`,
                text: '是'
            });
            const labelOff = this._el('span', {
                style: `position: absolute; top: 0; right: 10px; line-height: 22px; font-size: 10px; font-weight: 600; color: #fff; display: ${checked ? 'none' : 'inline'};`,
                text: '否'
            });

            track.append(thumb, labelOn, labelOff);

            const update = (val) => {
                track.style.backgroundColor = val ? '#2ea44f' : '#bfcbd9';
                thumb.style.transform = `translateX(${val ? '31px' : '3px'})`;
                labelOn.style.display = val ? 'inline' : 'none';
                labelOff.style.display = val ? 'none' : 'inline';
            };

            checkbox.addEventListener('change', (e) => {
                update(e.target.checked);
                if (onChange) onChange(e.target.checked);
            });

            track.addEventListener('click', (e) => {
                e.preventDefault();
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            });

            wrapper.appendChild(checkbox);
            wrapper.appendChild(track);
            if (label) wrapper.appendChild(this._el('span', { text: label }));
            return wrapper;
        },

        createButton({ text, type = 'default', onClick }) {
            const btn = document.createElement('button');
            btn.className = `btn ns-ui-btn-${type}`;
            let bg = '#fafbfc', color = '#24292e', border = '1px solid var(--border-color, #e1e4e8)';
            if (type === 'primary') { bg = '#2ea44f'; color = '#fff'; border = 'none'; }
            if (type === 'danger')  { bg = '#d73a49'; color = '#fff'; border = 'none'; }
            btn.style.cssText = `background: ${bg}; color: ${color}; border: ${border}; font-size: 14px; padding: 6px 16px; height: auto; line-height: normal; transition: 0.2s;`;
            btn.textContent = text;
            if (onClick) btn.addEventListener('click', (e) => { e.preventDefault(); onClick(e); });
            return btn;
        },

        createFormRow({ label, description, control }) {
            const row = this._el('div', { style: 'margin-bottom: 20px;', children: [
                this._el('div', { style: 'font-weight: 600; margin-bottom: 6px; color: var(--text-color); font-size: 14px;', text: label }),
                ...(description ? [this._el('div', { style: 'font-size: 12px; color: #888; margin-bottom: 8px;', text: description })] : []),
                this._el('div', { children: [control] })
            ]});
            return row;
        },

        createWarningBanner({ message, buttonText, onButtonClick }) {
            const btn = this.createButton({ text: buttonText, type: 'danger', onClick: onButtonClick });
            btn.style.cssText += 'padding: 4px 10px; font-size: 12px; white-space: nowrap; flex-shrink: 0;';
            return this._el('div', {
                style: `background-color: rgba(215, 58, 73, 0.1); border-left: 4px solid #d73a49; padding: 12px 15px; margin-bottom: 20px; border-radius: 0 4px 4px 0; color: #d73a49; font-size: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;`,
                children: [
                    this._el('span', { style: 'flex: 1; min-width: 0;', html: message }),
                    btn
                ]
            });
        },

        createList({ items = [], placeholder = '添加新项...', onChange }) {
            const container = this._el('div', { style: 'border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; background: var(--glass-color);' });
            let currentList = [...items];

            const renderList = () => {
                container.innerHTML = '';
                if (currentList.length > 0) {
                    const listWrapper = this._el('div', { style: 'display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;' });
                    currentList.forEach((item, index) => {
                        listWrapper.appendChild(this._el('div', { style: 'display: flex; gap: 8px;', children: [
                            this.createInput({ value: item, onChange: (val) => { currentList[index] = val; if (onChange) onChange(currentList); } }),
                            this.createButton({ text: '✕', type: 'danger', onClick: () => { currentList.splice(index, 1); renderList(); if (onChange) onChange(currentList); } })
                        ]}));
                    });
                    container.appendChild(listWrapper);
                }
                container.appendChild(this.createButton({ text: '+ 添加项', onClick: () => { currentList.push(''); renderList(); if (onChange) onChange(currentList); } }));
            };
            renderList();
            return container;
        },

        buildConfigForm(schema, currentData, onSave) {
            const form = this._el('div');
            const localData = { ...currentData };

            schema.forEach(item => {
                let control;
                const value = localData[item.key] !== undefined ? localData[item.key] : item.default;
                const handleChange = (val) => { localData[item.key] = val; };

                switch (item.type) {
                    case 'text':   control = this.createInput({ value, placeholder: item.placeholder, onChange: handleChange }); break;
                    case 'number': control = this.createNumber({ value, min: item.min, max: item.max, step: item.step, onChange: handleChange }); break;
                    case 'select': control = this.createSelect({ options: item.options, value, onChange: handleChange }); break;
                    case 'switch': control = this.createSwitch({ checked: value, label: item.inlineLabel, onChange: handleChange }); break;
                    case 'list':   control = this.createList({ items: value, placeholder: item.placeholder, onChange: handleChange }); break;
                    default: return;
                }
                form.appendChild(this.createFormRow({ label: item.label, description: item.description, control }));
            });

            const saveBtn = this.createButton({ text: '保存配置', type: 'primary', onClick: () => { if (onSave) onSave(localData); _win.NodeSeekUI.showAlert('配置已保存！'); } });
            saveBtn.style.marginTop = '10px';
            form.appendChild(saveBtn);
            return form;
        }
    };


    // ==========================================
    // 脚本市场
    // ==========================================
    const Market = {
        _cache: null,

        _parseMeta(scriptContent) {
            const meta = {};
            const block = scriptContent.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
            if (!block) return meta;
            block[1].split('\n').forEach(line => {
                const m = line.match(/\/\/\s*@(\w+)\s+(.+)/);
                if (m) meta[m[1].trim()] = m[2].trim();
            });
            return meta;
        },

        _compareVersions(v1, v2) {
            const normalize = v => String(v).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
            const a = normalize(v1), b = normalize(v2);
            const len = Math.max(a.length, b.length);
            for (let i = 0; i < len; i++) {
                if ((a[i] || 0) > (b[i] || 0)) return 1;
                if ((a[i] || 0) < (b[i] || 0)) return -1;
            }
            return 0;
        },

        getInstalled() {
            const result = {};
            try {
                const ids = JSON.parse(GM_getValue(INSTALLED_PREFIX + '__index', '[]'));
                ids.forEach(id => {
                    const data = GM_getValue(INSTALLED_PREFIX + id, null);
                    if (data) { try { result[id] = JSON.parse(data); } catch(e) {} }
                });
            } catch(e) {}
            return result;
        },

        _saveInstalled(id, data) {
            GM_setValue(INSTALLED_PREFIX + id, JSON.stringify(data));
            const ids = JSON.parse(GM_getValue(INSTALLED_PREFIX + '__index', '[]'));
            if (!ids.includes(id)) {
                ids.push(id);
                GM_setValue(INSTALLED_PREFIX + '__index', JSON.stringify(ids));
            }
        },

        _removeInstalled(id) {
            GM_deleteValue(INSTALLED_PREFIX + id);
            const ids = JSON.parse(GM_getValue(INSTALLED_PREFIX + '__index', '[]')).filter(i => i !== id);
            GM_setValue(INSTALLED_PREFIX + '__index', JSON.stringify(ids));
        },

        async fetchRegistry() {
            if (this._cache) return this._cache;
            const text = await gmFetch(REGISTRY_URL);
            this._cache = JSON.parse(text);
            return this._cache;
        },

        async install(item, onProgress) {
            onProgress && onProgress('正在下载...');
            const scriptContent = await gmFetch(item.url);
            const meta = this._parseMeta(scriptContent);
            const version = meta.version || item.version || '0.0.0';
            const data = {
                id: item.id,
                name: item.name,
                description: item.description,
                version,
                author: item.author || '',
                tags: item.tags || [],
                url: item.url,
                scriptContent,
                installedAt: Date.now(),
                enabled: true
            };
            this._saveInstalled(item.id, data);
            onProgress && onProgress('安装完成');
            this._execute(data);
            return data;
        },

        uninstall(id) {
            this._removeInstalled(id);
        },

        _execute(data) {
            if (!data.enabled) return;
            document.querySelectorAll(`script[data-ns-market="${data.id}"]`).forEach(s => s.remove());
            const script = document.createElement('script');
            script.setAttribute('data-ns-market', data.id);
            script.textContent = `
(function() {
    var _exec = function() {
        try { ${data.scriptContent} } catch(e) { console.error('[NS Market] 模块执行错误 (${data.id}):', e); }
    };
    if (window.NodeSeekUI) { _exec(); }
    else { var _t = setInterval(function() { if (window.NodeSeekUI) { clearInterval(_t); _exec(); } }, 200); }
})();`;
            document.head.appendChild(script);
        },

        autoStart() {
            const installed = this.getInstalled();
            Object.values(installed).forEach(data => {
                if (data.enabled) {
                    console.log(`[NS Market] 自动启动: ${data.name}`);
                    this._execute(data);
                }
            });
        },

        async renderUI(container) {
            container.innerHTML = '';
            const fieldset = document.createElement('fieldset');
            fieldset.innerHTML = `<h2 style="margin: 10px 0; border-bottom: 2px solid #2ea44f; padding-bottom: 8px;">脚本市场</h2>`;

            const loadingEl = UI._el('div', {
                style: 'text-align: center; padding: 40px 0;',
                html: `<img src="/static/image/loading/loading1.gif" style="max-width:20px;max-height:20px;vertical-align:middle;"> <span style="margin-left:8px;color:#888;font-size:14px;">正在加载脚本列表...</span>`
            });
            fieldset.appendChild(loadingEl);
            container.appendChild(fieldset);

            let registry;
            try {
                registry = await this.fetchRegistry();
            } catch(e) {
                loadingEl.innerHTML = `<span style="color:#d73a49;">加载失败：${e.message}，请检查网络或稍后重试。</span>`;
                return;
            }

            loadingEl.remove();

            const installed = this.getInstalled();
            const scripts = registry.scripts || [];

            if (scripts.length === 0) {
                fieldset.appendChild(UI._el('div', { style: 'text-align:center;padding:40px 0;color:#888;', text: '暂无可用脚本。' }));
                return;
            }

            const list = UI._el('div', { style: 'display:flex;flex-direction:column;gap:12px;margin-top:15px;' });

            scripts.forEach(item => {
                const inst = installed[item.id];
                const hasUpdate = inst ? this._compareVersions(item.version, inst.version) > 0 : false;

                const card = UI._el('div', {
                    style: 'padding:15px;border-radius:8px;background-color:var(--glass-color,rgba(0,0,0,0.03));border:1px solid var(--border-color,rgba(0,0,0,0.1));'
                });

                const header = UI._el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;' });
                header.appendChild(UI._el('span', { style: 'font-size:15px;font-weight:600;color:var(--text-color);', text: item.name }));
                header.appendChild(UI._el('span', { style: 'font-size:12px;color:#888;', text: `v${item.version}` }));
                if (item.author) header.appendChild(UI._el('span', { style: 'font-size:12px;color:#888;', text: `by ${item.author}` }));

                let badgeBg, badgeText;
                if (!inst) {
                    badgeBg = 'rgba(3,102,214,0.12)'; badgeText = '未安装';
                } else if (hasUpdate) {
                    badgeBg = 'rgba(255,152,0,0.15)'; badgeText = '可更新';
                } else if (inst.enabled) {
                    badgeBg = 'rgba(46,164,79,0.12)'; badgeText = '已启用';
                } else {
                    badgeBg = 'rgba(0,0,0,0.06)'; badgeText = '已禁用';
                }
                header.appendChild(UI._el('span', {
                    style: `font-size:11px;padding:2px 7px;border-radius:3px;background:${badgeBg};color:var(--text-color);`,
                    text: badgeText
                }));
                card.appendChild(header);

                if (item.description) {
                    card.appendChild(UI._el('p', { style: 'margin:0 0 10px;font-size:13px;color:#888;', text: item.description }));
                }

                if (item.tags && item.tags.length) {
                    const tagWrap = UI._el('div', { style: 'display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;' });
                    item.tags.forEach(tag => tagWrap.appendChild(UI._el('span', {
                        style: 'font-size:11px;padding:1px 6px;border-radius:3px;background:rgba(46,164,79,0.1);color:#2ea44f;',
                        text: tag
                    })));
                    card.appendChild(tagWrap);
                }

                const actions = UI._el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;' });
                const statusEl = UI._el('span', { style: 'font-size:12px;color:#888;align-self:center;' });

                if (!inst) {
                    const installBtn = UI.createButton({ text: '安装', type: 'primary', onClick: async () => {
                        installBtn.disabled = true;
                        installBtn.textContent = '安装中...';
                        try {
                            await this.install(item, (msg) => { statusEl.textContent = msg; });
                            this._cache = null;
                            this.renderUI(container);
                        } catch(e) {
                            statusEl.textContent = `安装失败：${e.message}`;
                            installBtn.disabled = false;
                            installBtn.textContent = '安装';
                        }
                    }});
                    actions.appendChild(installBtn);
                } else {
                    if (hasUpdate) {
                        const updateBtn = UI.createButton({ text: '更新', type: 'primary', onClick: async () => {
                            updateBtn.disabled = true;
                            updateBtn.textContent = '更新中...';
                            try {
                                await this.install(item, (msg) => { statusEl.textContent = msg; });
                                this._cache = null;
                                this.renderUI(container);
                            } catch(e) {
                                statusEl.textContent = `更新失败：${e.message}`;
                                updateBtn.disabled = false;
                                updateBtn.textContent = '更新';
                            }
                        }});
                        actions.appendChild(updateBtn);
                    }

                    const toggleBtn = UI.createButton({
                        text: inst.enabled ? '禁用' : '启用',
                        type: inst.enabled ? 'default' : 'primary',
                        onClick: () => {
                            inst.enabled = !inst.enabled;
                            this._saveInstalled(inst.id, inst);
                            this._cache = null;
                            this.renderUI(container);
                        }
                    });
                    actions.appendChild(toggleBtn);

                    const uninstallBtn = UI.createButton({ text: '卸载', type: 'danger', onClick: () => {
                        this.uninstall(item.id);
                        this._cache = null;
                        this.renderUI(container);
                    }});
                    actions.appendChild(uninstallBtn);
                }

                actions.appendChild(statusEl);
                card.appendChild(actions);
                list.appendChild(card);
            });

            fieldset.appendChild(list);
        }
    };


    // ==========================================
    // 核心引擎 API
    // ==========================================
    const coreAPI = {
        UI: UI,
        Market: Market,
        panels: new Map(),
        vueInstance: null,
        _lastRenderedHash: null,
        _initializedRoute: false,
        _initialHashRestored: false,
        _managerReady: false,

        isEnabled(id) {
            return moduleStates[id] !== false;
        },

        register(config) {
            if (!config.id || !config.name || typeof config.render !== 'function') return;
            this.panels.set(config.id, config);
            this.tryInjectTabs();
            const currentHash = location.hash.replace('#', '');
            if (currentHash === config.id || currentHash === 'script_manager') {
                this.handleRoute();
            }
        },

        store(moduleId, key, value) {
            GM_setValue(`${STORE_PREFIX}${moduleId}_${key}`, JSON.stringify(value));
        },

        load(moduleId, key, defaultValue = null) {
            const raw = GM_getValue(`${STORE_PREFIX}${moduleId}_${key}`, null);
            if (raw === null) return defaultValue;
            try { return JSON.parse(raw); } catch(e) { return defaultValue; }
        },

        getVue() {
            const root = document.querySelector('#nsk-frame');
            if (!root) return null;
            const els = root.querySelectorAll('*');
            for (let i = 0; i < els.length; i++) {
                if (els[i].__vue__ && Array.isArray(els[i].__vue__.tabs)) {
                    return els[i].__vue__;
                }
            }
            return null;
        },

        tryInjectTabs() {
            if (!this.vueInstance) this.vueInstance = this.getVue();
            if (!this.vueInstance) return;

            if (!this.vueInstance._ns_hooked && typeof this.vueInstance.select === 'function') {
                const originalSelect = this.vueInstance.select;
                const self = this;
                this.vueInstance.select = function(index) {
                    originalSelect.call(this, index);
                    const tab = this.tabs[index];
                    if (tab && tab.key && location.hash !== '#' + tab.key) location.hash = tab.key;
                    self.handleRoute();
                };
                this.vueInstance._ns_hooked = true;
            }

            let tabsChanged = false;
            this.panels.forEach((panel, id) => {
                if (!this.vueInstance.tabs.find(t => t.key === id)) {
                    this.vueInstance.tabs.push({ cn: panel.name, key: id });
                    tabsChanged = true;
                }
            });

            if (tabsChanged || !this._initialHashRestored) {
                const targetHash = _ORIGINAL_HASH || window.location.hash;
                if (targetHash) {
                    const targetKey = targetHash.replace('#', '');
                    if (this.panels.has(targetKey)) {
                        const targetIndex = this.vueInstance.tabs.findIndex(t => t.key === targetKey);
                        if (targetIndex !== -1) {
                            this.vueInstance.selected = targetIndex;
                            if (window.location.hash !== targetHash) {
                                window.history.replaceState(null, null, targetHash);
                            }
                            this._initialHashRestored = true;
                        }
                    } else {
                        this._initialHashRestored = true;
                    }
                } else {
                    this._initialHashRestored = true;
                }
                this.syncVueSelection();
            }
        },

        syncVueSelection() {
            if (!this.vueInstance) return;
            const hash = location.hash.replace('#', '');
            const index = this.vueInstance.tabs.findIndex(t => t.key === hash);
            if (index !== -1 && this.vueInstance.selected !== index) {
                this.vueInstance.selected = index;
            }
        },

        showAlert(msg) {
            if (typeof mscAlert === 'function') mscAlert(msg);
            else alert(msg);
        },

        renderManagerUI(container) {
            if (!container) return;
            container.innerHTML = `<fieldset><h2 style="margin: 10px 0; border-bottom: 2px solid #2ea44f; padding-bottom: 8px;">模块总控中心</h2><div id="ns-core-module-list" style="margin-top: 15px;"></div></fieldset>`;
            const listContainer = container.querySelector('#ns-core-module-list');

            let moduleCount = 0;
            this.panels.forEach((module, id) => {
                if (id === 'script_manager' || id === 'ns_market') return;
                moduleCount++;
                const enabled = this.isEnabled(id);
                const card = document.createElement('div');
                card.style.cssText = `padding: 15px; margin-bottom: 15px; border-radius: 8px; background-color: var(--glass-color, rgba(0,0,0,0.03)); border: 1px solid var(--border-color, rgba(0,0,0,0.1));`;
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <h3 style="margin: 0; font-size: 16px; color: var(--text-color);">${module.name}</h3>
                            <span style="font-size: 12px; color: #888;">v${module.version || '1.0'}</span>
                            <span class="storage-tip" style="background-color: ${enabled ? '#2ea44f' : '#666'} !important; color: #fff !important; transition: 0.3s;">${enabled ? '已启用' : '已禁用'}</span>
                        </div>
                    </div>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #888;">${module.description || '无描述'}</p>
                    <button class="btn ns-toggle-btn" style="background-color: ${enabled ? '#d9d9d9' : '#2ea44f'} !important; color: ${enabled ? '#333' : '#fff'} !important; border: none; height: auto; line-height: normal; padding: 6px 16px; font-size: 14px; transition: 0.3s;">
                        ${enabled ? '禁用' : '启用'}
                    </button>
                `;
                card.querySelector('.ns-toggle-btn').addEventListener('click', (e) => {
                    e.preventDefault();
                    const newState = !enabled;
                    moduleStates[id] = newState;
                    GM_setValue('ns_module_states', moduleStates);
                    this.showAlert(`模块 "${module.name}" 已${newState ? '启用' : '禁用'}`);
                    if (typeof module.onToggle === 'function') module.onToggle(newState);
                    this.renderManagerUI(container);
                });
                listContainer.appendChild(card);
            });

            if (moduleCount === 0) {
                listContainer.innerHTML = `<div style="text-align: center; padding: 40px 0; color: #888;">检测到当前未安装任何子模块脚本。</div>`;
            }
        },

        injectStyles() {
            if (document.getElementById('ns-ui-styles')) return;
            const style = document.createElement('style');
            style.id = 'ns-ui-styles';
            style.innerHTML = `
                @keyframes ns-fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                .ns-suppress-native > *:not(#ns-custom-panels-wrapper) { display: none !important; }
                .ns-reveal-native > *:not(#ns-custom-panels-wrapper) { animation: ns-fade-in 0.25s ease-out forwards; }
                #ns-custom-panels-wrapper { transition: opacity 0.25s ease, transform 0.25s ease; opacity: 0; display: none; box-sizing: border-box !important; width: 100% !important; position: relative; z-index: 1; pointer-events: none; transform: translateY(5px); }
                #ns-custom-panels-wrapper.ns-show { display: block !important; opacity: 1 !important; pointer-events: auto !important; transform: translateY(0); }
                @media screen and (max-width: 768px) { .selector-left-side { z-index: 1002 !important; position: relative; } .selector-right-side { z-index: 1 !important; } }
                .selector-right-side, .right-side, #ns-custom-panels-wrapper { min-height: 650px !important; }
                .dark-layout .ns-ui-btn-default { background-color: #fafbfc !important; color: #24292e !important; }
                .dark-layout .ns-ui-btn-primary { background-color: #2ea44f !important; color: #fff !important; }
                .dark-layout .ns-ui-btn-danger  { background-color: #d73a49 !important; color: #fff !important; }
            `;
            document.head.appendChild(style);
        },

        handleRoute() {
            const hash = location.hash.replace('#', '');
            const rightSide = document.querySelector('.selector-right-side') || document.querySelector('.right-side');
            if (!rightSide) return;

            if (hash !== 'script_manager' && hash !== 'ns_market' && this._lastRenderedHash === hash && document.querySelector('#ns-custom-panels-wrapper.ns-show')) return;

            let wrapper = document.getElementById('ns-custom-panels-wrapper');
            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.id = 'ns-custom-panels-wrapper';
                wrapper.className = 'personal-info pure-form';
                rightSide.appendChild(wrapper);
            }

            const isCustom = this.panels.has(hash);
            const panel = this.panels.get(hash);

            if (isCustom) {
                this._lastRenderedHash = hash;

                const renderContent = () => {
                    wrapper.innerHTML = '';
                    panel.render(wrapper);

                    if (hash !== 'script_manager' && hash !== 'ns_market' && !this.isEnabled(hash)) {
                        const banner = UI.createWarningBanner({
                            message: '<strong>⚠️ 模块当前已禁用</strong>：更改配置不会生效。请在管理中心开启。',
                            buttonText: '去管理中心',
                            onButtonClick: () => { location.hash = '#script_manager'; }
                        });
                        const heading = wrapper.querySelector('h2, h3');
                        if (heading) heading.insertAdjacentElement('afterend', banner);
                        else wrapper.prepend(banner);
                    }
                };

                if (!this._currentIsCustom || !this._initializedRoute) {
                    this._currentIsCustom = true;
                    this._initializedRoute = true;
                    rightSide.classList.add('ns-suppress-native');
                    renderContent();
                    wrapper.style.display = 'block';
                    void wrapper.offsetWidth;
                    wrapper.classList.add('ns-show');
                } else {
                    wrapper.classList.remove('ns-show');
                    setTimeout(() => {
                        renderContent();
                        void wrapper.offsetWidth;
                        wrapper.classList.add('ns-show');
                    }, 150);
                }
            } else {
                this._lastRenderedHash = hash;
                if (this._currentIsCustom) {
                    this._currentIsCustom = false;
                    wrapper.classList.remove('ns-show');
                    setTimeout(() => {
                        if (!this._currentIsCustom) {
                            wrapper.style.display = 'none';
                            rightSide.classList.remove('ns-suppress-native');
                            rightSide.classList.add('ns-reveal-native');
                        }
                    }, 250);
                }
            }
            this.syncVueSelection();
        },

        init() {
            this.injectStyles();

            this.panels.set('ns_market', {
                id: 'ns_market',
                name: '脚本市场',
                render: (c) => Market.renderUI(c)
            });

            this.panels.set('script_manager', {
                id: 'script_manager',
                name: '脚本管理',
                render: (c) => {
                    if (this._managerReady) {
                        this.renderManagerUI(c);
                        return;
                    }
                    c.innerHTML = `
                        <fieldset>
                            <h2 style="margin: 10px 0; border-bottom: 2px solid #2ea44f; padding-bottom: 8px;">模块总控中心</h2>
                            <div style="text-align: center; padding: 40px 0;">
                                <img src="/static/image/loading/loading1.gif" alt="" style="max-width: 20px; max-height: 20px; vertical-align: middle;">
                                <span style="margin-left: 8px; color: #888; font-size: 14px;">正在加载模块...</span>
                            </div>
                        </fieldset>
                    `;
                    setTimeout(() => {
                        this._managerReady = true;
                        this.renderManagerUI(c);
                    }, 800);
                }
            });

            Market.autoStart();

            if (!location.pathname.startsWith('/setting')) return;

            setInterval(() => {
                if (this.getVue()) {
                    this.tryInjectTabs();
                    if (this.vueInstance.isMobile && this.vueInstance.isMobile()) {
                        document.body.classList.toggle('ns-mobile-menu-open', !!this.vueInstance.showLeftPanel);
                    }
                    const hash = location.hash.replace('#', '');
                    if (this.panels.has(hash)) {
                        const wrapper = document.getElementById('ns-custom-panels-wrapper');
                        if (!wrapper || !wrapper.classList.contains('ns-show')) this.handleRoute();
                    }
                }
            }, 400);

            window.addEventListener('hashchange', () => this.handleRoute());
        }
    };

    _win.NodeSeekUI = window.NodeSeekUI = coreAPI;
    coreAPI.init();
})();