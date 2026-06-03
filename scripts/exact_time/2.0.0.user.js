(function () {
  const API = window.NodeSeekUI;
  if (!API) { console.error("未检测到 NodeSeek UI 基座"); return; }

  const MODULE_ID = "exact_time";
  let timer = null;

  function replaceRelativeTime() {
    const attr = "data-ns-time-replaced";
    document.querySelectorAll(`[title]:not([${attr}])`).forEach((el) => {
      try {
        const title = el.getAttribute("title") || "";
        if (!title) return;
        const text = (el.textContent || "").trim();
        const lower = text.toLowerCase();
        const looksRelative = /\bago\b/.test(lower) || /刚刚|分钟前|小时|天前|月前|年前/.test(text);
        if (!looksRelative) return;
        let display = title;
        if (/\bedited\b/.test(lower)) {
          const clean = title.replace(/^\s*edited\s*/i, "").replace(/^\s*编辑于\s*/i, "");
          display = "编辑时间 " + clean;
        }
        el.textContent = display;
        el.setAttribute(attr, "true");
      } catch (e) {}
    });
  }

  function start() {
    stop();
    const cfg = API.getConfig(MODULE_ID, [{ key: "interval", default: 2000 }]);
    replaceRelativeTime();
    timer = setInterval(replaceRelativeTime, cfg.interval);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  API.register({
    id: MODULE_ID,
    name: "精确时间显示",
    version: "2.0.0",
    description: "将相对时间替换为悬停提示中的绝对时间。",
    author: "_RyF",
    defaults: { interval: 2000 },
    settings: [
      {
        type: "section",
        title: "扫描设置",
        fields: [
          {
            key: "interval", type: "number", label: "扫描频率 (ms)",
            description: "扫描页面新时间的频率，默认 2000ms。",
            min: 500, max: 10000, step: 500, default: 2000,
          },
          {
            type: "button", label: "立即扫描一次",
            onClick: () => replaceRelativeTime(),
          },
        ],
      },
    ],
    execute() { start(); },
    onToggle(enabled) { enabled ? start() : stop(); },
    onConfigChange() { if (timer) start(); }, // 运行中则按新频率重启
  });
})();
