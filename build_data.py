# -*- coding: utf-8 -*-
"""
戰情指揮中心情報建置引擎 (Briefing Command Center Data Builder)
萃取 14 檔每日晨報 + 4 檔每週週報之 Frontmatter、30秒精簡摘要、完整內容與歷史期數。
"""
import os
import re
import json
import yaml
from pathlib import Path
from datetime import datetime, timezone, timedelta

# 台灣時區 UTC+8
TAIPEI_TZ = timezone(timedelta(hours=8))

PROJECT_DIR = Path(__file__).resolve().parent
OBSIDIAN_ROOT = Path(r"G:\我的雲端硬碟\Obsidian")
DAILY_DIR = OBSIDIAN_ROOT / "Clippings" / "晨報"
WEEKLY_DIR = OBSIDIAN_ROOT / "Clippings" / "週報"

CHANNELS_CONFIG = [
    # 每日晨報系列 (14)
    {
        "id": "huggingface",
        "name": "HuggingFace 趨勢日報",
        "category": "ai",
        "category_name": "AI 與前沿",
        "type": "daily",
        "time_slot": "05:40",
        "folder": DAILY_DIR / "HuggingFace趨勢日報",
        "icon": "sparkles",
        "accent_color": "#ff9d00",
        "badge": "每日 05:40"
    },
    {
        "id": "github",
        "name": "GitHub 趨勢每日快報",
        "category": "ai",
        "category_name": "AI 與前沿",
        "type": "daily",
        "time_slot": "05:50",
        "folder": DAILY_DIR / "GitHub趨勢日報",
        "icon": "git-branch",
        "accent_color": "#2dd4bf",
        "badge": "每日 05:50"
    },
    {
        "id": "rental-softdec",
        "name": "包租代管軟裝產業追蹤",
        "category": "business",
        "category_name": "實業營運",
        "type": "daily",
        "time_slot": "06:00",
        "folder": DAILY_DIR / "包租代管軟裝產業追蹤",
        "icon": "home",
        "accent_color": "#10b981",
        "badge": "每日 06:00"
    },
    {
        "id": "ai-bloggers",
        "name": "AI 科技博主動態日報",
        "category": "ai",
        "category_name": "AI 與前沿",
        "type": "daily",
        "time_slot": "06:10",
        "folder": DAILY_DIR / "AI科技博主動態",
        "icon": "video",
        "accent_color": "#ec4899",
        "badge": "每日 06:10"
    },
    {
        "id": "storage-org",
        "name": "收納產業情報日報",
        "category": "business",
        "category_name": "實業營運",
        "type": "daily",
        "time_slot": "06:20",
        "folder": DAILY_DIR / "收納產業情報",
        "icon": "boxes",
        "accent_color": "#06b6d4",
        "badge": "每日 06:20"
    },
    {
        "id": "finance",
        "name": "財經晨報",
        "category": "finance",
        "category_name": "金融與投資",
        "type": "daily",
        "time_slot": "06:30",
        "folder": DAILY_DIR / "財經晨報",
        "icon": "trending-up",
        "accent_color": "#3b82f6",
        "badge": "每日 06:30"
    },
    {
        "id": "ai-daily",
        "name": "AI 趨勢晨報",
        "category": "ai",
        "category_name": "AI 與前沿",
        "type": "daily",
        "time_slot": "06:40",
        "folder": DAILY_DIR / "AI晨報",
        "icon": "cpu",
        "accent_color": "#00f0ff",
        "badge": "每日 06:40"
    },
    {
        "id": "opensource",
        "name": "開源專案版本追蹤日報",
        "category": "macro",
        "category_name": "總經與科技生態",
        "type": "daily",
        "time_slot": "06:50",
        "folder": DAILY_DIR / "開源版本追蹤",
        "icon": "terminal",
        "accent_color": "#8b5cf6",
        "badge": "每日 06:50"
    },
    {
        "id": "iot-smarthome",
        "name": "IoT 與智慧家庭產業晨報",
        "category": "tech",
        "category_name": "前瞻硬體",
        "type": "daily",
        "time_slot": "07:00",
        "folder": DAILY_DIR / "IoT與智慧家庭產業晨報",
        "icon": "wifi",
        "accent_color": "#14b8a6",
        "badge": "每日 07:00"
    },
    {
        "id": "robotics",
        "name": "智慧機器人產業晨報",
        "category": "tech",
        "category_name": "前瞻硬體",
        "type": "daily",
        "time_slot": "07:10",
        "folder": DAILY_DIR / "智慧機器人產業晨報",
        "icon": "bot",
        "accent_color": "#f43f5e",
        "badge": "每日 07:10"
    },
    {
        "id": "agri-fishery",
        "name": "智慧農業與漁業產業晨報",
        "category": "tech",
        "category_name": "前瞻硬體",
        "type": "daily",
        "time_slot": "07:20",
        "folder": DAILY_DIR / "智慧農業與漁業產業晨報",
        "icon": "leaf",
        "accent_color": "#84cc16",
        "badge": "每日 07:20"
    },
    {
        "id": "quant-trading",
        "name": "量化交易晨報",
        "category": "finance",
        "category_name": "金融與投資",
        "type": "daily",
        "time_slot": "07:30",
        "folder": DAILY_DIR / "量化交易晨報",
        "icon": "activity",
        "accent_color": "#eab308",
        "badge": "每日 07:30"
    },
    {
        "id": "crypto",
        "name": "虛擬貨幣產業晨報",
        "category": "finance",
        "category_name": "金融與投資",
        "type": "daily",
        "time_slot": "07:40",
        "folder": DAILY_DIR / "虛擬貨幣產業晨報",
        "icon": "circle-dollar-sign",
        "accent_color": "#f97316",
        "badge": "每日 07:40"
    },
    {
        "id": "pawnshop",
        "name": "當舖放款產業晨報",
        "category": "business",
        "category_name": "實業營運",
        "type": "daily",
        "time_slot": "07:50",
        "folder": DAILY_DIR / "當舖放款晨報",
        "icon": "shield-alert",
        "accent_color": "#d97706",
        "badge": "每日 07:50"
    },

    # 每週產業週報系列 (4)
    {
        "id": "high-yield-etf",
        "name": "高收益 ETF 每週配息週報",
        "category": "finance",
        "category_name": "金融與投資",
        "type": "weekly",
        "time_slot": "週五 21:45",
        "folder": WEEKLY_DIR / "高收益ETF週報",
        "icon": "wallet",
        "accent_color": "#10b981",
        "badge": "每週五 21:45"
    },
    {
        "id": "ar-xr-glasses",
        "name": "AR / XR / AI 眼鏡產業週報",
        "category": "tech",
        "category_name": "前瞻硬體",
        "type": "weekly",
        "time_slot": "週五 21:55",
        "folder": WEEKLY_DIR / "AR眼鏡週報",
        "icon": "glasses",
        "accent_color": "#a855f7",
        "badge": "每週五 21:55"
    },
    {
        "id": "openrouter-rankings",
        "name": "OpenRouter 模型調用週報",
        "category": "ai",
        "category_name": "AI 與前沿",
        "type": "weekly",
        "time_slot": "週六 09:05",
        "folder": WEEKLY_DIR / "OpenRouter模型週報",
        "icon": "bar-chart-2",
        "accent_color": "#38bdf8",
        "badge": "每週六 09:05"
    },
    {
        "id": "macro-economy",
        "name": "全球與台灣總體經濟週報",
        "category": "macro",
        "category_name": "總經與科技生態",
        "type": "weekly",
        "time_slot": "週一 08:40",
        "folder": WEEKLY_DIR / "總體經濟週報",
        "icon": "globe-2",
        "accent_color": "#6366f1",
        "badge": "每週一 08:40"
    }
]

