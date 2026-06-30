
function deleteFromCard() {
  if (S.eCat === null || S.eIdx === null) return;
  const lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';
  const msg = lang === 'en' ? 'Delete this item?' : '確定要刪除這件衣物嗎？';
  if (!confirm(msg)) return;
  delItem(S.eCat, S.eIdx);
  closeCard();
}


// ── Image compression ─────────────────────────────────────
function compressImage(dataUrl, maxWidth=600, quality=0.75) {
  return new Promise(resolve => {
    const isPng = dataUrl.startsWith('data:image/png');
    const img = new Image();
    img.onload = () => {
      // For transparent PNGs (e.g. removed-bg photos), first crop to the tight
      // bounding box of non-transparent pixels so the subject is centered with
      // no leftover empty margin — this is what makes object-fit:contain look
      // properly centered everywhere the image is displayed.
      let sourceCanvas = img;
      let srcW = img.width, srcH = img.height;
      let cropX = 0, cropY = 0;

      if (isPng) {
        const probe = document.createElement('canvas');
        probe.width = img.width; probe.height = img.height;
        const pctx = probe.getContext('2d');
        pctx.drawImage(img, 0, 0);
        try {
          const { data } = pctx.getImageData(0, 0, probe.width, probe.height);
          let minX = probe.width, minY = probe.height, maxX = 0, maxY = 0;
          let found = false;
          const step = 2; // sample every other pixel for speed
          for (let y = 0; y < probe.height; y += step) {
            for (let x = 0; x < probe.width; x += step) {
              const alpha = data[(y * probe.width + x) * 4 + 3];
              if (alpha > 10) {
                found = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
          if (found && (maxX - minX) > 4 && (maxY - minY) > 4) {
            const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03); // small breathing room
            cropX = Math.max(0, minX - pad);
            cropY = Math.max(0, minY - pad);
            srcW = Math.min(probe.width, maxX + pad) - cropX;
            srcH = Math.min(probe.height, maxY + pad) - cropY;
          }
        } catch(e) {
          // getImageData can fail on tainted canvas (cross-origin); fall back to full image
        }
      }

      const canvas = document.createElement('canvas');
      let w = srcW, h = srcH;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!isPng) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
      } else {
        ctx.drawImage(img, cropX, cropY, srcW, srcH, 0, 0, w, h);
      }
      // PNG for removed-bg images (keep transparency), JPEG for others
      const out = isPng
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', quality);
      resolve(out);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}


function editClosetItem(cat, i) {
  closeAllMenus();
  const item = S.items[cat][i];
  S.eCat = cat; S.eIdx = i; S.pImg = item.src; S.pCat = cat;
  openCardWith(item);
}


// ── Search ────────────────────────────────────────────────
function openSearch() {
  const overlay = document.getElementById('search-overlay');
  overlay.style.display = 'flex';
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
  setTimeout(() => document.getElementById('search-input').focus(), 100);
}

function closeSearch() {
  document.getElementById('search-overlay').style.display = 'none';
}

function doSearch(q) {
  const results = document.getElementById('search-results');
  results.innerHTML = '';
  if (!q.trim()) return;
  const found = [];
  const qLower = q.toLowerCase();
  CLOSET_ORDER.forEach(cat => {
    (S.items[cat] || []).forEach((item, i) => {
      const category = (item.category || '').toLowerCase();
      const brand    = (item.brand    || '').toLowerCase();
      const season   = (item.season   || '').toLowerCase();
      const tags     = (item.tags     || '').toLowerCase();
      if (category.includes(qLower) || brand.includes(qLower) || season.includes(qLower) || tags.includes(qLower)) {
        found.push({ cat, i, item });
      }
    });
  });
  if (!found.length) {
    results.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px;">沒有找到符合的衣物</p>';
    return;
  }
  const grid = mk('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;';
  found.forEach(({cat, i, item}) => {
    const cell = mk('div');
    cell.style.cssText = 'aspect-ratio:1;border-radius:10px;overflow:hidden;background:var(--surface);border:0.5px solid var(--border);position:relative;cursor:pointer;';
    const img = mk('img'); img.src = item.src; img.alt = cat;
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;padding:6px;';
    cell.appendChild(img);
    const lbl = mk('div');
    lbl.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.35);color:#fff;font-size:9px;padding:3px;text-align:center;';
    const validCat = (typeof isValidCategory === 'function' && isValidCategory(item.category)) ? item.category : '';
    lbl.textContent = (item.brand || '') + (item.brand && validCat ? ' · ' : '') + (validCat || CATS[cat].label);
    cell.appendChild(lbl);
    cell.onclick = () => { closeSearch(); switchTab('ootd'); S.idx[cat] = i; renderCat(cat); };
    grid.appendChild(cell);
  });
  results.appendChild(grid);
}


function switchTab(tab) {
  document.querySelectorAll('.nav-tab, .nav-tab-add').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('tab-' + tab);
  if (el) el.classList.add('active');

  // Hide all views
  ['closet-view','card-view','calendar-view','settings-view','search-overlay'].forEach(id => {
    const v = document.getElementById(id);
    if (v) v.style.display = 'none';
  });

  // Card shortcut button: show only on ootd tab
  const cardBtn = document.getElementById('card-shortcut-btn');
  if (cardBtn) cardBtn.style.display = tab === 'ootd' ? 'flex' : 'none';

  // Outfit row menus: hide when not on ootd (they are inside #main, not closet-grid)
  document.querySelectorAll('#main .item-menu-wrap').forEach(m => {
    m.style.display = tab === 'ootd' ? 'block' : 'none';
  });

  // Update topbar title
  const titles = {
    zh: { wardrobe:'我的衣櫥', calendar:'我的記錄', ootd:'今天穿什麼？', card:'穿搭卡片', settings:'個人資料' },
    en: { wardrobe:'My Wardrobe', calendar:'My Records', ootd:'What to wear?', card:'Style Card', settings:'Profile' },
  };
  const lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';
  const titleEl = document.getElementById('app-title');
  if (titleEl && titles[lang][tab]) titleEl.textContent = titles[lang][tab];

  if (tab === 'wardrobe')  setView('closet');
  else if (tab === 'ootd') setView('outfit');
  else if (tab === 'card') openOOTD();
  else if (tab === 'calendar') openCalendar();
  else if (tab === 'settings') openSettings();
}


// ── Settings ─────────────────────────────────────────────
const I18N = {
  zh: {
    title: '我的衣櫥', outfit: '搭配', closet: '衣櫥', addItem: '新增衣物',
    settings: '設定', darkMode: '深色模式', language: '語言',
    accessory: '配飾', jacket: '外套', top: '上著', bottom: '下著', shoes: '鞋子',
    addHint: '點「新增衣物」加入', name: '名稱', date: '新增日期',
    season: '季節', brand: '品牌', size: '尺寸', save: '儲存',
    cancel: '取消', choosePhoto: '選擇照片', choose: '選擇', all: '全部',
    noItems: '這個分類還沒有衣物', addClothes: '新增衣物',
    namePh: '輸入名稱', brandPh: '輸入品牌',
  },
  en: {
    title: 'My Wardrobe', outfit: 'Outfit', closet: 'Closet', addItem: 'Add Item',
    settings: 'Settings', darkMode: 'Dark Mode', language: 'Language',
    accessory: 'Accessory', jacket: 'Jacket', top: 'Top', bottom: 'Bottom', shoes: 'Shoes',
    addHint: 'Tap "Add Item" to start', name: 'Name', date: 'Date Added',
    season: 'Season', brand: 'Brand', size: 'Size', save: 'Save',
    cancel: 'Cancel', choosePhoto: 'Choose Photo', choose: 'Select', all: 'All',
    noItems: 'No items in this category', addClothes: 'Add Item',
    namePh: 'Enter name', brandPh: 'Enter brand',
  }
};

let currentLang = localStorage.getItem('lang') || 'zh';


function t(key) { return I18N[currentLang][key] || key; }

function applyLang() {
  const L = I18N[currentLang];
  const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  // Title
  const titleEl = document.getElementById('app-title');
  if (titleEl) titleEl.innerHTML = L.title + ' <i class="ti ti-chevron-down" style="font-size:14px;color:var(--text-muted);"></i>';

  // Settings
  setT('settings-title', L.settings);
  setT('lbl-theme', L.darkMode);
  setT('lbl-lang', L.language);

  // Bottom nav tabs (use data-zh / data-en spans)
  document.querySelectorAll('.nav-tab span').forEach(span => {
    span.textContent = span.getAttribute('data-' + currentLang) || span.textContent;
  });

  // Upload modal
  const uploadH2 = document.querySelector('#upload-modal h2');
  if (uploadH2) uploadH2.textContent = L.addClothes;
  const modalBtns = document.querySelectorAll('#upload-modal .modal-actions button');
  if (modalBtns[0]) modalBtns[0].textContent = L.cancel;
  if (modalBtns[1]) modalBtns[1].innerHTML = '<i class="ti ti-upload"></i> ' + L.choosePhoto;

  // Upload cat buttons
  const catBtns = document.querySelectorAll('.upload-cat-btn');
  const catKeys = ['accessory','jacket','top','bottom','shoes'];
  const catIcons = ['ti-diamond','ti-coat','ti-shirt','ti-layout-bottombar','ti-shoe'];
  catBtns.forEach((btn, i) => { if (catKeys[i]) btn.innerHTML = '<i class="ti ' + catIcons[i] + '"></i> ' + (L[catKeys[i]] || catKeys[i]); });

  // Card fields
  const labels = document.querySelectorAll('.card-label');
  const keys = ['name','date','season','brand','size'];
  labels.forEach((el, i) => { if (keys[i]) el.textContent = L[keys[i]]; });
  const saveBtns = document.querySelectorAll('.card-save-btn');
  saveBtns.forEach(b => { b.textContent = L.save; });
  const nameInput = document.getElementById('cf-name');
  const brandInput = document.getElementById('cf-brand');
  if (nameInput) nameInput.placeholder = L.namePh;
  if (brandInput) brandInput.placeholder = L.brandPh;

  // Season/size choose label
  ['season-val','size-val'].forEach(id => {
    const el = document.getElementById(id);
    if (el && (el.textContent === '選擇' || el.textContent === 'Select')) el.textContent = L.choose;
  });

  // Lang buttons
  const zhBtn = document.getElementById('lang-zh');
  const enBtn = document.getElementById('lang-en');
  if (zhBtn) zhBtn.classList.toggle('active', currentLang === 'zh');
  if (enBtn) enBtn.classList.toggle('active', currentLang === 'en');

  // OOTD card i18n - update all data-zh/data-en elements
  document.querySelectorAll('[data-zh]').forEach(el => {
    const val = el.getAttribute('data-' + currentLang);
    if (val) el.textContent = val;
  });

  // Re-render
  renderAll();
  if (S.view === 'closet') renderCloset();
}

function applyTheme() {}

// Settings now handled by settings.js

function toggleTheme() {}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  applyLang();
  // Re-render settings if on settings tab
  if (typeof renderSettings === 'function' && document.getElementById('settings-view') && document.getElementById('settings-view').style.display !== 'none') {
    renderSettings();
  }
}

function updateMenuDrop(cat, idx) {
  const drop = document.getElementById('drop-' + cat);
  if (!drop) return;
  drop.innerHTML =
    '<button onclick="editItem(\'' + cat + '\',' + idx + ')"><i class="ti ti-pencil"></i> Edit</button>' +
    '<hr>' +
    '<button class="del-opt" onclick="delItem(\'' + cat + '\',' + idx + ')"><i class="ti ti-trash"></i> Delete</button>';
}

// ── Accessory Column ─────────────────────────────────────
function renderAccessoryCol() {
  const items = (S.items.accessory || []).filter(item => item && (item.src || typeof item === 'string'));
  const picked = S.accPicked || [];
  const locked = picked.length >= 3;
  const hasNoAccessoryOption = items.length > 0;
  // Sync accBrowseIdx bounds (real items: 0..len-1, "none": -1)
  if (S.accBrowseIdx !== -1 && S.accBrowseIdx >= items.length) S.accBrowseIdx = Math.max(0, items.length - 1);

  for (let s = 0; s < 4; s++) {
    const slotEl = document.getElementById('acc-slot-' + s);
    if (!slotEl) continue;
    slotEl.innerHTML = '';
    slotEl.className = 'acc-slot';
    slotEl.onclick = null;

    if (s === 0) {
      // slot 0 = browse slot (TOP) - show sliding accessory picker + "none" option at the end
      if (!items.length) {
        const e = document.createElement('div');
        e.className = 'acc-empty';
        e.textContent = I18N[currentLang]['accessory'] || '配飾';
        slotEl.appendChild(e);
      } else {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;';
        const track = document.createElement('div');
        track.className = 'acc-browse-track';
        track.id = 'acc-browse-track';
        items.forEach((item, i) => {
          const slide = document.createElement('div');
          slide.className = 'acc-browse-slide';
          const img = document.createElement('img');
          img.src = item.src; img.alt = '配飾';
          slide.appendChild(img);
          track.appendChild(slide);
        });
        // "No accessory" virtual slide at the end
        if (hasNoAccessoryOption) {
          const noSlide = document.createElement('div');
          noSlide.className = 'acc-browse-slide';
          const noCard = document.createElement('div');
          noCard.className = 'no-jacket-card';
          noCard.style.width = '78%';
          const noSpan = document.createElement('span');
          noSpan.textContent = currentLang === 'en' ? 'No accessory' : '不戴配飾';
          noCard.appendChild(noSpan);
          noSlide.appendChild(noCard);
          track.appendChild(noSlide);
        }
        wrap.appendChild(track);

        const totalSlides = items.length + (hasNoAccessoryOption ? 1 : 0);
        if (totalSlides > 1) {
          const dots = document.createElement('div');
          dots.className = 'acc-dots';
          items.forEach((_, i) => {
            const d = document.createElement('div');
            d.className = 'acc-dot' + (i === S.accBrowseIdx ? ' active' : '');
            dots.appendChild(d);
          });
          if (hasNoAccessoryOption) {
            const d = document.createElement('div');
            d.className = 'acc-dot' + (S.accBrowseIdx === -1 ? ' active' : '');
            dots.appendChild(d);
          }
          wrap.appendChild(dots);
        }
        slotEl.appendChild(wrap);

        const visualIdx = S.accBrowseIdx === -1 ? items.length : S.accBrowseIdx;
        // Position track instantly (no transition) on full re-render, since this isn't a user swipe
        track.style.transition = 'none';
        track.style.transform = 'translateX(-' + visualIdx * 100 + '%)';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const tr = document.getElementById('acc-browse-track');
            if (tr) tr.style.transition = 'transform .3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          });
        });
        // Tap to pick — only meaningful when on a real item (not "no accessory" slide) and not locked
        if (!locked && S.accBrowseIdx !== -1) {
          slotEl.classList.add('browse');
          slotEl.onclick = () => pickAccessory();
        }
        let tx = 0;
        wrap.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
        wrap.addEventListener('touchend', e => {
          const dx = e.changedTouches[0].clientX - tx;
          if (Math.abs(dx) > 30) {
            const total = items.length + (hasNoAccessoryOption ? 1 : 0);
            const curVisual = S.accBrowseIdx === -1 ? items.length : S.accBrowseIdx;
            const nextVisual = (curVisual + (dx < 0 ? 1 : -1) + total) % total;
            S.accBrowseIdx = nextVisual === items.length ? -1 : nextVisual;
            renderAccessoryCol();
          }
        }, { passive: true });
      }
    } else {
      // slots 1-3 = picked items (newest at slot 1, oldest at slot 3)
      const pickedIdx = picked[s - 1]; // undefined if not picked yet
      if (pickedIdx !== undefined) {
        const item = items[pickedIdx];
        if (!item) continue;
        const img = document.createElement('img');
        img.src = item.src; img.alt = '配飾';
        slotEl.appendChild(img);
        // del button
        const del = document.createElement('button');
        del.className = 'acc-del';
        del.innerHTML = '✕';
        del.onclick = e => { e.stopPropagation(); removeAccPick(s - 1); };
        slotEl.appendChild(del);
      } else {
        const e = document.createElement('div');
        e.className = 'acc-empty';
        e.textContent = I18N[currentLang]['accessory'] || '配飾';
        slotEl.appendChild(e);
      }
    }
  }
}

