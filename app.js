// 戰情指揮中心情報看板邏輯 (Tactical Command Center Logic - High-Tech Edition)

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
  setupAuthSystem();
  
  // 檢查權限 Session
  const session = window.tacticalAuth ? window.tacticalAuth.checkSession() : null;
  if (session) {
    unlockTerminal(session);
    await loadBriefingsData();
    handleHashNavigation();
  } else {
    lockTerminal();
  }
  
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
      b.classList.remove('active', 'bg-cyan-500/20', 'text-cyan-300', 'border-cyan-500/50', 'shadow-sm', 'shadow-cyan-500/20');
      b.classList.add('bg-slate-900/70', 'text-slate-400', 'border-slate-800');
    });
    
    btn.classList.add('active', 'bg-cyan-500/20', 'text-cyan-300', 'border-cyan-500/50', 'shadow-sm', 'shadow-cyan-500/20');
    btn.classList.remove('bg-slate-900/70', 'text-slate-400', 'border-slate-800');
    
    currentCategory = btn.dataset.cat;
    applyFiltersAndRender();
  });

  // 型態切換 (全型態 / 每日晨報 / 產業週報)
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => {
        b.classList.remove('text-cyan-400', 'bg-slate-800', 'font-semibold', 'shadow-inner');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('text-cyan-400', 'bg-slate-800', 'font-semibold', 'shadow-inner');
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

  // 字體大小縮放 (A- / A+)
  let currentFontSize = 1.025;
  const btnFontDec = document.getElementById('btn-font-dec');
  const btnFontInc = document.getElementById('btn-font-inc');
  if (btnFontDec && btnFontInc) {
    btnFontDec.addEventListener('click', () => {
      currentFontSize = Math.max(0.85, currentFontSize - 0.075);
      const content = document.getElementById('reader-content');
      if (content) content.style.fontSize = `${currentFontSize}rem`;
    });
    btnFontInc.addEventListener('click', () => {
      currentFontSize = Math.min(1.4, currentFontSize + 0.075);
      const content = document.getElementById('reader-content');
      if (content) content.style.fontSize = `${currentFontSize}rem`;
    });
  }

  // 全螢幕切換
  const btnFullscreen = document.getElementById('btn-fullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      const panel = document.getElementById('reader-panel');
      panel.classList.toggle('is-fullscreen');
      const icon = document.getElementById('fullscreen-icon');
      if (icon) {
        if (panel.classList.contains('is-fullscreen')) {
          icon.setAttribute('data-lucide', 'minimize-2');
        } else {
          icon.setAttribute('data-lucide', 'maximize-2');
        }
        lucide.createIcons();
      }
    });
  }

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

  // 閱覽器進度條 & TOC 實時章節追蹤 (Scroll-Spy)
  const scrollContainer = document.getElementById('reader-scroll-container');
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', () => {
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      const bar = document.getElementById('reader-progress-bar');
      if (bar) bar.style.width = `${progress}%`;

      // TOC Scroll-Spy 高亮聯動
      const headings = document.querySelectorAll('#reader-content h1, #reader-content h2, #reader-content h3');
      let currentActiveId = '';
      headings.forEach(h => {
        const rect = h.getBoundingClientRect();
        if (rect.top <= 240) {
          currentActiveId = h.id;
        }
      });
      if (currentActiveId) {
        document.querySelectorAll('#reader-toc a').forEach(a => {
          if (a.getAttribute('href') === `#${currentActiveId}`) {
            a.classList.add('is-active');
          } else {
            a.classList.remove('is-active');
          }
        });
      }
    });
  }
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
      lastSyncEl.innerHTML = `<i data-lucide="satellite" class="w-3.5 h-3.5 text-emerald-400"></i> 最後同步: ${allBriefingsData.generated_at} (Taipei)`;
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
      <div class="col-span-full py-20 text-center text-slate-500 font-mono">
        <i data-lucide="search-x" class="w-10 h-10 mx-auto mb-3 text-slate-600"></i>
        未搜尋到符合目前篩選條件的情報頻道
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = channels.map((ch) => {
    const latest = ch.latest;
    const hasToday = ch.has_today;
    const bullets = latest ? latest.summary_bullets || [] : [];
    
    // 格式化摘要條列（醒目標示 [5★], [4★], [3★]）
    const formattedBullets = bullets.slice(0, 4).map(b => {
      let text = escapeHtml(b);
      text = text.replace(/\[5★\]/g, '<span class="badge-5star">5★</span>');
      text = text.replace(/\[4★\]/g, '<span class="badge-4star">4★</span>');
      text = text.replace(/\[3★\]/g, '<span class="badge-3star">3★</span>');
      return `<li class="flex items-start gap-2.5 line-clamp-2">
        <span class="text-cyan-400 select-none font-bold text-xs mt-0.5">▸</span>
        <span class="flex-1 leading-relaxed">${text}</span>
      </li>`;
    }).join('');

    const statusBadge = hasToday 
      ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-500/20">
           <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 radar-live"></span> 今日已落盤
         </span>`
      : `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono text-cyan-300 bg-cyan-950/70 border border-cyan-500/40 shadow-sm shadow-cyan-500/10">
           <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> 最新刊號
         </span>`;

    return `
      <div class="glass-panel spotlight-card rounded-2xl p-5 sm:p-6 flex flex-col justify-between cursor-pointer group tactical-bracket"
           onclick="openReaderByChannelId('${ch.id}')"
           style="border-top: 3px solid ${ch.accent_color};">
        
        <!-- Card Top Section -->
        <div>
          <!-- Meta Header -->
          <div class="flex items-center justify-between gap-2 mb-3.5">
            <div class="flex items-center space-x-2">
              <span class="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-950 border border-slate-700 text-slate-300 shadow-inner">
                ${ch.badge}
              </span>
              <span class="text-xs text-slate-400 font-mono tracking-wide">${ch.category_name}</span>
            </div>
            <div>${statusBadge}</div>
          </div>

          <!-- Channel Name & Title -->
          <h3 class="text-base font-extrabold text-slate-100 group-hover:text-cyan-300 transition-colors flex items-center gap-2.5">
            <div class="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-cyan-400 shadow-sm group-hover:border-cyan-400/50 group-hover:shadow-cyan-400/20 transition-all flex-shrink-0">
              <i data-lucide="${ch.icon}" class="w-4 h-4"></i>
            </div>
            <span class="truncate tracking-tight">${ch.name}</span>
          </h3>

          <div class="text-xs text-slate-400 font-mono mt-1.5 mb-3.5 flex items-center gap-2 truncate">
            <span class="text-cyan-400/80 font-bold">${latest ? latest.date : '尚未生成'}</span>
            <span class="text-slate-600">·</span>
            <span class="truncate text-slate-300">${latest ? latest.title : '暫無報告'}</span>
          </div>

          <!-- 30-Second Summary Bullets (精簡摘要) -->
          <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-4 min-h-[105px] shadow-inner">
            <div class="text-[11px] font-mono text-cyan-400/90 mb-2 flex items-center gap-1.5 font-bold">
              <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-400"></i> 30 秒作戰精華速覽:
            </div>
            <ul class="text-xs text-slate-300 space-y-2">
              ${formattedBullets || '<li class="text-slate-500 text-[11px]">暫無條列精華，請點擊開啟全文。</li>'}
            </ul>
          </div>
        </div>

        <!-- Card Bottom Section -->
        <div class="pt-3.5 border-t border-slate-800/70 flex items-center justify-between text-xs font-mono text-slate-400">
          <div class="flex items-center space-x-3">
            <span class="text-slate-300">${latest ? (latest.word_count).toLocaleString() + ' 字' : '0 字'}</span>
            <span class="text-slate-600">·</span>
            <span class="text-slate-400">~${latest ? latest.read_time_minutes : 0} 分鐘</span>
          </div>
          <span class="text-cyan-400 group-hover:text-cyan-300 group-hover:translate-x-1.5 transition-all flex items-center gap-1.5 font-bold font-mono">
            作戰閱覽 <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </span>
        </div>

      </div>
    `;
  }).join('');

  initSpotlightEffect();
  lucide.createIcons();
}

// 游標聚光燈座標動態計算
function initSpotlightEffect() {
  document.querySelectorAll('.spotlight-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
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

  // 開啟 Centered Tactical Cinema Modal
  const overlay = document.getElementById('reader-overlay');
  const panel = document.getElementById('reader-panel');
  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.remove('opacity-0');
    panel.classList.remove('scale-95', 'opacity-0');
    panel.classList.add('scale-100', 'opacity-100');
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
    `<span class="px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono">#${t}</span>`
  ).join('');

  // 30 秒重點精華盒子
  const summaryBox = document.getElementById('reader-summary-box');
  const summaryList = document.getElementById('reader-summary-list');
  const bullets = edition.summary_bullets || [];
  if (bullets.length > 0) {
    summaryBox.classList.remove('hidden');
    summaryList.innerHTML = bullets.map(b => {
      let text = escapeHtml(b);
      text = text.replace(/\[5★\]/g, '<span class="badge-5star">5★</span>');
      text = text.replace(/\[4★\]/g, '<span class="badge-4star">4★</span>');
      text = text.replace(/\[3★\]/g, '<span class="badge-3star">3★</span>');
      return `<li class="flex items-start gap-2.5"><span class="text-amber-400 font-bold text-sm select-none">▸</span><span class="leading-relaxed">${text}</span></li>`;
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

  // 回到頂部重設進度
  const scrollContainer = document.getElementById('reader-scroll-container');
  scrollContainer.scrollTop = 0;
  const bar = document.getElementById('reader-progress-bar');
  if (bar) bar.style.width = '0%';
  
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
    
    let indentClass = 'pl-1 font-bold text-slate-200 text-xs';
    if (tag === 'h2') indentClass = 'pl-2 text-cyan-400/90 text-xs font-semibold';
    if (tag === 'h3') indentClass = 'pl-4 text-slate-400 text-[11px]';

    const a = document.createElement('a');
    a.href = `#${id}`;
    a.className = `toc-link block py-1.5 px-2 hover:text-cyan-300 transition-colors truncate rounded ${indentClass}`;
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
  panel.classList.remove('scale-100', 'opacity-100');
  panel.classList.add('scale-95', 'opacity-0');
  
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

// ==================== TACTICAL AUTH & ACCESS CONTROL SYSTEM ====================

function setupAuthSystem() {
  const authModal = document.getElementById('auth-modal');
  const authForm = document.getElementById('auth-form');
  const alertBox = document.getElementById('auth-alert');
  const alertMsg = document.getElementById('auth-alert-msg');
  const passcodeEl = document.getElementById('auth-passcode');
  const rememberEl = document.getElementById('auth-remember');
  const btnLogout = document.getElementById('btn-logout');

  // 表單送出 (通行密碼驗證)
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = passcodeEl ? passcodeEl.value : '';
      const remember = rememberEl ? rememberEl.checked : true;
      
      const res = await window.tacticalAuth.loginWithPassword('指揮官', code, remember);
      if (res.success) {
        hideAuthAlert();
        unlockTerminal(res.user);
        if (!allBriefingsData) {
          await loadBriefingsData();
          handleHashNavigation();
        }
      } else {
        showAuthAlert(res.message);
        triggerAuthShake();
      }
    });
  }

  // 登出 / 鎖定按鈕
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('確認鎖定戰情終端並安全登出？')) {
        window.tacticalAuth.logout();
        lockTerminal();
        // 如果正在開閱讀器，順便關閉
        closeReader();
      }
    });
  }
}

