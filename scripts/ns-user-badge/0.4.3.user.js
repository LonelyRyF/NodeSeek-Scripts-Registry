(function() {
    'use strict';

    const MODULE_ID = 'ns_user_badge';
    const MODULE_NAME = '用户信息徽章';
    const MODULE_VERSION = '0.4.2';
    const MODULE_DESC = '在帖子作者昵称旁显示等级和加入天数，完美支持暗黑模式，可自定义颜色与展示项。';

    const DEFAULT_CONFIG = {
        showRank: true,
        showDays: true,
        badgeColor: '#00a8ff'
    };

    const apiCache = new Map();
    let observer = null;
    let nsAPI = null;

    // --- 基座存储桥接 ---
    const getConfig = () => {
        if (nsAPI) return { ...DEFAULT_CONFIG, ...nsAPI.load(MODULE_ID, 'config', {}) };
        return DEFAULT_CONFIG;
    };

    const saveConfig = (data) => {
        if (nsAPI) nsAPI.store(MODULE_ID, 'config', data);
    };

    const waitForUI = (cb, maxWait = 10000) => {
        if (window.NodeSeekUI) {
            nsAPI = window.NodeSeekUI;
            return cb(nsAPI);
        }
        const start = Date.now();
        const timer = setInterval(() => {
            if (window.NodeSeekUI) {
                clearInterval(timer);
                nsAPI = window.NodeSeekUI;
                cb(nsAPI);
            } else if (Date.now() - start > maxWait) {
                clearInterval(timer);
                console.warn(`[${MODULE_NAME}] 基座未检测到，界面配置功能将不可用`);
                initFeatures();
            }
        }, 200);
    };

    // --- 核心业务逻辑 ---
    function getJoinedDays(dateStr) {
        const joinedDate = new Date(dateStr);
        const now = new Date();
        return Math.floor((now - joinedDate) / (1000 * 60 * 60 * 24));
    }

    function injectBadges(authorLink, config) {
        // 如果两个开关都关了，直接跳过
        if (!config.showRank && !config.showDays) return;

        const uidMatch = authorLink.href.match(/\/space\/(\d+)/);
        if (!uidMatch) return;
        const uid = uidMatch[1];

        if (authorLink.dataset.badgeInjected === 'true') return;
        authorLink.dataset.badgeInjected = 'true';

        if (!apiCache.has(uid)) {
            const fetchPromise = fetch(`/api/account/getInfo/${uid}`)
                .then(res => res.json())
                .catch(() => null);
            apiCache.set(uid, fetchPromise);
        }

        apiCache.get(uid).then(data => {
            if (data && data.success && data.detail) {
                const { rank, created_at } = data.detail;
                const days = getJoinedDays(created_at);
                
                // 移除 display: inline-block，还原原生 span 布局，防止大小变动
                const customStyle = `background: transparent; border: 1px solid ${config.badgeColor}; color: ${config.badgeColor}; margin-left: 4px; line-height: 1; padding: 0 4px; font-size: 11px; border-radius: 3px;`;

                const fragments = document.createDocumentFragment();

                if (config.showRank) {
                    const rankBadge = document.createElement('span');
                    rankBadge.className = 'nsk-badge ns-custom-badge';
                    rankBadge.style.cssText = customStyle;
                    rankBadge.textContent = `Lv${rank}`;
                    fragments.appendChild(rankBadge);
                }

                if (config.showDays) {
                    const daysBadge = document.createElement('span');
                    daysBadge.className = 'nsk-badge ns-custom-badge';
                    daysBadge.style.cssText = customStyle;
                    daysBadge.textContent = `${days}天`;
                    fragments.appendChild(daysBadge);
                }

                authorLink.after(fragments);
            }
        });
    }

    // 清理函数：用于模块禁用或配置更新时刷新 DOM
    function removeBadges() {
        document.querySelectorAll('.ns-custom-badge').forEach(el => el.remove());
        document.querySelectorAll('a.author-name[data-badge-injected="true"]').forEach(link => {
            link.dataset.badgeInjected = 'false';
        });
    }

    function initFeatures() {
        stopFeatures(); 
        const config = getConfig();

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
    }

    // --- 基座集成逻辑 ---
    waitForUI((api) => {
        api.register({
            id: MODULE_ID,
            name: MODULE_NAME,
            version: MODULE_VERSION,
            description: MODULE_DESC,
            onToggle(enabled) {
                if (enabled) initFeatures();
                else stopFeatures();
            },
            render(container) {
                const currentConfig = getConfig();
                container.innerHTML = '';
                
                const fieldset = document.createElement('fieldset');
                fieldset.innerHTML = `<h2 style="margin: 10px 0; border-bottom: 2px solid #2ea44f; padding-bottom: 8px;">${MODULE_NAME} 设置</h2>`;
                
                const formContainer = document.createElement('div');
                formContainer.style.marginTop = '15px';

                // 开关：显示等级
                const rankSwitch = api.UI.createFormRow({
                    label: '显示等级徽章',
                    control: api.UI.createSwitch({
                        checked: currentConfig.showRank,
                        inlineLabel: '启用',
                        onChange: (val) => currentConfig.showRank = val
                    })
                });

                // 开关：显示天数
                const daysSwitch = api.UI.createFormRow({
                    label: '显示天数徽章',
                    control: api.UI.createSwitch({
                        checked: currentConfig.showDays,
                        inlineLabel: '启用',
                        onChange: (val) => currentConfig.showDays = val
                    })
                });

                // 颜色选择器
                const colorRow = document.createElement('div');
                colorRow.style.cssText = 'margin-bottom: 20px;';
                colorRow.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 6px; color: var(--text-color); font-size: 14px;">徽章颜色</div>
                    <div style="font-size: 12px; color: #888; margin-bottom: 8px;">自定义边框与文字颜色</div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <input type="color" id="badge-color-picker" value="${currentConfig.badgeColor}" style="width: 50px; height: 30px; border: none; cursor: pointer; background: transparent; padding: 0;">
                        <span id="color-code" style="font-family: monospace;">${currentConfig.badgeColor.toUpperCase()}</span>
                    </div>
                `;

                formContainer.append(rankSwitch, daysSwitch, colorRow);

                // 保存按钮
                const saveBtn = api.UI.createButton({
                    text: '保存并应用',
                    type: 'primary',
                    onClick: () => {
                        saveConfig(currentConfig);
                        if (api.isEnabled(MODULE_ID)) {
                            initFeatures(); 
                            api.showAlert('设置已保存并即时生效！');
                        } else {
                            api.showAlert('设置已保存，请在管理中心启用该模块！');
                        }
                    }
                });
                saveBtn.style.marginTop = '10px';
                formContainer.appendChild(saveBtn);

                fieldset.appendChild(formContainer);
                container.appendChild(fieldset);

                const picker = container.querySelector('#badge-color-picker');
                const codeDisplay = container.querySelector('#color-code');
                picker.addEventListener('input', (e) => {
                    const val = e.target.value.toUpperCase();
                    codeDisplay.textContent = val;
                    currentConfig.badgeColor = val;
                });
            }
        });

        if (api.isEnabled(MODULE_ID)) initFeatures();
    });

})();