function pickAccessory() {
  if (S.items.accessory.length === 0) return;
  if (S.accBrowseIdx === -1) return; // "no accessory" slide selected, nothing to pick
  if (S.accPicked.length >= 3) return;
  const idx = S.accBrowseIdx;
  // avoid picking same item twice
  if (S.accPicked.includes(idx)) return;
  S.accPicked.unshift(idx); // newest first
  renderAccessoryCol();
}

function removeAccPick(slotIdx) {
  S.accPicked.splice(slotIdx, 1);
  renderAccessoryCol();
}


'use strict';

// ── 在這裡填入你的 remove.bg API key ──────────────────────
// API keys are now stored in localStorage via Settings page, not hardcoded here.
function getGeminiKey() { return localStorage.getItem('gemini-api-key') || ''; }
function getRemoveBgKey() { return localStorage.getItem('removebg-api-key') || ''; }
// ──────────────────────────────────────────────────────────

const CATS = {
  accessory: { label: '配飾', row: 'row-accessory' },
  jacket:    { label: '外套', row: 'row-jacket' },  // now in outfit-col
  top:       { label: '上著', row: 'row-top' },
  bottom:    { label: '下著', row: 'row-bottom' },
  shoes:     { label: '鞋子', row: 'row-shoes' },
};
const OUTFIT_ORDER  = ['top', 'bottom', 'jacket', 'shoes'];
const CLOSET_ORDER  = ['accessory', 'jacket', 'top', 'bottom', 'shoes'];

