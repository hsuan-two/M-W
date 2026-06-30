'use strict';

// ── Settings ──────────────────────────────────────────────

function openSettings() {
  const view = document.getElementById('settings-view');
  view.style.display = 'block';
  renderSettings();
}

function renderSettings() {
  const content = document.getElementById('settings-content');
  const lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';
  const L = {
    zh: { profile: '個人資料', name: '名稱', language: '語言', about: '關於',
          version: '版本', tapToChange: '點擊更換頭像', editName: '輸入名稱',
          storage: '儲存空間', storageUsed: '已使用', reminder: '每日穿搭提醒',
          reminderTime: '提醒時間', data: '資料管理', export: '匯出資料',
          exportDesc: '下載 JSON 備份', clear: '清除所有資料',
          clearDesc: '刪除所有衣物紀錄', clearConfirm: '確定要清除所有資料嗎？此動作無法復原！',
          cleared: '已清除所有資料', exported: '資料已匯出' },
    en: { profile: 'Profile', name: 'Name', language: 'Language', about: 'About',
          version: 'Version', tapToChange: 'Tap to change', editName: 'Enter name',
          storage: 'Storage', storageUsed: 'Used', reminder: 'Daily Outfit Reminder',
          reminderTime: 'Reminder Time', data: 'Data', export: 'Export Data',
          exportDesc: 'Download JSON backup', clear: 'Clear All Data',
          clearDesc: 'Delete all wardrobe items', clearConfirm: 'Clear all data? This cannot be undone!',
          cleared: 'All data cleared', exported: 'Data exported' },
  }[lang];

  const savedName   = localStorage.getItem('user-name') || '';
  const savedAvatar = localStorage.getItem('user-avatar') || '';
  const reminderTime = localStorage.getItem('reminder-time') || '';
  const reminderOn = localStorage.getItem('reminder-on') === 'true';

  // Storage shown as placeholder, updated async below
  const usedMB = '...';
  const maxMB = '...';
  const pct = 0;
  const barColor = '#111';

  content.innerHTML = `
    <div style="background:#fff;padding:32px 16px 24px;display:flex;flex-direction:column;align-items:center;gap:12px;border-bottom:0.5px solid rgba(0,0,0,.08);">
      <div id="avatar-wrap" style="width:80px;height:80px;border-radius:50%;background:#f5f4f2;overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center;border:0.5px solid rgba(0,0,0,.08);" onclick="changeAvatar()">
        ${savedAvatar
          ? `<img src="${savedAvatar}" style="width:100%;height:100%;object-fit:cover;">`
          : `<i class="ti ti-user" style="font-size:36px;color:#a8a7a4;"></i>`}
      </div>
      <div style="font-size:11px;color:#a8a7a4;">${L.tapToChange}</div>
      <input id="user-name-input" type="text" value="${savedName}" placeholder="${L.editName}"
        style="border:none;border-bottom:1px solid rgba(0,0,0,.12);background:transparent;font-size:16px;text-align:center;outline:none;color:#1a1917;font-family:inherit;padding:4px 8px;width:200px;"
        onchange="saveName(this.value)">
    </div>

    <div style="padding:0 16px 24px;">

      <div class="settings-section-label">${L.language}</div>
      <div class="settings-row" style="border-bottom:none;">
        <span class="settings-label"><i class="ti ti-language" style="font-size:18px;"></i> ${L.language}</span>
        <div class="lang-switcher">
          <button class="lang-btn ${lang==='zh'?'active':''}" onclick="setLang('zh')">中文</button>
          <button class="lang-btn ${lang==='en'?'active':''}" onclick="setLang('en')">English</button>
        </div>
      </div>

      <div class="settings-section-label">${L.storage}</div>
      <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:8px;border-bottom:none;">
        <div style="display:flex;justify-content:space-between;width:100%;">
          <span style="font-size:14px;color:#6b6a67;">${L.storageUsed}</span>
          <span id="storage-used-text" style="font-size:14px;color:#1a1917;">計算中...</span>
        </div>
        <div style="width:100%;height:6px;background:#f0efed;border-radius:3px;overflow:hidden;">
          <div id="storage-bar" style="width:0%;height:100%;background:#111;border-radius:3px;transition:width .3s;"></div>
        </div>
        <div id="storage-pct-text" style="font-size:11px;color:#a8a7a4;">計算中...</div>
      </div>

      <div class="settings-section-label">${L.reminder}</div>
      <div class="settings-row">
        <span class="settings-label"><i class="ti ti-bell" style="font-size:18px;"></i> ${L.reminder}</span>
<button class="toggle-btn ${reminderOn?'on':''}" id="reminder-toggle" onclick="toggleReminder()"><span class="toggle-knob"></span></button>
      </div>
      <div class="settings-row" style="border-bottom:none;" id="reminder-time-row" ${reminderOn?'':'style="display:none;border-bottom:none;"'}>
        <span class="settings-label">${L.reminderTime}</span>
        <input type="time" value="${reminderTime || '08:00'}" id="reminder-time-input"
          style="border:0.5px solid rgba(0,0,0,.12);border-radius:8px;padding:6px 10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"
          onchange="saveReminderTime(this.value)">
      </div>

      <div class="settings-section-label">${L.data}</div>
      <div class="settings-row" style="cursor:pointer;" onclick="exportData()">
        <span class="settings-label"><i class="ti ti-download" style="font-size:18px;"></i> ${L.export}</span>
        <span style="font-size:12px;color:#a8a7a4;">${L.exportDesc}</span>
      </div>
      <div class="settings-row" style="border-bottom:none;cursor:pointer;" onclick="clearAllData()">
        <span class="settings-label" style="color:#d64242;"><i class="ti ti-trash" style="font-size:18px;"></i> ${L.clear}</span>
        <span style="font-size:12px;color:#a8a7a4;">${L.clearDesc}</span>
      </div>

      <div class="settings-section-label">API Keys</div>
      <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;">
        <span class="settings-label" style="font-size:13px;">remove.bg API Key</span>
        <input type="text" id="removebg-key-input" value="${localStorage.getItem('removebg-api-key') || ''}" placeholder="貼上 API key"
          style="width:100%;padding:8px 12px;border-radius:8px;border:0.5px solid rgba(0,0,0,.12);font-size:13px;font-family:inherit;outline:none;background:#fff;color:#1a1917;"
          onchange="localStorage.setItem('removebg-api-key', this.value)">
        <a href="https://www.remove.bg/api" target="_blank" style="font-size:11px;color:#888;">免費申請 →</a>
      </div>
      <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;border-bottom:none;">
        <span class="settings-label" style="font-size:13px;">Gemini API Key</span>
        <input type="text" id="gemini-key-input" value="${localStorage.getItem('gemini-api-key') || ''}" placeholder="貼上 API key"
          style="width:100%;padding:8px 12px;border-radius:8px;border:0.5px solid rgba(0,0,0,.12);font-size:13px;font-family:inherit;outline:none;background:#fff;color:#1a1917;"
          onchange="localStorage.setItem('gemini-api-key', this.value)">
        <a href="https://aistudio.google.com" target="_blank" style="font-size:11px;color:#888;">免費申請 →</a>
      </div>

      <div class="settings-section-label">${L.about}</div>
      <div class="settings-row" style="border-bottom:none;">
        <span class="settings-label" style="color:#6b6a67;">${L.version}</span>
        <span style="font-size:14px;color:#a8a7a4;">1.0.0</span>
      </div>
    </div>
  `;

  // Update storage display using navigator.storage.estimate()
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(est => {
      const used = (est.usage / 1024 / 1024).toFixed(1);
      const quota = (est.quota / 1024 / 1024).toFixed(0);
      const p = Math.min(100, Math.round(est.usage / est.quota * 100));
      const color = p > 80 ? '#d64242' : p > 60 ? '#f0a500' : '#111';
      const usedEl = document.getElementById('storage-used-text');
      const barEl = document.getElementById('storage-bar');
      const pctEl = document.getElementById('storage-pct-text');
      if (usedEl) usedEl.textContent = used + ' / ' + quota + ' MB';
      if (barEl) { barEl.style.width = p + '%'; barEl.style.background = color; }
      if (pctEl) pctEl.textContent = p + '% used';
    });
  }

  // Rebuild toggle button properly (innerHTML doesn't render child spans correctly sometimes)
  const toggleBtn = document.getElementById('reminder-toggle');
  if (toggleBtn && !toggleBtn.querySelector('.toggle-knob')) {
    const knob = document.createElement('span');
    knob.className = 'toggle-knob';
    toggleBtn.appendChild(knob);
  }

  // Avatar file input
  if (!document.getElementById('avatar-file-input')) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.id = 'avatar-file-input'; inp.accept = 'image/*';
    inp.style.display = 'none';
    inp.addEventListener('change', e => {
      const file = e.target.files[0]; e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        localStorage.setItem('user-avatar', ev.target.result);
        renderSettings();
      };
      reader.readAsDataURL(file);
    });
    document.body.appendChild(inp);
  }
}

