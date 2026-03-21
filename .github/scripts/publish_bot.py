import os
import re
import json
import sys
import urllib.request

def parse_issue_body(body):
    """解析 GitHub Issue Form 生成的 Markdown"""
    data = {}
    # 按照 '### 标题' 分割文本
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
        print("❌ 未获取到 ISSUE_BODY")
        sys.exit(1)

    data = parse_issue_body(issue_body)
    
    # 获取表单字段 (需要与 yaml 中的 label 完全对应)
    script_id = data.get("脚本 ID")
    version = data.get("版本号")
    name = data.get("脚本名称")
    desc = data.get("脚本简述")
    file_section = data.get("脚本文件", "")

    if not all([script_id, version, name]):
        print("❌ 核心字段缺失，请检查表单填写。")
        sys.exit(1)

    # 1. 提取上传的附件 URL 
    # GitHub 附件链接通常为 https://github.com/user-attachments/assets/...
    url_match = re.search(r'(https://github\.com/[^\s\)]+)', file_section)
    if not url_match:
        print("❌ 未检测到有效的文件上传链接，请确认是否将文件拖入了表单。")
        sys.exit(1)
    
    file_url = url_match.group(1)
    print(f"✅ 提取到文件下载链接: {file_url}")

    # 2. 下载文件并保存
    target_dir = f"scripts/{script_id}"
    os.makedirs(target_dir, exist_ok=True)
    file_path = f"{target_dir}/{version}.user.js"

    try:
        req = urllib.request.Request(file_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            content = response.read()
            with open(file_path, "wb") as f:
                f.write(content)
        print(f"✅ 文件已保存至: {file_path}")
    except Exception as e:
        print(f"❌ 文件下载失败: {e}")
        sys.exit(1)

    # 3. 更新 registry.json
    registry_path = "registry.json"
    registry = []
    if os.path.exists(registry_path):
        with open(registry_path, "r", encoding="utf-8") as f:
            try:
                registry = json.load(f)
            except json.JSONDecodeError:
                registry = []

    new_entry = {
        "id": script_id,
        "name": name,
        "description": desc,
        "version": version,
        "author": "rainyfall", # 可以根据需求改成从 Issue 提取的作者名
        "url": f"https://raw.githubusercontent.com/LonelyRyF/NodeSeek-Scripts-Registry/master/{file_path}"
    }

    # 剔除旧版本同 ID 的记录，追加新记录
    registry = [item for item in registry if item.get('id') != script_id]
    registry.append(new_entry)

    with open(registry_path, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)
    
    print("✅ registry.json 更新完毕")

if __name__ == "__main__":
    main()