const S = {
  items:  { accessory: [], jacket: [], top: [], bottom: [], shoes: [] },
  idx:    { accessory: 0,  jacket: 0,  top: 0,  bottom: 0,  shoes: 0  },
  selCat: null, view: 'outfit',
  pImg: null, pCat: null, eCat: null, eIdx: null,
  filter: 'all',
  accBrowseIdx: 0,   // which accessory is shown in slot 0 (browse)
  accPicked: [],     // picked accessory item indices (max 3)
};

async function loadState() {
  try {
    // Migrate from localStorage if exists
    const legacy = localStorage.getItem('wardrobe-v3');
    if (legacy) {
      const d = JSON.parse(legacy);
      if (d.items) {
        Object.assign(S.items, d.items);
        await dbSaveWardrobe({ items: S.items });
        localStorage.removeItem('wardrobe-v3');
        console.log('Migrated from localStorage to IndexedDB');
      }
    } else {
      const data = await dbLoadWardrobe();
      if (data && data.items) Object.assign(S.items, data.items);
    }
  } catch(e) { console.error('loadState error:', e); }
  renderAll();
  applyLang();
  switchTab('ootd');
}
function saveState() {
  dbSaveWardrobe({ items: S.items }).catch(e => {
    console.error('saveState error:', e);
  });
  checkStorageQuota();
}

let lastStorageWarnTime = 0;
function checkStorageQuota() {
  if (!navigator.storage || !navigator.storage.estimate) return;
  navigator.storage.estimate().then(est => {
    if (!est.quota) return;
    const pct = est.usage / est.quota;
    const now = Date.now();
    // Only warn once per session-ish (avoid spamming on every save)
    if (pct > 0.8 && now - lastStorageWarnTime > 60000) {
      lastStorageWarnTime = now;
      const lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';
      const pctNum = Math.round(pct * 100);
      alert(lang === 'en'
        ? `Storage is ${pctNum}% full. Consider exporting or removing old items.`
        : `儲存空間已使用 ${pctNum}%，建議匯出備份或刪除部分舊衣物。`);
    }
  }).catch(() => {});
}

function renderAll() { OUTFIT_ORDER.forEach(renderCat); renderAccessoryCol(); }

