# 豐存股 Chrome Extension — AI 友善規格（Portfolio vs VTI）

## 1) 目標與範圍

- **目標**：在永豐「豐存股」目標頁面中插入一張折線圖（Apache ECharts），同時顯示：
  - `portfolio`：投資組合在「每個交易日（有交易事件的日子）」的**收盤市值**
  - `vti`：以平行時空規則模擬 VTI，在相同交易日的**收盤市值**
- **範圍內**：
  - 從頁面 UI 依年度篩選抓取買入/賣出歷史交易表格
  - 透過 Yahoo Finance 取得股價日 K（`interval=1d`）收盤價
  - 合併事件、計算兩條序列、渲染圖表並插入到指定 DOM
- **範圍外（本版不做）**：
  - 股利/配息/拆股/合併等公司行動的精準處理（僅能透過 `adjclose` 做部分涵蓋，見「歧義/決策」）
  - 自動登入、繞過驗證碼、突破站點防爬蟲
  - 任意日期補齊的每日曲線（本版只在交易日點更新）

---

## 2) 名詞與資料字典

- **tradeDate**：交易事件發生日期（以美股交易日為主；格式與時區需明確，見第 10 節）。
- **TradeEvent**：從頁面表格解析出的單筆買入或賣出事件。
- **portfolioValue(tradeDate)**：在 `tradeDate` 當日收盤後，持倉依收盤價估值的總市值。
- **VTI parallel trading**（平行時空 VTI 規則，已確認）：
  - 買入事件：用同日「投入成本」等值金額，在當日收盤價買入 VTI（允許小數股）。
  - 賣出事件：用同日「交割金額」等值金額，在當日收盤價賣出 VTI（允許小數股，不管實際賣出原股幾股）。

### 2.1 BUY-only 增量投入比較模式（本版實作）

由於站方交易查詢存在 `minDate/maxSpan` 等限制，可能無法取得更早年度的買入，但仍可取得近年賣出，導致「期初持倉未知」而無法做完整的 BUY+SELL 持倉回放。

因此本版提供並預設採用 **BUY-only** 模式來比較「從系統允許的最小日期起新增投入的績效」：

- **只使用 BUY 事件**：所有 SELL 事件 **不納入比較與計算**（Portfolio 與 VTI 對照皆同樣忽略）
- **可解讀的 insight**：比較「每筆新增投入的現金」若依原策略買入（Portfolio） vs 全部改買 VTI（對照組），持有至今的差異
- **限制**：此模式不等於真實帳戶總市值/含賣出再投入的績效；SELL 時點與提領不會反映在曲線中

---

## 3) 目標頁面與 DOM 擷取規則

### 3.1 年度篩選策略

- **年度範圍**：
  - 由頁面 daterangepicker 的 `minDate` 決定最早可查日期（例如 `2021/01/01`）
  - Extension 會讀取 `minDate` 並以其年份作為抓取起點（`startYear = minDate.year`），逐年查詢到今年
- **每個年度的日期輸入**：
  - 起始：`YYYY/01/01`
  - 結束：
    - 若 `YYYY < currentYear`：`YYYY/12/31`
    - 若 `YYYY == currentYear`：**今天**（避免抓未來日期）
- **輸入格式（重要）**：`YYYY/MM/DD ~ YYYY/MM/DD`（注意 `separator = " ~ "`，含空白；來源為頁面 daterangepicker locale 設定）
- **輸入後觸發（重要）**：
  - 僅送出 Enter **不一定**會 refetch（實測需 focus 在 input 內且頁面實作依賴 submit）
  - 頁面在 daterangepicker callback 會呼叫 `SubmitForm()`；自動化需在設定 input value 後主動呼叫：
    - 優先：`window.SubmitForm()`（若存在）
    - 否則：提交 `#form1`（`requestSubmit()` / `submit()`）
  - **注意**：`SubmitForm()/form.submit()` 會觸發**整頁 reload**，因此不能用「單次 JS 執行中 for-loop 逐年抓取」；必須採用「分段與恢復」狀態機（見 3.3 與 9.3）。

### 3.2 買入頁（Buy）

