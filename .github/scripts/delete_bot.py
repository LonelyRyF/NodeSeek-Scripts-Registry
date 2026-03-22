import os
import re
import json
import sys
import shutil


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
    script_id = data.get("脚本 ID", "").strip()

    if not script_id:
        fail("脚本 ID 为空")

    # 解析勾选框
    ownership_section = data.get("身份确认", "")
    # GitHub issue form checkboxes: checked = "- [x] ..."
    is_checked = bool(re.search(r'-\s*\[x\]', ownership_section, re.IGNORECASE))

    # 加载 map.json
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
        fail(f"脚本 '{script_id}' 不存在于注册表中")

    if not is_checked:
        # 搁置
        print(f"Delete request for '{script_id}' not confirmed. Putting on hold.")
        with open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a") as fh:
            fh.write("on_hold=true\n")
        with open("/tmp/delete_comment.txt", "w") as f:
            f.write("删除申请已收到，但你未勾选"此脚本为本人发布"确认框，申请已搁置。如确认为本人脚本，请重新编辑 Issue 并勾选确认框。")
        sys.exit(0)

    if owner.lower() != submitter.lower():
        fail(f"提交者 '{submitter}' 不是脚本 '{script_id}' 的原始发布者，已拒绝")

    # 从 registry.json 移除
    registry_path = "registry.json"
    registry_data = {"scripts": []}
    if os.path.exists(registry_path):
        with open(registry_path, "r", encoding="utf-8") as f:
            try:
                registry_data = json.load(f)
            except json.JSONDecodeError:
                pass

    scripts = registry_data.get("scripts", [])
    new_scripts = [s for s in scripts if s.get("id") != script_id]
    if len(new_scripts) == len(scripts):
        print(f"Warning: script_id '{script_id}' not found in registry.json")

    registry_data["scripts"] = new_scripts
    with open(registry_path, "w", encoding="utf-8") as f:
        json.dump(registry_data, f, indent=2, ensure_ascii=False)

    # 从 map.json 移除
    del map_data[script_id]
    with open(map_path, "w", encoding="utf-8") as f:
        json.dump(map_data, f, indent=2, ensure_ascii=False)

    # 删除脚本目录
    script_dir = f"scripts/{script_id}"
    if os.path.exists(script_dir):
        shutil.rmtree(script_dir)
        print(f"Deleted directory: {script_dir}")

    print(f"registry.json and map.json updated, script '{script_id}' removed")

    if issue_number:
        with open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a") as fh:
            fh.write(f"script_id={script_id}\n")
            fh.write(f"issue_number={issue_number}\n")


if __name__ == "__main__":
    main()
