// ==UserScript==
// @name         NodeSeek 瀑布流 & 评论引用跳转修复 (子模块)
// @description  提前预加载下一页数据，实现无缝瀑布流；修复跨页引用评论导致页面刷新的问题。
// @namespace    http://www.nodeseek.com/
// @version      1.6.0
// @match        *://www.nodeseek.com/*
// @match        *://www.deepflood.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @license      GPL-3.0
// ==/UserScript==

(function () {
    'use strict';

    const MODULE_ID = 'ns_waterfall';
    const MODULE_NAME = '瀑布流 & 引用跳转';
    const MODULE_VERSION = '1.6.0';
    const MODULE_DESC = '提前预加载下一页数据，实现无缝瀑布流；修复跨页引用评论导致页面刷新的问题。';

    const DEFAULT_CONFIG = {
    enableWaterfall: true,
    enableRefFix: true,
    listThreshold: 6000,
    postThreshold: 4000,
    scrollThrottle: 100,
    smoothScroll: false,
    highlightDuration: 1500
};

const CONFIG_SCHEMA = [
    { key: 'enableWaterfall', type: 'switch', label: '瀑布流自动加载', description: '滚动到底部时自动加载下一页内容', inlineLabel: '启用', default: true },
    { key: 'enableRefFix', type: 'switch', label: '评论引用跳转修复', description: '修复跨页引用评论导致页面刷新的问题，改为页内跳转', inlineLabel: '启用', default: true },
    { key: 'listThreshold', type: 'number', label: '列表页预加载距离 (px)', description: '距离页面底部多少像素时开始加载下一页（列表页）', min: 1000, max: 20000, step: 500, default: 6000 },
    { key: 'postThreshold', type: 'number', label: '帖子页预加载距离 (px)', description: '距离页面底部多少像素时开始加载下一页（帖子页）', min: 1000, max: 20000, step: 500, default: 4000 },
    { key: 'scrollThrottle', type: 'number', label: '滚动检测间隔 (ms)', description: '滚动事件节流时间，值越小检测越灵敏', min: 50, max: 500, step: 50, default: 100 },
    { key: 'smoothScroll', type: 'switch', label: '平滑滚动', description: '引用跳转时使用平滑滚动动画，关闭则瞬间跳转', inlineLabel: '启用', default: false },
    { key: 'highlightDuration', type: 'number', label: '引用高亮时长 (ms)', description: '跳转到引用楼层后的高亮闪烁持续时间', min: 500, max: 5000, step: 500, default: 1500 }
];

    const getConfig = () => ({ ...DEFAULT_CONFIG, ...GM_getValue('ns_waterfall_config', {}) });
    const saveConfig = (data) => GM_setValue('ns_waterfall_config', data);

    // === 等待基座就绪后注册 ===
    const waitForUI = (cb, maxWait = 10000) => {
        const _win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        if (_win.NodeSeekUI) return cb(_win.NodeSeekUI);
        const start = Date.now();
        const timer = setInterval(() => {
            if (_win.NodeSeekUI) { clearInterval(timer); cb(_win.NodeSeekUI); }
            else if (Date.now() - start > maxWait) { clearInterval(timer); console.warn(`[${MODULE_NAME}] 基座未检测到，以独立模式运行`); initFeatures(); }
        }, 200);
    };

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
        // 清理上一轮的监听器（onToggle 重新启用时）
        cleanupFns.forEach(fn => fn());
        cleanupFns = [];

        const cfg = getConfig();

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

        // --- 修复评论菜单 ---
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
                    if (typeof menuInstance.$mount === "function") menuInstance.$mount(menuMount);
                } catch { }
            });
        };

        // --- 瀑布流 ---
        if (cfg.enableWaterfall) {
            const loadNextPage = async () => {
                if (isBusy) return;
                const atBottom = document.documentElement.scrollHeight <= innerHeight + scrollY + profile.threshold;
                if (!atBottom) return;
                const nextBtn = document.querySelector(profile.next);
                const nextUrl = nextBtn?.href;
                if (!nextUrl) return;

                isBusy = true;
                try {
                    const res = await fetch(nextUrl, { credentials: "include" });
                    const html = await res.text();
                    const doc = new DOMParser().parseFromString(html, "text/html");

                    if (isPost) {
                        const jsonStr = doc.getElementById("temp-script")?.textContent;
                        if (jsonStr) {
                            try {
                                const decoded = decodeURIComponent(atob(jsonStr).split("").map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
                                const parsed = JSON.parse(decoded);
                                if (parsed?.postData?.comments && window.__config__?.postData?.comments) {
                                    window.__config__.postData.comments.push(...parsed.postData.comments);
                                }
                            } catch (e) { console.error("解析新页面配置失败", e); }
                        }
                    }

                    const srcList = doc.querySelector(profile.list);
                    const dstList = document.querySelector(profile.list);
                    if (srcList && dstList) {
                        const appendedNodes = Array.from(srcList.children);
                        dstList.append(...appendedNodes);
                        processCommentMenus(appendedNodes);
                    }

                    [profile.pagerTop, profile.pagerBot].forEach(sel => {
                        const srcPager = doc.querySelector(sel);
                        const dstPager = document.querySelector(sel);
                        if (srcPager && dstPager) dstPager.innerHTML = srcPager.innerHTML;
                    });

                    history.pushState(null, null, nextUrl);
                } catch (e) {
                    console.error("瀑布流加载失败:", e);
                }
                isBusy = false;
            };

            const scrollHandler = throttle(() => {
                if (scrollY > prevY) loadNextPage();
                prevY = scrollY;
            }, cfg.scrollThrottle);

            window.addEventListener("scroll", scrollHandler, { passive: true });
            cleanupFns.push(() => window.removeEventListener("scroll", scrollHandler));
        }

        // --- 点击拦截 ---
        const clickHandler = (e) => {
            const a = e.target.closest('a');
            if (!a) return;

            // 分页器按钮强制刷新
            if (a.closest('.nsk-pager')) {
                a.target = '_self';
                e.stopImmediatePropagation();
                return;
            }

            // 楼层引用跳转修复
            if (cfg.enableRefFix && isPost && a.href && a.href.includes('#')) {
                try {
                    const linkUrl = new URL(a.href, location.origin);
                    const currentUrl = new URL(location.href);
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
            }
        };

        document.addEventListener('click', clickHandler, true);
        cleanupFns.push(() => document.removeEventListener('click', clickHandler, true));
    };

    // === 注册到基座 ===
    waitForUI((api) => {
        api.register({
            id: MODULE_ID,
            name: MODULE_NAME,
            version: MODULE_VERSION,
            description: MODULE_DESC,
            onToggle(enabled) {
                if (enabled) initFeatures();
                else { cleanupFns.forEach(fn => fn()); cleanupFns = []; }
            },
            render(container) {
                const currentConfig = getConfig();
                container.innerHTML = '';
                const fieldset = document.createElement('fieldset');
                fieldset.innerHTML = `<h2 style="margin: 10px 0; border-bottom: 2px solid #2ea44f; padding-bottom: 8px;">${MODULE_NAME} 设置</h2>`;
                fieldset.appendChild(api.UI.buildConfigForm(CONFIG_SCHEMA, currentConfig, (data) => {
                    saveConfig(data);
                    if (api.isEnabled(MODULE_ID)) initFeatures();
                }));
                container.appendChild(fieldset);
            }
        });

        if (api.isEnabled(MODULE_ID)) initFeatures();
    });

})();