function renderCat(cat) {
  const cfg = CATS[cat], row = document.getElementById(cfg.row);
  const items = S.items[cat], idx = S.idx[cat];
  if (!row) return;
  row.innerHTML = '';
  const wrap = mk('div', 'slider-wrap');

  // Category label always centered in slot
  const catLabel = mk('div', 'cat-center-label');
  catLabel.textContent = I18N[currentLang][cat] || cfg.label;
  row.appendChild(catLabel);

  // Jacket gets a special "no jacket" virtual slide prepended (only if there are real items)
  const hasNoJacketOption = (cat === 'jacket' && items.length > 0);
  // When hasNoJacketOption, idx -1 represents "no jacket"; real items shift by +1 visually
  const noJacketSelected = hasNoJacketOption && idx === -1;

  if (!items.length) {
    const e = mk('div', 'empty-slot');
    wrap.appendChild(e);
  } else {
    const track = mk('div', 'slider-track'); track.id = 'track-' + cat;

    items.forEach((item, i) => {
      const slide = mk('div', 'slide');
      const img = mk('img', 'item-img'); img.src = item.src; img.alt = cfg.label;
      slide.appendChild(img);
      track.appendChild(slide);
    });

    if (hasNoJacketOption) {
      const noSlide = mk('div', 'slide');
      const noCard = mk('div', 'no-jacket-card');
      const noSpan = document.createElement('span');
      noSpan.textContent = currentLang === 'en' ? 'No jacket today' : '今天不穿外套';
      noCard.appendChild(noSpan);
      noSlide.appendChild(noCard);
      track.appendChild(noSlide);
    }

    wrap.appendChild(track);

    const totalSlides = items.length + (hasNoJacketOption ? 1 : 0);
    if (totalSlides > 1) {
      const dots = mk('div', 'dot-row');
      items.forEach((_, i) => dots.appendChild(mk('div', 'dot' + (i === idx ? ' active' : ''))));
      if (hasNoJacketOption) dots.appendChild(mk('div', 'dot' + (noJacketSelected ? ' active' : '')));
      wrap.appendChild(dots);
    }

    const visualIdx = (hasNoJacketOption && idx === -1) ? items.length : idx;
    requestAnimationFrame(() => {
      const t = document.getElementById('track-' + cat);
      if (t) t.style.transform = 'translateX(-' + visualIdx * 100 + '%)';
    });
  }
  row.appendChild(wrap);
  let tx = 0;
  wrap.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  wrap.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 38) go(cat, dx < 0 ? 1 : -1);
  }, { passive: true });
}

function closeMenus() { document.querySelectorAll('.item-dropdown').forEach(d => d.classList.remove('show')); }
function closeAllMenus() { closeMenus(); }
document.addEventListener('click', e => { if (!e.target.closest('.item-menu-wrap')) closeMenus(); });

function navBtn(cb, side, hidden) {
  const b = mk('button', 'nav-btn ' + side + (hidden ? ' hidden' : ''));
  b.innerHTML = '<i class="ti ti-chevron-' + side + '"></i>'; b.onclick = cb; return b;
}
function go(cat, dir) {
  const len = S.items[cat].length;
  if (!len) return;

  const hasNoJacketOption = (cat === 'jacket');
  let ni;
  if (hasNoJacketOption) {
    // Visual layout: [item0, item1, ..., itemN-1, no-jacket]
    // Logical idx: 0..len-1 for real items, -1 for "no jacket" (which sits at visual position len)
    const total = len + 1;
    const curVisual = S.idx[cat] === -1 ? len : S.idx[cat];
    const nextVisual = (curVisual + dir + total) % total;
    ni = nextVisual === len ? -1 : nextVisual;
  } else {
    ni = (S.idx[cat] + dir + len) % len;
  }
  S.idx[cat] = ni;

  // Animate existing track instead of full re-render (avoids inconsistent transition timing)
  const visualIdx = hasNoJacketOption ? (ni === -1 ? len : ni) : ni;
  const t = document.getElementById('track-' + cat);
  if (t) {
    t.style.transition = 'transform .3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    t.style.transform = 'translateX(-' + visualIdx * 100 + '%)';
  }
  // Update dots without full re-render
  const row = document.getElementById(CATS[cat].row);
  if (row) {
    const dots = row.querySelectorAll('.dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === visualIdx));
  }
  updateMenuDrop(cat, ni);
}
function delItem(cat, i) {
  closeMenus(); S.items[cat].splice(i, 1); S.idx[cat] = Math.max(0, S.idx[cat] - 1);
  saveState(); renderCat(cat); if (S.view === 'closet') renderCloset();
}
function editItem(cat, i) {
  closeMenus(); const item = S.items[cat][i];
  S.eCat = cat; S.eIdx = i; S.pImg = item.src; S.pCat = cat; openCardWith(item);
}

function openUpload() {
  switchTab('ootd');
  document.getElementById('upload-modal').classList.add('open');
}
function closeUpload() {
  document.getElementById('upload-modal').classList.remove('open');
  S.selCat = null; document.querySelectorAll('.upload-cat-btn').forEach(b => b.classList.remove('selected'));
}
function selectCat(btn) {
  document.querySelectorAll('.upload-cat-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected'); S.selCat = btn.dataset.cat;
}
function triggerFile() { if (!S.selCat) { alert('請先選擇衣物類別'); return; } document.getElementById('file-input').click(); }
document.getElementById('upload-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeUpload(); });

async function handleFile(e) {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  const cat = S.selCat; if (!cat) return; closeUpload();
  const rowId = CATS[cat].row;
  const row = document.getElementById(rowId) || document.getElementById('acc-slot-3') || document.body;
  const ov = mk('div', 'processing-overlay');
  const ovSpan = document.createElement('span');
  ovSpan.textContent = currentLang === 'en' ? 'Processing...' : '處理中...';
  ov.appendChild(ovSpan);
  row.appendChild(ov);
  try {
    let url;
    const removeBgKey = getRemoveBgKey();
    if (removeBgKey) {
      const fd = new FormData(); fd.append('image_file', file); fd.append('size', 'auto');
      const res = await fetch('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': removeBgKey }, body: fd });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error((j.errors?.[0]?.title) || 'API 錯誤'); }
      url = await b2u(await res.blob());
      trackRemoveBgUsage();
    } else { url = await b2u(file); }
    S.pImg = url; S.pCat = cat; S.eCat = null; S.eIdx = null;
    if (row.contains(ov)) row.removeChild(ov);
    if (cat === 'accessory') renderAccessoryCol();
    openCardWith({ src: url, name: '', date: '', season: '', brand: '', size: '' });
  } catch (err) {
    if (row.contains(ov)) row.removeChild(ov);
    const fb = await b2u(file).catch(() => null);
    if (fb) { S.pImg = fb; S.pCat = cat; S.eCat = null; S.eIdx = null; openCardWith({ src: fb, name: '', date: '', season: '', brand: '', size: '' }); }
    if (removeBgKey) alert('去背失敗。\n' + err.message);
  }
}

// ── remove.bg usage tracking (30-day rolling window, matches remove.bg's own reset cycle) ──
function getRemoveBgUsageData() {
  try {
    return JSON.parse(localStorage.getItem('removebg-usage-data') || 'null') || { cycleStart: null, count: 0 };
  } catch(e) { return { cycleStart: null, count: 0 }; }
}

function getRemoveBgUsage() {
  const data = getRemoveBgUsageData();
  if (!data.cycleStart) return 0;
  const daysSinceStart = (Date.now() - data.cycleStart) / (1000 * 60 * 60 * 24);
  if (daysSinceStart >= 30) return 0; // cycle has reset
  return data.count;
}

function getRemoveBgDaysUntilReset() {
  const data = getRemoveBgUsageData();
  if (!data.cycleStart) return null; // no cycle started yet
  const daysSinceStart = (Date.now() - data.cycleStart) / (1000 * 60 * 60 * 24);
  if (daysSinceStart >= 30) return null; // already reset, no active cycle
  return Math.ceil(30 - daysSinceStart);
}

