import os
import re
import json
import sys
import urllib.request


def parse_issue_body(body):
    """解析 GitHub Issue Form 生成的 Markdown"""
    data = {}
    sections = re.split(r'^###\s+', body, flags=re.MULTILINE)
    for section in sections:
        if not section.strip():
            continue
        parts = section.split('\n', 1)
        if len(parts) == 2:
            key = parts[0].strip()
            val = parts[1].strip()
            if val == "_No response_":
                val = ""
            data[key] = val
    return data


def parse_userscript_meta(content):
    """从子脚本 JS 常量中解析 MODULE_ID / MODULE_NAME / MODULE_VERSION / MODULE_DESC"""
    meta = {}
    patterns = {
        'id':      r"const\s+MODULE_ID\s*=\s*['\"]([^'\"]+)['\"]",
        'name':    r"const\s+MODULE_NAME\s*=\s*['\"]([^'\"]+)['\"]",
        'version': r"const\s+MODULE_VERSION\s*=\s*['\"]([^'\"]+)['\"]",
        'desc':    r"const\s+MODULE_DESC\s*=\s*['\"]([^'\"]+)['\"]",
    }
    for key, pattern in patterns.items():
        m = re.search(pattern, content)
        if m:
            meta[key] = m.group(1).strip()
    return meta


def main():
    issue_body   = os.getenv("ISSUE_BODY", "")
    issue_number = os.getenv("ISSUE_NUMBER", "")
    if not issue_body:
        print("Error: ISSUE_BODY not found")
        sys.exit(1)

    data = parse_issue_body(issue_body)

    name         = data.get("脚本名称", "").strip()
    author       = data.get("作者名", "").strip() or "unknown"
    file_section = data.get("脚本文件", "")

    if not file_section:
        print("Error: file_upload field missing")
        sys.exit(1)

    # 提取附件 URL
    url_match = re.search(
        r'https://github\.com/user-attachments/[^\s\)\]]+',
        file_section
    )
    if not url_match:
        print("Error: no valid GitHub attachment URL found")
        sys.exit(1)

    file_url = url_match.group(0)
    print(f"File URL: {file_url}")

    # 下载文件内容
    try:
        req = urllib.request.Request(file_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            raw_content = response.read()
        js_content = raw_content.decode("utf-8", errors="replace")
    except Exception as e:
        print(f"Error downloading file: {e}")
        sys.exit(1)

    # 从脚本内容解析元数据
    meta = parse_userscript_meta(js_content)
    script_id = meta.get("id")
    version   = meta.get("version")
    name      = meta.get("name")
    desc      = meta.get("desc", "")

    if not all([script_id, version, name]):
        print(f"Error: could not parse MODULE_ID/MODULE_NAME/MODULE_VERSION from script. Got: {meta}")
        sys.exit(1)

    print(f"Parsed: id={script_id}, version={version}, name={name}")

    # 保存文件
    target_dir = f"scripts/{script_id}"
    os.makedirs(target_dir, exist_ok=True)
    file_path = f"{target_dir}/{version}.user.js"

    with open(file_path, "wb") as f:
        f.write(raw_content)
    print(f"Saved to: {file_path}")

    # 更新 registry.json
    registry_path = "registry.json"
    registry_data = {"scripts": []}
    if os.path.exists(registry_path):
        with open(registry_path, "r", encoding="utf-8") as f:
            try:
                registry_data = json.load(f)
            except json.JSONDecodeError:
                pass

    scripts = registry_data.get("scripts", [])

    new_entry = {
        "id":          script_id,
        "name":        name,
        "description": desc,
        "version":     version,
        "author":      author,
        "url":         f"https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/{file_path}"
    }

    scripts = [item for item in scripts if item.get("id") != script_id]
    scripts.append(new_entry)
    registry_data["scripts"] = scripts

    with open(registry_path, "w", encoding="utf-8") as f:
        json.dump(registry_data, f, indent=2, ensure_ascii=False)

    print("registry.json updated")

    # 输出供 workflow 使用的变量
    if issue_number:
        with open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a") as fh:
            fh.write(f"script_id={script_id}\n")
            fh.write(f"version={version}\n")
            fh.write(f"issue_number={issue_number}\n")


if __name__ == "__main__":
    main()
