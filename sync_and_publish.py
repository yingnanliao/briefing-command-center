# -*- coding: utf-8 -*-
"""
戰情看板同步與發布腳本 (Sync & Publish Pipeline)
每日 09:10 由 Hermes Agent 排程或手動呼叫：
1. 執行 build_data.py 提取當日最新 14 檔晨報 + 4 檔週報
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

def main():
    now_str = datetime.now(TAIPEI_TZ).strftime('%Y-%m-%d %H:%M:%S')
    today_str = datetime.now(TAIPEI_TZ).strftime('%Y-%m-%d')
    print(f"=== [START] Briefing Command Center Sync & Publish at {now_str} ===")

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
