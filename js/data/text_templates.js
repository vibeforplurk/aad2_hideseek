/*
 * 暮影領地捉迷藏｜固定 Plurk 文字模板
 * ------------------------------------------------------------------
 * 網站只提供標準模板；主持人可在「文字輸出」頁修改產出的文字後複製。
 * 模板中的 (dice4)、(draw)、(coin) 等是 Plurk 擲骰語法，貼到 Plurk 送出
 * 後會由 Plurk 產生結果，主持人再把結果回填到網站。
 *
 * 若要調整輸出文字，主要修改這個檔案；動態組字（設施區塊、判定條件、
 * 「請擲…」提示）在 js/features/text_generator.js。
 */
(function (ST) {
  "use strict";

  ST.TEXT_VARIABLES = [
    { key: "round", label: "目前回合" },
    { key: "max_round", label: "最大回合" },
    { key: "mode_label", label: "模式名稱" },
    { key: "player_name", label: "PLURK ID（不含 @）" },
    { key: "player_tag", label: "PLURK 標註（含 @）" },
    { key: "character_name", label: "角色名稱" },
    { key: "role_label", label: "角色類型" },
    { key: "facility_id", label: "設施格號" },
    { key: "facility_name", label: "設施名稱" },
    { key: "facility_emoji", label: "設施符號" },
    { key: "facility_quote", label: "設施旁白" },
    { key: "facility_block", label: "設施區塊（符號＋Rides＋旁白）" },
    { key: "event_summary", label: "事件內容" },
    { key: "event_check_prompt", label: "事件擲骰提示" },
    { key: "start_position", label: "移動起點" },
    { key: "end_position", label: "移動終點" },
    { key: "position", label: "目前位置" },
    { key: "movement_steps", label: "移動步數" },
    { key: "movement_direction", label: "移動方向" },
    { key: "movement_check_syntax", label: "移動擲骰語法" },
    { key: "movement_instruction", label: "移動階段指示" },
    { key: "passby_prompt", label: "途經判定提示" },
    { key: "extra_movement", label: "額外移動說明" },
    { key: "event_result", label: "事件結果" },
    { key: "judgment_result", label: "判定結果" },
    { key: "result_sentence", label: "遊戲結束語句" },
    { key: "judgment_position_line", label: "判定位置說明" },
    { key: "judgment_instructions", label: "本次判定指示" },
    { key: "judgment_reference", label: "判定條件參考" },
    { key: "passby_result", label: "途經結果" },
    { key: "hiders", label: "所有躲藏者（含位置）" },
    { key: "hider_tags", label: "躲藏者標註" },
    { key: "hider_positions", label: "躲藏者位置" },
    { key: "seeker", label: "追捕者／異常（含位置）" },
    { key: "seeker_tag", label: "追捕者標註" },
    { key: "seeker_position", label: "追捕者位置" },
    { key: "start_positions", label: "起始位置一覽" },
    { key: "time", label: "現在時間" },
    { key: "date", label: "今天日期" }
  ];

  ST.DICE_SYNTAX = [
    { syntax: "(dice4)", label: "dice4", detail: "移動步數（1–4）" },
    { syntax: "(dice6)", label: "dice6", detail: "茶館事件步數（1–6）" },
    { syntax: "(dice20)", label: "dice20", detail: "起始位置、返場位置、退場後移動" },
    { syntax: "(draw)", label: "draw", detail: "吉／凶判定" },
    { syntax: "(coin)", label: "coin", detail: "異常專用：P／骨／特殊" }
  ];

  ST.DEFAULT_TEXT_TEMPLATES = [
    {
      key: "layout",
      name: "佈局",
      stage: "start",
      enabled: true,
      template: "**▶︎佈局**\n躲藏者：{hider_tags}\n追捕者：{seeker_tag}",
      description: "公布雙方的 PLURK 標註與角色名稱。"
    },
    {
      key: "round_start",
      name: "回合開始",
      stage: "round",
      enabled: true,
      template: "**▶︎第 {round} 回合開始**\n躲藏者位置：{hider_positions}\n追捕者位置：{seeker_position}",
      description: "公布本回合開始時的所有角色位置。"
    },
    {
      key: "event_prompt",
      name: "事件階段提示",
      stage: "event",
      enabled: true,
      template: "**▷{role_label} {character_name} 事件階段**\n{facility_block}\n事件：{event_summary}\n{event_check_prompt}",
      description: "目前角色所在設施、旁白與事件內容。"
    },
    {
      key: "movement_prompt",
      name: "移動階段提示",
      stage: "movement",
      enabled: true,
      template: "**▷{role_label} {character_name} 移動階段**\n{movement_instruction}\n{passby_prompt}",
      description: "請玩家擲移動骰、選擇方向；有途經時附上判定。"
    },
    {
      key: "judgment_prompt",
      name: "判定階段提示",
      stage: "judgment",
      enabled: true,
      template: "**▷{role_label} {character_name} 判定階段**\n{judgment_position_line}\n{judgment_instructions}\n{judgment_reference}",
      description: "目前位置的判定條件與本次觸發的判定。"
    },
    {
      key: "movement_result",
      name: "移動結果",
      stage: "movement",
      enabled: true,
      template: "**▷{role_label} {character_name} 移動結果**\n🎲 移動步數：{movement_check_syntax} → {movement_steps} 格\n從 {start_position} 沿{movement_direction}前進，抵達 {end_position}。\n{extra_movement}\n{passby_result}",
      description: "回填移動結果後使用。"
    },
    {
      key: "event_result",
      name: "事件結果",
      stage: "event",
      enabled: true,
      template: "**▷{role_label} {character_name} 事件結果**\n{facility_name}：{event_result}",
      description: "回填事件骰子結果後使用。"
    },
    {
      key: "judgment_result",
      name: "判定結果",
      stage: "judgment",
      enabled: true,
      template: "**▷{role_label} {character_name} 判定結果**\n{judgment_result}",
      description: "回填判定骰子結果後使用。"
    },
    {
      key: "capture_result",
      name: "捕獲結果",
      stage: "judgment",
      enabled: true,
      template: "**▶︎捕獲**\n💀 {character_name} 遭追捕者捕獲，退出遊戲。",
      description: "確認捕獲後使用。"
    },
    {
      key: "round_end",
      name: "回合結束",
      stage: "round",
      enabled: true,
      template: "**▶︎第 {round} 回合結束**",
      description: "全體角色完成行動後使用。"
    },
    {
      key: "game_end",
      name: "遊戲結束",
      stage: "end",
      enabled: true,
      template: "**▶︎遊戲結束**\n{result_sentence}",
      description: "遊戲結束時使用。"
    },
    {
      key: "freeform",
      name: "自由備註",
      stage: "free",
      enabled: true,
      template: "",
      description: "主持人自由撰寫，不受目前階段限制。"
    }
  ];
})(window.ST = window.ST || {});
