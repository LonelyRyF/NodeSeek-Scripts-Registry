# NodeSeek 脚本仓库

由 [rainyfall](https://github.com/LonelyRyF) 维护的 NodeSeek / DeepFlood 油猴脚本集合。

## 目录结构

```text
NodeSeek-Scripts-Registry/
├── registry.json        # 云端脚本索引
├── version.json         # 基座版本信息
├── map.json             # 脚本文件映射
├── framework/           # 基座相关文件
├── scripts/             # 脚本文件目录，按 <脚本ID>/<版本号>.user.js 存放
└── README.md
```

---

## 安装基座（必装）

其余子模块均依赖基座运行。基座内置脚本市场，安装后可直接在 NodeSeek 设置页管理所有子模块。

**[点击安装 NodeSeek UI 基座 v5.0](https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/framework/nodeseek.user.js)**

安装基座后，进入 NodeSeek 设置页的脚本相关面板，即可浏览、安装和管理所有子模块。

---

## 使用说明

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)
2. 先安装上方 **基座脚本**
3. 进入 [nodeseek.com/setting](https://www.nodeseek.com/setting)
4. 在脚本管理/脚本市场中安装或管理子模块
5. 子模块也可通过 `registry.json` 中的 `url` 直接安装

---

## 子脚本开发文档（v5.0）

### 脚本模板

```javascript
(function() {
  'use strict';

  const API = window.NodeSeekUI;
  if (!API) return;

  const MODULE_ID = 'ns_my_script';
  const log = API.logger.scope(MODULE_ID);

  API.register({
    id: MODULE_ID,
    name: '我的脚本',
    version: '1.0.0',
    description: '功能描述',
    author: '作者名',
    minBaseVersion: '5.0',

    render(container) {
      container.innerHTML = '';
      container.appendChild(API.UI._el('div', { text: '设置面板' }));
    },

    execute() {
      log.info('脚本启动');
    },

    onEnable() {
      log.info('模块已启用');
    },

    onDisable() {
      log.info('模块已禁用');
      API.removeStyle(MODULE_ID + '_css');
    }
  });
})();
```

### 生命周期

| 钩子 | 触发时机 | 说明 |
|------|---------|------|
| `execute` | 页面加载且模块为启用状态 | 核心业务入口 |
| `render(container)` | 切换到该面板时 | 设置 UI 渲染 |
| `onEnable()` | 管理中心手动启用 | 恢复状态、重新挂载 |
| `onDisable()` | 管理中心手动禁用 | 清理副作用 |
| `onToggle(enabled)` | 兼容旧写法 | 与 `onEnable/onDisable` 互斥 |
| `canEnable()` | 点击启用前 | 返回 `false` 或字符串可阻止启用 |

**执行顺序：**

1. 页面加载时调用 `register()`
2. 基座写回元数据并关联本地安装信息
3. 如果模块已启用，则调用 `execute()`
4. 启用模块时调用 `canEnable()` / `onEnable()`
5. 禁用模块时调用 `onDisable()` 并执行已注册的清理回调

> **绝对禁忌：** 严禁在全局作用域直接运行业务代码。所有 DOM 操作、请求、监听和副作用都必须放在 `execute`、`onEnable`、`onDisable` 或 `onToggle` 中。

### 注册配置参考

```javascript
API.register({
  id: 'ns_my_script',
  name: '我的脚本',
  version: '1.0.0',
  description: '功能描述',
  author: '作者名',
  minBaseVersion: '5.0',

  render(container) {
    container.innerHTML = '';
  },

  execute() {},
  onEnable() {},
  onDisable() {},
  canEnable() { return true; }
});
```

### 数据存储

```javascript
API.store('ns_my_script', 'config', { level: 5, enabled: true });
const cfg = API.load('ns_my_script', 'config', {});
const merged = API.getConfig('ns_my_script', SCHEMA);
```

- 数据统一通过 `API.store/load/getConfig` 读写
- 不要直接使用 `GM_getValue/GM_setValue`
- `getConfig` 会自动合并 Schema 默认值，并带有缓存

### 样式注入

```javascript
API.addStyle(`
  .ns-my-card { background: var(--glass-color); }
`, 'ns_my_script_css');

API.removeStyle('ns_my_script_css');
```

- 严禁使用 `document.createElement('style')`
- 样式 ID 建议使用 `moduleId + '_css'`
- 类名请加命名空间前缀：`ns-*` 或 `nskx-*`
- 在 `onDisable()` 中务必清理样式

### 网络请求

```javascript
const res = await API.request({
  url: 'https://api.github.com/users/octocat',
  method: 'GET',
  headers: { Accept: 'application/json' },
  timeout: 10000
});

if (res.ok) {
  const data = await res.json();
  console.log(data);
}
```

### DOM 监听

```javascript
const el = await API.waitForElement('.comment-textarea', 10000);
const items = await API.waitForElement('.post-list-item', 10000, true);
```

### 页面识别

```javascript
const page = API.detectPage();

if (page.isPost) {
  console.log(page.postId);
}

const user = window.__config__?.user;
const postId = window.__config__?.postData?.postId;
```

### 清理机制

```javascript
execute() {
  const observer = new MutationObserver(() => {});
  observer.observe(document.body, { childList: true, subtree: true });

  API.onCleanup('ns_my_script', () => {
    observer.disconnect();
    API.removeStyle('ns_my_script_css');
  });
}
```

### 事件总线

```javascript
API.on('base:page-navigated', ({ hash }) => {
  console.log(hash);
});

API.emit('my_module:data-ready', { data: [1, 2, 3] });
```

### 日志系统

```javascript
const log = API.logger.scope('ns_my_script');

log.info('初始化完成');
log.warn('配置缺失');
log.error('请求失败', { status: 404 });
log.debug('调试信息');
```

日志可在 `/setting#ns_logs` 中查看、过滤、导出和清空。

### UI 组件库

```javascript
const UI = API.UI;

const input = UI.createInput({
  value: '初始值',
  placeholder: '请输入...',
  onChange: (val) => console.log(val)
});

const btn = UI.createButton({
  text: '保存',
  type: 'primary',
  onClick: () => console.log('clicked')
});
```

### Schema 表单生成器

```javascript
const SCHEMA = [
  {
    key: 'enabled',
    type: 'switch',
    label: '启用功能',
    default: true
  },
  {
    key: 'blurLevel',
    type: 'number',
    label: '模糊强度',
    min: 1,
    max: 20,
    step: 1,
    default: 8
  }
];

render(container) {
  container.innerHTML = '';
  const cfg = API.getConfig(MODULE_ID, SCHEMA);
  container.appendChild(
    API.UI.buildConfigForm(SCHEMA, cfg, (newCfg) => {
      API.store(MODULE_ID, 'config', newCfg);
    })
  );
}
```

支持的主要字段类型：`text`、`number`、`select`、`switch`、`list`、`object_list`。

### 开发规范

- 模块 ID 一律使用下划线命名法：`ns_privacy_guard`
- 所有业务逻辑放进 `execute` / `onEnable` / `onDisable` / `onToggle`
- 样式注入使用 `API.addStyle/removeStyle`
- 页面信息优先从 `window.__config__` 和 `API.detectPage()` 获取
- 异步 DOM 使用 `API.waitForElement()`，不要盲轮询
- 所有外部副作用都注册 `API.onCleanup()`
- 两者不能同时用：`onToggle` 与 `onEnable/onDisable`
- 建议声明 `minBaseVersion: '5.0'`

### v4.9 → v5.0 升级要点

- 新增统一存储层 `Storage`
- 新增统一网络层 `NetClient`
- 新增 `ns_compat`、`ns_logs` 系统面板
- `request()` 返回统一响应对象
- `waitForElement()` 支持 `all` 模式
- 新增 `Logger` 与 `EventBus`
- 本地安装完全依赖 `register()`

---

## 提交新脚本

1. Fork 本仓库
2. 将脚本放至 `scripts/<脚本ID>/<版本号>.user.js`
3. 在 `registry.json` 的 `scripts` 数组中添加一条记录：

```json
{
  "id": "your-script-id",
  "name": "脚本名称",
  "description": "脚本描述",
  "version": "1.0.0",
  "author": "作者名",
  "tags": ["标签1", "标签2"],
  "url": "https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/scripts/your-script-id/1.0.0.user.js"
}
```

4. 提交 Pull Request