- **日期輸入框**：`#BuyInfo_QueryDateRange`
- **結果表格 selector**：
  - `.query-result-area .buy-table-area table.buy-table.default-table.h5`
- **表頭（用於欄位映射）**：固定包含「成交日 / 股票名稱 / 成交股 / 投入成本」等欄（見 `RAW_SPEC.md`）。

### 3.3 賣出頁（Sell）

- **切換到賣出標籤**：
  - `#TagSelectArea` 內找到文字為「賣出」的 `.tag-select-header`（或依 onclick `TagSelectClick(2)`）並點擊。
- **日期輸入框**：`#SellInfo_QueryDateRange`
- **結果表格 selector**：
  - `.query-result-area .sell-table-area table.sell-table.default-table.h5`
- **表頭（用於欄位映射）**：固定包含「成交日 / 股票名稱 / 成交股 / 交割金額」等欄。
- **重要限制（切換 tab 可能 reload）**：
  - 實務上點擊「賣出」tab 可能觸發頁面重新 request / 重載，導致 content script 重新初始化、記憶體狀態遺失。
  - 因此抓取流程必須支援「分段與恢復」：先抓買入並**持久化暫存**（建議 `chrome.storage.local`；無則退回 `sessionStorage`），再切換到賣出頁；重載後自動從暫存讀回買入資料並繼續抓賣出，最後合併計算並清理暫存。
  - **補充**：不只切 tab；每次設定日期區間後觸發 `SubmitForm()/form.submit()` 也會整頁 reload，同樣需要分段恢復。

### 3.4 排序、分頁與滾動載入

- 篩選結果為 **當年由晚到早排序**：畫面上先看到 12 月，往下捲才會出現 1 月。
- **需求**：抓到該年度所有列（不遺漏），並可跨年度累積。
- **建議實作規格（可測）**：
  - 滾動至表格容器底部直到「列數在連續 N 次檢查中不再增加」或出現明確的「無更多資料」訊號。
  - 抓取後以「(tradeDate, ticker, type, shares, cashAmount)」做去重。

---

## 4) 交易資料欄位定義（解析輸出）

> 注意：頁面同時有 web/mobile 欄位（mobile 會用 `<br>` 合併顯示）。解析時應優先取 web 欄位；若不存在再回退 mobile 欄位解析。

### 4.1 BuyRow → TradeEvent

- **必要輸出欄位**：
  - `type = "BUY"`
  - `tradeDate`：`YYYY/MM/DD`
  - `ticker`：例如 `COST`（從股票名稱欄位內的 `.td-item1` 或等價位置）
  - `shares`：成交股（可為小數）
  - `cash`：投入成本（buyCost；數字可含千分位）

### 4.2 SellRow → TradeEvent

- **必要輸出欄位**：
  - `type = "SELL"`
  - `tradeDate`
  - `ticker`
  - `shares`
  - `cash`：交割金額（sellCash；數字可含千分位）

### 4.3 數字與日期解析規格

- **日期**：
  - DOM 內可能是 `2024/<br>12/30` → 正規化成 `2024/12/30`
  - 另提供 `isoDate = YYYY-MM-DD` 供 map key 使用（建議）。
- **數字**：
  - 去除千分位逗號：`"1,572.66" -> 1572.66`
  - 空值/`--`/缺欄：視為錯誤（丟出可辨識錯誤碼，或跳過並記錄告警；需在第 9 節定義行為）。

---

## 5) 價格資料來源（Yahoo Finance Chart API）

### 5.1 API 形式（來源：RAW_SPEC）

`https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?formatted=true&includeAdjustedClose=true&interval=1d&period1={timestampStart}&period2={timestampEnd}`

- `symbol`：ticker（例如 `VTI`, `NVDA`）
  - **注意（Class shares）**：若 ticker 含 `.`（例如 `BRK.B`），打 Yahoo API 時需轉成 `-`（`BRK-B`）才會成功；系統內事件/持倉 ticker 可維持原樣，僅在「送 Yahoo request」時做 normalize。
