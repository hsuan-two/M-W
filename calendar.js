'use strict';

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();

function openCalendar() {
  document.getElementById('calendar-view').style.display = 'block';
  renderCalendar();
}

async function renderCalendar() {
  const content = document.getElementById('calendar-content');
  const records = await getCalendarRecords();
  const lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';

  const monthNames = lang === 'en'
    ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    : ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const dayNames = lang === 'en'
    ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    : ['日','一','二','三','四','五','六'];

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();

  content.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
  header.innerHTML = `
    <button onclick="calPrev()" style="background:none;border:0.5px solid var(--border-strong);border-radius:8px;padding:6px 14px;cursor:pointer;font-size:18px;color:var(--text-primary);">‹</button>
    <span style="font-size:16px;font-weight:500;color:var(--text-primary);">${calYear} ${monthNames[calMonth]}</span>
    <button onclick="calNext()" style="background:none;border:0.5px solid var(--border-strong);border-radius:8px;padding:6px 14px;cursor:pointer;font-size:18px;color:var(--text-primary);">›</button>
  `;
  content.appendChild(header);

  // Day labels
  const dayRow = document.createElement('div');
  dayRow.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px;';
  dayNames.forEach(d => {
    const cell = document.createElement('div');
    cell.style.cssText = 'text-align:center;font-size:11px;color:var(--text-muted);padding:4px 0;';
    cell.textContent = d;
    dayRow.appendChild(cell);
  });
  content.appendChild(dayRow);

  // Grid
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:3px;';

  for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${calYear}.${String(calMonth+1).padStart(2,'0')}.${String(d).padStart(2,'0')}`;
    const rec = records[dateKey];
    const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

    const cell = document.createElement('div');
    cell.style.cssText = 'aspect-ratio:1;border-radius:8px;cursor:pointer;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--surface);';

    if (rec && rec.items && rec.items[0]) {
      // removed: outfit thumbnail background. Only show dot indicator below.
    }

    if (isToday) {
      cell.style.outline = '2px solid var(--text-primary)';
      cell.style.outlineOffset = '-2px';
    }

    const num = document.createElement('span');
    num.style.cssText = 'font-size:12px;font-weight:' + (isToday?'600':'400') + ';color:var(--text-primary);position:relative;z-index:1;';
    num.textContent = d;
    cell.appendChild(num);

    if (rec) {
      const dot = document.createElement('div');
      dot.style.cssText = 'position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:var(--text-primary);z-index:1;';
      cell.appendChild(dot);
    }

    cell.onclick = () => openDayEditor(dateKey, rec);
    grid.appendChild(cell);
  }
  content.appendChild(grid);
}

function calPrev() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); }
function calNext() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); }

async function getCalendarRecords() {
  try { return await dbLoadAllCalendar(); }
  catch(e) { return {}; }
}

// ── Day editor ────────────────────────────────────────────
function openDayEditor(dateKey, existingRec) {
  const lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';
  const existing = document.getElementById('day-editor-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'day-editor-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:flex-end;';

  const panel = document.createElement('div');
  panel.style.cssText = 'background:var(--surface);border-radius:20px 20px 0 0;width:100%;max-height:80vh;display:flex;flex-direction:column;';

  // Handle
  const handle = document.createElement('div');
  handle.style.cssText = 'width:36px;height:4px;border-radius:2px;background:var(--border-strong);margin:12px auto 0;flex-shrink:0;';

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 16px;flex-shrink:0;border-bottom:0.5px solid var(--border);';
  hdr.innerHTML = `<span style="font-size:15px;font-weight:500;">${dateKey}</span><button onclick="document.getElementById('day-editor-overlay').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-secondary);">✕</button>`;

  // Outfit grid - shows current items or lets user pick
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:16px;';

  // Current outfit from S state
  const cats = ['top','bottom','jacket','shoes'];
  const catLabels = {
    zh: {top:'上著',bottom:'下著',jacket:'外套',shoes:'鞋子',accessory:'配飾'},
    en: {top:'Top',bottom:'Bottom',jacket:'Jacket',shoes:'Shoes',accessory:'Accessory'},
  }[lang];

  // Items to display: existing record or current outfit
  let displayItems = [];
  if (existingRec && existingRec.items && existingRec.items.length) {
    displayItems = existingRec.items;
  } else {
    cats.forEach(cat => {
      const arr = S.items[cat];
      const idx = S.idx[cat];
      if (arr && arr[idx]) displayItems.push({ cat, src: arr[idx].src || arr[idx] });
    });
    const activeAccIndices = (typeof getActiveAccessoryIndices === 'function') ? getActiveAccessoryIndices() : (S.accPicked || []);
    activeAccIndices.forEach(i => {
      if (S.items.accessory[i]) displayItems.push({ cat:'accessory', src: S.items.accessory[i].src || S.items.accessory[i] });
    });
  }

  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'font-size:13px;color:var(--text-muted);margin-bottom:12px;';
  subtitle.textContent = lang === 'en' ? 'Outfit for this day' : '這天的穿搭';
  body.appendChild(subtitle);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;';

  displayItems.forEach((item, i) => {
    const cell = document.createElement('div');
    cell.style.cssText = 'aspect-ratio:1;border-radius:10px;overflow:hidden;background:var(--surface2);position:relative;';
    const img = document.createElement('img');
    img.src = item.src;
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;padding:4px;';
    cell.appendChild(img);
    const lbl = document.createElement('div');
    lbl.style.cssText = 'position:absolute;bottom:0;left:0;right:0;text-align:center;font-size:9px;color:var(--text-muted);padding:2px;background:rgba(255,255,255,.7);';
    lbl.textContent = catLabels[item.cat] || item.cat;
    cell.appendChild(lbl);
    grid.appendChild(cell);
  });

  // Empty placeholder if no items
  if (!displayItems.length) {
    const empty = document.createElement('p');
    empty.style.cssText = 'font-size:13px;color:var(--text-muted);text-align:center;padding:20px 0;';
    empty.textContent = lang === 'en' ? 'No outfit selected. Go to OOTD tab to set up an outfit first.' : '請先到今日穿搭頁面選好搭配再記錄。';
    body.appendChild(empty);
  } else {
    body.appendChild(grid);
  }

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;';

  if (existingRec) {
    const delBtn = document.createElement('button');
    delBtn.style.cssText = 'flex:1;padding:12px;border-radius:var(--radius);border:0.5px solid #d64242;background:none;color:#d64242;font-size:14px;font-family:inherit;cursor:pointer;';
    delBtn.textContent = lang === 'en' ? 'Delete' : '刪除紀錄';
    delBtn.onclick = () => {
        dbDeleteCalendarRecord(dateKey)
        .then(() => { overlay.remove(); renderCalendar(); })
        .catch(e => alert('刪除失敗：' + e.message));
    };
    btnRow.appendChild(delBtn);
  }

  const saveBtn = document.createElement('button');
  saveBtn.style.cssText = 'flex:1;padding:12px;border-radius:var(--radius);border:none;background:#111;color:#fff;font-size:14px;font-family:inherit;cursor:pointer;opacity:' + (displayItems.length ? '1' : '0.4') + ';';
  saveBtn.textContent = lang === 'en' ? 'Save Outfit' : '儲存穿搭';
  saveBtn.disabled = !displayItems.length;
  saveBtn.onclick = () => {
    if (!displayItems.length) {
      alert(lang === 'en' ? 'Please set up an outfit in OOTD tab first.' : '請先到今日穿搭選好搭配！');
      return;
    }
    dbSaveCalendarRecord(dateKey, { items: displayItems, date: dateKey })
      .then(() => { overlay.remove(); renderCalendar(); })
      .catch(e => alert('儲存失敗：' + e.message));
  };
  btnRow.appendChild(saveBtn);

  body.appendChild(btnRow);
  panel.appendChild(handle);
  panel.appendChild(hdr);
  panel.appendChild(body);
  overlay.appendChild(panel);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}