// 解鎖終端
function unlockTerminal(user) {
  const authModal = document.getElementById('auth-modal');
  const mainWrapper = document.getElementById('main-content-wrapper');
  const commanderBadge = document.getElementById('commander-badge');
  const commanderName = document.getElementById('commander-name');
  const commanderAvatar = document.getElementById('commander-avatar');
  const commanderDefaultIcon = document.getElementById('commander-default-icon');
  const btnLogout = document.getElementById('btn-logout');

  // 隱藏登入 Modal
  if (authModal) {
    authModal.classList.add('auth-hidden');
  }

  // 移除主介面模糊效果
  if (mainWrapper) {
    mainWrapper.classList.remove('auth-locked');
  }

  // 顯示指揮官徽章與登出按鈕
  if (commanderBadge && user) {
    commanderBadge.classList.remove('hidden');
    commanderBadge.classList.add('flex');
    if (commanderName) commanderName.textContent = user.name || '廖英男';

    if (user.avatar && commanderAvatar) {
      commanderAvatar.src = user.avatar;
      commanderAvatar.classList.remove('hidden');
      if (commanderDefaultIcon) commanderDefaultIcon.classList.add('hidden');
    } else {
      if (commanderAvatar) commanderAvatar.classList.add('hidden');
      if (commanderDefaultIcon) commanderDefaultIcon.classList.remove('hidden');
    }
  }

  if (btnLogout) {
    btnLogout.classList.remove('hidden');
  }

  lucide.createIcons();
}

