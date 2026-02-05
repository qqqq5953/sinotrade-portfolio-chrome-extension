# 測試方案（Portfolio vs VTI）

## 1) 測試目標

- **正確性**：解析買入/賣出表格 → 正規化事件 → 對齊 Yahoo 收盤價 → 算出 `portfolio[]` 與 `vti[]` 序列，與規格一致。
- **穩定性**：SSR/延遲載入/滾動載入不致漏資料；DOM 結構有小幅變動時可快速定位問題。
- **可重現性**：同一組 fixture（交易事件 + 價格表）每次跑出完全相同的序列。

> 本文件以「分層測試」為主：越底層越純函式、越上層越接近真實頁面。建議先把可測的純函式（解析、排序、計算）抽到 `src/shared.ts` 或獨立 module，再用 Playwright 做端到端驗證。

---

## 2) 測試分層與覆蓋範圍

### A. 單元測試（Unit, 純函式，最快、最重要）

**A1. 字串/數字/日期解析**

- `parseNumber("1,572.66") -> 1572.66`
- `parseNumber("0.10730") -> 0.1073`
- `parseNumber("") / "--"`：應明確定義為丟錯或回傳 `null`（建議丟錯並附欄位資訊）
- `parseTradeDate("2024/<br>12/30") -> { tradeDate:"2024/12/30", isoDate:"2024-12-30" }`

**A2. DOM row 解析（建議用 JSDOM 或直接用 DOMParser）**

- `parseBuyRow(tr)`：輸出 `TradeEvent{type:"BUY", isoDate, ticker, shares, cash}`  
  覆蓋：
  - web 欄位存在時優先採用
  - mobile 欄位 `<br>` 合併時仍能解析
- `parseSellRow(tr)`：同上，cash = 交割金額

**A3. 事件合併/排序/同日規則**

給定一組 `buyEvents[] + sellEvents[]`：
- 合併後 `events[]` 依日期升冪
- 同日多事件的順序固定（依規格第 10 節決策）
- `tradeDates = unique(events.isoDate)` 升冪且不重複

**A4. 價格對齊與缺價回退**

- `getClose(priceSeries, isoDate)`：
  - 命中時回傳 close
  - 缺失時依回退規則（例如「最近前一個有價日」）取得
  - 若回退不到：丟出可辨識錯誤（包含 ticker + isoDate）

**A5. 核心計算（市值在交易日點更新）**

用 fixture：
- `events[]`（包含多 ticker）
- 各 ticker 的 `PriceSeries`（可只提供交易日與必要的回退日）

驗證：
- `portfolioHoldings` 在每個 tradeDate 更新後的 shares 正確
- `portfolioValue = Σ shares * close` 正確
- `vtiShares` 更新規則正確：
  - BUY：`+ cash / vtiClose`
  - SELL：`- cash / vtiClose`
- `vtiValue = vtiShares * vtiClose` 正確
- 小數誤差：建議用 `toBeCloseTo` 或定義 epsilon（例如 `1e-6`）

---

### B. 整合測試（Integration, 含 fetch/快取，但不跑真網站）

**B1. Yahoo Finance 回應解析**

用一份最小化的 Yahoo chart JSON fixture（只需 `timestamp[]` 與 `close[]/adjclose[]`）：
- 能建立 `PriceSeries(Map<isoDate, close>)`
- close 為 null 時的回退（若採用）

**B2. 價格快取**

在測試中 mock `fetch`，連續呼叫「同一 symbol 同一年」兩次：
- 只打一次 fetch（第二次命中 cache）
- 失敗後是否重試（若有做重試）行為一致

---

### C. Playwright E2E（End-to-End, 最高信心；以靜態頁面模擬，不依賴真帳號）

> 目標：在不登入永豐、不依賴真資料的前提下，驗證「內容腳本能從 DOM 擷取 → 計算 → 插入 chart」的整條管線。

**C1. 靜態 HTML fixture 頁**