function trackRemoveBgUsage() {
  let data = getRemoveBgUsageData();
  const now = Date.now();

  if (!data.cycleStart || (now - data.cycleStart) / (1000 * 60 * 60 * 24) >= 30) {
    // Start a new 30-day cycle
    data = { cycleStart: now, count: 1 };
  } else {
    data.count += 1;
  }
  localStorage.setItem('removebg-usage-data', JSON.stringify(data));

  const limit = 50;
  const remaining = limit - data.count;
  const lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';

  if (remaining === 5) {
    alert(lang === 'en'
      ? 'Only 5 remove.bg uses left in this 30-day cycle.'
      : '本次 30 天額度只剩 5 次了！');
  } else if (remaining <= 0) {
    alert(lang === 'en'
      ? 'remove.bg quota used up for this 30-day cycle.'
      : '本次 30 天額度已用完！');
  }
}

// ── Season selector with dropdown + tags ─────────────────
const SEASONS_ZH = ['春天','夏天','秋天','冬天','全季節'];
const SEASONS_EN = ['Spring','Summer','Autumn','Winter','All Season'];
function getSeasons() { return (typeof currentLang !== 'undefined' && currentLang === 'en') ? SEASONS_EN : SEASONS_ZH; }
const SEASONS = SEASONS_ZH; // kept for backward compat
let selectedSeasons = [];

