(function() {
    'use strict';

    const API = window.NodeSeekUI;

    const MODULE_ID = 'user_badge';
    const MODULE_NAME = '用户信息徽章';
    const MODULE_VERSION = '0.4.3';
    const MODULE_DESC = '在帖子作者昵称旁显示等级和加入天数，完美支持暗黑模式，可自定义颜色与展示项。';
    const STYLE_ID = MODULE_ID + '_css';
    const USER_INFO_CACHE_TTL = 2 * 60 * 60;

    const SCHEMA = [
        { key: 'showRank', type: 'switch', label: '显示等级徽章', description: '在作者昵称旁显示用户等级', default: true },
        { key: 'showDays', type: 'switch', label: '显示天数徽章', description: '在作者昵称旁显示加入天数', default: true },
        { key: 'badgeColor', type: 'color', label: '徽章颜色', description: '自定义边框与文字颜色，如 #00a8ff', default: '#00a8ff' }
    ];

    const userInfoCache = API.sharedCache || new Map();
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
        return (Math.floor((now - joinedDate) / (1000 * 60 * 60 * 24))) + 1;
    }

    function injectBadges(authorLink, config) {
        if (!config.showRank && !config.showDays) return;

        const uidMatch = authorLink.href.match(/\/space\/(\d+)/);
        if (!uidMatch) return;
        const uid = uidMatch[1];
        const cacheKey = `userInfo:${uid}`;

        if (authorLink.dataset.badgeInjected === 'true') return;
        authorLink.dataset.badgeInjected = 'true';

        let cachedUserInfo = userInfoCache.get(cacheKey);

        if (cachedUserInfo === undefined) {
            const fetchPromise = API.request({
                url: `/api/account/getInfo/${uid}`,
                method: 'GET'
            }).then(res => {
                try {
                    const data = JSON.parse(res.responseText);
                    return data && data.success ? data.detail : null;
                } catch { return null; }
            }).then(userInfo => {
                if (userInfo) userInfoCache.set(cacheKey, userInfo, { ttl: USER_INFO_CACHE_TTL });
                else userInfoCache.delete(cacheKey);
                return userInfo;
            }).catch(() => {
                userInfoCache.delete(cacheKey);
                return null;
            });
            userInfoCache.set(cacheKey, fetchPromise, { ttl: USER_INFO_CACHE_TTL });
            cachedUserInfo = fetchPromise;
        }

        Promise.resolve(cachedUserInfo).then(userInfo => {
            if (userInfo) {
                const { rank, created_at } = userInfo;
                const days = getJoinedDays(created_at);
                
                const fragments = document.createDocumentFragment();

                if (config.showRank) {
                    const rankBadge = document.createElement('span');
                    rankBadge.className = 'nsk-badge ns-custom-badge';
                    rankBadge.style.setProperty('--ns-badge-color', config.badgeColor);
                    rankBadge.textContent = `Lv${rank}`;
                    fragments.appendChild(rankBadge);
                }

                if (config.showDays) {
                    const daysBadge = document.createElement('span');
                    daysBadge.className = 'nsk-badge ns-custom-badge';
                    daysBadge.style.setProperty('--ns-badge-color', config.badgeColor);
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

    // --- 注册基座 ---
    API.register({
        id: MODULE_ID,
        name: MODULE_NAME,
        version: MODULE_VERSION,
        description: MODULE_DESC,
        settings: SCHEMA,
        
        execute: function() {
            initFeatures();
        },
        
        onToggle: function(enabled) {
            if (enabled) {
                initFeatures();
            } else {
                stopFeatures();
            }
        },

        onConfigChange: function(newData) {
            saveConfig(newData);
            stopFeatures();
            initFeatures();
        }
    });

})();
