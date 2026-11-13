/*
 * 暮影領地捉迷藏｜回合與行動順序
 * ------------------------------------------------------------------
 * 1V1：躲藏者 → 追捕者。
 * 多人：回合開始依所在格數字由小到大；同格依上回合先抵達者優先；
 *       所有躲藏者完成後才輪到異常（追捕者）。
 */
(function (ST) {
  "use strict";

  function getPlayer(state, id) {
    return state.players.filter(function (p) { return p.id === id; })[0] || null;
  }

  var TurnManager = {
    computeOrder: function (state) {
      var hiders = state.players.filter(function (p) { return p.role === "hider" && p.inPlay && !p.captured; });
      var seekers = state.players.filter(function (p) { return p.role === "seeker" && p.inPlay && !p.captured; });
      if (state.mode === "multi") {
        hiders.sort(function (a, b) {
          return Number(a.position) - Number(b.position) || Number(a.arrivalSeq) - Number(b.arrivalSeq);
        });
      } else {
        hiders.sort(function (a, b) { return Number(a.arrivalSeq) - Number(b.arrivalSeq); });
      }
      return hiders.map(function (p) { return p.id; }).concat(seekers.slice(0, 1).map(function (p) { return p.id; }));
    },

    beginTurn: function (state, playerId) {
      var player = getPlayer(state, playerId);
      if (!player) return null;
      state.activePlayerId = player.id;
      state.phase = "event";
      state.movement = null;
      state.lastMovement = null;
      state.pendingCapture = null;
      state.pendingRelocation = null;
      state.turnFlags = ST.defaultTurnFlags();

      player.statuses = (player.statuses || []).filter(function (status) {
        if (!status || !status.key) return false;
        if (status.key === "eventLock" && Number(status.remaining) > 0) {
          state.turnFlags.skipEvent = true;
          status.remaining = Number(status.remaining) - 1;
        }
        if (status.remaining != null && Number(status.remaining) <= 0) return false;
        return true;
      });

      ST.addLog(state, {
        type: "turn",
        actorId: player.id,
        message: "第 " + state.round + " 回合｜" + ST.playerLabel(player) + " 開始行動（" + (player.role === "seeker" ? "追捕者" : "躲藏者") + "）。"
      });
      return player;
    },

    beginRound: function (state, rules) {
      state.turnOrder = TurnManager.computeOrder(state);
      state.turnIndex = 0;
      ST.addLog(state, { type: "round", message: "第 " + state.round + " 回合開始。" });
      var first = state.turnOrder[0] || null;
      if (!first) {
        TurnManager.endGame(state, rules, "seeker", "場上已沒有可行動的躲藏者。");
        return { status: "ended" };
      }
      TurnManager.beginTurn(state, first);
      return { status: "round", round: state.round, playerId: first };
    },

    /**
     * 推進到下一位可行動角色；若本回合結束則進入下一回合或結束遊戲。
     */
    advance: function (state, rules) {
      if (!state || state.phase === "ended") return { status: "ended" };
      var order = Array.isArray(state.turnOrder) ? state.turnOrder : TurnManager.computeOrder(state);
      var index = Number(state.turnIndex);
      for (var i = index + 1; i < order.length; i += 1) {
        var candidate = getPlayer(state, order[i]);
        if (candidate && candidate.inPlay && !candidate.captured) {
          state.turnIndex = i;
          TurnManager.beginTurn(state, candidate.id);
          return { status: "turn", playerId: candidate.id };
        }
      }
      return TurnManager.endRound(state, rules);
    },

    endRound: function (state, rules) {
      ST.addLog(state, { type: "round", message: "第 " + state.round + " 回合結束。" });
      if (Number(state.round) >= Number(state.maxRound)) {
        var reason = Number(state.maxRound) <= 0
          ? "最大回合數已歸零（古堡探險），這回合的追捕者行動後遊戲結束。"
          : "已達最大回合數 " + state.maxRound + "，回合結束。";
        TurnManager.endGame(state, rules, rules.options.roundLimitWinner || "hider", reason);
        return { status: "ended", reason: "round-limit" };
      }
      state.round = Number(state.round) + 1;
      state.groupDice4 = {};
      return TurnManager.beginRound(state, rules);
    },

    /** 手動把行動權交給指定角色。 */
    setActive: function (state, rules, playerId) {
      var player = getPlayer(state, playerId);
      if (!player) return false;
      var order = Array.isArray(state.turnOrder) && state.turnOrder.length ? state.turnOrder.slice() : TurnManager.computeOrder(state);
      var index = order.indexOf(playerId);
      if (index < 0) {
        order.push(playerId);
        index = order.length - 1;
      }
      state.turnOrder = order;
      state.turnIndex = index;
      TurnManager.beginTurn(state, playerId);
      return true;
    },

    endGame: function (state, rules, winner, reason) {
      state.phase = "ended";
      state.movement = null;
      state.pendingCapture = null;
      state.pendingRelocation = null;
      state.result = {
        winner: winner === "seeker" ? "seeker" : "hider",
        winnerLabel: winner === "seeker" ? "追捕者獲勝" : "躲藏者逃脫",
        reason: reason || "",
        round: state.round,
        endedAt: new Date().toISOString()
      };
      ST.addLog(state, {
        type: "game",
        message: "遊戲結束：" + state.result.winnerLabel + "（" + state.result.reason + "）"
      });
      return state.result;
    },

    statusLabel: function (status) {
      return (status && status.label) || "特殊狀態";
    }
  };

  ST.TurnManager = TurnManager;
})(window.ST = window.ST || {});
