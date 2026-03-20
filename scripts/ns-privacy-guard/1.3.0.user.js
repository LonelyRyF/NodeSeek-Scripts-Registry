(function() {
    var API = window.NodeSeekUI;
    var UI = API.UI;
    var MODULE_ID = 'ns-privacy-guard';

    var SCHEMA = [
        {
            key: 'avatarMode', type: 'select', label: '头像处理模式', description: '选择对头像的处理方式',
            options: [
                { label: '不处理', value: 'none' },
                { label: '模糊遮罩', value: 'blur' },
                { label: '替换为自定义图片', value: 'replace' }
            ],
            default: 'blur'
        },
        { key: 'blurAvatarAmount', type: 'number', label: '头像模糊强度 (px)', description: '模糊模式下的模糊半径，建议 4~10', min: 1, max: 20, step: 1, default: 6 },
        { key: 'replaceAvatar', type: 'text', label: '替换头像 URL', description: '替换模式下使用的头像图片地址，留空则隐藏头像', placeholder: '图片地址', default: '' },
        {
            key: 'nameMode', type: 'select', label: '名称处理模式', description: '选择对用户名的处理方式',
            options: [
                { label: '不处理', value: 'none' },
                { label: '模糊遮罩', value: 'blur' },
                { label: '替换为自定义文字', value: 'replace' }
            ],
            default: 'blur'
        },
        { key: 'blurNameAmount', type: 'number', label: '名称模糊强度 (px)', description: '模糊模式下的模糊半径，建议 4~10', min: 1, max: 20, step: 1, default: 6 },
        { key: 'replaceName', type: 'text', label: '替换名称', description: '替换模式下显示的用户名，留空则显示为 ***', placeholder: '匿名用户', default: '***' },
        { key: 'coverAuthor', type: 'switch', label: '处理发帖者（列表页）', description: '对帖子列表中发帖者的头像和名称进行处理', default: true },
        { key: 'coverLastCommenter', type: 'switch', label: '处理最后评论者（列表页）', description: '对列表页最后评论者的名称进行处理', default: true },
        { key: 'coverPostPage', type: 'switch', label: '处理帖子详情页', description: '对帖子内容页中所有楼层的头像和名称进行处理', default: true }
    ];

    var DEFAULT_CONFIG = {};
    SCHEMA.forEach(function(item) { DEFAULT_CONFIG[item.key] = item.default; });

    function getConfig() {
        return API.load(MODULE_ID, 'config', DEFAULT_CONFIG);
    }

    function applyToAvatar(imgEl, cfg) {
        if (!imgEl) return;
        if (cfg.avatarMode === 'blur') {
            imgEl.style.filter = 'blur(' + cfg.blurAvatarAmount + 'px)';
            imgEl.style.transition = 'filter 0.2s';
        } else if (cfg.avatarMode === 'replace') {
            if (cfg.replaceAvatar) {
                imgEl.src = cfg.replaceAvatar;
            } else {
                imgEl.style.visibility = 'hidden';
            }
        }
        imgEl.setAttribute('data-ns-privacy', '1');
    }

    function applyToName(el, cfg) {
        if (!el) return;
        if (cfg.nameMode === 'blur') {
            el.style.filter = 'blur(' + cfg.blurNameAmount + 'px)';
            el.style.transition = 'filter 0.2s';
            el.style.userSelect = 'none';
        } else if (cfg.nameMode === 'replace') {
            el.setAttribute('data-ns-orig-name', el.textContent);
            el.textContent = cfg.replaceName || '***';
        }
        el.setAttribute('data-ns-privacy', '1');
    }

    function processListItem(item, cfg) {
        if (item.getAttribute('data-ns-processed')) return;
        if (cfg.coverAuthor) {
            var avatarLink = item.querySelector(':scope > a[href^="/space/"]');
            if (avatarLink) applyToAvatar(avatarLink.querySelector('img.avatar-normal'), cfg);
            applyToName(item.querySelector('.info-author a'), cfg);
        }
        if (cfg.coverLastCommenter) {
            applyToName(item.querySelector('.info-last-commenter a'), cfg);
        }
        item.setAttribute('data-ns-processed', '1');
    }

    function processListAll(cfg) {
        document.querySelectorAll('.post-list-item:not([data-ns-processed])').forEach(function(item) {
            processListItem(item, cfg);
        });
    }

    function processPostItem(item, cfg) {
        if (item.getAttribute('data-ns-processed')) return;
        applyToAvatar(item.querySelector('.avatar-wrapper img.avatar-normal'), cfg);
        applyToName(item.querySelector('.author-name'), cfg);
        item.querySelectorAll('.nsk-badge:not(.is-poster):not(.ns-custom-badge)').forEach(function(badge) {
            badge.remove();
        });
        item.setAttribute('data-ns-processed', '1');
    }

    function processPostAll(cfg) {
        if (!cfg.coverPostPage) return;
        document.querySelectorAll('.content-item:not([data-ns-processed])').forEach(function(item) {
            processPostItem(item, cfg);
        });
    }

    function resetAll() {
        document.querySelectorAll('.post-list-item[data-ns-processed]').forEach(function(item) {
            item.removeAttribute('data-ns-processed');
            var img = item.querySelector('img.avatar-normal[data-ns-privacy]');
            if (img) {
                img.style.filter = '';
                img.style.visibility = '';
                img.removeAttribute('data-ns-privacy');
            }
            item.querySelectorAll('a[data-ns-privacy]').forEach(function(a) {
                var orig = a.getAttribute('data-ns-orig-name');
                if (orig) a.textContent = orig;
                a.style.filter = '';
                a.style.userSelect = '';
                a.removeAttribute('data-ns-orig-name');
                a.removeAttribute('data-ns-privacy');
            });
        });
        document.querySelectorAll('.content-item[data-ns-processed]').forEach(function(item) {
            item.removeAttribute('data-ns-processed');
            var img = item.querySelector('img.avatar-normal[data-ns-privacy]');
            if (img) {
                img.style.filter = '';
                img.style.visibility = '';
                img.removeAttribute('data-ns-privacy');
            }
            var nameEl = item.querySelector('.author-name[data-ns-privacy]');
            if (nameEl) {
                var orig = nameEl.getAttribute('data-ns-orig-name');
                if (orig) nameEl.textContent = orig;
                nameEl.style.filter = '';
                nameEl.style.userSelect = '';
                nameEl.removeAttribute('data-ns-orig-name');
                nameEl.removeAttribute('data-ns-privacy');
            }
        });
    }

    var observer = null;

    function startObserver(cfg) {
        if (observer) observer.disconnect();
        observer = new MutationObserver(function() {
            processListAll(cfg);
            processPostAll(cfg);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function stopObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    function renderSettings(container) {
        var cfg = getConfig();
        var form = UI.buildConfigForm(SCHEMA, cfg, function(newData) {
            API.store(MODULE_ID, 'config', newData);
            resetAll();
            stopObserver();
            var newCfg = getConfig();
            processListAll(newCfg);
            processPostAll(newCfg);
            startObserver(newCfg);
        });
        var fieldset = document.createElement('fieldset');
        fieldset.innerHTML = '<h2 style="margin: 10px 0; border-bottom: 2px solid #2ea44f; padding-bottom: 8px;">隐私保护</h2><p style="font-size:13px;color:#888;margin-bottom:16px;">隐藏或模糊页面中的用户头像与名称，保护浏览隐私。</p>';
        fieldset.appendChild(form);
        container.appendChild(fieldset);
    }

    API.register({
        id: MODULE_ID,
        name: '隐私保护',
        version: '1.3.0',
        description: '模糊或替换帖子列表及详情页中的用户头像和名称',
        render: renderSettings,
        onToggle: function(enabled) {
            if (enabled) {
                var cfg = getConfig();
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
        var cfg = getConfig();
        if (document.body) {
            processListAll(cfg);
            processPostAll(cfg);
            startObserver(cfg);
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                processListAll(cfg);
                processPostAll(cfg);
                startObserver(cfg);
            });
        }
    })();

})();