function renderSeasonUI() {
  const wrap = document.getElementById('season-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex:1;margin-left:8px;';

  // Dropdown button
  const dropBtn = mk('button');
  dropBtn.style.cssText = 'font-size:13px;color:var(--text-primary);background:var(--surface2);border:0.5px solid var(--border-strong);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;';
  dropBtn.innerHTML = (typeof currentLang !== 'undefined' && currentLang === 'en' ? 'Select season' : '選擇季節') + ' <i class="ti ti-chevron-down" style="font-size:11px;"></i>';
  dropBtn.onclick = e => { e.stopPropagation(); showSeasonDropdown(dropBtn); };
  wrap.appendChild(dropBtn);

  // Selected tags
  if (selectedSeasons.length) {
    const tagsRow = mk('div');
    tagsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;';
    selectedSeasons.forEach(s => {
      // s is stored in EN, display in current lang
      const enIdx = SEASONS_EN.indexOf(s);
      const displayS = (typeof currentLang !== 'undefined' && currentLang === 'zh' && enIdx >= 0) ? SEASONS_ZH[enIdx] : s;
      const tag = mk('div');
      tag.style.cssText = 'display:flex;align-items:center;gap:4px;background:#111;color:#fff;border-radius:100px;padding:4px 10px;font-size:12px;';
      const x = mk('button');
      x.innerHTML = '&times;';
      x.style.cssText = 'background:none;border:none;color:#fff;cursor:pointer;font-size:14px;line-height:1;padding:0;margin-right:1px;';
      x.onclick = () => { selectedSeasons = selectedSeasons.filter(v => v !== s); renderSeasonUI(); };
      tag.appendChild(x);
      const lbl = document.createElement('span');
      lbl.textContent = displayS;
      tag.appendChild(lbl);
      tagsRow.appendChild(tag);
    });
    wrap.appendChild(tagsRow);
  }
}

function showSeasonDropdown(anchor) {
  const existing = document.getElementById('season-dropdown-popup');
  if (existing) { existing.remove(); return; }
  const rect = anchor.getBoundingClientRect();
  const pop = mk('div'); pop.id = 'season-dropdown-popup';
  pop.style.cssText = 'position:fixed;top:' + (rect.bottom+4) + 'px;right:' + (window.innerWidth-rect.right) + 'px;background:#fff;border:0.5px solid rgba(0,0,0,.12);border-radius:10px;overflow:hidden;z-index:500;min-width:140px;box-shadow:0 4px 16px rgba(0,0,0,.12);';
  getSeasons().forEach((s, idx) => {
    const sEn = SEASONS_EN[idx];
    const btn = mk('button');
    btn.style.cssText = 'display:flex;align-items:center;justify-content:space-between;width:100%;padding:11px 14px;border:none;background:' + (selectedSeasons.includes(s)?'#f5f4f2':'#fff') + ';font-size:14px;font-family:inherit;color:#111;cursor:pointer;border-bottom:0.5px solid rgba(0,0,0,.06);';
    btn.innerHTML = s + (selectedSeasons.includes(sEn) ? ' <span style="color:#888;font-size:12px;">✓</span>' : '');
    btn.onclick = () => {
      if (sEn === 'All Season') {
        selectedSeasons = selectedSeasons.includes('All Season') ? [] : ['All Season'];
      } else {
        selectedSeasons = selectedSeasons.filter(x => x !== 'All Season');
        if (selectedSeasons.includes(sEn)) selectedSeasons = selectedSeasons.filter(x => x !== sEn);
        else selectedSeasons.push(sEn);
      }
      pop.remove();
      renderSeasonUI();
    };
    pop.appendChild(btn);
  });
  document.body.appendChild(pop);
  setTimeout(() => document.addEventListener('click', () => pop.remove(), { once: true }), 10);
}

function renderSeasonChips() { renderSeasonUI(); }
function toggleSeason(s) {}

// ── Size selector ─────────────────────────────────────────
const SIZE_OPTS = {
  top:       ['XS','S','M','L','XL','XXL','F'],
  bottom:    ['XS','S','M','L','XL','XXL','F'],
  jacket:    ['XS','S','M','L','XL','XXL','F'],
  accessory: ['F'],
  shoes: null,
};
const SHOE_SYSTEMS = {
  EU:['35','36','37','38','39','40','41','42','43','44','45','46'],
  US:['4','4.5','5','5.5','6','6.5','7','7.5','8','8.5','9','9.5','10','10.5','11','12'],
  UK:['2','3','4','5','6','7','8','9','10','11'],
  cm:['22','22.5','23','23.5','24','24.5','25','25.5','26','26.5','27','28'],
};
let selectedSize = '';
let selectedShoeSystem = 'EU';

function renderSizeSelector(cat) {
  const wrap = document.getElementById('size-selector');
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;margin-left:8px;';

  if (cat === 'shoes') {
    const sysRow = mk('div'); sysRow.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;';
    Object.keys(SHOE_SYSTEMS).forEach(sys => {
      const b = mk('button', 'size-system-btn' + (sys === selectedShoeSystem ? ' active' : ''));
      b.textContent = sys;
      b.onclick = () => { selectedShoeSystem = sys; selectedSize = ''; renderSizeSelector(cat); };
      sysRow.appendChild(b);
    });
    wrap.appendChild(sysRow);
    const sizeRow = mk('div'); sizeRow.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;';
    SHOE_SYSTEMS[selectedShoeSystem].forEach(s => {
      const b = mk('button', 'size-btn' + (s === selectedSize ? ' active' : ''));
      b.textContent = s;
      b.onclick = () => { selectedSize = s; renderSizeSelector(cat); };
      sizeRow.appendChild(b);
    });
    wrap.appendChild(sizeRow);
  } else {
    const opts = SIZE_OPTS[cat] || SIZE_OPTS.top;
    const row = mk('div'); row.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;';
    opts.forEach(s => {
      const b = mk('button', 'size-btn' + (s === selectedSize ? ' active' : ''));
      b.textContent = s;
      b.onclick = () => { selectedSize = s; renderSizeSelector(cat); };
      row.appendChild(b);
    });
    wrap.appendChild(row);
  }
}

// ── Brand picker ──────────────────────────────────────────
let selectedBrand = '';
const BRANDS_BUILTIN = ["A.P.C.","Acne Studios","Adidas","Alexander McQueen","Alexander Wang","Ami Paris","Arc'teryx","Balenciaga","Balmain","Bottega Veneta","Burberry","Calvin Klein","Canada Goose","Carhartt","Celine","Champion","Chanel","Chrome Hearts","Coach","Common Projects","Converse","Cos","Dior","Dr. Martens","Eileen Fisher","Essentials","Fendi","Frame","Free People","Ganni","Gap","Givenchy","Gucci","H&M","Helmut Lang","Hermes","Jacquemus","Kenzo","Lacoste","Levi's","Loewe","Louis Vuitton","Lululemon","Maison Margiela","Marc Jacobs","Marni","Max Mara","Miu Miu","Moncler","Muji","New Balance","Nike","Off-White","Palm Angels","Patagonia","Paul Smith","Polo Ralph Lauren","Prada","Rag & Bone","Ralph Lauren","Rick Owens","Salomon","Sandro","Stone Island","Supreme","The North Face","Theory","Thom Browne","Tommy Hilfiger","Toteme","Uniqlo","Valentino","Vans","Versace","Vivienne Westwood","Yeezy","Zara","Zimmermann","3.1 Phillip Lim","A-COLD-WALL*","Ader Error","Aimé Leon Dore","Alyx","Amiri","ASICS","Attico","Bape","Berluti","Birkenstock","Bode","Boss","Brunello Cucinelli","Casablanca","Chloe","Comme des Garcons","Craig Green","Diesel","Dries Van Noten","ERL","Etro","Fear of God","Gentle Monster","Golden Goose","Hoka","Isabel Marant","Jil Sander","Khaite","Mackintosh","Massimo Dutti","Nanushka","Needles","New Era","Noah","Norse Projects","Our Legacy","Pangaia","Peter Do","Pleats Please","Puma","Reebok","Rhude","Sacai","Saint Laurent","Sea New York","Snow Peak","Sporty & Rich","Staud","Studio Nicholson","Sunspel","Tekla","The Row","Tory Burch","Undercover","Veja","Vetements","Visvim","Willy Chavarria","Woolrich","Y-3","Y/Project","Zegna"];

function openBrandPicker() {
  const existing = document.getElementById('brand-picker-overlay');
  if (existing) existing.remove();
  const userBrands = JSON.parse(localStorage.getItem('user-brands') || '[]');
  const allBrands = [...new Set([...userBrands, ...BRANDS_BUILTIN])].sort((a,b) => a.localeCompare(b));

  const overlay = mk('div'); overlay.id = 'brand-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:400;display:flex;align-items:flex-end;';
  const panel = mk('div'); panel.style.cssText = 'background:var(--surface);border-radius:20px 20px 0 0;width:100%;height:72vh;display:flex;flex-direction:column;';
  const handle = mk('div'); handle.style.cssText = 'width:36px;height:4px;border-radius:2px;background:var(--border-strong);margin:12px auto 0;flex-shrink:0;';
  const searchWrap = mk('div'); searchWrap.style.cssText = 'padding:12px 16px 8px;flex-shrink:0;';
  const searchInput = mk('input'); searchInput.type='text'; searchInput.placeholder='搜尋品牌...';
  searchInput.style.cssText = 'width:100%;padding:10px 14px;border-radius:10px;border:0.5px solid var(--border-strong);background:var(--surface2);color:var(--text-primary);font-size:14px;font-family:inherit;outline:none;';
  searchWrap.appendChild(searchInput);
  const list = mk('div'); list.style.cssText = 'flex:1;overflow-y:auto;padding:0 16px 20px;';

  function renderList(filter) {
    list.innerHTML = '';
    const filtered = allBrands.filter(b => b.toLowerCase().includes(filter.toLowerCase()));
    if (filter && !allBrands.find(b => b.toLowerCase() === filter.toLowerCase())) {
      const addBtn = mk('button'); addBtn.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;padding:13px 0;border:none;background:none;color:var(--text-primary);font-size:14px;font-family:inherit;cursor:pointer;border-bottom:0.5px solid var(--border);';
      addBtn.innerHTML = '+ 新增「' + filter + '」';
      addBtn.onclick = () => { selectBrand(filter, true); overlay.remove(); };
      list.appendChild(addBtn);
    }
    filtered.forEach(b => {
      const btn = mk('button'); btn.style.cssText = 'display:block;width:100%;padding:13px 0;border:none;border-bottom:0.5px solid var(--border);background:' + (b===selectedBrand?'var(--surface2)':'none') + ';color:var(--text-primary);font-size:14px;font-family:inherit;cursor:pointer;text-align:left;';
      btn.textContent = b + (b === selectedBrand ? ' ✓' : '');
      btn.onclick = () => { selectBrand(b, false); overlay.remove(); };
      list.appendChild(btn);
    });
  }
  searchInput.addEventListener('input', e => renderList(e.target.value));
  renderList('');
  panel.appendChild(handle); panel.appendChild(searchWrap); panel.appendChild(list);
  overlay.appendChild(panel);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  setTimeout(() => searchInput.focus(), 100);
}

function selectBrand(brand, isNew) {
  selectedBrand = brand;
  const btn = document.getElementById('cf-brand-val');
  if (btn) btn.textContent = brand;
  if (isNew) {
    const userBrands = JSON.parse(localStorage.getItem('user-brands') || '[]');
    if (!userBrands.includes(brand)) { userBrands.unshift(brand); localStorage.setItem('user-brands', JSON.stringify(userBrands)); }
  }
}


// ── Tags system ───────────────────────────────────────────
let selectedTags = [];

function getUserTags() {
  try { return JSON.parse(localStorage.getItem('user-tags') || '[]'); }
  catch(e) { return []; }
}

function saveUserTag(tag) {
  const tags = getUserTags();
  if (!tags.includes(tag)) {
    tags.unshift(tag);
    if (tags.length > 50) tags.pop();
    localStorage.setItem('user-tags', JSON.stringify(tags));
  }
}

function renderTagsArea() {
  const area = document.getElementById('tags-area');
  if (!area) return;
  area.innerHTML = '';

  // Selected tags
  if (selectedTags.length) {
    const row = mk('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;';
    selectedTags.forEach(tag => {
      const chip = mk('div');
      chip.style.cssText = 'display:flex;align-items:center;gap:3px;background:#111;color:#fff;border-radius:100px;padding:4px 10px;font-size:12px;';
      const x = mk('button');
      x.innerHTML = '&times;';
      x.style.cssText = 'background:none;border:none;color:#fff;cursor:pointer;font-size:14px;line-height:1;padding:0;';
      x.onclick = () => { selectedTags = selectedTags.filter(t => t !== tag); renderTagsArea(); };
      chip.appendChild(x);
      const lbl = mk('span'); lbl.textContent = tag;
      chip.appendChild(lbl);
      row.appendChild(chip);
    });
    area.appendChild(row);
  }

  // Input row
  const inputRow = mk('div');
  inputRow.style.cssText = 'display:flex;gap:6px;align-items:center;justify-content:flex-end;width:100%;';

  const inp = mk('input');
  inp.type = 'text';
  inp.placeholder = typeof currentLang !== 'undefined' && currentLang === 'en' ? 'Add tag...' : '新增標籤...';
  inp.style.cssText = 'flex:1;max-width:130px;padding:5px 10px;border-radius:20px;border:0.5px solid var(--border-strong);background:var(--surface2);font-size:12px;font-family:inherit;outline:none;color:var(--text-primary);';
  inp.id = 'tag-input';

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { addTag(inp.value.trim()); inp.value = ''; }
  });

  const addBtn = mk('button');
  addBtn.textContent = '+';
  addBtn.style.cssText = 'background:#111;color:#fff;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:16px;font-weight:300;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
  addBtn.onclick = () => { addTag(inp.value.trim()); inp.value = ''; };

  inputRow.appendChild(inp);
  inputRow.appendChild(addBtn);
  area.appendChild(inputRow);

  // History tags
  const history = getUserTags().filter(t => !selectedTags.includes(t)).slice(0, 8);
  if (history.length) {
    const histRow = mk('div');
    histRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;';
    history.forEach(tag => {
      const btn = mk('button');
      btn.style.cssText = 'padding:3px 10px;border-radius:100px;border:0.5px solid var(--border-strong);background:transparent;color:var(--text-secondary);font-size:11px;font-family:inherit;cursor:pointer;';
      btn.textContent = tag;
      btn.onclick = () => { addTag(tag); };
      histRow.appendChild(btn);
    });
    area.appendChild(histRow);
  }
}

