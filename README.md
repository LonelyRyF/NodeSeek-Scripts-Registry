# NodeSeek 脚本仓库

由 [rainyfall](https://github.com/LonelyRyF) 维护的 NodeSeek / DeepFlood 油猴脚本集合。

## 目录结构

```
NodeSeek-Scripts-Registry/
├── registry.json        # 云端脚本索引（子模块）
├── version.json         # 基座版本信息（自动更新）
├── scripts/             # 脚本文件目录，按 <脚本ID>/<版本号>.user.js 存放
└── README.md
```

---

## 安装基座（必装）

其余子模块均依赖基座运行。基座内置脚本市场，安装后可直接在 NodeSeek 设置页管理所有子模块。

**[点击安装 NodeSeek Setting Framework v4.8](https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/scripts/ns-ui-framework/4.8.user.js)**

安装基座后，进入 NodeSeek 设置页 → 「脚本市场」即可浏览并安装所有子模块。

---

## 使用说明

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)
2. 先安装上方 **基座脚本**
3. 进入 [nodeseek.com/setting](https://www.nodeseek.com/setting) → 「脚本市场」安装子模块
4. 子模块也可通过 `registry.json` 中的 `url` 直接安装

---

## 子脚本开发文档（v4.8）

### 架构概述

```
基座 (nodeseek.user.js) [运行于 Tampermonkey 沙盒, 拥有极高权限]
├── window.NodeSeekUI ← 暴露给原生网页(Page Context)的桥梁 API
│   ├── .UI             ← UI 组件库 (支持高级表单)
│   ├── .register()     ← 注册模块与生命周期钩子
│   ├── .getConfig()    ← 配置自动合并器
│   ├── .addStyle()     ← 穿透 CSP 限制注入 CSS
│   ├── .request()      ← 穿透 CORS 限制发起跨域请求
│   └── .waitForElement() ← SPA 异步 DOM 监听
│
└── 脚本市场 (registry.json)
    └── 子脚本 (云端加载) ← 注入原生网页，通过生命周期钩子由基座调度
```

### 子脚本生命周期

从 v4.7 开始，基座**不再物理拦截**禁用脚本的注入。所有已安装的脚本都会被加载，但核心逻辑由基座统一调度。

**加载时序：**
1. 基座读取本地存储的脚本代码，并全部注入到页面
2. 子脚本在全局作用域**仅作变量声明**，并立即调用 `API.register()` 注册自己
3. 基座接收到注册信息，挂载 UI 面板
4. 基座判断该模块的状态：
   - **若为启用状态**：基座主动调用子脚本提供的 `execute` 钩子，执行核心业务
   - **若为禁用状态**：基座跳过执行，仅在管理中心保留其 UI 界面

> **⚠️ 绝对禁忌：** 严禁在脚本的全局作用域直接运行业务代码（如操作 DOM、发起请求）。所有业务逻辑**必须**包裹在 `execute` 或 `onToggle` 钩子中。

### 注册面板与钩子

```javascript
window.NodeSeekUI.register({
  id: 'ns_my_script',   // 唯一 ID（规范：统一使用下划线 _）
  name: '我的脚本',     // Tab 显示名称
  version: '1.0.0',
  description: '功能描述',

  // 【UI 渲染】每次切换到该面板时触发
  render: function(container) {
    container.innerHTML = '<h2>设置面板</h2>';
  },

  // 【核心启动】基座判定模块已开启时触发（替代原先的全局自执行）
  execute: function() {
    API.addStyle('.hide { display:none; }', 'my_style');
  },

  // 【热切换】用户在管理中心手动点击「启用/禁用」时触发
  onToggle: function(enabled) {
    if (enabled) API.addStyle('.hide { display:none; }', 'my_style');
    else API.removeStyle('my_style');
  }
});
```

### 增强版 API 接口

```javascript
// 数据与配置
API.store(moduleId, key, value);
const val = API.load(moduleId, key, defaultValue);
const config = API.getConfig(MODULE_ID, SCHEMA); // 自动合并默认配置

// 沙盒穿透（DOM 与网络）
API.addStyle('.btn { color: red; }', 'my_custom_style'); // 穿透 CSP
API.removeStyle('my_custom_style');
const res = await API.request({ url: 'https://...', method: 'GET' }); // 穿透 CORS
const el = await API.waitForElement('.comment-textarea', 10000); // 异步等待元素

// UI 交互
API.showAlert('操作成功');
```

### Schema 高级表单

使用 `UI.buildConfigForm()` 通过 Schema 声明快速生成配置表单。

**基础类型：** `text` / `number` / `select` / `switch` / `list`

**高级对象列表 (`object_list`)：** 带折叠面板、增删改查和内联动作按钮的卡片组。

```javascript
{
  key: 'customRules',
  type: 'object_list',
  label: '自定义规则',
  placeholder: '添加新规则',
  summaryKey: 'name',
  template: [
    { key: 'name', label: '名称', type: 'text', default: '新规则' },
    {
      key: 'url', label: '目标链接', type: 'text',
      actions: [{
        label: '预览测试',
        onClick: (item, val, handleChange) => window.open(val, '_blank')
      }]
    }
  ]
}
```

### 开发规范

| 规范点 | 说明 |
|--------|------|
| **主键命名规范** | 模块 ID 推荐使用**下划线 `_`** 命名（如 `ns_privacy_guard`），基座会自动将 `-` 转为 `_` |
| **严禁全局执行** | 不允许在全局作用域直接执行 DOM 操作，必须放入 `execute` 钩子中 |
| **使用 `addStyle`** | 严禁使用 `document.createElement('style')`，请统一使用 `API.addStyle` |
| **无需处理转义** | v4.8 已在底层解决反引号和模板插值的注入报错，可放心使用 ES6 语法 |

### 完整示例

```javascript
(function() {
  const API = window.NodeSeekUI;
  const MODULE_ID = 'ns_my_script';
  const STYLE_ID = MODULE_ID + '_css';

  const SCHEMA = [
    { key: 'blurLevel', type: 'number', label: '模糊强度', default: 8 }
  ];

  function applyEffect() {
    const cfg = API.getConfig(MODULE_ID, SCHEMA);
    API.addStyle(`.avatar { filter: blur(${cfg.blurLevel}px) !important; }`, STYLE_ID);
  }

  API.register({
    id: MODULE_ID,
    name: '我的脚本',
    version: '1.0.0',
    description: '功能描述',
    render: function(container) {
      const form = API.UI.buildConfigForm(SCHEMA, API.getConfig(MODULE_ID, SCHEMA), function(newConfig) {
        API.store(MODULE_ID, 'config', newConfig);
        applyEffect();
      });
      container.appendChild(form);
    },
    execute: function() { applyEffect(); },
    onToggle: function(enabled) {
      if (enabled) applyEffect();
      else API.removeStyle(STYLE_ID);
    }
  });
})();
```

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
