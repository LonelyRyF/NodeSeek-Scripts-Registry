(function () {
    'use strict';

    const API = window.NodeSeekUI;
    const MODULE_ID = 'ns_conversation';
    const MODULE_NAME = '对话链查看';
    const MODULE_VERSION = '1.3.0';
    const MODULE_DESC = '在评论操作栏添加"对话"按钮，展开完整上下文对话链，支持跨页探测与嵌套扫描。';

    const SCHEMA = [
        { key: 'alwaysShow', type: 'switch', label: '始终显示对话按钮', description: '对所有评论显示按钮，即使没有引用', default: false },
        { key: 'enableFetch', type: 'switch', label: '跨页加载（向上追溯）', description: '引用了其他页楼层时，自动 fetch 对应页面', default: false },
        { key: 'enableScan', type: 'switch', label: '跨页扫描（向下探测）', description: '主动 fetch 后续页面，寻找引用了当前楼层的回复', default: false },
        { key: 'enableNestedScan', type: 'switch', label: '嵌套向下扫描', description: '找到回复后，继续扫描该回复的回复，递归展开', default: false },
        { key: 'maxDepth', type: 'number', label: '向上追溯深度', description: '往上追溯的最大层数', min: 1, max: 20, step: 1, default: 10 },
        { key: 'maxScanPages', type: 'number', label: '向下探测最大页数', description: '向下最多主动 fetch 几页', min: 1, max: 20, step: 1, default: 3 },
        { key: 'maxNestedDepth', type: 'number', label: '嵌套扫描深度', description: '嵌套向下扫描的最大递归层数', min: 1, max: 5, step: 1, default: 2 },
        { key: 'collapseThreshold', type: 'number', label: '折叠阈值', description: '对话链超过此条数时折叠显示，0 表示不折叠', min: 0, max: 50, step: 1, default: 0 },
        { key: 'showPageBadge', type: 'switch', label: '显示页码标注', description: '跨页 fetch 来的楼层显示"第N页"标注', default: true },
    ];

    const getConfig = () => API.getConfig(MODULE_ID, SCHEMA);
    const saveConfig = (data) => API.store(MODULE_ID, 'config', data);

    let cleanupFns = [];
    const cleanup = () => { cleanupFns.forEach(f => f()); cleanupFns = []; };

    const SCOPED = 'data-v-254da704';

    // ── PageCache ─────────────────────────────────────────────────
    const PageCache = (() => {
        const DB = 'ns-waterfall-cache', STORE = 'pages';
        let _db = null;
        const open = () => _db ? Promise.resolve(_db) : new Promise((res, rej) => {
            const r = indexedDB.open(DB, 1);
            r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'key' }); };
            r.onsuccess = () => { _db = r.result; res(_db); };
            r.onerror = () => rej(r.error);
        });
        return {
            async get(key) {
                const db = await open();
                return new Promise(res => {
                    const r = db.transaction(STORE).objectStore(STORE).get(key);
                    r.onsuccess = () => res(r.result?.html || null);
                    r.onerror = () => res(null);
                });
            },
            async set(key, html) {
                const db = await open();
                return new Promise(res => {
                    const tx = db.transaction(STORE, 'readwrite');
                    tx.objectStore(STORE).put({ key, html, ts: Date.now() });
                    tx.oncomplete = res; tx.onerror = res;
                });
            }
        };
    })();

    // ── 限速 fetch（5 req/s，失败重试）──────────────────────────
    const RateLimiter = (() => {
        const INTERVAL = 200; // 200ms = 5 req/s
        let lastTime = 0;
        const wait = () => {
            const now = Date.now();
            const diff = now - lastTime;
            if (diff >= INTERVAL) { lastTime = now; return Promise.resolve(); }
            const delay = INTERVAL - diff;
            lastTime = now + delay;
            return new Promise(r => setTimeout(r, delay));
        };
        return {
            async fetch(url, retries = 2) {
                await wait();
                for (let i = 0; i <= retries; i++) {
                    try {
                        const res = await fetch(url, { credentials: 'include' });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        return res;
                    } catch (e) {
                        if (i === retries) throw e;
                        await new Promise(r => setTimeout(r, 300 * (i + 1)));
                    }
                }
            }
        };
    })();

    // ── 页面缓存 fetch ────────────────────────────────────────────
    // 返回 { doc, fromCache } 方便标注页码
    const fetchDoc = async (url) => {
        const key = new URL(url, location.origin).pathname;
        let html = await PageCache.get(key);
        const fromCache = !!html;
        if (!html) {
            const res = await RateLimiter.fetch(url);
            html = await res.text();
            await PageCache.set(key, html);
        }
        return { doc: new DOMParser().parseFromString(html, 'text/html'), fromCache };
    };

    // ── 工具 ──────────────────────────────────────────────────────
    const getPostId = () => window.__config__?.postData?.postId;
    const getTotalPages = () => window.__config__?.postData?.postPageCount || 1;
    const getPerPage = () => window.__config__?.commmentPerPage || 10;

    const getPageForFloor = (floorId) => {
        const floor = parseInt(floorId);
        if (isNaN(floor) || floor === 0) return 1;
        return Math.ceil(floor / getPerPage());
    };

    const pageUrl = (n) => `${location.origin}/post-${getPostId()}-${n}`;

    const getQuotedFloorIds = (item) => {
        const ids = [];
        const postId = getPostId();
        item.querySelectorAll('article.post-content a[href*="#"]').forEach(a => {
            try {
                const raw = a.getAttribute('href');
                if (!raw) return;
                const u = new URL(raw, location.origin);
                if (postId && !u.pathname.includes(`/post-${postId}-`)) return;
                const hash = u.hash.slice(1);
                if (hash && /^\d+$/.test(hash)) ids.push(hash);
            } catch {}
        });
        return [...new Set(ids)];
    };

    // 获取已被 waterfall 加载的页码集合
    const getLoadedPageNums = () => {
        const set = new Set();
        document.querySelectorAll('.wf-page-marker').forEach(m => {
            const match = m.dataset.url?.match(/\/post-\d+-(\d+)/);
            if (match) set.add(parseInt(match[1]));
        });
        const cur = location.pathname.match(/\/post-\d+-(\d+)/);
        if (cur) set.add(parseInt(cur[1]));
        return set;
    };

    // 从 DOM 或已 fetch 的 doc 里找楼层元素，附带来源页码
    const docCache = new Map(); // pageNum → doc

    const getFloorEl = async (floorId, enableFetch) => {
        // 先找真实 DOM
        let el = document.getElementById(floorId);
        if (el && !el.classList.contains('ns-conv-item')) return { el, page: null };

        if (!enableFetch) return { el: null, page: null };

        const page = getPageForFloor(floorId);
        if (!page) return { el: null, page: null };

        // 从缓存的 doc 里找
        if (docCache.has(page)) {
            return { el: docCache.get(page).getElementById(floorId), page };
        }

        try {
            const { doc } = await fetchDoc(pageUrl(page));
            docCache.set(page, doc);
            return { el: doc.getElementById(floorId), page };
        } catch {
            return { el: null, page: null };
        }
    };

    // ── 向上追溯 ──────────────────────────────────────────────────
    const buildUpChain = async (startItem, maxDepth, enableFetch) => {
        const chain = []; // [{ el, page }]
        const visited = new Set([startItem.id]);
        let current = startItem;

        for (let depth = 0; depth < maxDepth; depth++) {
            const ids = getQuotedFloorIds(current);
            if (!ids.length) break;
            const targetId = ids[0];
            if (visited.has(targetId)) break;
            visited.add(targetId);

            const { el, page } = await getFloorEl(targetId, enableFetch);
            if (!el) break;

            chain.unshift({ el, page });
            current = el;
        }
        return chain;
    };

    // ── 向下扫描（含嵌套）────────────────────────────────────────
    const buildDownChain = async (item, enableScan, maxScanPages, enableNested, maxNestedDepth) => {
        const floorId = item.id;
        if (!floorId) return [];

        const allResults = []; // [{ el, page, depth }]
        const seen = new Set();

        // 扫描某个楼层的回复
        const scanRepliesOf = async (targetFloorId, depth) => {
            if (depth > maxNestedDepth) return;

            const found = []; // [{ el, page }]

            // 扫已加载 DOM
            document.querySelectorAll('.content-item:not(.ns-conv-item)').forEach(el => {
                if (el.id === targetFloorId) return;
                if (getQuotedFloorIds(el).includes(targetFloorId) && !seen.has(el.id)) {
                    seen.add(el.id);
                    found.push({ el, page: null });
                }
            });

            // 跨页扫描
            if (enableScan && maxScanPages > 0) {
                const currentPage = getPageForFloor(targetFloorId) || 1;
                const endPage = Math.min(currentPage + maxScanPages, getTotalPages());
                const loadedNums = getLoadedPageNums();

                for (let p = currentPage + 1; p <= endPage; p++) {
                    if (loadedNums.has(p)) {
                        // 已在 DOM，上面已扫过
                        continue;
                    }
                    let doc = docCache.get(p);
                    if (!doc) {
                        try {
                            const result = await fetchDoc(pageUrl(p));
                            doc = result.doc;
                            docCache.set(p, doc);
                        } catch { continue; }
                    }
                    doc.querySelectorAll('.content-item').forEach(el => {
                        if (getQuotedFloorIds(el).includes(targetFloorId) && !seen.has(el.id)) {
                            seen.add(el.id);
                            found.push({ el, page: p });
                        }
                    });
                }
            }

            // 加入结果
            for (const item of found) {
                allResults.push({ ...item, depth });
                // 嵌套扫描
                if (enableNested && depth < maxNestedDepth && item.el.id) {
                    await scanRepliesOf(item.el.id, depth + 1);
                }
            }
        };

        await scanRepliesOf(floorId, 0);
        return allResults;
    };

    // ── Vue 菜单挂载 ──────────────────────────────────────────────
    let vueCache = null;
    const getVue = () => {
        if (vueCache) return vueCache;
        const v = document.querySelector('.comment-menu')?.__vue__;
        if (v?.$root?.constructor && v?.$options) vueCache = { C: v.$root.constructor, o: v.$options };
        return vueCache;
    };

    const getCommentIndex = (floorId) =>
        (window.__config__?.postData?.comments || []).findIndex(c => String(c.floorIndex) === floorId);

    const mountMenu = (el, idx) => {
        const v = getVue(); if (!v || idx < 0) return;
        const oldMount = el.querySelector('.comment-menu-mount');
        if (!oldMount) return;
        const newMount = document.createElement('div');
        newMount.className = 'comment-menu-mount';
        oldMount.replaceWith(newMount);
        try { const i = new v.C(v.o); i.setIndex?.(idx); i.$mount?.(newMount); } catch {}
    };

    // ── clone 节点 ────────────────────────────────────────────────
    const cloneItem = (originalEl, role, page, depth, showPageBadge) => {
        const clone = originalEl.cloneNode(true);
        clone.removeAttribute('id');
        clone.classList.add('ns-conv-item');
        clone.querySelectorAll('.ns-conv-btn, .ns-conv-thread, .ns-conv-role-tag').forEach(el => el.remove());

        const borderColors = { up: '#2ea44f', cur: '#ffd400', down: '#45ca6b' };
        // 嵌套层级用透明度区分
        const opacity = depth > 0 ? Math.max(0.5, 1 - depth * 0.15) : 1;
        clone.style.cssText = `border-left: 3px solid ${borderColors[role]};opacity:${opacity};`;

        const floorLink = clone.querySelector('.floor-link');
        if (floorLink) {
            const labels = { up: '上文', cur: '当前', down: '回复' };
            const colors = { up: '#2ea44f', cur: '#ffd400', down: '#45ca6b' };
            const textColors = { up: '#fff', cur: '#2a4b3c', down: '#fff' };

            const tag = document.createElement('span');
            tag.className = 'ns-conv-role-tag';
            tag.style.cssText = `font-size:10px;padding:1px 5px;border-radius:3px;background:${colors[role]};color:${textColors[role]};margin-left:4px;vertical-align:middle;`;
            tag.textContent = depth > 0 ? `↳ 回复` : labels[role];
            floorLink.insertAdjacentElement('afterend', tag);

            // 页码标注
            if (showPageBadge && page) {
                const pageBadge = document.createElement('span');
                pageBadge.className = 'ns-conv-role-tag';
                pageBadge.style.cssText = 'font-size:10px;padding:1px 5px;border-radius:3px;background:#666;color:#fff;margin-left:4px;vertical-align:middle;';
                pageBadge.textContent = `第${page}页`;
                tag.insertAdjacentElement('afterend', pageBadge);
            }
        }

        // 头像点击
        clone.querySelectorAll('img.avatar-normal').forEach(img => {
            const a = img.closest('a[href*="/space/"]');
            const uid = a?.href.match(/\/space\/(\d+)/)?.[1];
            if (!uid) return;
            img.style.cursor = 'pointer';
            img.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                const hc = document.querySelector('.hover-user-card')?.__vue__;
                if (!hc) return;
                const rect = img.getBoundingClientRect();
                hc.left = rect.left;
                hc.top = rect.top;
                hc.loadUser(parseInt(uid));
                hc.show();
            }, true);
        });

        return clone;
    };

    // ── 渲染对话链 ────────────────────────────────────────────────
    const THREAD_CLASS = 'ns-conv-thread';

    const renderThread = async (triggerItem, cfg) => {
        const next = triggerItem.nextElementSibling;
        if (next?.classList.contains(THREAD_CLASS)) { next.remove(); return; }

        // 清空 docCache，每次点击重新扫（避免旧数据）
        docCache.clear();

        const loading = document.createElement('div');
        loading.className = THREAD_CLASS;
        loading.style.cssText = 'padding:8px 12px;color:#999;font-size:13px;border-left:3px solid var(--main-color);';
        loading.textContent = '加载对话链中…';
        triggerItem.insertAdjacentElement('afterend', loading);

        let upChain, downChain;
        try {
            [upChain, downChain] = await Promise.all([
                buildUpChain(triggerItem, cfg.maxDepth, cfg.enableFetch),
                buildDownChain(
                    triggerItem,
                    cfg.enableScan,
                    cfg.maxScanPages,
                    cfg.enableNestedScan,
                    cfg.maxNestedDepth
                )
            ]);
        } catch (e) {
            loading.remove();
            API.showAlert('加载对话链失败');
            return;
        }

        loading.remove();

        if (!upChain.length && !downChain.length) {
            API.showAlert('未找到相关对话');
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = THREAD_CLASS;
        wrapper.style.cssText = `
            margin: 4px 0 8px;
            border: 1px solid var(--main-color);
            border-radius: 8px;
            overflow: hidden;
            background: var(--glass-color);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        `;

        wrapper.addEventListener('click', (e) => {
            const img = e.target.closest('img.avatar-normal');
            if (!img) return;
            const a = img.closest('a[href*="/space/"]');
            const uid = a?.href.match(/\/space\/(\d+)/)?.[1];
            if (!uid) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            const hc = document.querySelector('.hover-user-card')?.__vue__;
            if (!hc) return;
            const rect = img.getBoundingClientRect();
            hc.left = rect.left;
            hc.top = rect.top;
            hc.loadUser(parseInt(uid));
            hc.show();
        }, true);

        const totalCount = upChain.length + 1 + downChain.length;
        const shouldCollapse = cfg.collapseThreshold > 0 && totalCount > cfg.collapseThreshold;

        // 内容容器（折叠时隐藏）
        const contentEl = document.createElement('div');
        contentEl.className = 'ns-conv-content';
        if (shouldCollapse) contentEl.style.display = 'none';

        const appendItems = (items, role) => {
            items.forEach(({ el, page, depth = 0 }, i) => {
                if (i > 0 && depth === 0) {
                    const sep = document.createElement('div');
                    sep.style.cssText = 'height:1px;background:var(--glass-color);margin:0 12px;';
                    contentEl.appendChild(sep);
                }
                // 嵌套缩进
                const wrap = document.createElement('div');
                if (depth > 0) wrap.style.cssText = `margin-left:${depth * 16}px;`;
                const clone = cloneItem(el, role, page, depth, cfg.showPageBadge);
                mountMenu(clone, getCommentIndex(el.id));
                wrap.appendChild(clone);
                contentEl.appendChild(wrap);
            });
        };

        if (upChain.length) {
            appendItems(upChain, 'up');
            const sep = document.createElement('div');
            sep.style.cssText = 'height:2px;background:var(--glass-color);';
            contentEl.appendChild(sep);
        }

        const curClone = cloneItem(triggerItem, 'cur', null, 0, false);
        mountMenu(curClone, getCommentIndex(triggerItem.id));
        contentEl.appendChild(curClone);

        if (downChain.length) {
            const sep = document.createElement('div');
            sep.style.cssText = 'height:2px;background:var(--glass-color);';
            contentEl.appendChild(sep);
            appendItems(downChain, 'down');
        }

        wrapper.appendChild(contentEl);

        // 折叠展开 header
        if (shouldCollapse) {
            const header = document.createElement('div');
            header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;cursor:pointer;font-size:13px;color:#999;';
            header.innerHTML = `<span>💬 对话链 · ${upChain.length} 条上文 · ${downChain.length} 条回复</span><span style="color:var(--main-color);">展开</span>`;
            let expanded = false;
            header.addEventListener('click', () => {
                expanded = !expanded;
                contentEl.style.display = expanded ? '' : 'none';
                header.querySelector('span:last-child').textContent = expanded ? '收起' : '展开';
            });
            wrapper.insertBefore(header, contentEl);
        }

        // 收起栏
        const collapseRow = document.createElement('div');
        collapseRow.style.cssText = 'display:flex;justify-content:center;align-items:center;padding:8px;background:var(--main-color);cursor:pointer;gap:4px;';
        collapseRow.innerHTML = `<svg class="iconpark-icon" style="width:14px;height:14px;color:#fff;"><use href="#up"></use></svg><span style="font-size:13px;color:#fff;font-weight:500;">收起对话</span>`;
        collapseRow.addEventListener('click', () => wrapper.remove());
        wrapper.appendChild(collapseRow);

        triggerItem.insertAdjacentElement('afterend', wrapper);
    };

    // ── 注入按钮 ──────────────────────────────────────────────────
    const BTN_CLASS = 'ns-conv-btn';

    const injectBtn = (item) => {
        if (item.classList.contains('ns-conv-item')) return;
        const cfg = getConfig();
        if (!cfg.alwaysShow && !getQuotedFloorIds(item).length) return;
        if (item.querySelector(`.${BTN_CLASS}`)) return;

        const tryInsert = () => {
            const menu = item.querySelector('.comment-menu');
            if (!menu) return false;
            const btn = document.createElement('div');
            btn.setAttribute(SCOPED, '');
            btn.className = `menu-item ${BTN_CLASS}`;
            btn.title = '查看对话';
            btn.innerHTML = `<svg ${SCOPED}="" class="iconpark-icon"><use ${SCOPED}="" href="#comments"></use></svg><span ${SCOPED}="">对话</span>`;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                renderThread(item, getConfig());
            });
            const quoteBtn = Array.from(menu.querySelectorAll('.menu-item')).find(el =>
                el.querySelector('use[href="#quote"]')
            );
            if (quoteBtn) quoteBtn.insertAdjacentElement('beforebegin', btn);
            else menu.appendChild(btn);
            return true;
        };

        if (!tryInsert()) {
            const mount = item.querySelector('.comment-menu-mount');
            if (!mount) return;
            const obs = new MutationObserver(() => { if (tryInsert()) obs.disconnect(); });
            obs.observe(mount, { childList: true, subtree: true });
            setTimeout(() => obs.disconnect(), 5000);
        }
    };

    const injectButtons = () => {
        if (!location.pathname.match(/^\/post-/)) return;
        document.querySelectorAll('.content-item').forEach(injectBtn);
        const list = document.querySelector('ul.comments');
        if (!list) return;
        const obs = new MutationObserver(muts => {
            muts.forEach(m => m.addedNodes.forEach(n => {
                if (n.nodeType !== 1) return;
                if (n.classList?.contains('content-item')) injectBtn(n);
                n.querySelectorAll?.('.content-item:not(.ns-conv-item)').forEach(injectBtn);
            }));
        });
        obs.observe(list, { childList: true, subtree: true });
        cleanupFns.push(() => obs.disconnect());
    };

    // ── 注册 ──────────────────────────────────────────────────────
    API.register({
        id: MODULE_ID,
        name: MODULE_NAME,
        version: MODULE_VERSION,
        description: MODULE_DESC,

        render(container) {
            const cfg = getConfig();
            const form = API.UI.buildConfigForm(SCHEMA, cfg, (data) => {
                saveConfig(data);
                document.querySelectorAll(`.${BTN_CLASS}`).forEach(el => el.remove());
                injectButtons();
                API.showAlert('配置已保存！');
            });
            const fs = document.createElement('fieldset');
            fs.innerHTML = `<h2 style="margin:10px 0;border-bottom:2px solid #2ea44f;padding-bottom:8px;">${MODULE_NAME} 设置</h2>`;
            fs.appendChild(form);
            container.appendChild(fs);
        },

        execute() { injectButtons(); },
        onToggle(on) {
            if (on) injectButtons();
            else {
                cleanup();
                document.querySelectorAll(`.${THREAD_CLASS}, .${BTN_CLASS}`).forEach(el => el.remove());
            }
        }
    });
})();