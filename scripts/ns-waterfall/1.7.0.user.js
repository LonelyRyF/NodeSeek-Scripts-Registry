(function () {
    'use strict';

    const API = window.NodeSeekUI;
    const MODULE_ID = 'ns_waterfall';
    const MODULE_NAME = '瀑布流 & 引用跳转';
    const MODULE_VERSION = '1.7.0';
    const MODULE_DESC = '提前预加载下一页数据，实现无缝瀑布流；修复跨页引用评论导致页面刷新的问题。';

    const CONFIG_SCHEMA = [
        { key: 'enableWaterfall', type: 'switch', label: '瀑布流自动加载', description: '滚动到底部时自动加载下一页内容', inlineLabel: '启用', default: true },
        { key: 'enableRefFix', type: 'switch', label: '评论引用跳转修复', description: '修复跨页引用评论导致页面刷新的问题，改为页内跳转', inlineLabel: '启用', default: true },
        { key: 'listThreshold', type: 'number', label: '列表页预加载距离 (px)', description: '距离页面底部多少像素时开始加载下一页（列表页）', min: 1000, max: 20000, step: 500, default: 6000 },
        { key: 'postThreshold', type: 'number', label: '帖子页预加载距离 (px)', description: '距离页面底部多少像素时开始加载下一页（帖子页）', min: 1000, max: 20000, step: 500, default: 4000 },
        { key: 'scrollThrottle', type: 'number', label: '滚动检测间隔 (ms)', description: '滚动事件节流时间，值越小检测越灵敏', min: 50, max: 500, step: 50, default: 100 },
        { key: 'smoothScroll', type: 'switch', label: '平滑滚动', description: '引用跳转时使用平滑滚动动画，关闭则瞬间跳转', inlineLabel: '启用', default: false },
        { key: 'highlightDuration', type: 'number', label: '引用高亮时长 (ms)', description: '跳转到引用楼层后的高亮闪烁持续时间', min: 500, max: 5000, step: 500, default: 1500 }
    ];

    // === 工具函数 ===
    const throttle = (fn, ms) => {
        let last = 0;
        return (...a) => {
            const now = Date.now();
            if (now - last >= ms) { last = now; fn(...a); }
        };
    };

    // === 功能主体 ===
    let cleanupFns = [];

    const initFeatures = () => {
        cleanupFns.forEach(fn => fn());
        cleanupFns = [];

        const cfg = API.getConfig(MODULE_ID, CONFIG_SCHEMA);

        const PROFILES = {
            list: { path: /^\/(categories\/|page|award|search|$)/, threshold: cfg.listThreshold, next: ".nsk-pager a.pager-next", list: "ul.post-list:not(.topic-carousel-panel)", pagerTop: "div.nsk-pager.pager-top", pagerBot: "div.nsk-pager.pager-bottom" },
            post: { path: /^\/post-/, threshold: cfg.postThreshold, next: ".nsk-pager a.pager-next", list: "ul.comments", pagerTop: "div.nsk-pager.post-top-pager", pagerBot: "div.nsk-pager.post-bottom-pager" }
        };

        const isList = PROFILES.list.path.test(location.pathname);
        const isPost = PROFILES.post.path.test(location.pathname);
        const profile = isList ? PROFILES.list : isPost ? PROFILES.post : null;

        if (!profile) return;

        let isBusy = false;
        let prevY = scrollY;

        const processCommentMenus = (commentElements) => {
            if (!isPost || !commentElements?.length) return;
            const existingMenu = document.querySelector(".comment-menu");
            const vue = existingMenu?.__vue__;
            if (!vue?.$root?.constructor || !vue?.$options) return;

            const startIndex = document.querySelectorAll(".content-item").length - commentElements.length;
            commentElements.forEach((comment, index) => {
                const menuMount = document.createElement("div");
                menuMount.className = "comment-menu-mount";
                comment.appendChild(menuMount);
                try {
                    const menuInstance = new vue.$root.constructor(vue.$options);
                    if (typeof menuInstance.setIndex === "function") menuInstance.setIndex(startIndex + index);
                    menuInstance.$mount(menuMount);
                } catch (e) { console.warn('[ns-waterfall] menu mount failed', e); }
            });
        };

        const loadNextPage = async () => {
            if (isBusy) return;
            const nextLink = document.querySelector(profile.next);
            if (!nextLink) return;
            isBusy = true;
            try {
                const res = await fetch(nextLink.href);
                const text = await res.text();
                const doc = new DOMParser().parseFromString(text, 'text/html');
                const newItems = doc.querySelectorAll(profile.list + ' > li');
                const newPagerBot = doc.querySelector(profile.pagerBot);
                const list = document.querySelector(profile.list);
                if (!list || !newItems.length) { isBusy = false; return; }
                const addedItems = [];
                newItems.forEach(item => { list.appendChild(item); addedItems.push(item); });
                processCommentMenus(addedItems);
                const pagerBot = document.querySelector(profile.pagerBot);
                const pagerTop = document.querySelector(profile.pagerTop);
                if (newPagerBot) {
                    if (pagerBot) pagerBot.replaceWith(newPagerBot.cloneNode(true));
                    if (pagerTop) pagerTop.replaceWith(newPagerBot.cloneNode(true));
                } else {
                    if (pagerBot) pagerBot.remove();
                    if (pagerTop) pagerTop.remove();
                }
                history.replaceState(null, '', nextLink.href);
            } catch(e) { console.warn('[ns-waterfall] load failed', e); }
            isBusy = false;
        };

        if (cfg.enableWaterfall) {
            const scrollHandler = throttle(() => {
                const dy = scrollY - prevY;
                prevY = scrollY;
                if (dy > 0 && (document.documentElement.scrollHeight - scrollY - innerHeight) < profile.threshold) {
                    loadNextPage();
                }
            }, cfg.scrollThrottle);
            window.addEventListener('scroll', scrollHandler, { passive: true });
            cleanupFns.push(() => window.removeEventListener('scroll', scrollHandler));
        }

        if (cfg.enableRefFix) {
            const clickHandler = (e) => {
                const link = e.target.closest('a[href]');
                if (!link) return;
                try {
                    const currentUrl = new URL(location.href);
                    const linkUrl = new URL(link.href, location.href);
                    const linkPostId = linkUrl.pathname.match(/\/post-(\d+)/)?.[1];
                    const currentPostId = currentUrl.pathname.match(/\/post-(\d+)/)?.[1];
                    if (linkPostId && linkPostId === currentPostId) {
                        const hashVal = linkUrl.hash.substring(1);
                        if (hashVal) {
                            const targetEl = document.getElementById(hashVal) || document.querySelector(`a[name="${hashVal}"]`)?.parentElement;
                            if (targetEl) {
                                e.preventDefault();
                                e.stopImmediatePropagation();
                                targetEl.scrollIntoView({ behavior: cfg.smoothScroll ? 'smooth' : 'auto' });
                                targetEl.style.transition = 'background-color 0.4s ease';
                                const origBg = targetEl.style.backgroundColor || '';
                                targetEl.style.backgroundColor = 'rgba(255, 152, 0, 0.2)';
                                setTimeout(() => {
                                    targetEl.style.backgroundColor = origBg;
                                    setTimeout(() => { targetEl.style.transition = ''; }, 400);
                                }, cfg.highlightDuration);
                            }
                        }
                    }
                } catch (err) { }
            };
            document.addEventListener('click', clickHandler, true);
            cleanupFns.push(() => document.removeEventListener('click', clickHandler, true));
        }
    };

    API.register({
        id: MODULE_ID,
        name: MODULE_NAME,
        version: MODULE_VERSION,
        description: MODULE_DESC,
        execute: function() {
            initFeatures();
        },
        onToggle: function(enabled) {
            if (enabled) initFeatures();
            else { cleanupFns.forEach(fn => fn()); cleanupFns = []; }
        },
        render: function(container) {
            const currentConfig = API.getConfig(MODULE_ID, CONFIG_SCHEMA);
            container.innerHTML = '';
            const fieldset = document.createElement('fieldset');
            fieldset.innerHTML = `<h2 style="margin: 10px 0; border-bottom: 2px solid #2ea44f; padding-bottom: 8px;">${MODULE_NAME} 设置</h2>`;
            fieldset.appendChild(API.UI.buildConfigForm(CONFIG_SCHEMA, currentConfig, (data) => {
                API.store(MODULE_ID, 'config', data);
                if (API.isEnabled(MODULE_ID)) initFeatures();
            }));
            container.appendChild(fieldset);
        }
    });

})();
