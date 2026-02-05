## 豐存股交易紀錄折線圖（Chrome Extension）

這個專案會在永豐「豐存股」的交易紀錄頁面上：

- 依年度（2020 → 今年）自動輸入日期區間到 `#BuyInfo_QueryDateRange` / `#SellInfo_QueryDateRange`，逐年抓取買入/賣出 table 資料
- 擷取欄位：成交日、股票名稱（代號）、成交股、投入成本（買入）/交割金額（賣出）
- 以 Yahoo Finance 日線收盤價（預設用 `adjclose`）在「交易日點」估值，計算 `portfolio` 與 `vti` 兩條序列
- 將圖表插入到 `#TagSelectArea` 的第 2 個子元素（`#chart`）

同時也提供一個純 HTML/CSS/JS（由 TypeScript 打包）的小型 demo 頁面用來驗證解析與計算邏輯。

### 安裝/建置

```bash
npm i
npm run build
```

建置後輸出到 `dist/`：

- `dist/manifest.json`、`dist/content.js`、`dist/sw.js`：Chrome extension
- `dist/demo.html`、`dist/demo.css`、`dist/demo.js`：純前端 demo

### 測試（無測試框架）

```bash
npm test
```

### 載入到 Chrome

1. Chrome → `chrome://extensions`
2. 開啟「開發人員模式」
3. 「載入未封裝項目」→ 選擇本專案的 `dist/` 資料夾

### 使用方式

進入豐存股的交易紀錄頁面後，頁面右下會出現「產生折線圖」按鈕，點擊後會開始逐年抓取並繪圖。

### 注意

- `manifest.json` 目前已收斂到交易頁 `https://aiinvest.sinotrade.com.tw/Account/Transaction*`，並額外允許 `https://query1.finance.yahoo.com/*`（抓 VTI 歷史收盤價）。
