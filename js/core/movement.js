/*
 * 暮影領地捉迷藏｜移動計算
 * ------------------------------------------------------------------
 * 20 格環狀地圖移動、途經偵測、途經效果套用。
 * 移動採「預覽 → 逐站解決途經 → 確認套用」流程，確認前不會改變角色位置。
 */
(function (ST) {
  "use strict";

  var MAX_STEPS = 200;

  function directionLabel(direction) {
    return Number(direction) < 0 ? "逆時針" : "順時針";
  }

  function clamp(value, min, max) {
    var n = Number(value);
    if (!isFinite(n)) n = min;
    return Math.min(max, Math.max(min, n));
  }

  var Movement = {
    directionLabel: directionLabel,

    /**
     * 建立移動工作階段。
     * options: { steps, direction, bonusSteps, passByLocked, canRefusePassBy }
     */
    create: function (state, rules, options) {
      options = options || {};
      if (!state.activePlayerId) throw new Error("目前沒有行動角色。");
      var player = state.players.filter(function (item) { return item.id === state.activePlayerId; })[0];
      if (!player) throw new Error("找不到行動角色。");
      var steps = clamp(options.steps, 0, MAX_STEPS);
      var bonus = clamp(options.bonusSteps || 0, 0, MAX_STEPS);
      var total = steps + bonus;
      var direction = Number(options.direction) < 0 ? -1 : 1;
      var session = {
        id: ST.uid("mv"),
        playerId: player.id,
        playerRole: player.role,
        mode: state.mode,
        kind: options.kind === "extra" ? "extra" : "base",
        startPosition: player.position,
        direction: direction,
        originalDirection: direction,
        requestedSteps: steps,
        bonusSteps: bonus,
        stepsTotal: total,
        remainingSteps: total,
        path: [player.position],
        priorPath: Array.isArray(options.priorPath) ? options.priorPath.slice() : null,
        visited: [],
        facilities: [],
        triggered: Array.isArray(options.alreadyTriggered) ? options.alreadyTriggered.slice() : [],
        resolved: [],
        pending: null,
        pendingIndex: 0,
        passByLocked: !!options.passByLocked,
        canRefusePassBy: !!options.canRefusePassBy,
        refused: false,
        status: total > 0 ? "moving" : "ready",
        endPosition: total > 0 ? null : player.position,
        adjustments: [],
        notes: [],
        createdAt: new Date().toISOString()
      };
      return Movement.walk(session, rules);
    },

    canTrigger: function (session, facility, rules) {
      if (!facility || !facility.passBy) return false;
      if (facility.passBy.status === "none") return false;
      if (session.passByLocked) return false;
      if (session.triggered.indexOf(facility.id) >= 0) return false;
      if (!rules.options.allowMultiplePassBy && session.triggered.length > 0) return false;
      return true;
    },

    /**
     * 沿著路徑前進，遇到需要處理的途經設施即停下。
     */
    walk: function (session, rules) {
      if (session.status === "encounter") return session;
      if (session.status === "ready") return session;
      session.status = "moving";
      var guard = 0;
      while (session.remainingSteps > 0 && guard < MAX_STEPS) {
        guard += 1;
        var last = session.path[session.path.length - 1];
        var next = ST.MAP.step(last, session.direction, 1);
        session.path.push(next);
        session.remainingSteps -= 1;
        session.visited.push({ nodeId: next, remaining: session.remainingSteps, direction: session.direction });

        var isEndpoint = session.remainingSteps === 0;
        var facility = ST.getFacilityRules(rules, next, session.mode);
        if (facility && facility.passBy) {
          var node = ST.MAP.getNode(next);
          if (session.facilities.indexOf(next) < 0) {
            session.facilities.push(next);
          }
          var endpointAllowed = !isEndpoint || rules.options.endpointTriggersPassBy;
          if (endpointAllowed && Movement.canTrigger(session, facility, rules)) {
            session.pending = {
              nodeId: next,
              facilityId: facility.id,
              facilityName: facility.name,
              passBy: facility.passBy,
              isEndpoint: isEndpoint
            };
            session.status = "encounter";
            return session;
          }
          if (isEndpoint && !rules.options.endpointTriggersPassBy) {
            session.notes.push({
              type: "endpoint",
              nodeId: next,
              message: "抵達 " + (node ? node.name || node.id + " 號格" : next) + "（終點不觸發途經）"
            });
          }
        }
        if (isEndpoint) break;
      }
      session.status = "ready";
      session.remainingSteps = 0;
      session.endPosition = session.path[session.path.length - 1];
      return session;
    },

    /** 套用一次途經結果。effects 由呼叫端依規則資料提供。 */
    applyPassBy: function (session, rules, options) {
      options = options || {};
      var outcome = options.outcome || { effects: [] };
      var external = [];
      var messages = [];
      var floor = rules.options.stepFloor || 0;

      (outcome.effects || []).forEach(function (effect) {
        switch (effect.type) {
          case "stepMod":
            session.remainingSteps = Math.max(floor, session.remainingSteps + Number(effect.value || 0));
            session.adjustments.push({ type: "stepMod", value: Number(effect.value || 0), source: options.facilityName });
            messages.push("步數 " + (Number(effect.value) > 0 ? "+" : "") + Number(effect.value || 0) + "（剩餘 " + session.remainingSteps + "）");
            break;
          case "cancelRemaining":
            session.remainingSteps = 0;
            messages.push("剩餘步數取消");
            break;
          case "reverseDirection":
            session.direction *= -1;
            messages.push("改往" + directionLabel(session.direction) + "行進");
            break;
          case "resumeDice":
            var dice = clamp(options.diceValue, 1, effect.dice || 4);
            session.remainingSteps += dice;
            if (effect.direction === "reverse") session.direction *= -1;
            session.adjustments.push({ type: "resumeDice", value: dice, direction: session.direction, source: options.facilityName });
            messages.push("重新行進 " + dice + " 格（" + directionLabel(session.direction) + "）");
            break;
          case "passByLock":
            session.passByLocked = true;
            messages.push("本回合不再觸發途經");
            break;
          case "allowRefusePassBy":
            session.canRefusePassBy = true;
            break;
          case "note":
            messages.push(effect.text || "");
            break;
          default:
            external.push(effect);
        }
      });

      if (session.pending) {
        session.resolved.push({
          facilityId: session.pending.facilityId,
          facilityName: session.pending.facilityName,
          nodeId: session.pending.nodeId,
          outcomeKey: options.outcomeKey || "",
          diceValue: options.diceValue != null ? options.diceValue : null,
          text: outcome.text || "",
          messages: messages.slice(),
          isEndpoint: session.pending.isEndpoint
        });
        session.triggered.push(session.pending.facilityId);
      }
      session.pending = null;
      session.pendingIndex = session.resolved.length;
      session.status = session.remainingSteps > 0 ? "moving" : "ready";
      if (session.remainingSteps <= 0) {
        session.endPosition = session.path[session.path.length - 1];
      }
      session.messages = messages;
      return { session: session, external: external, messages: messages };
    },

    /** 拒絕觸發途經（茶館事件提供的一次機會）。 */
    refusePassBy: function (session) {
      if (!session.canRefusePassBy || session.refused || !session.pending) {
        return { ok: false, message: "目前沒有可拒絕的途經。" };
      }
      var pending = session.pending;
      session.refused = true;
      session.canRefusePassBy = false;
      session.triggered.push(pending.facilityId);
      session.resolved.push({
        facilityId: pending.facilityId,
        facilityName: pending.facilityName,
        nodeId: pending.nodeId,
        outcomeKey: "拒絕",
        text: "主持人選擇拒絕觸發途經。",
        messages: []
      });
      session.pending = null;
      session.status = session.remainingSteps > 0 ? "moving" : "ready";
      if (session.remainingSteps <= 0) session.endPosition = session.path[session.path.length - 1];
      return { ok: true, message: "已拒絕觸發 " + pending.facilityName + " 的途經效果。" };
    },

    /** 就地停止移動。 */
    stop: function (session, reason) {
      session.remainingSteps = 0;
      session.pending = null;
      session.status = "ready";
      session.endPosition = session.path[session.path.length - 1];
      session.notes.push({ type: "stop", message: reason || "主持人手動停止移動。" });
      return session;
    },

    /** 取得目前移動的摘要，供面板與文字使用。 */
    summary: function (session) {
      if (!session) return null;
      return {
        startPosition: session.startPosition,
        endPosition: session.endPosition != null ? session.endPosition : session.path[session.path.length - 1],
        direction: session.direction,
        directionLabel: directionLabel(session.direction),
        stepsTotal: Math.max(0, session.path.length - 1),
        remainingSteps: session.remainingSteps,
        path: session.path.slice(),
        triggered: session.triggered.slice(),
        resolved: session.resolved.slice(),
        status: session.status
      };
    },

    /** 檢查移動工作階段是否可安全套用。 */
    validate: function (session) {
      var errors = [];
      if (!session) errors.push("沒有進行中的移動。");
      if (session && session.status === "encounter") errors.push("尚有途經效果尚未處理。");
      if (session && session.status !== "ready") errors.push("移動尚未結束。");
      return { ok: errors.length === 0, errors: errors };
    }
  };

  ST.Movement = Movement;
})(window.ST = window.ST || {});
