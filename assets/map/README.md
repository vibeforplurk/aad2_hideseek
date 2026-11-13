# 暮影領地捉迷藏｜地圖座標資產

## 檔案
- `map_nodes.js`：前端程式可直接匯入的節點座標。
- `map_nodes.json`：完整 JSON 資料，含地圖尺寸與座標系統說明。
- `map_coordinates.csv`：方便用試算表檢查或手動修正的座標表。
- `map_nodes_overlay.svg`：透明節點編號疊圖，可放在 `map.png` 上方預覽。
- `map.png`：原始底圖（此 ZIP 內附一份）。

## 座標規則
- 底圖尺寸：1717 × 961 px。
- 原點：圖片左上角 `(0, 0)`。
- X 軸向右增加，Y 軸向下增加。
- 每個點位的座標代表圓圈中心。
- 編號由 1 號開始，依使用者指定的順時針方向排列。

## 使用方式
將 `map.png`、`map_nodes_overlay.svg` 放在同一個目錄即可疊圖預覽。
網站正式繪製時，建議由 JavaScript 讀取 `map_nodes.js`，再以 SVG 動態繪製角色標記、路徑、起點與終點；不要把遊戲狀態寫死在底圖 SVG 裡。

## 校正提醒
這份座標由圖像辨識／圓形偵測估算，足以作為第一版定位資料，但仍建議將 SVG 疊圖與原圖並排檢查，尤其確認 1 號大圓圈中心及邊緣點位。若要精準到數個像素，可在 Inkscape 中逐點微調，或直接修改 CSV／JS 的 x、y。

## 設施名稱位置
網站前端使用 `js/data/map.js` 的 `label`（地圖短名稱）、`labelDx`、`labelDy`、`labelAnchor` 控制設施名稱文字與位置；預設所有名稱都在圓點下方（接待廳因圓圈較大使用 `labelDy: 118`，其餘為 `labelDy: 78`）。地圖下方額外保留 `ST.MAP.labelPadding`（64px）避免底部名稱被裁切。
