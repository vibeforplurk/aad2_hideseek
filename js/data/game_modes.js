/*
 * 暮影領地捉迷藏｜遊戲模式設定
 */
(function (ST) {
  "use strict";

  ST.GAME_MODES = {
    "1v1": {
      id: "1v1",
      label: "1V1 模式",
      short: "1V1",
      description: "一位躲藏者與一位追捕者。每回合由躲藏者先行動，再由追捕者行動。",
      defaultMaxRound: 10,
      maxHiders: 1,
      maxSeekers: 1,
      hiderLabel: "躲藏者",
      seekerLabel: "追捕者",
      judgmentDice: "draw",
      judgmentDiceLabel: "draw（吉／凶）",
      endCondition: "追捕者與躲藏者同格、或依規則判定捕獲；10 回合後躲藏者逃脫。"
    },
    multi: {
      id: "multi",
      label: "多人模式",
      short: "多人",
      description: "一至四位躲藏者與主持人扮演的異常（追捕者）。依所在格數字與抵達順序決定行動順序。",
      defaultMaxRound: 10,
      maxHiders: 4,
      maxSeekers: 1,
      hiderLabel: "躲藏者",
      seekerLabel: "異常",
      judgmentDice: "coin",
      judgmentDiceLabel: "coin（P／骨／特殊）",
      endCondition: "所有躲藏者被捕獲，或回合上限到達。",
      multiplayerNotes: [
        "行動順序：回合開始時依所在格數字由小到大；同格依上回合先抵達者優先。",
        "同一格有複數躲藏者時，回合開始選人擲等同人數的 draw；全吉或全凶時該格所有躲藏者額外移動 dice4。",
        "追捕者判定階段只捕獲最後抵達該格的一位躲藏者。",
        "異常的事件與移動判定將 draw 改為 coin（P＝吉、骨＝凶）。"
      ]
    }
  };

  ST.getMode = function (mode) {
    return ST.GAME_MODES[mode] || ST.GAME_MODES["1v1"];
  };

  ST.DEFAULT_NAMES = {
    hider: ["喬安娜", "小紅帽", "灰姑娘"],
    seeker: ["異常", "追捕者"]
  };
})(window.ST = window.ST || {});
