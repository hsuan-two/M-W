'use strict';

// ── IndexedDB wrapper ─────────────────────────────────────
const DB_NAME = 'mw-wardrobe';
const DB_VERSION = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('wardrobe')) {
        d.createObjectStore('wardrobe', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('calendar')) {
        d.createObjectStore('calendar', { keyPath: 'date' });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = e => reject(e.target.error);
  });
}

// ── Wardrobe store ────────────────────────────────────────
async function dbSaveWardrobe(data) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('wardrobe', 'readwrite');
    const store = tx.objectStore('wardrobe');
    // data = { items: { accessory:[], top:[], ... } }
    store.put({ id: 'main', ...data });
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
  });
}

async function dbLoadWardrobe() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('wardrobe', 'readonly');
    const req = tx.objectStore('wardrobe').get('main');
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror = e => reject(e.target.error);
  });
}

// ── Calendar store ────────────────────────────────────────
async function dbSaveCalendarRecord(dateKey, record) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('calendar', 'readwrite');
    tx.objectStore('calendar').put({ date: dateKey, ...record });
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
  });
}

async function dbDeleteCalendarRecord(dateKey) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('calendar', 'readwrite');
    tx.objectStore('calendar').delete(dateKey);
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
  });
}

async function dbLoadAllCalendar() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('calendar', 'readonly');
    const req = tx.objectStore('calendar').getAll();
    req.onsuccess = e => {
      const result = {};
      (e.target.result || []).forEach(r => { result[r.date] = r; });
      resolve(result);
    };
    req.onerror = e => reject(e.target.error);
  });
}

async function dbClearAll() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(['wardrobe','calendar'], 'readwrite');
    tx.objectStore('wardrobe').clear();
    tx.objectStore('calendar').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
  });
}

async function dbExportAll() {
  const wardrobe = await dbLoadWardrobe();
  const d = await openDB();
  const calendar = await new Promise((resolve, reject) => {
    const tx = d.transaction('calendar', 'readonly');
    const req = tx.objectStore('calendar').getAll();
    req.onsuccess = e => resolve(e.target.result || []);
    req.onerror = e => reject(e.target.error);
  });
  return { wardrobe, calendar, exportDate: new Date().toISOString() };
}