function addTag(tag) {
  if (!tag) return;
  if (!selectedTags.includes(tag)) {
    selectedTags.push(tag);
    saveUserTag(tag);
  }
  renderTagsArea();
}

async function analyzeTagsWithAI(imageSrc, cat) {
  const catEl = document.getElementById('cf-category');
  if (!catEl) return;

  const lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';

  const geminiKey = getGeminiKey();
  if (!geminiKey) {
    // No API key configured — AI analysis unavailable
    if (!catEl.textContent) catEl.textContent = lang === 'en' ? 'AI unavailable (no key)' : 'AI 未設定金鑰';
    return;
  }

  try {
    const base64 = imageSrc.split(',')[1];
    const mediaType = imageSrc.split(';')[0].split(':')[1] || 'image/png';

    const prompt = lang === 'en'
      ? 'Analyze this clothing image. Return ONLY a JSON object with one field: "category" (a specific clothing type description, like "short sleeve t-shirt", "jeans", "sneakers"). No markdown, no other text, just raw JSON.'
      : '分析這件衣物圖片。只回覆JSON物件，包含一個欄位："category"（具體類型，例如"短袖T恤"、"牛仔褲"、"運動鞋"）。不要markdown格式，不要其他文字，只回傳純JSON。';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=' + geminiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mediaType, data: base64 } }
          ]
        }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 150 }
      })
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error('HTTP ' + res.status + ': ' + errBody.slice(0, 200));
    }

    const data = await res.json();
    const text = data.candidates && data.candidates[0] && data.candidates[0].content
      && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
      && data.candidates[0].content.parts[0].text;

    if (!text) throw new Error('No text in response: ' + JSON.stringify(data).slice(0, 200));

    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    if (result.category) {
      const topLevelLabel = (I18N[currentLang] && I18N[currentLang][cat]) || (CATS[cat] && CATS[cat].label) || cat;
      catEl.textContent = topLevelLabel + ' > ' + result.category;
    }
  } catch(e) {
    console.error('AI analyze error:', e);
    const isTimeout = e.name === 'AbortError';
    const isRateLimit = (e.message || '').includes('429');
    let shortMsg;
    if (isTimeout) shortMsg = lang === 'en' ? 'Timed out' : '逾時';
    else if (isRateLimit) shortMsg = lang === 'en' ? 'Too many requests, wait a bit' : '請求太頻繁，請稍後再試';
    else shortMsg = (e.message || '').slice(0, 60);

    if (!catEl.textContent || catEl.textContent.includes('辨識中') || catEl.textContent.includes('Analyzing')) {
      catEl.textContent = (lang === 'en' ? 'AI failed: ' : 'AI 辨識失敗：') + shortMsg;
    }
    console.warn('AI analysis failed:', e.message);
  }
}

let lastAiCallTime = 0;
const AI_CALL_COOLDOWN_MS = 4000; // minimum gap between AI calls to avoid rate limiting

function reanalyzeCategory() {
  const catEl = document.getElementById('cf-category');
  const reanalyzeBtn = document.getElementById('cf-reanalyze-btn');
  const imgSrc = document.getElementById('card-img').src;
  if (!imgSrc) return;

  const lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';

  const now = Date.now();
  const elapsed = now - lastAiCallTime;
  if (elapsed < AI_CALL_COOLDOWN_MS) {
    const waitSec = Math.ceil((AI_CALL_COOLDOWN_MS - elapsed) / 1000);
    if (catEl) catEl.textContent = lang === 'en'
      ? ('Please wait ' + waitSec + 's before retrying')
      : ('請等待 ' + waitSec + ' 秒後再試');
    if (reanalyzeBtn) reanalyzeBtn.style.display = 'inline-block';
    return;
  }
  lastAiCallTime = now;

  if (catEl) catEl.textContent = lang === 'en' ? 'Analyzing...' : 'AI 辨識中...';
  if (reanalyzeBtn) reanalyzeBtn.style.display = 'none';

  compressImage(imgSrc, 350, 0.6).then(compressed => {
    analyzeTagsWithAI(compressed, S.pCat);
  }).catch(() => {
    analyzeTagsWithAI(imgSrc, S.pCat);
  });
}

// ── Card open/close ───────────────────────────────────────
// Old placeholder strings from previous app versions that should be treated as "no real category"
const INVALID_CATEGORY_TEXTS = [
  'Analyzing...', 'AI 辨識中...', '點擊輸入', 'Tap to edit',
  'AI 辨識失敗', 'AI analysis failed', 'AI 未設定金鑰', 'AI unavailable (no key)',
];
const INVALID_CATEGORY_PREFIXES = ['AI 辨識失敗', 'AI failed:'];
function isValidCategory(cat) {
  if (!cat) return false;
  const trimmed = cat.trim();
  if (INVALID_CATEGORY_TEXTS.includes(trimmed)) return false;
  if (INVALID_CATEGORY_PREFIXES.some(p => trimmed.startsWith(p))) return false;
  return true;
}

