'use strict';

const OOTD_TODAY = new Date().toISOString().slice(0,10).replace(/-/g,'.');
let ootdWeather = { temp: '--', icon: '🌤️' };

// Get location then fetch weather
const OWM_KEY = '1866de13e68761cea397d07b00004f4c';

function owmIcon(id) {
  if (id >= 200 && id < 300) return '🌩️';
  if (id >= 300 && id < 400) return '🌦️';
  if (id >= 500 && id < 600) return '🌧️';
  if (id >= 600 && id < 700) return '❄️';
  if (id >= 700 && id < 800) return '🌫️';
  if (id === 800) return '☀️';
  if (id === 801) return '🌤️';
  if (id <= 804) return '⛅';
  return '🌡️';
}

function fetchOWM(lat, lon) {
  fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OWM_KEY}`)
    .then(r => r.json())
    .then(d => {
      const temp = Math.round(d.main.temp);
      const icon = owmIcon(d.weather[0].id);
      ootdWeather = { temp, icon };
    }).catch(() => {});
}

function initWeather() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => fetchOWM(pos.coords.latitude, pos.coords.longitude),
      ()  => fetchOWM(23.0, 120.2) // fallback Tainan
    );
  } else {
    fetchOWM(23.0, 120.2);
  }
}
initWeather();

let ootdFileCallback = null;
const ootdFileInput = document.getElementById('ootd-file-input');
if (ootdFileInput) {
  ootdFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !ootdFileCallback) return;
    const reader = new FileReader();
    reader.onload = ev => { ootdFileCallback(ev.target.result); ootdFileCallback = null; };
    reader.readAsDataURL(file);
  });
}

function ootdPickFile(cb) {
  ootdFileCallback = cb;
  if (ootdFileInput) ootdFileInput.click();
}

function getWardrobeItem(cat) {
  // Use current in-memory state S (loaded from IndexedDB) for the currently selected outfit item
  try {
    if (typeof S !== 'undefined' && S.items && S.items[cat] && S.items[cat].length) {
      const idx = S.idx && typeof S.idx[cat] === 'number' ? S.idx[cat] : 0;
      if (idx === -1) return null; // "no jacket today" selected
      const item = S.items[cat][idx] || S.items[cat][0];
      return item.src || item;
    }
  } catch(e) {}
  return null;
}

function openOOTD() {
  const cv = document.getElementById('card-view');
  cv.style.display = 'flex';
  document.getElementById('card-step-pick').style.display = 'block';
  document.getElementById('card-step-edit').style.display = 'none';
}

function closeOOTD() {
  switchTab('ootd');
}

function ootdPickTemplate(n) {
  document.getElementById('card-step-pick').style.display = 'none';
  const editEl = document.getElementById('card-step-edit');
  editEl.style.display = 'flex';
  const titles = ['', 'Card 01 — Story', 'Card 02 — Grid', 'Card 03 — Split'];
  document.getElementById('ootd-edit-title').textContent = titles[n];
  ootdRenderCard(n);
}

function ootdBackToPick() {
  document.getElementById('card-step-edit').style.display = 'none';
  document.getElementById('card-step-pick').style.display = 'block';
}

// ── Upload cell ───────────────────────────────────────────
function ootdUploadCell(label, coverFit, existingSrc) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;position:absolute;inset:0;';

  function setImg(src) {
    wrap.innerHTML = '';
    const img = document.createElement('img');
    img.src = src;
    img.crossOrigin = 'anonymous';
    img.style.cssText = 'display:block;position:absolute;top:0;left:0;width:100%;height:100%;object-fit:' + (coverFit ? 'cover' : 'contain') + ';background:#fff;';
    wrap.appendChild(img);
    wrap.onclick = (e) => { e.stopPropagation(); ootdPickFile(setImg); };
  }

  function showEmpty() {
    wrap.innerHTML = '';
    const h = document.createElement('div');
    h.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#a8a7a4;text-align:center;font-family:'Cormorant Garamond',serif;padding:4px;pointer-events:none;";
    h.textContent = label;
    wrap.appendChild(h);
    wrap.onclick = (e) => { e.stopPropagation(); ootdPickFile(setImg); };
  }

  if (existingSrc) { setImg(existingSrc); } else { showEmpty(); }
  return wrap;
}

// ── Text block ────────────────────────────────────────────
function ootdTextBlock() {
  const temp = ootdWeather.temp;
  const icon = ootdWeather.icon;
  const lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';
  const tagDefault = lang === 'en' ? '#OOTD #MyStyle' : '#OOTD #今日穿搭';
  return `
    <div style="display:flex;flex-direction:column;gap:3px;padding:8px 14px 0;justify-content:flex-start;height:100%;">
      <div contenteditable="true" style="font-family:'Cormorant Garamond',serif;font-size:13px;color:#1a1917;letter-spacing:.04em;outline:none;">${OOTD_TODAY}</div>
      <div contenteditable="true" style="font-family:'Cormorant Garamond',serif;font-size:12px;color:#6b6a67;outline:none;">Weather: ${temp}°C ${icon}</div>
      <div contenteditable="true" style="font-family:'Cormorant Garamond',serif;font-size:11px;color:#a8a7a4;font-style:italic;outline:none;">${tagDefault}</div>
    </div>
  `;
}


// ── Category picker for card slots ───────────────────────
const OOTD_CATS = [
  {cat:'top', lbl:'上著'},
  {cat:'bottom', lbl:'下著'},
  {cat:'jacket', lbl:'外套'},
  {cat:'shoes', lbl:'鞋子'},
  {cat:'accessory', lbl:'配飾'},
];

// Track which non-accessory categories are already used on the current card,
// so the picker can exclude them (accessory itself has no such limit).
let ootdUsedCats = {};

function ootdResetUsedCats() { ootdUsedCats = {}; }

function ootdMarkCatUsed(cat, used) {
  if (cat === 'accessory') return; // accessory can be used multiple times
  if (used) ootdUsedCats[cat] = true;
  else delete ootdUsedCats[cat];
}

// Returns true if there's a real (non-empty) wardrobe item for this category
function ootdHasItem(cat) {
  return !!getWardrobeItem(cat);
}

// Smart default category for a slot: if jacket has no item, fall back to accessory.
// If accessory also has no item, just stay on jacket (will render blank with picker).
function ootdSmartDefaultCat(defaultCat, defaultLbl) {
  if (defaultCat === 'jacket' && !ootdHasItem('jacket')) {
    if (ootdHasItem('accessory')) return { cat: 'accessory', lbl: '配飾' };
  }
  return { cat: defaultCat, lbl: defaultLbl };
}

function ootdCatCell(defaultCat, defaultLbl, coverFit) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;background:#fff;cursor:pointer;display:block;';

  // Apply smart fallback (jacket → accessory) before first render
  const smart = ootdSmartDefaultCat(defaultCat, defaultLbl);
  let currentCat = smart.cat;
  let currentLbl = smart.lbl;
  ootdMarkCatUsed(currentCat, true);

  function renderCell(src) {
    wrap.innerHTML = '';

    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.crossOrigin = 'anonymous';
      img.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;background:#fff;box-sizing:border-box;';
      wrap.appendChild(img);
    } else {
      const lbl = document.createElement('div');
      lbl.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#a8a7a4;font-family:'Cormorant Garamond',serif;";
      lbl.textContent = currentLbl;
      wrap.appendChild(lbl);
    }

    // Change button (⇄)
    const chg = document.createElement('button');
    chg.textContent = '⇄';
    chg.style.cssText = 'position:absolute;top:3px;right:3px;background:rgba(255,255,255,.85);border:none;border-radius:4px;color:#555;font-size:10px;padding:2px 6px;cursor:pointer;z-index:5;';
    chg.onclick = e => { e.stopPropagation(); showCatPicker(); };
    wrap.appendChild(chg);

    // Tap image to upload custom photo
    if (src) {
      wrap.onclick = () => ootdPickFile(customSrc => renderCell(customSrc));
    } else {
      wrap.onclick = () => ootdPickFile(customSrc => renderCell(customSrc));
    }
  }

  function showCatPicker() {
    // Remove existing picker if any
    const existing = document.getElementById('ootd-cat-picker');
    if (existing) existing.remove();

    const picker = document.createElement('div');
    picker.id = 'ootd-cat-picker';
    picker.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.4);';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:#fff;border-radius:14px;overflow:hidden;width:220px;';

    const title = document.createElement('div');
    title.style.cssText = 'padding:12px 16px;font-size:13px;font-weight:500;color:#1a1917;border-bottom:0.5px solid rgba(0,0,0,.08);';
    title.textContent = '選擇分類';
    panel.appendChild(title);

    OOTD_CATS.forEach(({cat, lbl}) => {
      // Exclude categories already used elsewhere on this card (except accessory, and except the slot's own current category)
      const isUsedElsewhere = cat !== 'accessory' && cat !== currentCat && ootdUsedCats[cat];
      const btn = document.createElement('button');
      const isDisabled = isUsedElsewhere;
      btn.style.cssText = 'display:flex;align-items:center;width:100%;padding:13px 16px;border:none;background:' + (cat===currentCat?'#f5f4f2':'#fff') + ';font-size:14px;font-family:inherit;color:' + (isDisabled ? '#c4c2bd' : '#1a1917') + ';cursor:' + (isDisabled ? 'not-allowed' : 'pointer') + ';border-bottom:0.5px solid rgba(0,0,0,.06);';
      btn.textContent = lbl;
      if (isDisabled) {
        const used = document.createElement('span');
        used.textContent = ' (已使用)';
        used.style.cssText = 'margin-left:auto;color:#c4c2bd;font-size:11px;';
        btn.appendChild(used);
      } else if (cat === currentCat) {
        const check = document.createElement('span');
        check.textContent = ' ✓';
        check.style.cssText = 'margin-left:auto;color:#888;font-size:12px;';
        btn.appendChild(check);
      }
      if (!isDisabled) {
        btn.onclick = () => {
          ootdMarkCatUsed(currentCat, false); // free up old category
          currentCat = cat;
          currentLbl = lbl;
          ootdMarkCatUsed(currentCat, true); // claim new category
          picker.remove();
          renderCell(getWardrobeItem(cat));
        };
      }
      panel.appendChild(btn);
    });

    const cancel = document.createElement('button');
    cancel.style.cssText = 'display:block;width:100%;padding:13px 16px;border:none;background:#fff;font-size:14px;font-family:inherit;color:#888;cursor:pointer;';
    cancel.textContent = '取消';
    cancel.onclick = () => picker.remove();
    panel.appendChild(cancel);

    picker.appendChild(panel);
    picker.onclick = e => { if(e.target===picker) picker.remove(); };
    document.body.appendChild(picker);
  }

  renderCell(getWardrobeItem(currentCat));
  return wrap;
}


function ootdPhotoCell(label, coverFit) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;background:#fff;';

  function setImg(src) {
    wrap.innerHTML = '';
    const img = document.createElement('img');
    img.src = src;
    img.crossOrigin = 'anonymous';
    img.style.cssText = 'display:block;position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;';
    wrap.appendChild(img);
    // tap to replace
    wrap.onclick = e => { e.stopPropagation(); ootdPickFile(setImg); };
  }

  const h = document.createElement('div');
  h.style.cssText = "font-size:10px;color:#a8a7a4;text-align:center;font-family:'Cormorant Garamond',serif;padding:4px;pointer-events:none;";
  h.textContent = label;
  wrap.appendChild(h);
  wrap.onclick = e => { e.stopPropagation(); ootdPickFile(setImg); };
  return wrap;
}

// ── Render card using flexbox (not absolute) for reliable html2canvas ──
function ootdRenderCard(n) {
  ootdResetUsedCats();
  const card = document.getElementById('ootd-card');
  card.innerHTML = '';
  card.style.cssText = 'width:320px;height:400px;position:relative;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 2px 20px rgba(0,0,0,.12);flex-shrink:0;display:block;';

  if (n === 1) {
    // Use fixed pixel sizes based on card width (320px) at 4:5 = 400px tall
    const W = 320, H = 400;
    const topH = Math.round(H * 0.52);
    const txtH = 80;
    const gridH = H - topH - txtH;
    const cellH = Math.floor(gridH / 2);
    const cellW = Math.floor(W / 2);

    card.style.cssText = 'width:' + W + 'px;height:' + H + 'px;position:relative;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 2px 20px rgba(0,0,0,.12);display:block;flex-shrink:0;';

    // Top photo
    const top = document.createElement('div');
    top.style.cssText = 'position:absolute;top:0;left:0;width:' + W + 'px;height:' + topH + 'px;overflow:hidden;background:#f5f4f2;';
    top.appendChild(ootdUploadCell('上傳 OOTD 照片', true));
    card.appendChild(top);

    // 4 grid cells - fixed pixel positions
    const cells = [{cat:'top',lbl:'上著'},{cat:'bottom',lbl:'下著'},{cat:'shoes',lbl:'鞋子'},{cat:'jacket',lbl:'外套'}];
    cells.forEach(({cat,lbl}, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const cell = document.createElement('div');
      cell.style.cssText = 'position:absolute;left:' + (col*cellW) + 'px;top:' + (topH + row*cellH + (row>0?1:0)) + 'px;width:' + (col===1 ? W-cellW : cellW) + 'px;height:' + (cellH-1) + 'px;overflow:hidden;background:#fff;border:0.5px solid rgba(0,0,0,.05);position:absolute;';
      cell.appendChild(ootdCatCell(cat, lbl, false));
      card.appendChild(cell);
    });
    // vertical divider between grid cols
    const vline = document.createElement('div');
    vline.style.cssText = 'position:absolute;left:' + cellW + 'px;top:' + topH + 'px;width:1px;height:' + gridH + 'px;background:rgba(0,0,0,.05);';
    card.appendChild(vline);

    // Text area
    const txt = document.createElement('div');
    txt.style.cssText = 'position:absolute;left:0;bottom:0;width:' + W + 'px;height:' + txtH + 'px;background:#fff;border-top:0.5px solid rgba(0,0,0,.06);';
    txt.innerHTML = ootdTextBlock();
    card.appendChild(txt);
  }

  else if (n === 2) {
    const W = 320, H = 400, txtH = 80;
    const gridH = H - txtH;
    const cellW = Math.floor(W/2), cellH = Math.floor(gridH/2);
    card.style.background = '#f9f8f7';

    ['照片 1','照片 2','照片 3','照片 4'].forEach((lbl, i) => {
      const col = i % 2, row = Math.floor(i/2);
      const x = col === 0 ? 0 : cellW + 1;
      const y = row === 0 ? 0 : cellH + 1;
      const w = col === 0 ? cellW : W - cellW - 1;
      const h = row === 0 ? cellH : gridH - cellH - 1;
      const cell = document.createElement('div');
      cell.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;overflow:hidden;background:#fff;';
      cell.appendChild(ootdPhotoCell(lbl, true));
      card.appendChild(cell);
    });

    const txt = document.createElement('div');
    txt.style.cssText = 'position:absolute;left:0;bottom:0;width:' + W + 'px;height:' + txtH + 'px;background:#fff;border-top:0.5px solid rgba(0,0,0,.06);';
    txt.innerHTML = ootdTextBlock();
    card.appendChild(txt);
  }
  else if (n === 3) {
    const W = 320, H = 400;
    const leftW = Math.round(W * 0.44);
    const rightW = W - leftW;
    const cellH = Math.floor(H / 4);
    const leftSlots = [{cat:'top',lbl:'上著'},{cat:'bottom',lbl:'下著'},{cat:'jacket',lbl:'外套'},{cat:'shoes',lbl:'鞋子'}];

    leftSlots.forEach(({cat,lbl}, i) => {
      const cell = document.createElement('div');
      const t = i * cellH + (i > 0 ? 1 : 0);
      const h = i === 3 ? H - t : cellH - 1;
      cell.style.cssText = 'position:absolute;left:0;top:' + t + 'px;width:' + leftW + 'px;height:' + h + 'px;overflow:hidden;background:#fff;position:absolute;';
      cell.appendChild(ootdCatCell(cat, lbl, false));
      card.appendChild(cell);
    });

    // vertical divider
    const vline = document.createElement('div');
    vline.style.cssText = 'position:absolute;left:' + leftW + 'px;top:0;width:1px;height:' + H + 'px;background:rgba(0,0,0,.08);';
    card.appendChild(vline);

    const right = document.createElement('div');
    right.style.cssText = 'position:absolute;left:' + (leftW+1) + 'px;top:0;width:' + (rightW-1) + 'px;height:' + H + 'px;background:#f5f4f2;overflow:hidden;';
    right.appendChild(ootdUploadCell('上傳 OOTD 照片', true));
    card.appendChild(right);
  }
}

// ── Save as image using Canvas API ───────────────────────
async function ootdSave() {
  const card = document.getElementById('ootd-card');
  const W = 320, H = 400, SCALE = 3;
  const CW = W * SCALE, CH = H * SCALE;

  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // rounded rect clip
  const R = 16;
  ctx.beginPath();
  ctx.moveTo(R, 0);
  ctx.lineTo(W-R, 0);
  ctx.quadraticCurveTo(W, 0, W, R);
  ctx.lineTo(W, H-R);
  ctx.quadraticCurveTo(W, H, W-R, H);
  ctx.lineTo(R, H);
  ctx.quadraticCurveTo(0, H, 0, H-R);
  ctx.lineTo(0, R);
  ctx.quadraticCurveTo(0, 0, R, 0);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();

  const dpr = window.devicePixelRatio || 1;
  const cardRect = card.getBoundingClientRect();
  const scaleX = W / cardRect.width;
  const scaleY = H / cardRect.height;

  const loadImg = src => new Promise(res => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });

  // draw each img — respect each image's actual object-fit (cover vs contain)
  const imgs = card.querySelectorAll('img');
  const drawPromises = Array.from(imgs).map(async img => {
    const r = img.getBoundingClientRect();
    const x = (r.left - cardRect.left) * scaleX;
    const y = (r.top  - cardRect.top)  * scaleY;
    const iw = r.width  * scaleX;
    const ih = r.height * scaleY;
    if (iw <= 0 || ih <= 0) return;
    const loaded = await loadImg(img.src);
    if (!loaded) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, iw, ih);

    const computedFit = window.getComputedStyle(img).objectFit || 'contain';
    const ia = loaded.naturalWidth / loaded.naturalHeight;
    const ca = iw / ih;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, iw, ih);
    ctx.clip();

    let dw, dh, dx, dy;
    if (computedFit === 'cover') {
      // Fill the cell completely, cropping overflow (matches CSS object-fit: cover)
      if (ia > ca) { dh = ih; dw = ih * ia; dy = y; dx = x - (dw - iw) / 2; }
      else         { dw = iw; dh = iw / ia; dx = x; dy = y - (dh - ih) / 2; }
    } else {
      // Fit entirely inside the cell, letterboxed (matches CSS object-fit: contain)
      if (ia > ca) { dw = iw; dh = iw / ia; dx = x; dy = y + (ih - dh) / 2; }
      else         { dh = ih; dw = ih * ia; dy = y; dx = x + (iw - dw) / 2; }
    }
    ctx.drawImage(loaded, dx, dy, dw, dh);
    ctx.restore();
  });
  await Promise.all(drawPromises);

  // text bg
  const txtEl = card.querySelector('[style*="border-top"]');
  if (txtEl) {
    const r = txtEl.getBoundingClientRect();
    const ty = (r.top - cardRect.top) * scaleY;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, ty, W, H - ty);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();
  }

  // text lines — read actual computed font size from DOM and scale proportionally,
  // so text always matches what's visually shown on screen regardless of viewport width
  const textDivs = card.querySelectorAll('[contenteditable]');
  const textStyles = [
    { color: '#1a1917' },
    { color: '#6b6a67' },
    { color: '#a8a7a4', italic: true },
  ];
  textDivs.forEach((div, i) => {
    const r = div.getBoundingClientRect();
    const x = (r.left - cardRect.left) * scaleX;
    const y = (r.top  - cardRect.top)  * scaleY;
    const st = textStyles[i] || textStyles[0];
    const computedSize = parseFloat(window.getComputedStyle(div).fontSize) || 13;
    const scaledSize = computedSize * scaleY; // scale font size to match canvas coordinate system
    ctx.font = (st.italic ? 'italic ' : '') + scaledSize + "px 'Cormorant Garamond', Georgia, serif";
    ctx.fillStyle = st.color;
    ctx.textBaseline = 'top';
    ctx.fillText(div.textContent, x + 14 * scaleX, y + 6 * scaleY);
  });

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = 'OOTD-' + OOTD_TODAY + '.png';
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
