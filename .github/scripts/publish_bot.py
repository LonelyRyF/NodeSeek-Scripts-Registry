import os
import re
import json
import sys
import urllib.request
import rjsmin
from packaging.version import Version, InvalidVersion


def parse_issue_body(body):
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


def parse_js_meta(content):
    meta = {}
    const_patterns = {
        'id':      r"const\s+MODULE_ID\s*=\s*['\"]([^'\"]+)['\"]",
        'version': r"const\s+MODULE_VERSION\s*=\s*['\"]([^'\"]+)['\"]",
    }
    for key, pattern in const_patterns.items():
        m = re.search(pattern, content)
        if m:
            meta[key] = m.group(1).strip()

    reg_match = re.search(r'API\.register\s*\(\s*\{(.+?)\}\s*\)', content, re.DOTALL)
    if reg_match:
        block = reg_match.group(1)
        for key, pattern in [('id', r"\bid\s*:\s*['\"]([^'\"]+)['\"]"),
                              ('version', r"\bversion\s*:\s*['\"]([^'\"]+)['\"]")]:
            if key not in meta:
                m = re.search(pattern, block)
                if m:
                    meta[key] = m.group(1).strip()
    return meta


def version_tuple(v):
    try:
        return Version(v)
    except InvalidVersion:
        return Version("0.0.0")


def fail(msg):
    print(f"Error: {msg}")
    with open("/tmp/bot_error.txt", "w") as f:
        f.write(msg)
    sys.exit(1)


def main():
    issue_body   = os.getenv("ISSUE_BODY", "")
    issue_number = os.getenv("ISSUE_NUMBER", "")
    submitter    = os.getenv("SUBMITTER", "")

    if not issue_body:
        fail("ISSUE_BODY not found")

    data = parse_issue_body(issue_body)

    plugin_name  = data.get("插件名称", "").strip()
    author       = data.get("作者名", "").strip() or "unknown"
    description  = data.get("插件主要作用", "").strip()
    file_section = data.get("脚本文件", "")

    if not file_section:
        fail("file_upload field missing")

    url_match = re.search(
        r'https://github\.com/user-attachments/[^\s\)\]]+',
        file_section
    )
    if not url_match:
        fail("no valid GitHub attachment URL found")

    file_url = url_match.group(0)
    try:
        req = urllib.request.Request(file_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            raw_content = response.read()
        js_content = raw_content.decode("utf-8", errors="replace")
    except Exception as e:
        fail(f"下载文件失败: {e}")

    meta = parse_js_meta(js_content)
    script_id = meta.get("id")
    version   = meta.get("version")

    if not all([script_id, version]):
        fail("could not parse MODULE_ID/MODULE_VERSION. Got: {meta}")

    # 加载 map.json，检查 name 重复
    map_path = "map.json"
    map_data = {}
    if os.path.exists(map_path):
        with open(map_path, "r", encoding="utf-8") as f:
            try:
                map_data = json.load(f)
            except json.JSONDecodeError:
                pass

    if script_id in map_data:
        fail(f"脚本 ID '{script_id}' 已存在，禁止重复发布")

    # 保存文件
    target_dir    = f"scripts/{script_id}"
    os.makedirs(target_dir, exist_ok=True)
    original_path = f"{target_dir}/{version}.original.user.js"
    file_path     = f"{target_dir}/{version}.user.js"

    with open(original_path, "wb") as f:
        f.write(raw_content)

    minified = rjsmin.jsmin(js_content)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(minified)

    print(f"Saved original: {original_path}")
    print(f"Saved minified: {file_path}")

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
        "name":        plugin_name or script_id,
        "description": description,
        "version":     version,
        "author":      author,
        "url":         f"https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/{file_path}"
    }
    scripts.append(new_entry)
    registry_data["scripts"] = scripts
    with open(registry_path, "w", encoding="utf-8") as f:
        json.dump(registry_data, f, indent=2, ensure_ascii=False)

    # 更新 map.json
    map_data[script_id] = submitter
    with open(map_path, "w", encoding="utf-8") as f:
        json.dump(map_data, f, indent=2, ensure_ascii=False)

    print(f"map.json updated: {script_id} -> {submitter}")
    print(f"registry.json updated")

    if issue_number:
        with open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a") as fh:
            fh.write(f"script_id={script_id}\n")
            fh.write(f"version={version}\n")
            fh.write(f"issue_number={issue_number}\n")


if __name__ == "__main__":
    main()