def parse_frontmatter_and_content(raw_text):
    """分離 YAML Frontmatter 與 Markdown 內文"""
    fm = {}
    content = raw_text
    if raw_text.startswith("---"):
        parts = raw_text.split("---", 2)
        if len(parts) >= 3:
            fm_str = parts[1]
            content = parts[2].strip()
            try:
                fm = yaml.safe_load(fm_str) or {}
            except Exception:
                fm = {}
    return fm, content

def extract_date_from_filename_or_text(filename, fm, content):
    """精準提取發布日期 YYYY-MM-DD"""
    # 1. Check frontmatter
    for key in ['date', 'published', 'created']:
        val = fm.get(key)
        if val:
            val_str = str(val).strip()
            m = re.search(r'\d{4}-\d{2}-\d{2}', val_str)
            if m:
                return m.group(0)
    # 2. Check filename
    m = re.search(r'\d{4}-\d{2}-\d{2}', filename)
    if m:
        return m.group(0)
    m = re.search(r'(\d{4})(\d{2})(\d{2})', filename)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    # 3. Check content headers
    m = re.search(r'\d{4}-\d{2}-\d{2}', content[:500])
    if m:
        return m.group(0)
    return datetime.now(TAIPEI_TZ).strftime('%Y-%m-%d')

def extract_30s_summary_bullets(content):
    """提取 30 秒重點精華條列，若無則提取導語或前幾點核心摘要"""
    bullets = []
    
    # 嘗試匹配 【2】⏱️ 30 秒重點精華 或類似標題
    pattern = r'##\s*(?:【\d+】\s*)?(?:⏱️\s*)?(?:30\s*秒)?重點精華.*?\n([\s\S]*?)(?=\n##\s|\Z)'
    match = re.search(pattern, content)
    if match:
        section_text = match.group(1).strip()
        lines = section_text.split('\n')
        for line in lines:
            line_str = line.strip()
            if line_str.startswith(('-', '*', '•')) or re.match(r'^\d+\.', line_str):
                # Clean up marker
                clean_bullet = re.sub(r'^[-*•\d\.]+\s*', '', line_str).strip()
                if clean_bullet:
                    bullets.append(clean_bullet)
    
    # Fallback: 如果抓不到，檢查是否有導語或一般列表
    if not bullets:
        lead_pattern = r'##\s*(?:【\d+】\s*)?導語.*?\n([\s\S]*?)(?=\n##\s|\Z)'
        match_lead = re.search(lead_pattern, content)
        if match_lead:
            text = match_lead.group(1).strip()
            paragraphs = [p.strip() for p in text.split('\n\n') if p.strip() and not p.strip().startswith('#')]
            if paragraphs:
                bullets = [paragraphs[0][:280] + ("..." if len(paragraphs[0]) > 280 else "")]
    
    # Secondary Fallback: 尋找前 5 個條列項目
    if not bullets:
        all_bullets = re.findall(r'^[-\*]\s+(.*)$', content, flags=re.MULTILINE)
        if all_bullets:
            bullets = all_bullets[:5]

    return bullets[:7]  # 保留精華前 5~7 條

