# 她不是故意的｜失智症 BPSD 六個處置實例

給失智症家屬與照顧者的互動衛教網頁：六個家裡最常見的行為與精神症狀（BPSD）情境，每題三種接法，點選揭曉哪一句接得住；也可以播放約 8 分鐘的台灣國語配音解說（逐句字幕、自動翻頁）。

**線上觀看**：https://a7662888.github.io/bpsd-caregiver-deck/

操作：← → 換頁、空白鍵播放／暫停、S 字幕、M 配樂、T 切換樣式；手機可左右滑動換頁，點一下畫面叫出控制列。網址加 `#7` 直達第 7 頁。

三種樣式：預設「指示牌」（黑字黃色塊、字最大），另有「臨床筆記」與「報刊」可在控制列的「樣式」按鈕切換，或網址加 `?theme=a`（臨床筆記）、`?theme=b`（報刊）。

## 內容來源
改編自〈認識失智症：家屬照顧者講座〉（馬偕紀念醫院 失智防治中心 陳培豪醫師，2026.12.11）。頁面上的數字與建議均附出處：
- 《失智症防治照護政策綱領暨行動方案 3.0》；馬偕紀念醫院失智防治中心 NPI-Q 評估資料
- Kales HC, et al. J Am Geriatr Soc 2014;62:762–769. PMID 24635665（DICE）
- Cheng CM, et al. J Chin Med Assoc 2026;89:187–197. PMID 41527161（激動症狀藥物處置台灣專家共識）
- Sloane PD, et al. J Am Geriatr Soc 2004;52:1795–1804. PMID 15507054（以人為中心的洗澡）

本網頁為衛教資訊，不取代醫療建議；個別狀況請與您的醫療團隊討論。

## AI 生成內容揭露
旁白為 AI 語音（ElevenLabs）；配樂由 Google Lyria 生成；插圖為 AI 生成。

## 檔案
- `index.html`、`deck.css`、`deck.js`、`beats.js`：網頁本體（`beats.js` 由 `build/build_beats.py` 產生）
- `themes/`：三種樣式（`deai.css` 共用，`theme-c.css` 指示牌、`theme-a.css` 臨床筆記、`theme-b.css` 報刊）
- `build/narration.json`：逐句旁白稿（`text` 為字幕，`say` 為送語音引擎的讀音修正）
- `audio/`：逐句旁白與背景配樂；`assets/`：插圖
