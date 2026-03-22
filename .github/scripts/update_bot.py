import os
import re
import json
import sys
import urllib.request
import rjsmin


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
    for key, pattern in [
        ('id',      r"const\s+MODULE_ID\s*=\s*['\"]([^'\"]+)['\"]"),
        ('version', r"const\s+MODULE_VERSION\s*=\s*['\"]([^'\"]+)['\"]"),
    ]:
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
        return tuple(int(x) for x in v.split('.'))
    except Exception:
        return (0,)


def main():
    issue_body   = os.getenv("ISSUE_BODY", "")
    issue_number = os.getenv("ISSUE_NUMBER", "")
    submitter    = os.getenv("SUBMITTER", "")

    if not issue_body:
        print("Error: ISSUE_BODY not found")
        sys.exit(1)

    data = parse_issue_body(issue_body)
    update_log   = data.get("更新日志", "").strip()
    file_section = data.get("脚本文件", "")

    if not file_section:        print("Error: missing script_id or file")
        sys.exit(1)

    # 校验身份
    map_path = "map.json"
    map_data = {}
    if os.path.exists(map_path):
        with open(map_path, "r", encoding="utf-8") as f:
            try:
                map_data = json.load(f)
            except json.JSONDecodeError:
                pass

    owner = map_data.get(script_id)
    if owner is None:
        print(f"Error: script_id '{script_id}' not found in map.json. Rejected.")
        sys.exit(1)

    if owner.lower() != submitter.lower():
        print(f"Error: submitter '{submitter}' is not the owner '{owner}' of script '{script_id_input}'. Rejected.")
        sys.exit(1)

    # 下载新文件
    url_match = re.search(
        r'https://github\.com/user-attachments/[^\s\)\]]+',
        file_section
    )
    if not url_match:
        print("Error: no valid GitHub attachment URL found")
        sys.exit(1)

    file_url = url_match.group(0)
    try:
        req = urllib.request.Request(file_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            raw_content = response.read()
        js_content = raw_content.decode("utf-8", errors="replace")
    except Exception as e:
        print(f"Error downloading file: {e}")
        sys.exit(1)

    meta = parse_js_meta(js_content)
    script_id = meta.get("id")
    new_version = meta.get("version")

    if not all([script_id, new_version]):
        print(f"Error: could not parse MODULE_ID/MODULE_VERSION. Got: {meta}")
        sys.exit(1)

    # 检查版本降级
    registry_path = "registry.json"
    registry_data = {"scripts": []}
    if os.path.exists(registry_path):
        with open(registry_path, "r", encoding="utf-8") as f:
            try:
                registry_data = json.load(f)
            except json.JSONDecodeError:
                pass

    scripts = registry_data.get("scripts", [])
    existing = next((s for s in scripts if s.get("id") == script_id), None)

    if existing:
        old_ver = existing.get("version", "0.0.0")
        if version_tuple(new_version) <= version_tuple(old_ver):
            print(f"Error: new version '{new_version}' is not higher than current '{old_ver}'. Rejected.")
            sys.exit(1)

    # 保存文件
    target_dir    = f"scripts/{script_id}"
    os.makedirs(target_dir, exist_ok=True)
    original_path = f"{target_dir}/{new_version}.original.user.js"
    file_path     = f"{target_dir}/{new_version}.user.js"

    with open(original_path, "wb") as f:
        f.write(raw_content)

    minified = rjsmin.jsmin(js_content)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(minified)

    print(f"Saved original: {original_path}")
    print(f"Saved minified: {file_path}")

    # 更新 registry.json
    new_url = f"https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/{file_path}"
    if existing:
        existing["version"] = new_version
        existing["url"] = new_url
        if update_log:
            existing["update_log"] = update_log
    else:
        scripts.append({"id": script_id, "version": new_version, "url": new_url})

    registry_data["scripts"] = scripts
    with open(registry_path, "w", encoding="utf-8") as f:
        json.dump(registry_data, f, indent=2, ensure_ascii=False)

    print("registry.json updated")

    if issue_number:
        with open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a") as fh:
            fh.write(f"script_id={script_id}\n")
            fh.write(f"version={new_version}\n")
            fh.write(f"issue_number={issue_number}\n")


if __name__ == "__main__":
    main()