def parse_file(file_path):
    """解析單篇 Markdown 檔案"""
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        raw_text = f.read()
    
    fm, content = parse_frontmatter_and_content(raw_text)
    filename = file_path.name
    date_str = extract_date_from_filename_or_text(filename, fm, content)
    bullets = extract_30s_summary_bullets(content)
    
    # 取得標題
    title = fm.get('title')
    if not title:
        m = re.search(r'^#\s+(.+)$', content, flags=re.MULTILINE)
        if m:
            title = m.group(1).strip()
        else:
            title = filename.replace('.md', '')
    
    # 取得來源與標籤
    source = fm.get('source', '')
    tags = fm.get('tags', [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(',')]
    
    word_count = len(content)
    read_time = max(1, round(word_count / 450))  # 中文閱讀速度約 450 字/分
    
    return {
        "filename": filename,
        "date": date_str,
        "title": title,
        "source": source,
        "tags": tags,
        "summary_bullets": bullets,
        "word_count": word_count,
        "read_time_minutes": read_time,
        "content": content
    }

def build_all_channels():
    now_taipei = datetime.now(TAIPEI_TZ).strftime("%Y-%m-%d %H:%M:%S")
    channels_output = []
    
    total_briefings_count = 0
    today_str = datetime.now(TAIPEI_TZ).strftime("%Y-%m-%d")
    
    for ch in CHANNELS_CONFIG:
        folder = ch['folder']
        channel_data = {
            "id": ch['id'],
            "name": ch['name'],
            "category": ch['category'],
            "category_name": ch['category_name'],
            "type": ch['type'],
            "time_slot": ch['time_slot'],
            "badge": ch['badge'],
            "icon": ch['icon'],
            "accent_color": ch['accent_color'],
            "has_today": False,
            "latest": None,
            "history": []
        }
        
        if not folder.exists():
            channels_output.append(channel_data)
            continue
            
        md_files = sorted(list(folder.glob("*.md")), key=lambda x: x.name, reverse=True)
        if not md_files:
            channels_output.append(channel_data)
            continue
        
        parsed_files = []
        for fp in md_files:
            try:
                item = parse_file(fp)
                parsed_files.append(item)
            except Exception as e:
                print(f"Error parsing {fp}: {e}")
                
        # 依日期由新至舊排序
        parsed_files.sort(key=lambda x: x['date'], reverse=True)
        
        if parsed_files:
            latest = parsed_files[0]
            if latest['date'] == today_str:
                channel_data['has_today'] = True
            
            channel_data['latest'] = latest
            
            # 歷史記錄：保留最近 14 期，只帶摘要與標題（輕量化）
            history_list = []
            for h in parsed_files[1:15]:
                history_list.append({
                    "date": h['date'],
                    "filename": h['filename'],
                    "title": h['title'],
                    "summary_bullets": h['summary_bullets'][:3],
                    "word_count": h['word_count'],
                    "content": h['content']
                })
            channel_data['history'] = history_list
            total_briefings_count += 1
            
        channels_output.append(channel_data)

    output = {
        "generated_at": now_taipei,
        "target_date": today_str,
        "total_channels": len(channels_output),
        "active_channels": total_briefings_count,
        "channels": channels_output
    }
    
    out_file = PROJECT_DIR / "data" / "briefings.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Successfully compiled {total_briefings_count}/{len(channels_output)} channels into {out_file}")
    return output

if __name__ == "__main__":
    build_all_channels()
