(function() {
    'use strict';

    const MODULE_ID = 'ns_privacy_guard';
    const api = window.NodeSeekUI;
    const UI = api.UI;

    const SCHEMA = [
        { key: 'enabled', type: 'switch', label: '启用隐私保护', description: '开启后将对页面中的用户信息进行处理', default: true },
        {
            key: 'mode', type: 'select', label: '处理模式', description: '选择对头像和名称的处理方式',
            options: [
                { label: '模糊遮罩', value: 'blur' },
                { label: '替换为自定义内容', value: 'replace' },
                { label: '模糊 + 替换名称', value: 'blur_replace_name' }
            ],
            default: 'blur'
        },
        { key: 'blurAmount', type: 'number', label: '模糊强度 (px)', description: '模糊模式下的模糊半径，建议 4~10', min: 1, max: 20, step: 1, default: 6 },
        { key: 'replaceAvatar', type: 'text', label: '替换头像 URL', description: '替换模式下使用的头像图片地址，留空则隐藏头像', placeholder: 'https://example.com/avatar.png', default: '' },
        { key: 'replaceName', type: 'text', label: '替换名称', description: '替换模式下显示的用户名，留空则显示为 ***', placeholder: '匿名用户', default: '***' },
        { key: 'coverAuthor', type: 'switch', label: '处理发帖者（列表页）', description: '对帖子列表中发帖者的头像和名称进行处理', default: true },
        { key: 'coverLastCommenter', type: 'switch', label: '处理最后评论者（列表页）', description: '对列表页 ⚡ 图标后的最后评论者进行处理', default: true },
        { key: 'coverPostPage', type: 'switch', label: '处理帖子详情页', description: '对帖子内容页中所有楼层的头像和名称进行处理', default: true }
    ];

    function getConfig() {
        const cfg = {};
        SCHEMA.forEach(item => { cfg[item.key] = api.load(MODULE_ID, item.key, item.default); });
        return cfg;
    }

    function applyToAvatar(imgEl, cfg) {
        if (!imgEl) return;
        if (cfg.mode === 'blur' || cfg.mode === 'blur_replace_name') {
            imgEl.style.filter = `blur(${cfg.blurAmount}px)`;
            imgEl.style.transition = 'filter 0.2s';
        } else if (cfg.mode === 'replace') {
            if (cfg.replaceAvatar) { imgEl.src = cfg.replaceAvatar; }
            else { imgEl.style.visibility = 'hidden'; }
        }
        imgEl.setAttribute('data-ns-privacy', '1');
    }

    function applyToName(el, cfg) {
        if (!el) return;
        if (cfg.mode === 'blur') {
            el.style.filter = `blur(${cfg.blurAmount}px)`;
            el.style.transition = 'filter 0.2s';
            el.style.userSelect = 'none';
        } else if (cfg.mode === 'replace' || cfg.mode === 'blur_replace_name') {
            el.setAttribute('data-ns-orig-name', el.textContent);
            el.textContent = cfg.replaceName || '***';
        }
        el.setAttribute('data-ns-privacy', '1');
    }

    // 列表页
    function processListItem(item, cfg) {
        if (item.getAttribute('data-ns-processed')) return;
        if (cfg.coverAuthor) {
            const avatarLink = item.querySelector(':scope > a[href^="/space/"]');
            if (avatarLink) applyToAvatar(avatarLink.querySelector('img.avatar-normal'), cfg);
            applyToName(item.querySelector('.info-author a'), cfg);
        }
        if (cfg.coverLastCommenter) {
            applyToName(item.querySelector('.info-last-commenter a'), cfg);
        }
        item.setAttribute('data-ns-processed', '1');
    }

    function processListAll(cfg) {
        if (!cfg.enabled) return;
        document.querySelectorAll('.post-list-item:not([data-ns-processed])').forEach(item => processListItem(item, cfg));
    }

    // 帖子详情页
    function processPostItem(item, cfg) {
        if (item.getAttribute('data-ns-processed')) return;
        applyToAvatar(item.querySelector('.avatar-wrapper img.avatar-normal'), cfg);
        applyToName(item.querySelector('.author-name'), cfg);
        // 移除非楼主、非用户徽章插件的 badge
        item.querySelectorAll('.nsk-badge:not(.is-poster):not(.ns-custom-badge)').forEach(badge => badge.remove());
        item.setAttribute('data-ns-processed', '1');
    }

    function processPostAll(cfg) {
        if (!cfg.enabled || !cfg.coverPostPage) return;
        document.querySelectorAll('.content-item:not([data-ns-processed])').forEach(item => processPostItem(item, cfg));
    }

    // 重置
    function resetAll() {
        document.querySelectorAll('.post-list-item[data-ns-processed]').forEach(item => {
            item.removeAttribute('data-ns-processed');
            const img = item.querySelector('img.avatar-normal[data-ns-privacy]');
            if (img) { img.style.filter = ''; img.style.visibility = ''; img.removeAttribute('data-ns-privacy'); }
            item.querySelectorAll('a[data-ns-privacy]').forEach(a => {
                const orig = a.getAttribute('data-ns-orig-name');
                if (orig) a.textContent = orig;
                a.style.filter = ''; a.style.userSelect = '';
                a.removeAttribute('data-ns-orig-name'); a.removeAttribute('data-ns-privacy');
            });
        });
        document.querySelectorAll('.content-item[data-ns-processed]').forEach(item => {
            item.removeAttribute('data-ns-processed');
            const img = item.querySelector('img.avatar-normal[data-ns-privacy]');
            if (img) { img.style.filter = ''; img.style.visibility = ''; img.removeAttribute('data-ns-privacy'); }
            const nameEl = item.querySelector('.author-name[data-ns-privacy]');
            if (nameEl) {
                const orig = nameEl.getAttribute('data-ns-orig-name');
                if (orig) nameEl.textContent = orig;
                nameEl.style.filter = ''; nameEl.style.userSelect = '';
                nameEl.removeAttribute('data-ns-orig-name'); nameEl.removeAttribute('data-ns-privacy');
            }
        });
    }

    // Observer
    let observer = null;

    function startObserver(cfg) {
        if (observer) observer.disconnect();
        observer = new MutationObserver(() => {
            processListAll(cfg);
            processPostAll(cfg);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function stopObserver() {
        if (observer) { observer.disconnect(); observer = null; }
    }

    // 设置面板
    function renderSettings(container) {
        const cfg = getConfig();
        const form = UI.buildConfigForm(SCHEMA, cfg, (newData) => {
            SCHEMA.forEach(item => api.store(MODULE_ID, item.key, newData[item.key]));
            resetAll();
            stopObserver();
            const newCfg = getConfig();
            if (newCfg.enabled) {
                processListAll(newCfg);
                processPostAll(newCfg);
                startObserver(newCfg);
            }
        });
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<fieldset><h2 style="margin: 10px 0; border-bottom: 2px solid #2ea44f; padding-bottom: 8px;">隐私保护</h2><p style="font-size:13px;color:#888;margin-bottom:16px;">隐藏或模糊页面中的用户头像与名称，保护浏览隐私。</p></fieldset>`;
        wrapper.querySelector('fieldset').appendChild(form);
        container.appendChild(wrapper);
    }

    api.register({
        id: MODULE_ID,
        name: '隐私保护',
        version: '1.2',
        description: '模糊或替换帖子列表及详情页中的用户头像和名称',
        render: renderSettings,
        onToggle: (enabled) => {
            if (enabled) {
                const cfg = getConfig();
                processListAll(cfg);
                processPostAll(cfg);
                startObserver(cfg);
            } else {
                resetAll();
                stopObserver();
            }
        }
    });

    (function run() {
        const cfg = getConfig();
        if (!cfg.enabled) return;
        if (document.body) {
            processListAll(cfg);
            processPostAll(cfg);
            startObserver(cfg);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                processListAll(cfg);
                processPostAll(cfg);
                startObserver(cfg);
            });
        }
    })();

})();