- `period1/period2`：Unix timestamp（**秒**）邊界，例如：1626652800，建議：
  - `period1`：年度起始日 00:00:00 UTC 的 timestamp（或以交易所時區計算；見第 10 節）
  - `period2`：建議用「**隔日 00:00:00 UTC**」作為右邊界（例如年度用 `YYYY+1-01-01`；今年用 `today+1` buffer），避免 API 邊界行為導致漏掉最後一天（見 10.7）。

### 5.4 CORS 與 Extension 架構注意事項（重要）

- 從豐存股頁面（content script）直接 `fetch(query1.finance.yahoo.com)` 會被 CORS 擋下（Yahoo 未回 `Access-Control-Allow-Origin`）。
- 正確做法：在 MV3 **service worker**（background）中代打 Yahoo，再以 `chrome.runtime.sendMessage` 回傳 JSON 給 content script。
  - `manifest.json` 需包含 `host_permissions: ["https://query1.finance.yahoo.com/*"]`。

### 5.2 需要的價格欄位

- **預設**：使用 `close` 作為收盤價。
- **回退**：若 `close` 不存在或為 `null`，可回退 `adjclose`（是否回退需在第 10 節定義為決策）。

### 5.3 價格表結構（供 O(1) 查詢）

- 建立 `PriceSeries`：`Map<isoDate, closePrice>`
- 快取粒度：`(symbol, year)` 或 `(symbol, [start,end])`
- 目標：同一 symbol 同一年度只打一次網路請求（除非失敗重試）。

---

## 6) 資料模型（TypeScript 參考）

```ts
export type TradeType = "BUY" | "SELL";

export interface TradeEvent {
  type: TradeType;
  tradeDate: string; // "YYYY/MM/DD"
  isoDate: string;   // "YYYY-MM-DD"
  ticker: string;    // e.g. "COST"
  shares: number;    // can be fractional
  cash: number;      // BUY:投入成本, SELL:交割金額
  sourceYear: number;
}

export type PriceSeries = Map<string, number>; // key: isoDate

export type Holdings = Map<string, number>; // ticker -> shares
```

---

## 7) 計算定義（核心邏輯；只在交易日點更新）

### 7.1 事件合併與排序

- 解析 `buyEvents[]` 與 `sellEvents[]` 後合併為 `events[]`。
- `events[]` 依 `isoDate` 升冪排序。
- 同日多筆事件的排序規則（需固定以便測試重現）：
  - 建議：同日內依「原表格出現順序（由上到下）」或依「BUY 先於 SELL」；需在第 10 節明確定義。

### 7.2 價格準備

- 蒐集所有需要的 ticker：`uniqueTickers = unique(events.ticker) ∪ {"VTI"}`
- 依年度/區間取得各 ticker 的 `PriceSeries`。
- 需要一個取價函式：
  - `getClose(ticker, isoDate) -> number`
  - 若該日缺價：依回退規則（例如取「最近前一個有價交易日」），見第 10 節。

### 7.3 holdings 更新與市值計算

> 折線圖只在 `tradeDates`（有事件的日期）輸出一個點。

- 定義：
  - `tradeDates = unique(events.isoDate)`（升冪）
  - `portfolioHoldings: Holdings = new Map()`
  - `vtiShares = 0`
- 對每個 `tradeDate`（升冪）：
  1. 取出當日所有 `dayEvents`
  2. 先更新 **Portfolio holdings**：
     - BUY：`holdings[ticker] += shares`
     - SELL：`holdings[ticker] -= shares`
  3. 計算 **Portfolio 市值**：
     - \(portfolioValue = \sum_{t \in holdings} shares_t \times close(t, tradeDate)\)
  4. 更新 **VTI holdings（平行時空）**：
     - 對 `dayEvents`：
       - 若 BUY：`vtiShares += event.cash / close("VTI", tradeDate)`
       - 若 SELL：`vtiShares -= event.cash / close("VTI", tradeDate)`
  5. 計算 **VTI 市值**：
     - `vtiValue = vtiShares * close("VTI", tradeDate)`

### 7.4 輸出序列（ECharts）

- `xAxis.data = tradeDates`（建議用 `"YYYY-MM-DD"` 或 `"YYYY/MM/DD"`，但需一致）
- `portfolioSeries.data = portfolioValues[]`
- `vtiSeries.data = vtiValues[]`

