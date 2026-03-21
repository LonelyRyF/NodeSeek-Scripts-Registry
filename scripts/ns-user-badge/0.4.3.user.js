(function() {
    'use strict';

    const API = window.NodeSeekUI;
    const UI = API.UI;

    const MODULE_ID = 'ns_user_badge';
    const MODULE_NAME = '用户信息徽章';
    const MODULE_VERSION = '0.4.3';
    const MODULE_DESC = '在帖子作者昵称旁显示等级和加入天数，完美支持暗黑模式，可自定义颜色与展示项。';
    const STYLE_ID = MODULE_ID + '_css';

    const SCHEMA = [
        { key: 'showRank', type: 'switch', label: '显示等级徽章', description: '在作者昵称旁显示用户等级', default: true },
        { key: 'showDays', type: 'switch', label: '显示天数徽章', description: '在作者昵称旁显示加入天数', default: true },
        { key: 'badgeColor', type: 'text', label: '徽章颜色', description: '自定义边框与文字颜色，如 #00a8ff', default: '#00a8ff' }
    ];

    const apiCache = new Map();
    let observer = null;

    const getConfig = () => API.getConfig(MODULE_ID, SCHEMA);
    const saveConfig = (data) => API.store(MODULE_ID, 'config', data);

    // --- 样式注入 ---
    function injectStyles() {
        API.addStyle(`
            .ns-custom-badge {
                background: transparent !important;
                border: 1px solid var(--ns-badge-color, #00a8ff) !important;
                color: var(--ns-badge-color, #00a8ff) !important;
                margin-left: 4px !important;
                line-height: 1 !important;
                padding: 0 4px !important;
                font-size: 11px !important;
                border-radius: 3px !important;
            }
        `, STYLE_ID);
    }

    function removeStyles() {
        API.removeStyle(STYLE_ID);
    }

    // --- 核心业务 ---
    function getJoinedDays(dateStr) {
        const joinedDate = new Date(dateStr);
        const now = new Date();
        return Math.floor((now - joinedDate) / (1000 * 60 * 60 * 24));
    }

    function injectBadges(authorLink, config) {
        if (!config.showRank && !config.showDays) return;

        const uidMatch = authorLink.href.match(/\/space\/(\d+)/);
        if (!uidMatch) return;
        const uid = uidMatch[1];

        if (authorLink.dataset.badgeInjected === 'true') return;
        authorLink.dataset.badgeInjected = 'true';

        if (!apiCache.has(uid)) {
            const fetchPromise = API.request({
                url: `/api/account/getInfo/${uid}`,
                method: 'GET'
            }).then(res => {
                try { return JSON.parse(res.responseText); } catch { return null; }
            }).catch(() => null);
            apiCache.set(uid, fetchPromise);
        }

        apiCache.get(uid).then(data => {
            if (data && data.success && data.detail) {
                const { rank, created_at } = data.detail;
                const days = getJoinedDays(created_at);
                
                // 设置 CSS 变量用于动态颜色
                authorLink.style.setProperty('--ns-badge-color', config.badgeColor);

                const fragments = document.createDocumentFragment();

                if (config.showRank) {
                    const rankBadge = document.createElement('span');
                    rankBadge.className = 'nsk-badge ns-custom-badge';
                    rankBadge.textContent = `Lv${rank}`;
                    fragments.appendChild(rankBadge);
                }

                if (config.showDays) {
                    const daysBadge = document.createElement('span');
                    daysBadge.className = 'nsk-badge ns-custom-badge';
                    daysBadge.textContent = `${days}天`;
                    fragments.appendChild(daysBadge);
                }

                authorLink.after(fragments);
            }
        });
    }

    function removeBadges() {
        document.querySelectorAll('.ns-custom-badge').forEach(el => el.remove());
        document.querySelectorAll('a.author-name[data-badge-injected="true"]').forEach(link => {
            link.dataset.badgeInjected = 'false';
            link.style.removeProperty('--ns-badge-color');
        });
    }

    function initFeatures() {
        stopFeatures();
        const config = getConfig();
        injectStyles();

        const scanAndInject = () => {
            document.querySelectorAll('.author-info a.author-name').forEach(link => {
                injectBadges(link, config);
            });
        };

        scanAndInject();

        observer = new MutationObserver((mutations) => {
            if (mutations.some(m => m.addedNodes.length > 0)) scanAndInject();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function stopFeatures() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        removeBadges();
        removeStyles();
    }

    // --- 设置面板 ---
    function renderSettings(container) {
        const cfg = getConfig();
        const form = UI.buildConfigForm(SCHEMA, cfg, (newData) => {
            saveConfig(newData);
            stopFeatures();
            initFeatures();
            API.showAlert('配置已保存并即时生效！');
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
        
        render: renderSettings,
        
        execute: function() {
            initFeatures();
        },
        
        onToggle: function(enabled) {
            if (enabled) {
                initFeatures();
            } else {
                stopFeatures();
            }
        }
    });

})();
