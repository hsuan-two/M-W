# 我的衣櫥 — Wardrobe App

手機優先的虛擬衣櫥，支援自動去背，滑動搭配穿搭。

## 使用方式

1. 直接用瀏覽器打開 `index.html`
2. （建議）用 VS Code Live Server extension 開啟，體驗更流暢

```
# 如果有安裝 Node.js，也可以這樣跑：
npx serve .
```

## 設定 remove.bg API Key

1. 去 https://www.remove.bg/api 申請免費帳號
2. 複製 API key
3. 在 app 左下角點「API 設定」貼上 key
4. 之後上傳衣服照片會自動去背 ✨

> 免費額度：每月 50 張

## 功能

- 📸 上傳衣服、配飾、鞋子照片
- ✂️ 自動去背（需設定 API key）
- 👗 左右滑動搭配穿搭
- 🧥 外套獨立欄位在右側
- 🗂️ 衣櫥檢視模式
- 💾 資料存在瀏覽器 localStorage（關掉不會消失）
- 🌙 自動深色模式

## 檔案結構

```
index.html   — 頁面結構
style.css    — 樣式（手機優先）
app.js       — 邏輯（純 JS，不需要 build）
```

不需要安裝任何套件，開啟 index.html 就能用。