> 備註：ECharts `xAxis.type='date'` 時，通常 series data 也可用 `[time,value]` pair；本專案可沿用 RAW_SPEC 以 `xAxis.data + series.data` 形式輸出，但需確保日期字串可被 ECharts parse。

---

## 8) UI 渲染與插入

- 圖表容器：
  - `<div id="chart" style="width: 100%; height: 400px;"></div>`
- 插入位置：
  - 插入到 `#TagSelectArea` 中，作為 **第 2 個子元素**（index=1）。
- 重入/更新：
  - 若已存在 `#chart`：不得重複插入，應更新圖表 option（或先清理再重建）。
- 產生狀態顯示（不可用按鈕文字表示）：
  - 需有獨立的 UI 區塊/面板顯示狀態：`抓取買入中` → `切換賣出中` → `抓取賣出中` → `計算/繪圖中` → `已完成`（失敗則顯示錯誤訊息）。
  - 按鈕（若存在）僅作為啟動入口，不承擔進度/完成狀態顯示。

---

## 9) 錯誤處理與可觀測性

### 9.1 需處理的錯誤類型

- **DOM 找不到**：目標 selector 失效、頁面尚未載入、SSR hydration 延遲
- **年度篩選無資料**：該年沒有交易
- **解析失敗**：日期/數字欄位缺失、格式異常
- **價格缺失**：Yahoo 回傳缺日期或 close 為 null
- **網路失敗/限流**：429 / 5xx

### 9.2 建議行為

- 對致命錯誤顯示可讀訊息（例如在 chart 區塊顯示 error banner），同時在 console log 記錄：
  - 錯誤碼、selector、年度、ticker、原始欄位字串
- 對非致命錯誤（例如單筆列解析失敗）：
  - 預設 **跳過該筆** 並記錄 warning（此行為需在第 10 節確認是否接受）。

### 9.3 分段與恢復（因 submit / tab 切換會 reload）

- **觸發條件**：每次呼叫 `SubmitForm()/form.submit()` 可能整頁 reload；切換到賣出 tab 也可能 reload。
- **策略**：將抓取流程拆成多個 stage，並在每次「可能 reload」的動作前先持久化狀態，reload 後自動恢復並繼續下一步。
- **建議 stage（參考）**：
  - `buy_submitted`：已設定買入日期區間並 submit，等待 reload 後解析買入 table
  - `need_sell_tab`：買入完成，準備切換賣出 tab（可能 reload）
  - `sell_submitted`：已設定賣出日期區間並 submit，等待 reload 後解析賣出 table
  - `computing`：買賣資料都完成後，抓 Yahoo 價格、計算、繪圖
- **儲存位置**：優先 `chrome.storage.local`；無則退回 `sessionStorage`。

### 9.4 除錯資料落點（建議）

- 為了方便在 DevTools 直接檢查，可將解析後的資料額外 dump 到 `localStorage`（同網域 Application 面板可看）：
  - `pvs_debug_buyEvents_v1`
  - `pvs_debug_sellEvents_v1`
  - `pvs_debug_events_v1`
  - `pvs_debug_lastRange_BuyInfo_QueryDateRange` / `pvs_debug_lastRange_SellInfo_QueryDateRange`（用來確認 input value 是否被頁面重設）

---

## 10) 仍需明確化的細節（歧義/決策清單）

以下項目會影響「序列數值」與「測試可重現性」。本專案建議直接採用以下預設決策（偏向同類投資 app 的 best practice，並兼顧 extension 的限制與穩定性）：

1. **時區與日期鍵（最重要）**  
   - **唯一日期 key**：以美股交易所時區 **America/New_York（ET）** 為準，系統內統一用 `isoDateET = YYYY-MM-DD`。  
   - **DOM 日期對齊策略**：DOM 讀到的 `YYYY/MM/DD` 先轉成 `isoDateET`（視為交易日）。若當天取價失敗，啟用「自動校正」：依序嘗試 `isoDateET - 1 trading day`、`isoDateET + 1 trading day`，一旦命中即固定為 `resolvedIsoDateET` 並記錄 warning（避免台灣顯示日與 ET 交易日差一天造成全盤錯位）。
   - **理由**：Yahoo 的日線資料本質上依交易所日曆切日；用 ET 做 key 最少歧義，也最容易在測試中重現。