function openCardWith(item) {
  document.getElementById('card-img').src = item.src;
  document.getElementById('cf-date').textContent = item.date || new Date().toLocaleDateString('zh-TW');
  const catEl = document.getElementById('cf-category');
  const hasRealCategory = isValidCategory(item.category);
  if (catEl) catEl.textContent = hasRealCategory ? item.category : (currentLang === 'en' ? 'Analyzing...' : 'AI 辨識中...');
  selectedSeasons = item.season ? item.season.split(',').map(s=>s.trim()).filter(Boolean) : [];
  renderSeasonChips();
  selectedBrand = item.brand || '';
  const brandBtn = document.getElementById('cf-brand-val');
  if (brandBtn) brandBtn.textContent = selectedBrand || (currentLang==='en'?'Select brand':'選擇品牌');
  selectedSize = item.size || '';
  selectedShoeSystem = item.shoeSystem || 'EU';
  renderSizeSelector(S.pCat || 'top');
  // Tags
  selectedTags = item.tags ? item.tags.split(',').map(t=>t.trim()).filter(Boolean) : [];
  renderTagsArea();
  // AI auto-analyze category for genuinely new items only (no valid category yet, not editing existing)
  const isExistingItem = (S.eCat !== null && S.eIdx !== null);
  const reanalyzeBtn = document.getElementById('cf-reanalyze-btn');

  if (!isExistingItem && !hasRealCategory && item.src) {
    // Brand new upload — auto-trigger AI analysis
    if (reanalyzeBtn) reanalyzeBtn.style.display = 'none';
    compressImage(item.src, 350, 0.6).then(compressed => {
      analyzeTagsWithAI(compressed, S.pCat);
    }).catch(() => {
      analyzeTagsWithAI(item.src, S.pCat);
    });
  } else if (isExistingItem && !hasRealCategory) {
    // Existing item with no valid category (old data / stale placeholder) — show manual re-analyze button
    if (reanalyzeBtn) reanalyzeBtn.style.display = 'inline-block';
  } else {
    // Existing item that already has a real category — no button needed
    if (reanalyzeBtn) reanalyzeBtn.style.display = 'none';
  }
  // Show delete button only for existing items (not new uploads)
  const delBtn = document.getElementById('card-delete-btn');
  if (delBtn) delBtn.style.display = (S.eCat !== null && S.eIdx !== null) ? 'block' : 'none';
  document.getElementById('card-modal').classList.add('open');
}
function closeCard() {
  document.getElementById('card-modal').classList.remove('open');
  S.pImg = null; S.pCat = null; S.eCat = null; S.eIdx = null;
}
document.getElementById('card-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeCard(); });

async function saveCard() {
  if (!S.pImg || !S.pCat) return;

  // Warn if AI is still analyzing
  if (document.getElementById('tag-loading')) {
    const lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';
    const msg = lang === 'en'
      ? 'AI is still analyzing. Save anyway?'
      : 'AI 還在分析中，要繼續儲存嗎？';
    if (!confirm(msg)) return;
  }

  // Compress image before saving
  let savedSrc = S.pImg;
  try { savedSrc = await compressImage(S.pImg); } catch(e) {}

  const item = {
    src: savedSrc,
    date: document.getElementById('cf-date').textContent,
    category: document.getElementById('cf-category') ? document.getElementById('cf-category').textContent : '',
    season: selectedSeasons.join(', '),
    brand: selectedBrand || '',
    size: selectedSize || '',
    shoeSystem: S.pCat === 'shoes' ? selectedShoeSystem : '',
    tags: selectedTags.join(', '),
  };
  const cat = S.pCat;
  if (S.eCat !== null && S.eIdx !== null) { S.items[S.eCat][S.eIdx] = item; }
  else { S.items[cat].push(item); S.idx[cat] = S.items[cat].length - 1; }
  saveState(); closeCard();
  if (cat === 'accessory') renderAccessoryCol();
  else renderCat(cat);
  if (S.view === 'closet') renderCloset();
}

function b2u(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); }); }

function setView(v) {
  S.view = v;
  const cv = document.getElementById('closet-view');
  if (v === 'closet') { cv.style.display = 'flex'; renderCloset(); }
  else { cv.style.display = 'none'; }
  document.querySelectorAll('#main .item-menu-wrap').forEach(m => { m.style.display = v === 'outfit' ? 'block' : 'none'; });
}

function setFilter(f) {
  S.filter = f;
  document.querySelectorAll('.closet-tab').forEach(b => b.classList.toggle('active', b.dataset.f === f));
  renderClosetGrid();
}

function renderCloset() {
  const tabs = document.getElementById('closet-tabs'); tabs.innerHTML = '';
  [['all', t('all')], ...CLOSET_ORDER.map(c => [c, I18N[currentLang][c] || CATS[c].label])].forEach(([f, lbl]) => {
    const b = mk('button', 'closet-tab' + (S.filter === f ? ' active' : ''));
    b.textContent = lbl; b.dataset.f = f; b.onclick = () => setFilter(f); tabs.appendChild(b);
  });
  // Search button
  const srch = mk('button');
  srch.innerHTML = '<svg width="16" height="16" viewBox="0 0 15 15" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  srch.style.cssText = 'flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#111;background:transparent;border:0.5px solid var(--border-strong);border-radius:50%;width:32px;height:32px;padding:0;cursor:pointer;';
  srch.onclick = () => openSearch();
  tabs.appendChild(srch);
  renderClosetGrid();
}

function renderClosetGrid() {
  const c = document.getElementById('closet-content'); c.innerHTML = '';
  const cats = S.filter === 'all' ? CLOSET_ORDER : [S.filter];
  let any = false;
  cats.forEach(cat => {
    const items = S.items[cat]; if (!items.length) return; any = true;

    const section = mk('div');
    section.style.cssText = 'margin-bottom:20px;';

    if (S.filter === 'all') {
      const h = mk('p', 'closet-cat-label');
      h.textContent = I18N[currentLang][cat] || CATS[cat].label;
      section.appendChild(h);
    }

    const row = mk('div');
    row.style.cssText = 'display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;scrollbar-width:none;touch-action:pan-x;overscroll-behavior-x:contain;';

    items.forEach((item, i) => {
      const el = mk('div', 'closet-item');
      el.style.cssText = 'flex-shrink:0;width:100px;height:100px;scroll-snap-align:start;border-radius:var(--radius);overflow:visible;background:var(--surface);border:0.5px solid var(--border);position:relative;cursor:pointer;';
      const img = mk('img'); img.src = item.src; img.alt = CATS[cat].label;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;padding:6px;border-radius:var(--radius);';
      el.appendChild(img);

      const editBtn = mk('button');
      editBtn.style.cssText = 'position:absolute;top:0;right:0;width:40px;height:40px;background:none;border:none;cursor:pointer;z-index:5;display:flex;align-items:flex-start;justify-content:flex-end;padding:4px;';
      editBtn.innerHTML = '<span style="background:rgba(255,255,255,0.9);border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.15);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg></span>';
      editBtn.onclick = e => { e.stopPropagation(); editClosetItem(cat, i); };
      el.appendChild(editBtn);

      el.addEventListener('click', ev => { if (ev.target.closest('.item-menu-wrap')) return; switchTab('ootd'); S.idx[cat] = i; renderCat(cat); });
      row.appendChild(el);
    });

    section.appendChild(row);
    c.appendChild(section);
  });
  if (!any) { const p = mk('p', 'closet-empty'); p.textContent = t('noItems'); c.appendChild(p); }
}

function mk(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

loadState();