// 鎖定終端
function lockTerminal() {
  const authModal = document.getElementById('auth-modal');
  const mainWrapper = document.getElementById('main-content-wrapper');
  const commanderBadge = document.getElementById('commander-badge');
  const btnLogout = document.getElementById('btn-logout');
  const passcodeEl = document.getElementById('auth-passcode');

  // 顯示登入 Modal
  if (authModal) {
    authModal.classList.remove('auth-hidden');
  }

  // 模糊主畫面，阻止任何點擊與窺視
  if (mainWrapper) {
    mainWrapper.classList.add('auth-locked');
  }

  // 隱藏指揮官徽章與登出按鈕
  if (commanderBadge) {
    commanderBadge.classList.add('hidden');
    commanderBadge.classList.remove('flex');
  }
  if (btnLogout) {
    btnLogout.classList.add('hidden');
  }

  if (passcodeEl) {
    passcodeEl.value = '';
  }

  hideAuthAlert();
  lucide.createIcons();
}

// 顯示錯誤警報
function showAuthAlert(msg) {
  const alertBox = document.getElementById('auth-alert');
  const alertMsg = document.getElementById('auth-alert-msg');
  if (alertBox && alertMsg) {
    alertMsg.textContent = msg;
    alertBox.classList.remove('hidden');
    lucide.createIcons();
  }
}

// 隱藏警報
function hideAuthAlert() {
  const alertBox = document.getElementById('auth-alert');
  if (alertBox) {
    alertBox.classList.add('hidden');
  }
}

// 錯誤震動動畫
function triggerAuthShake() {
  const modalBox = document.querySelector('#auth-modal > div');
  if (modalBox) {
    modalBox.classList.remove('auth-shake');
    void modalBox.offsetWidth; // 強制重繪
    modalBox.classList.add('auth-shake');
  }
}

// 全域 Google GIS 回調函式
window.handleGoogleSignIn = async function(response) {
  if (!response || !response.credential) {
    showAuthAlert('Google 驗證憑證傳遞失敗');
    return;
  }

  const res = window.tacticalAuth.handleGoogleCredential(response.credential);
  if (res.success) {
    hideAuthAlert();
    unlockTerminal(res.user);
    if (!allBriefingsData) {
      await loadBriefingsData();
      handleHashNavigation();
    }
  } else {
    showAuthAlert(res.message);
    triggerAuthShake();
  }
};

