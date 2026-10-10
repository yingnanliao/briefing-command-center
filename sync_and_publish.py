# -*- coding: utf-8 -*-
"""
戰情看板同步與發布腳本 (Sync & Publish Pipeline)
每日 09:10 由 Hermes Agent 排程或手動呼叫：
1. 執行 build_data.py 提取當日最新 16 檔晨報 + 4 檔週報（共 20 檔情報）
2. 自動 Git Commit & Push 至 GitHub Pages 儲存庫
"""
import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

TAIPEI_TZ = timezone(timedelta(hours=8))
PROJECT_DIR = Path(__file__).resolve().parent

def run_cmd(cmd, cwd=PROJECT_DIR):
    print(f"Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='ignore')
    if result.returncode != 0:
        print(f"Error output: {result.stderr}")
    else:
        if result.stdout.strip():
            print(f"Output: {result.stdout.strip()}")
    return result

VERSION = "v0.21.6"   # 由 sync_and_publish.py 每次跑時自動更新此註解與 index.html


def sync_engine_version():
    """抓 hermes --version 的版本號，寫入 index.html 的 ENGINE 徽章（找不到或失敗則不動）"""
    try:
        res = subprocess.run(["hermes", "--version"], capture_output=True, text=True,
                             encoding="utf-8", errors="ignore", timeout=30)
        import re
        m = re.search(r"v\d+\.\d+\.\d+", (res.stdout or "") + (res.stderr or ""))
        if not m:
            print("[version] hermes --version 無法解析版本號，跳過更新")
            return
        new_ver = m.group(0)
        html_path = PROJECT_DIR / "index.html"
        html = html_path.read_text(encoding="utf-8")
        if new_ver in html:
            return  # 已是最新
        html = re.sub(r"(ENGINE: HERMES AGENT )v\d+\.\d+\.\d+", r"\g<1>" + new_ver, html)
        html_path.write_text(html, encoding="utf-8")
        print(f"[version] index.html ENGINE 徽章已更新為 {new_ver}")

        # 同步更新本檔頂部的 VERSION 註解
        self_path = Path(__file__)
        me = self_path.read_text(encoding="utf-8")
        me = re.sub(r'VERSION = "v\d+\.\d+\.\d+"',
                    f'VERSION = "{new_ver}"', me)
        self_path.write_text(me, encoding="utf-8")
    except Exception as e:
        print(f"[version] 更新 ENGINE 徽章失敗（忽略，不影響發布）: {e}")


def main():
    now_str = datetime.now(TAIPEI_TZ).strftime('%Y-%m-%d %H:%M:%S')
    today_str = datetime.now(TAIPEI_TZ).strftime('%Y-%m-%d')
    print(f"=== [START] Briefing Command Center Sync & Publish at {now_str} ===")

    # Step 0: 同步引擎版本徽章
    sync_engine_version()

    # Step 1: Run build_data.py
    build_script = PROJECT_DIR / "build_data.py"
    res = subprocess.run([sys.executable, "-X", "utf8", str(build_script)], cwd=PROJECT_DIR, capture_output=True, text=True, encoding='utf-8', errors='ignore')
    print(res.stdout)
    if res.returncode != 0:
        print(f"❌ build_data.py failed: {res.stderr}")
        return False

    # Step 2: Check Git status
    status_res = run_cmd(["git", "status", "--porcelain"])
    if not status_res.stdout.strip():
        print("ℹ️ No changes detected. All briefings are up to date.")
        return True

    # Step 3: Git add, commit, push
    run_cmd(["git", "add", "."])
    commit_msg = f"Auto-sync briefings [{today_str}] - {now_str}"
    run_cmd(["git", "commit", "-m", commit_msg])
    push_res = run_cmd(["git", "push", "origin", "main"])

    if push_res.returncode == 0:
        print(f"🚀 Successfully published update to GitHub Pages at {now_str}!")
        return True
    else:
        print(f"⚠️ Git push encountered issues: {push_res.stderr}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