function changeAvatar() {
  document.getElementById('avatar-file-input').click();
}

function saveName(val) {
  localStorage.setItem('user-name', val);
}

// ── Reminder ──────────────────────────────────────────────
function toggleReminder() {
  const on = localStorage.getItem('reminder-on') === 'true';
  const newOn = !on;
  localStorage.setItem('reminder-on', newOn);
  if (newOn && 'Notification' in window) {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') scheduleReminder();
    });
  }
  const row = document.getElementById('reminder-time-row');
  const btn = document.getElementById('reminder-toggle');
  if (row) row.style.display = newOn ? 'flex' : 'none';
  if (btn) btn.classList.toggle('on', newOn);
}

function saveReminderTime(time) {
  localStorage.setItem('reminder-time', time);
  if (localStorage.getItem('reminder-on') === 'true') scheduleReminder();
}

function scheduleReminder() {
  // Use service worker or simply set a daily check via setTimeout
  // Basic implementation: show notification if permission granted
  if ('Notification' in window && Notification.permission === 'granted') {
    const time = localStorage.getItem('reminder-time') || '08:00';
    const [h, m] = time.split(':').map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const ms = next - now;
    setTimeout(() => {
      new Notification('MW Wardrobe', {
        body: typeof currentLang !== 'undefined' && currentLang === 'en'
          ? "Don't forget to record today's outfit! 👗"
          : '記得記錄今天的穿搭！👗',
        icon: 'icon-180.png',
      });
      scheduleReminder(); // schedule next day
    }, ms);
  }
}

// ── Export data ───────────────────────────────────────────
async function exportData() {
  try {
    const data = await dbExportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MW-wardrobe-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch(e) {
    alert('匯出失敗：' + e.message);
  }
}

// ── Clear data ────────────────────────────────────────────
function clearAllData() {
  const lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';
  const msg = lang === 'en' ? 'Clear all data? This cannot be undone!' : '確定要清除所有資料嗎？此動作無法復原！';
  if (!confirm(msg)) return;
  dbClearAll().then(() => {
    localStorage.removeItem('user-tags');
    localStorage.removeItem('user-brands');
    alert(lang === 'en' ? 'All data cleared.' : '已清除所有資料。');
    renderSettings();
    if (typeof S !== 'undefined') {
      S.items = { accessory:[], jacket:[], top:[], bottom:[], shoes:[] };
      S.idx   = { accessory:0, jacket:0, top:0, bottom:0, shoes:0 };
      S.accPicked = [];
      if (typeof renderAll === 'function') renderAll();
    }
  }).catch(e => alert('清除失敗：' + e.message));
}

// Init reminder on load
if (localStorage.getItem('reminder-on') === 'true') {
  scheduleReminder();
}
