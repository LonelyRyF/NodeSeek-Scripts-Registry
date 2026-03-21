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


def main():
    issue_body = os.getenv("ISSUE_BODY", "")
    if not issue_body:
        print("Error: ISSUE_BODY not found")
        sys.exit(1)

    data = parse_issue_body(issue_body)

    script_id    = data.get("脚本 ID", "").strip()
    version      = data.get("版本号", "").strip()
    name         = data.get("脚本名称", "").strip()
    author       = data.get("作者名", "").strip() or "unknown"
    desc         = data.get("脚本简述", "").strip()
    file_section = data.get("脚本文件", "")

    if not all([script_id, version, name]):
        print("Error: required fields missing")
        sys.exit(1)

    # 提取附件 URL，兼容 Markdown 图片/链接两种格式
    url_match = re.search(
        r'https://github\.com/user-attachments/[^\s\)\]]+',
        file_section
    )
    if not url_match:
        print("Error: no valid GitHub attachment URL found")
        sys.exit(1)

    file_url = url_match.group(0)
    print(f"File URL: {file_url}")

    # 下载文件
    target_dir = f"scripts/{script_id}"
    os.makedirs(target_dir, exist_ok=True)
    file_path = f"{target_dir}/{version}.user.js"

    try:
        req = urllib.request.Request(file_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            content = response.read()
        with open(file_path, "wb") as f:
            f.write(content)
        print(f"Saved to: {file_path}")
    except Exception as e:
        print(f"Error downloading file: {e}")
        sys.exit(1)

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


if __name__ == "__main__":
    main()
