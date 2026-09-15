// 戰情指揮中心情報看板邏輯 (Tactical Command Center Logic)

let allBriefingsData = null;
let currentFilteredChannels = [];
let currentCategory = 'all';
let currentType = 'all';
let currentSearchQuery = '';
let activeChannelIndex = -1;
let activeChannel = null;
let activeEdition = null;

// ==================== 初始化與事件監聽 ====================
document.addEventListener('DOMContentLoaded', async () => {
  initClock();
  setupEventListeners();
  await loadBriefingsData();
  
  // 檢查 URL Hash 深層連結 (例如 #ai-daily)
  handleHashNavigation();
  window.addEventListener('hashchange', handleHashNavigation);
});

// 即時時鐘 (台北時間 UTC+8)
function initClock() {
  const clockEl = document.getElementById('live-clock');
  const dateEl = document.getElementById('live-date');
  
  function updateTime() {
    const now = new Date();
    // 轉為台北時間
    const optionsTime = { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const optionsDate = { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' };
    
    if (clockEl) clockEl.textContent = now.toLocaleTimeString('zh-TW', optionsTime);
    if (dateEl) dateEl.textContent = now.toLocaleDateString('zh-TW', optionsDate);
  }
  
  updateTime();
  setInterval(updateTime, 1000);
}

// 事件監聽綁定
function setupEventListeners() {
  // 分類篩選按鈕
  document.getElementById('category-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.remove('active', 'bg-cyan-500/20', 'text-cyan-300', 'border-cyan-500/40');
      b.classList.add('bg-slate-900/60', 'text-slate-400', 'border-slate-800');
    });
    
    btn.classList.add('active', 'bg-cyan-500/20', 'text-cyan-300', 'border-cyan-500/40');
    btn.classList.remove('bg-slate-900/60', 'text-slate-400', 'border-slate-800');
    
    currentCategory = btn.dataset.cat;
    applyFiltersAndRender();
  });

  // 型態切換 (全型態 / 每日晨報 / 產業週報)
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => {
        b.classList.remove('text-cyan-400', 'bg-slate-800');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('text-cyan-400', 'bg-slate-800');
      btn.classList.remove('text-slate-400');
      
      if (btn.id === 'type-all') currentType = 'all';
      else if (btn.id === 'type-daily') currentType = 'daily';
      else if (btn.id === 'type-weekly') currentType = 'weekly';
      
      applyFiltersAndRender();
    });
  });

  // 搜尋輸入框
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.trim().toLowerCase();
    applyFiltersAndRender();
  });

  // 重新整理按鈕
  document.getElementById('btn-refresh').addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh');
    btn.classList.add('animate-spin');
    await loadBriefingsData(true);
    setTimeout(() => btn.classList.remove('animate-spin'), 600);
  });

  // 閱覽器關閉按鈕
  document.getElementById('btn-close-reader').addEventListener('click', closeReader);
  document.getElementById('btn-close-x').addEventListener('click', closeReader);
  
  // 點擊背景遮罩關閉
  document.getElementById('reader-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'reader-overlay') {
      closeReader();
    }
  });

  // 歷史版本下拉切換
  document.getElementById('reader-history-select').addEventListener('change', (e) => {
    if (!activeChannel) return;
    const selectedVal = e.target.value;
    if (selectedVal === 'latest') {
      activeEdition = activeChannel.latest;
    } else {
      activeEdition = activeChannel.history.find(h => h.date === selectedVal);
    }
    renderReaderContent(activeChannel, activeEdition);
  });

  // 上一篇 / 下一篇導航
  document.getElementById('btn-prev-channel').addEventListener('click', navigatePrevChannel);
  document.getElementById('btn-next-channel').addEventListener('click', navigateNextChannel);

  // 複製連結
  document.getElementById('btn-copy-link').addEventListener('click', () => {
    if (!activeChannel) return;
    const url = `${window.location.origin}${window.location.pathname}#${activeChannel.id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('已複製此情報專屬作戰連結至剪貼簿！');
    });
  });

  // 鍵盤快捷鍵
  document.addEventListener('keydown', (e) => {
    const readerOpen = !document.getElementById('reader-overlay').classList.contains('hidden');
    if (!readerOpen) return;
    
    if (e.key === 'Escape') {
      closeReader();
    } else if (e.key === 'ArrowLeft') {
      navigatePrevChannel();
    } else if (e.key === 'ArrowRight') {
      navigateNextChannel();
    }
  });
}

// ==================== 資料載入 ====================
async function loadBriefingsData(forceBust = false) {
  try {
    const url = `data/briefings.json${forceBust ? '?t=' + Date.now() : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    
    allBriefingsData = await res.json();
    
    // 更新頂部 HUD 資訊
    const lastSyncEl = document.getElementById('last-sync-time');
    if (lastSyncEl) {
      lastSyncEl.textContent = `最後同步時間: ${allBriefingsData.generated_at} (Taipei)`;
    }
    
    const countBadge = document.getElementById('channel-count-badge');
    if (countBadge) {
      countBadge.textContent = `${allBriefingsData.total_channels} 檔情報 (${allBriefingsData.target_date})`;
    }

    applyFiltersAndRender();
  } catch (err) {
    console.error('載入情報資料失敗:', err);
    document.getElementById('briefings-grid').innerHTML = `
      <div class="col-span-full py-16 text-center text-red-400 font-mono">
        <i data-lucide="alert-triangle" class="w-10 h-10 mx-auto mb-3"></i>
        情報檔案讀取失敗，請確認 data/briefings.json 是否已生成。<br>
        <span class="text-xs text-slate-500 mt-2 block">${err.message}</span>
      </div>
    `;
    lucide.createIcons();
  }
}

// ==================== 篩選與渲染卡片矩陣 ====================
function applyFiltersAndRender() {
  if (!allBriefingsData || !allBriefingsData.channels) return;
  
  currentFilteredChannels = allBriefingsData.channels.filter(ch => {
    // 類別過濾
    if (currentCategory !== 'all' && ch.category !== currentCategory) return false;
    
    // 型態過濾 (daily / weekly)
    if (currentType !== 'all' && ch.type !== currentType) return false;
    
    // 搜尋關鍵字過濾
    if (currentSearchQuery) {
      const q = currentSearchQuery;
      const matchName = ch.name.toLowerCase().includes(q);
      const matchCat = ch.category_name.toLowerCase().includes(q);
      const latest = ch.latest;
      let matchTitle = false;
      let matchBullets = false;
      let matchTags = false;
      
      if (latest) {
        matchTitle = (latest.title || '').toLowerCase().includes(q);
        matchBullets = (latest.summary_bullets || []).some(b => b.toLowerCase().includes(q));
        matchTags = (latest.tags || []).some(t => t.toLowerCase().includes(q));
      }
      
      if (!matchName && !matchCat && !matchTitle && !matchBullets && !matchTags) {
        return false;
      }
    }
    
    return true;
  });

  renderBriefingCards(currentFilteredChannels);
}

function renderBriefingCards(channels) {
  const container = document.getElementById('briefings-grid');
  if (!channels || channels.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-500 font-mono">
        <i data-lucide="search-x" class="w-8 h-8 mx-auto mb-2 text-slate-600"></i>
        未搜尋到符合目前條件的情報頻道
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = channels.map((ch, index) => {
    const latest = ch.latest;
    const hasToday = ch.has_today;
    const bullets = latest ? latest.summary_bullets || [] : [];
    
    // 格式化摘要條列（醒目標示 [5★], [4★]）
    const formattedBullets = bullets.slice(0, 4).map(b => {
      let text = escapeHtml(b);
      text = text.replace(/\[5★\]/g, '<span class="text-amber-400 font-bold bg-amber-950/40 px-1 rounded">[5★]</span>');
      text = text.replace(/\[4★\]/g, '<span class="text-cyan-400 font-bold bg-cyan-950/40 px-1 rounded">[4★]</span>');
      text = text.replace(/\[3★\]/g, '<span class="text-slate-300 font-bold bg-slate-800 px-1 rounded">[3★]</span>');
      return `<li class="flex items-start gap-2 line-clamp-2">
        <span class="text-cyan-400 select-none mt-0.5">•</span>
        <span class="flex-1">${text}</span>
      </li>`;
    }).join('');

    const statusBadge = hasToday 
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
           <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 radar-live"></span> 今日已落盤
         </span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30">
           <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> 最新刊號
         </span>`;

    return `
      <div class="glass-panel rounded-xl p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer group hover:-translate-y-1"
           onclick="openReaderByChannelId('${ch.id}')"
           style="border-top: 3px solid ${ch.accent_color};">
        
        <!-- Card Top Section -->
        <div>
          <!-- Meta Header -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <div class="flex items-center space-x-2">
              <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-900 border border-slate-700 text-slate-300">
                ${ch.badge}
              </span>
              <span class="text-xs text-slate-400 font-mono">${ch.category_name}</span>
            </div>
            <div>${statusBadge}</div>
          </div>

          <!-- Channel Name & Title -->
          <h3 class="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition-colors flex items-center gap-2">
            <i data-lucide="${ch.icon}" class="w-4 h-4 text-cyan-400 flex-shrink-0"></i>
            <span class="truncate">${ch.name}</span>
          </h3>

          <div class="text-xs text-slate-400 font-mono mt-1 mb-3">
            ${latest ? latest.date : '尚未生成'} · ${latest ? latest.title : '暫無報告'}
          </div>

          <!-- 30-Second Summary Bullets (精簡摘要) -->
          <div class="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 mb-4 min-h-[96px]">
            <div class="text-[11px] font-mono text-cyan-400/80 mb-1.5 flex items-center gap-1">
              <i data-lucide="zap" class="w-3 h-3 text-amber-400"></i> 30 秒重點精華速覽:
            </div>
            <ul class="text-xs text-slate-300 space-y-1.5">
              ${formattedBullets || '<li class="text-slate-500 text-[11px]">暫無條列精華，請點擊開啟全文。</li>'}
            </ul>
          </div>
        </div>

        <!-- Card Bottom Section -->
        <div class="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono text-slate-400">
          <div class="flex items-center space-x-3">
            <span>${latest ? (latest.word_count).toLocaleString() + ' 字' : '0 字'}</span>
            <span>·</span>
            <span>~${latest ? latest.read_time_minutes : 0} 分鐘</span>
          </div>
          <span class="text-cyan-400 group-hover:translate-x-1 transition-transform flex items-center gap-1 font-bold">
            進入作戰閱覽 <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </span>
        </div>

      </div>
    `;
  }).join('');

  lucide.createIcons();
}

// ==================== 內嵌作戰閱覽器 (TERMINAL READER) ====================
function openReaderByChannelId(channelId) {
  if (!allBriefingsData || !allBriefingsData.channels) return;
  
  const chIndex = currentFilteredChannels.findIndex(c => c.id === channelId);
  const ch = chIndex !== -1 
    ? currentFilteredChannels[chIndex] 
    : allBriefingsData.channels.find(c => c.id === channelId);
    
  if (!ch || !ch.latest) return;
  
  activeChannelIndex = chIndex !== -1 ? chIndex : 0;
  activeChannel = ch;
  activeEdition = ch.latest;
  
  // 更新 URL hash
  window.location.hash = ch.id;
  
  // 填充歷史版本下拉選單
  const historySelect = document.getElementById('reader-history-select');
  historySelect.innerHTML = `<option value="latest">今日最新刊 (${ch.latest.date})</option>`;
  if (ch.history && ch.history.length > 0) {
    ch.history.forEach(h => {
      historySelect.innerHTML += `<option value="${h.date}">歷期: ${h.date} (${h.word_count.toLocaleString()} 字)</option>`;
    });
  }
  historySelect.value = 'latest';

  renderReaderContent(ch, activeEdition);

  // 開啟 Slide-over
  const overlay = document.getElementById('reader-overlay');
  const panel = document.getElementById('reader-panel');
  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.remove('opacity-0');
    panel.classList.remove('translate-x-full');
  }, 10);
  
  document.body.style.overflow = 'hidden';
}

function renderReaderContent(ch, edition) {
  if (!ch || !edition) return;
  
  // 頂部資訊
  document.getElementById('reader-badge').textContent = ch.badge;
  document.getElementById('reader-channel-name').textContent = `${ch.name} · ${ch.category_name}`;
  document.getElementById('reader-title').textContent = edition.title || ch.name;
  document.getElementById('reader-date').textContent = edition.date;
  document.getElementById('reader-word-count').textContent = `${edition.word_count.toLocaleString()} 字`;
  document.getElementById('reader-read-time').textContent = `預估 ~${Math.max(1, Math.round(edition.word_count / 450))} 分鐘`;

  // 標籤
  const tagsContainer = document.getElementById('reader-tags');
  const tags = edition.tags || [];
  tagsContainer.innerHTML = tags.map(t => 
    `<span class="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400">#${t}</span>`
  ).join('');

  // 30 秒重點精華盒子
  const summaryBox = document.getElementById('reader-summary-box');
  const summaryList = document.getElementById('reader-summary-list');
  const bullets = edition.summary_bullets || [];
  if (bullets.length > 0) {
    summaryBox.classList.remove('hidden');
    summaryList.innerHTML = bullets.map(b => {
      let text = escapeHtml(b);
      text = text.replace(/\[5★\]/g, '<span class="text-amber-400 font-bold bg-amber-950/60 px-1.5 py-0.5 rounded">[5★]</span>');
      text = text.replace(/\[4★\]/g, '<span class="text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.5 rounded">[4★]</span>');
      text = text.replace(/\[3★\]/g, '<span class="text-slate-300 font-bold bg-slate-800 px-1.5 py-0.5 rounded">[3★]</span>');
      return `<li class="flex items-start gap-2"><span class="text-amber-400 font-bold">•</span><span>${text}</span></li>`;
    }).join('');
  } else {
    summaryBox.classList.add('hidden');
  }

  // Markdown 全文渲染
  const contentEl = document.getElementById('reader-content');
  const cleanMarkdown = edition.content || '無內文資料';
  
  // 設定 marked
  marked.setOptions({
    gfm: true,
    breaks: true
  });
  
  contentEl.innerHTML = DOMPurify.sanitize(marked.parse(cleanMarkdown));

  // 動態生成左側大綱目錄 (TOC)
  buildTableOfContents(contentEl);

  // 回到頂部
  document.getElementById('reader-scroll-container').scrollTop = 0;
  lucide.createIcons();
}

function buildTableOfContents(contentEl) {
  const tocEl = document.getElementById('reader-toc');
  tocEl.innerHTML = '';
  
  const headers = contentEl.querySelectorAll('h1, h2, h3');
  if (!headers || headers.length === 0) {
    tocEl.innerHTML = '<span class="text-slate-600">無章節標題</span>';
    return;
  }

  headers.forEach((h, idx) => {
    const id = `toc-heading-${idx}`;
    h.id = id;
    const text = h.innerText.replace(/^[#\s]+/, '').trim();
    const tag = h.tagName.toLowerCase();
    
    let indentClass = 'pl-1 font-semibold text-slate-300';
    if (tag === 'h2') indentClass = 'pl-2 text-cyan-400/90';
    if (tag === 'h3') indentClass = 'pl-4 text-slate-400';

    const a = document.createElement('a');
    a.href = `#${id}`;
    a.className = `block py-1 hover:text-cyan-300 transition-colors truncate ${indentClass}`;
    a.textContent = text;
    a.onclick = (e) => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    tocEl.appendChild(a);
  });
}

function closeReader() {
  const overlay = document.getElementById('reader-overlay');
  const panel = document.getElementById('reader-panel');
  overlay.classList.add('opacity-0');
  panel.classList.add('translate-x-full');
  
  setTimeout(() => {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }, 250);

  // 清除 URL hash
  history.replaceState(null, null, ' ');
}

function navigatePrevChannel() {
  if (currentFilteredChannels.length === 0) return;
  activeChannelIndex = (activeChannelIndex - 1 + currentFilteredChannels.length) % currentFilteredChannels.length;
  const target = currentFilteredChannels[activeChannelIndex];
  openReaderByChannelId(target.id);
}

function navigateNextChannel() {
  if (currentFilteredChannels.length === 0) return;
  activeChannelIndex = (activeChannelIndex + 1) % currentFilteredChannels.length;
  const target = currentFilteredChannels[activeChannelIndex];
  openReaderByChannelId(target.id);
}

function handleHashNavigation() {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash && allBriefingsData && allBriefingsData.channels) {
    const found = allBriefingsData.channels.find(c => c.id === hash);
    if (found) {
      openReaderByChannelId(found.id);
    }
  }
}

// 輔助函式：HTML 轉義
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
