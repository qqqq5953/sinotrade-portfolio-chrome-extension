# 豐存股插件規格

[toc]

我想要為永豐的豐存股建立一個 chrome 插件，幫助我產生折線圖，顯示在網頁中某個區塊。
圖表中會有兩條線，一條是總資產累積金額，一條是vti的累積金額。
做法是：任何交易我都會在平行時空做一筆一樣的交易，只是標的都換成vti，這樣就可以知道總資產累積報酬是否有打贏大盤。
我發現永豐的豐存股網頁是SSR的技術，且交易資料是用日期篩選來呈現，不是一次呈現所有的，所以我可能需要用爬蟲的方式來取得資料。

假設：無論是歷史交易或是平行時空的vti，買入時機是在收盤。賣出則是用交割金額去算。如果個股賣出4股、交割金額為1000，則vti的交割金額也是1000，不管對應到幾股。

# 需要的步驟如下：
1. 進入目標頁面
2. 點選「買入」標籤
3. 輸入時間區間，按下enter後會出現篩選結果
4. 從篩選結果拿到買入歷史交易資料
5. 點選「賣出」標籤
6. 輸入時間區間，按下enter後會出現篩選結果
7. 從篩選結果拿到賣出歷史交易資料（成交日、股票名稱、成交股、交割金額）
8. 將買入跟賣出資料合併，並計算總資產累積金額
9. 將總資產累積金額和vti的累積金額繪製成折線圖
10. 將折線圖顯示在網頁中某個區塊



# 規格：
## 需要的 API
- yahoo finance api: https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?formatted=true&includeAdjustedClose=true&interval=1d&period1={timestamp_yearStart}&period2={timestamp_yearEnd}
- 其中symbol是標的的ticker（例如：NVDA），timestamp_yearStart對應到該年度最早日期，timestamp_yearEnd對應到該年度最後的日期。
## 買入頁：
- 我需要2020到現在(2026)、以年為單位的資料，所以需要爬蟲2020、2021、2022、2023、2024、2025、2026年度的資料，所以你必須要先知道今年是哪一年，再決定年度資料要怎麼去設定區間。
- 時間窗口設為一年，例如：2020/01/01 到 2020/12/31, 2021/01/01 到 2021/12/31, 以此類推，直到現在。
- 時間窗口的 input id 為 BuyInfo_QueryDateRange，日期格式為yyyy/mm/dd~yyyy/mm/dd，直接輸入文字後按enter即可啟動篩選。
- 從最早的年份開始爬蟲，直到最後的年度，且篩選結果會先呈現該年度最晚的日期，再往最早的日期排序。意思是畫面上會先看到該年度12月的資料，往下滾動到最下面才會看到1月的資料。
- 買入的篩選結果會出現 table，table 是包在 <div class="query-result-area"><div class="buy-table-area"><table class="buy-table default-table h5"></table></div></div> 中。
- 每個結果頁的thead固定是這種格式：
```
<thead>
    <tr>
        <th class="text-left">成交日</th>
        <th class="text-left">股票名稱</th>
        <th class="text-left web"></th>
        <th class="text-right web">成交股</th>
        <th class="text-right web">成交均價</th>
        <th class="text-right web">手續費</th>
        <th class="text-right web">投入成本</th>
        <th class="text-right mobile">成交股<br>成交均價</th>
        <th class="text-right mobile">手續費<br>投入成本</th>
    </tr>
</thead>
```
- 每個結果頁的tbody固定是這種格式：
```
<tbody>
    <tr>
        <td class="text-left">2024/<br class="mobile">12/30</td>
        <td class="text-left">
            <div>
                <div class="td-item1">COST</div>
                <div class="td-item2 mobile">好市多</div>
            </div>
        </td>
        <td class="text-left web">好市多</td>
        <td class="text-right web">0.10730</td>
        <td class="text-right web">931.97</td>
        <td class="text-right web">0.10</td>
        <td class="text-right web">100.10</td><br>931.97</td>
        <td class="text-right mobile">0.10<br>100.10</td>
    </tr>
    <tr>
        ...
    </tr>
</tbody>
```