準備一份 HTML（建議放 `tests/fixtures/transaction_page.html`）包含：
- `#TagSelectArea`（含「買入/賣出」tab 結構）
- `#BuyInfo_QueryDateRange`、`#SellInfo_QueryDateRange` input
- `.query-result-area` 下的 buy/sell table（thead/tbody 參考 `RAW_SPEC.md`）
- 可模擬「年度篩選後更新表格」：
  - 最簡做法：測試直接把整年資料放在 DOM，不需要真的觸發 Enter
  - 進階做法：在 fixture 頁面內附一段 script，監聽 Enter 後替換 table 內容

**C2. 注入 content script**

兩種策略擇一（建議先用 1）：

1) **直接在測試內 import 並執行核心函式**（最穩）
   - 把「解析/計算/渲染」封裝成 `run()` 並 export（例如 `src/content.ts` export main 或把核心抽到 `src/shared.ts`）
   - Playwright 用 `page.addScriptTag` 或 `page.evaluate` 呼叫 `run()`

2) **載入打包後的 `dist/content.js`**（更接近真實擴充）
   - Playwright 在 `page.addScriptTag({ path: "dist/content.js" })` 注入
   - 需注意 content script 可能依賴 extension API（若有用到，需 mock）

**C3. 攔截 Yahoo API**

- `page.route("https://query1.finance.yahoo.com/**", route => route.fulfill({ json: fixture }))`
- 讓 E2E 不受外網與限流影響

**C4. 斷言（E2E 驗收）**

- `#chart` 被插入到 `#TagSelectArea` 且為第 2 個子元素（index=1）
- 圖表 option 正確：
  - 方法 A：mock `window.echarts.init`，攔截 `setOption(option)` 參數
  - 方法 B：讓程式把最後的 `option` 暫存到 `window.__LAST_OPTION__` 供測試讀取
- 斷言 `xAxis.data`、`series[portfolio].data`、`series[vti].data` 長度一致
- 抽 3–5 個日期點比對數值（可用 `toBeCloseTo`）

---

## 3) Fixture 設計（讓測試可重跑）

### 3.1 建議的 fixture 類型

- **events fixture（正規化後）**：`tests/fixtures/events.sample.json`
  - 直接放 `TradeEvent[]`（type/isoDate/ticker/shares/cash）
- **price fixtures**：
  - `tests/fixtures/yahoo_VTI_2024.json`（原始 Yahoo JSON）
  - 或 `tests/fixtures/prices.VTI.2024.json`（已整理成 `{ isoDate: close }`）
- **HTML fixture**：`tests/fixtures/transaction_page.html`

### 3.2 需要至少 3 組 fixture（覆蓋邊界）

1. **同日多筆**：同一天同 ticker 多筆 BUY + SELL（驗證同日排序規則）
2. **小數股 + 千分位**：shares 有小數、cash 有千分位
3. **跨年度**：12/31 + 01/02（或下一個交易日）串接，且 Yahoo 價格跨年仍可對齊

（可加值）4. **缺價回退**：某 ticker 在 tradeDate 缺 close（或為 null），必須走回退規則

---

## 4) 建議的工具選型（不強制）

目前專案 `package.json` 尚未包含測試框架，建議二選一：

- **Vitest（推薦，TS 友善）**：單元/整合測試主力
  - `npm i -D vitest jsdom @types/node`
  - 優點：TS/ESM 支援佳、速度快
- **Playwright Test**：E2E 主力
  - `npm i -D @playwright/test && npx playwright install`

> 若你希望「零額外框架」，也可用 Node 內建 `node:test`，但 TypeScript 需要額外 transpile 設定，維護成本通常更高。

---

## 5) 邊界案例清單（回歸用）

- 年度內 **無任何交易**（table 空、或只有 thead）
- DOM 結構變動：少一欄、欄位順序改變（建議用 thead 文字做欄位映射）
- 金額/股數含括號或負號（例如損益欄位）誤被解析到 cash/shares
- 賣出 shares > 現有持倉（應報錯或拒絕）
- Yahoo API：429、5xx、回傳 timestamps 與 close 長度不一致
- close = null / 缺某天資料（回退策略）

