/*
 * 暮影領地捉迷藏｜操作紀錄
 * 撤銷快照由 Store 管理；本模組負責紀錄的整理、顯示與匯出。
 */
(function (ST) {
  "use strict";

  var TYPE_LABELS = {
    setup: "建立遊戲",
    turn: "角色行動",
    event: "事件",
    movement: "移動",
    passby: "途經",
    judgment: "判定",
    capture: "捕獲",
    release: "返場",
    round: "回合",
    undo: "撤銷",
    manual: "手動操作",
    rules: "規則",
    game: "遊戲結束"
  };

  var History = {
    typeLabel: function (type) {
      return TYPE_LABELS[type] || type || "操作";
    },

    recent: function (state, limit) {
      if (!state || !state.logs) return [];
      return state.logs.slice(-(limit || 30)).reverse();
    },

    all: function (state) {
      return state && state.logs ? state.logs.slice() : [];
    },

    formatTime: function (iso) {
      if (!iso) return "";
      try {
        return new Date(iso).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      } catch (error) {
        return iso;
      }
    },

    formatDate: function (iso) {
      if (!iso) return "";
      try {
        return new Date(iso).toLocaleString("zh-TW", {
          year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
        });
      } catch (error) {
        return iso;
      }
    },

    exportText: function (state) {
      return History.all(state).map(function (log) {
        return "[" + History.formatDate(log.at) + "] 第" + log.round + "回合 " + History.typeLabel(log.type) + "｜" + log.message;
      }).join("\n");
    },

    canUndo: function () {
      return ST.Store.undoSize() > 0;
    },

    undoLabel: function () {
      return ST.Store.undoLabel();
    }
  };

  ST.History = History;
})(window.ST = window.ST || {});