# 賣出頁：
- 賣出資料的抓取，要透過 id=TagSelectArea 找到裡面的 "賣出" div 並點擊，這樣才能抓到賣出資料：
```
<div id="TagSelectArea">
    <div class="center">
        <div class="tag-select-header-area center radius h5">
            <div class="tag-select-header btn radius " onclick="TagSelectClick(0)">買入</div>
            <div class="tag-select-header btn radius active" onclick="TagSelectClick(2)">賣出</div>
        </div>
    </div>
</div>
```
- 我需要2020到現在(2026)、以年為單位的資料，所以需要爬蟲2020、2021、2022、2023、2024、2025、2026年度的資料，所以你必須要先知道今年是哪一年，再決定年度資料要怎麼去設定區間。
- 時間窗口設為一年，例如：2020/01/01 到 2020/12/31, 2021/01/01 到 2021/12/31, 以此類推，直到現在。
- 時間窗口的 input id 為 SellInfo_QueryDateRange，日期格式為yyyy，日期格式為yyyy/mm/dd~yyyy/mm/dd，直接輸入文字後按enter即可啟動篩選。
- 從最早的年份開始爬蟲，直到最後的年度，且篩選結果會先呈現該年度最晚的日期，再往最早的日期排序。意思是畫面上會先看到該年度12月的資料，往下滾動到最下面才會看到1月的資料。
- 篩選結果會出現 table，table 是包在 <div class="query-result-area"><div class="sell-table-area"><table class="sell-table default-table h5"></table></div></div> 中。
- 每個結果頁的thead固定是這種格式：
```
<thead>
    <tr>
        <th class="text-left">成交日</th>
        <th class="text-left">股票名稱</th>
        <th class="text-left web"></th>
        <th class="text-right web">成交股</th>
        <th class="text-right web">成交均價</th>
        <th class="text-right web">損益</th>
        <th class="text-right web">報酬率</th>
        <th class="text-right web">投入成本</th>
        <th class="text-right web">交割金額</th>
        <th class="text-right mobile">成交股<br>成交均價</th>
        <th class="text-right mobile">損益<br>報酬率</th>
        <th class="text-right mobile">投入成本<br>交割金額</th>
    </tr>
</thead>
```
- 每個結果頁的tbody固定是這種格式：
```
<tbody>
    <tr>
        <td class="text-left">2020/<br class="mobile">03/04</td>
        <td class="text-left">
            <div>
                <div class="td-item1">LLY</div>
                <div class="td-item2 mobile">Eli Lilly</div>
            </div>
        </td>
        <td class="text-left web">Eli Lilly</td>
        <td class="text-right web">1.75752</td>
        <td class="text-right web">896.53</td>
        <td class="text-right web text-stock-up">271.36</td>
        <td class="text-right web text-stock-up">20.85%</td>
        <td class="text-right web">1,301.30</td>
        <td class="text-right web">1,572.66</td>
        <td class="text-right mobile">1.75752<br>896.53</td>
        <td class="text-right mobile">
            <span class="text-stock-up">271.36</span>
            <br>
            <span class="text-stock-up">20.85%</span>
        </td>
        <td class="text-right mobile">1,301.30<br>1,572.66</td>
    </tr>
    <tr>
        ...
    </tr>
</tbody>
```

## 資料合併
- 將買入跟賣出資料合併後，我要用 Apache ECharts 來呈現資產累積金額折線圖，他的 option 格式為：
```
const option = {
  title: {
    text: 'Portfolio vs VTI'
  },
  tooltip: {
    trigger: 'axis'
  },
  legend: {
    data: ['portfolio', 'vti']
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true
  },
  toolbox: {
    feature: {
      saveAsImage: {}
    }
  },
  xAxis: {
    type: 'date',
    boundaryGap: false,
    data: ['2020/01/01', '2020/01/02', ...]
  },
  yAxis: {
    type: 'value'
  },
  series: [
    portfolioSeries,
    vtiSeries
  ]
};
```
- 其中 portfolioSeries 的格式為：
```
const portfolioSeries = {
    name: 'portfolio',
    type: 'line',
    stack: 'portfolio',
    data: [100, 300, 200, ...]
}
```
- 但因為 portfolioSeries.data 是要呈現資產累積價值，所以如果第一天收盤後的價值為100、第二天收盤後的價值200、第三天賣出100，那 data 的值就會是 [100, 300, 200]，因為第三天賣出100，所以資產累積價值變成200。
- 同理 vtiSeries.data 的格式為：
```
const vtiSeries = {
    name: 'vti',
    type: 'line',
    stack: 'vti',
    data: [100, 200, ... , 300, 400, ...]
}
```
- 如果你有更有效率的做法取得portfolioSeries和vtiSeries，就直接用你的方法，希望可以用 O(n) 就取得資料。
- 將資料插入到 <div id="chart" style="width: 100%; height: 400px;"></div> 中，再將這個html插入到 <div id='TagSelectArea'> 裡面當作第二個子元素。

## 測試
- 我需要在你爬蟲的過程中，存幾組資料讓我測試看看是否能正常運作。
- 要寫測試確認你的運算邏輯是對的。
- 用 playwright 寫測試。