2. **缺價回退規則（避免 look-ahead bias）**  
   - 在完成第 1 點的「日期校正」後，若 `getClose(ticker, resolvedIsoDateET)` 仍缺價：只允許**往前回退**到最近一個有價的交易日（previous trading day），最多回退 `N=7` 個交易日。  
   - 超過回退上限或仍找不到：視為**致命錯誤**（停止該次計算並顯示錯誤資訊）。  
   - **理由**：同類績效追蹤工具一般避免用未來資料補值；往前回退可最大化可用性且不引入前視偏誤。

3. **close vs adjclose（估值價格選擇）**  
   - **預設估值價格**：優先使用 `adjclose` 作為收盤估值價；若 `adjclose` 缺失才回退到 `close`。  
   - **理由**：長期比較績效時，`adjclose` 較能反映公司行動（拆股/股利）造成的跳點問題；同類 app 進行 benchmark 比較時也常偏好 adjusted 系列以提升可比性與穩定性。

4. **同日多事件的處理方式（可重現、易測）**  
   - **估值頻率**：同一交易日只輸出一個點（本專案的 trade-day points 定義），且只在處理完當日所有事件後估值一次。  
   - **同日順序**：為了讓「非法超賣檢查」一致，當日事件處理順序固定為 **BUY → SELL**。  
   - **同日合併（建議）**：同日同 ticker 的 BUY 可彙總、SELL 可彙總（shares/cash 各自加總）以簡化計算並提升穩定性。

5. **賣出超過持倉/負持倉**  
   - **Portfolio**：不允許負持倉；若發生 `SELL shares > currentHolding`，視為**致命錯誤**（多數投資 app 不會 silently 修正，避免把錯誤資料算成「看起來合理」）。  
   - **VTI（平行時空）**：預設也不允許 `vtiShares < 0`。若某次 SELL 會導致 `vtiShares` 變負，視為**致命錯誤**（除非未來明確要支援「借券/做空」情境）。

6. **手續費/稅費是否已包含在投入成本/交割金額**  
   - **預設**：`cash` 欄位（投入成本/交割金額）視為頁面顯示的最終金額，不再額外加減手續費/稅費，避免重複計算。  
   - 可將 fee 欄位保留到事件結構供除錯/分析，但不影響本版計算。

7. **Yahoo chart 的 period2 邊界（避免漏掉最後一天）**  
   - **預設**：`period2` 使用「**明天 00:00:00 UTC**」作為右邊界（等價於 today + 1 day 的起點），再用 `isoDateET` 對齊過濾實際需要的日期。  
   - **理由**：許多 API 的 `period2` 為開區間或邊界行為不一；加 1 天 buffer 是同類系統常見的穩健做法。

8. **ECharts 日期格式（最穩定）**  
   - **預設**：避免依賴瀏覽器對日期字串的 parse；建議用 `xAxis.type = "time"`，series 使用 `[timestampMs, value]` pair：`[[tsMs, v], ...]`。  
   - **理由**：跨瀏覽器/locale 的日期 parse 風險最低，且對 extension 這類環境最穩；測試也更容易做精準比對。

---

## 11) 驗收準則（Acceptance Criteria）

1. **DOM 插入**：在目標頁面載入後，`#TagSelectArea` 的第 2 個子元素為 `#chart` 容器（或包含 chart 容器的 wrapper）。
2. **序列一致性（fixture）**：給定固定的交易事件與固定的價格表 fixture，輸出的：
   - `tradeDates.length === portfolioValues.length === vtiValues.length`
   - 指定 3–5 個日期點的 portfolio/vti value 精準相等（允許小數誤差需定義 epsilon）。
3. **跨年度**：至少一組 fixture 覆蓋 12/31 與 01/02（或 01/03）後，序列仍能正確串接不重複/不遺漏。
4. **容錯**：遇到某年度無交易時不崩潰；遇到單筆列解析失敗有 warning 且可繼續產圖（若採跳過策略）。

