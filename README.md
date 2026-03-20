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

**[点击安装 NodeSeek Setting Framework](https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/scripts/ns-ui-framework/4.4.user.js)**

安装基座后，进入 NodeSeek 设置页 → 「脚本市场」即可浏览并安装所有子模块。

---

## 使用说明

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)
2. 先安装上方 **基座脚本**
3. 进入 [nodeseek.com/setting](https://www.nodeseek.com/setting) → 「脚本市场」安装子模块
4. 子模块也可通过 `registry.json` 中的 `url` 直接安装

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
