/*
 * 暮影領地捉迷藏｜事件產生器
 * 依目前角色所在設施與模式，整理事件／途經規則、骰子需求與可選結果。
 * 真正的效果套用在 game_engine.js；這裡只負責「讀規則、產生選項」。
 */
(function (ST) {
  "use strict";

  var EventGenerator = {
    current: function (state, rules) {
      return ST.Engine.getEventInfo(state, rules);
    },

    checks: function (event, player, mode) {
      return ST.Engine.checksFor(event, player, mode);
    },

    outcomeKeys: function (rule, role) {
      if (!rule) return [];
      var table = rule.roleOutcomes ? rule.roleOutcomes[role] || {} : rule.outcomes || {};
      return Object.keys(table).filter(function (key) { return key !== "default"; });
    },

    outcome: function (rule, role, key) {
      if (!rule) return null;
      var table = rule.roleOutcomes ? rule.roleOutcomes[role] || {} : rule.outcomes || {};
      return table[key] || table["default"] || null;
    },

    passByRule: function (state, rules, nodeId) {
      var facility = ST.getFacilityRules(rules, nodeId, state.mode);
      if (!facility || !facility.passBy) return null;
      return facility.passBy;
    },

    /** 將事件規則整理成給主持人看的摘要。 */
    summary: function (facility, state) {
      if (!facility) return "此格沒有設施規則。";
      var event = facility.event;
      if (!event || event.status === "none") return "此格在目前模式沒有事件。";
      return event.summary || "";
    },

    statusLabel: function (status) {
      return { confirmed: "規則已確認", draft: "待確認", none: "無規則" }[status] || "未標示";
    }
  };

  ST.EventGenerator = EventGenerator;
})(window.ST = window.ST || {});
