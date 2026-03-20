# NodeSeek 脚本仓库

由 [rainyfall](https://github.com/LonelyRyF) 维护的 NodeSeek / DeepFlood 油猴脚本集合。

## 目录结构

```
NodeSeek-Scripts-Registry/
├── registry.json                          # 云端脚本索引（子模块）
├── version.json                           # 基座版本信息（自动更新）
├── scripts/
│   ├── ns-ui-framework/                   # UI 基座（需单独安装）
│   │   └── 4.4.user.js
│   ├── ns-waterfall/                      # 瀑布流 & 引用跳转
│   │   └── 1.6.0.user.js
│   ├── ns-user-badge/                     # 用户信息徽章
│   │   └── 0.4.2.user.js
│   ├── ns-pangu/                          # 盘古排版助手
│   │   └── 3.1.0.user.js
│   └── ns-sticker/                        # 自定义表情包
│       └── 16.1.1.user.js
└── README.md
```

---

## 脚本列表

### UI 基座（必装）

#### NodeSeek Setting Framework

- **版本**：v4.4
- **作者**：rainyfall (aka. 浅霖)
- **适用站点**：nodeseek.com / deepflood.com
- **安装地址**：[点击安装](https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/scripts/ns-ui-framework/4.4.user.js)

NodeSeek / DeepFlood 扩展基座。内置完整 UI 组件库（开关、输入框、下拉框、表单渲染器等），支持子模块注册、脚本市场（从本仓库 registry.json 安装/更新子模块）、基座自动更新检测。其余子模块均依赖本基座运行。

**主要功能：**
- 子模块注册与统一管理（模块总控中心）
- 内置脚本市场，可直接安装/更新/卸载子模块
- 基座自动更新检测（24 小时间隔），发现新版本时提示安装
- 子模块静默自动更新
- 沙盒穿透，Schema 表单渲染

---

### 子模块（通过脚本市场安装，或单独安装）

> 子模块需要基座脚本已安装并运行，才能正常使用配置界面。

#### 1. 瀑布流 & 评论引用跳转修复

- **版本**：v1.6.0
- **作者**：_RyF
- **安装地址**：[点击安装](https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/scripts/ns-waterfall/1.6.0.user.js)

提前预加载下一页数据，实现无缝瀑布流；修复跨页引用评论导致页面刷新的问题，改为页内平滑跳转并高亮闪烁定位。

**可配置项：**
- 瀑布流自动加载开关
- 评论引用跳转修复开关
- 列表页 / 帖子页预加载触发距离
- 滚动检测节流间隔
- 平滑滚动开关
- 引用高亮持续时长

---

#### 2. 用户信息徽章

- **版本**：v0.4.2
- **作者**：_RyF
- **安装地址**：[点击安装](https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/scripts/ns-user-badge/0.4.2.user.js)

在帖子作者昵称旁显示等级（Lv）和加入天数徽章，完美支持亮色 / 暗黑模式，可自定义颜色与展示项。

**可配置项：**
- 显示等级徽章开关
- 显示天数徽章开关
- 徽章颜色（颜色选择器）

---

#### 3. 盘古排版助手

- **版本**：v3.1.0
- **作者**：_RyF
- **安装地址**：[点击安装](https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/scripts/ns-pangu/3.1.0.user.js)

自动在中英文之间添加空格（基于 pangu.js）。采用提取-占位-还原架构，完美保护代码块、行内代码、链接、图片、@提及等 Markdown 语法，不会误处理特殊内容。

**可配置项：**
- 发布时自动排版开关
- 编辑器快捷「排版」按钮显示开关

---

#### 4. 自定义表情包

- **版本**：v16.1.1
- **作者**：_RyF
- **安装地址**：[点击安装](https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/scripts/ns-sticker/16.1.1.user.js)

在回复框表情栏注入自定义表情包面板，支持多分组管理与序列模式（批量加载连续编号图片）。懒加载渲染，点击直接插入 Markdown 图片语法。

**可配置项：**
- 分组管理（添加 / 删除分组，自定义分组名）
- 普通表情（名称 + URL）
- 序列模式（baseUrl + 起止编号 + 后缀）

---

## 使用说明

### 快速开始

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)
2. 先安装 **UI 基座**（其他脚本依赖它）
3. 进入 NodeSeek 设置页，点击「脚本市场」即可安装子模块
4. 也可直接点击各子模块的安装链接单独安装

### 提交新脚本

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
