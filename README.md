# NodeSeek Scripts Registry

A community-maintained registry of userscripts for [NodeSeek](https://www.nodeseek.com).

## 📦 Registry Structure

```
NodeSeek-Scripts-Registry/
├── registry.json          # Script index
├── scripts/
│   └── script-name/
│       └── script-name.user.js
└── README.md
```

## 🚀 Usage

Install any script directly via a userscript manager (Tampermonkey / Violentmonkey):

1. Browse the registry at [`registry.json`](./registry.json)
2. Click the script's `url` field to install

## ➕ Adding a Script

1. Fork this repo
2. Place your script at `scripts/<script-name>/<script-name>.user.js`
3. Add an entry to `registry.json`:

```json
{
  "id": "your-script-id",
  "name": "Script Display Name",
  "description": "What does it do?",
  "version": "1.0.0",
  "author": "your-name",
  "tags": ["tag1", "tag2"],
  "url": "https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/scripts/your-script-id/your-script-id.user.js"
}
```

4. Open a Pull Request

## 📋 Registry Format

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique script identifier (kebab-case, no spaces) |
| `name` | string | Human-readable script name |
| `description` | string | Brief description |
| `version` | string | Semver version string |
| `author` | string | Author name or GitHub username |
| `tags` | string[] | Categorization tags |
| `url` | string | Raw URL to the `.user.js` file |

## 📜 License

Scripts in this registry are subject to their individual licenses. Registry metadata is MIT licensed.
