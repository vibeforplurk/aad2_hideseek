/*
 * 暮影領地捉迷藏｜遊戲引擎
 * ------------------------------------------------------------------
 * 將「事件 → 移動 → 途經 → 判定 → 回合」串成一套流程。
 * 所有函式都只修改傳入的 draft 狀態，由 ST.Store.commit 負責存檔與撤銷。
 */
(function (ST) {
  "use strict";

  function getPlayer(state, id) {
    return state.players.filter(function (p) { return p.id === id; })[0] || null;
  }

  function active(state) {
    return getPlayer(state, state.activePlayerId);
  }

  function number(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function normalizeDrawValue(value) {
    if (value === "P") return "吉";
    if (value === "骨") return "凶";
    return value;
  }

  function syntaxForChecks(checks) {
    if (!checks || !checks.length) return "（無需擲骰）";
    return checks.map(function (check) {
      return "(" + (check.type || check.key || "draw") + ")";
    }).join(" ");
  }

  function uniqueList(list) {
    var result = [];
    (list || []).forEach(function (item) {
      if (result.indexOf(item) < 0) result.push(item);
    });
    return result;
  }

  function outcomeFor(rule, role, key) {
    if (!rule) return null;
    var table = rule.roleOutcomes ? rule.roleOutcomes[role] || {} : rule.outcomes || {};
    if (key != null && table[key]) return table[key];
    if (table["default"]) return table["default"];
    var keys = Object.keys(table);
    if (!key && keys.length === 1) return table[keys[0]];
    return null;
  }

  function describeEffect(effect) {
    switch (effect.type) {
      case "stepMod": return "移動步數 " + (Number(effect.value) > 0 ? "+" : "") + Number(effect.value);
      case "maxRoundMod": return "最大回合數 " + (Number(effect.value) > 0 ? "+" : "") + Number(effect.value);
      case "stepDice": return "本回合步數改用 dice" + effect.dice;
      case "extraMove": return "原移動後額外移動 dice" + effect.dice;
      case "bonusDice": return "額外移動 dice" + effect.dice;
      case "cancelRemaining": return "取消剩餘步數";
      case "reverseDirection": return "剩餘步數改往反方向";
      case "resumeDice": return "重新擲 dice" + effect.dice + (effect.direction === "reverse" ? "（反方向）" : "（原方向）");
      case "passByLock": return "本回合不觸發途經";
      case "allowRefusePassBy": return "可拒絕一次途經";
      case "eventLock": return "接下來 " + (effect.turns || 1) + " 次行動無法觸發事件";
      case "endTurn": return "結束本回合行動";
      case "cancelMovement": return "本回合移動取消";
      case "teleport": return "傳送至 " + (effect.target === "anyFacility" ? "任一設施" : effect.target);
      case "capture": return "捕獲角色";
      case "release": return "指定退場者返場";
      case "retire": return "目前角色退場";
      case "note": return effect.text || "";
      default: return "";
    }
  }

  function describeEffects(effects) {
    return (effects || []).map(describeEffect).filter(Boolean).join("；");
  }

  function applyEffects(draft, rules, effects, context) {
    var messages = [];
    var notes = [];
    context = context || {};
    var player = context.player || active(draft);

    (effects || []).forEach(function (effect) {
      switch (effect.type) {
        case "stepMod":
          draft.turnFlags.stepMod += Number(effect.value || 0);
          messages.push("步數 " + (Number(effect.value) > 0 ? "+" : "") + Number(effect.value || 0));
          break;
        case "maxRoundMod":
          draft.maxRound = Math.max(-99, Math.min(99, Number(draft.maxRound) + Number(effect.value || 0)));
          messages.push("最大回合數改為 " + draft.maxRound);
          if (draft.maxRound <= 0) {
            notes.push("最大回合數已歸零，這回合的追捕者行動後遊戲結束。");
          }
          break;
        case "stepDice":
          draft.turnFlags.stepDice = Number(effect.dice) || 6;
          messages.push("本回合步數改用 dice" + draft.turnFlags.stepDice);
          break;
        case "extraMove":
          draft.turnFlags.extraMove = {
            dice: Number(effect.dice) || 4,
            direction: effect.direction || "self",
            source: context.source || "事件",
            used: false
          };
          messages.push("原移動結束後可額外移動 (dice" + (Number(effect.dice) || 4) + ")，可選新方向");
          break;
        case "bonusDice":
          draft.turnFlags.bonusDice.push({
            dice: Number(effect.dice) || 4,
            direction: effect.direction || "self",
            value: context.diceValue != null ? Number(context.diceValue) : null,
            source: context.source || ""
          });
          if (context.diceValue != null && isFinite(Number(context.diceValue))) {
            draft.turnFlags.bonusSteps += Number(context.diceValue);
            messages.push("額外步數 +" + Number(context.diceValue));
          } else {
            notes.push("需要主持人輸入 dice" + (effect.dice || 4) + " 作為額外步數。");
          }
          break;
        case "passByLock":
          draft.turnFlags.passByLocked = true;
          messages.push("本回合不觸發途經");
          break;
        case "allowRefusePassBy":
          draft.turnFlags.canRefusePassBy = true;
          messages.push("本回合可拒絕一次途經");
          break;
        case "eventLock":
          if (player) {
            player.statuses.push({
              key: "eventLock",
              label: "下一次行動無法觸發事件",
              remaining: Number(effect.turns) || 1,
              scope: rules.options.eventLockScope || "nextAction",
              createdAt: new Date().toISOString()
            });
          }
          messages.push("下一次行動無法觸發事件");
          break;
        case "endTurn":
          draft.turnFlags.endTurn = true;
          draft.turnFlags.skipMovement = true;
          draft.turnFlags.skipJudgment = true;
          messages.push("結束本回合行動");
          break;
        case "cancelMovement":
          draft.turnFlags.skipMovement = true;
          messages.push("本回合移動取消");
          break;
        case "teleport":
          var targetNode = context.teleportNode != null ? Number(context.teleportNode) : null;
          if (!targetNode) {
            throw new Error("傳送效果需要先選擇目的地格。");
          }
          if (!ST.MAP.getNode(targetNode) || ST.MAP.getNode(targetNode).type !== "facility") {
            throw new Error("傳送目的地必須是設施格。");
          }
          if (player) {
            player.position = targetNode;
            draft.arrivalCounter += 1;
            player.arrivalSeq = draft.arrivalCounter;
            messages.push("傳送至 " + ST.MAP.label(targetNode));
          }
          break;
        case "capture":
          var captureTarget = context.captureTargetId ? getPlayer(draft, context.captureTargetId) : player;
          if (captureTarget) {
            draft.pendingCapture = {
              playerId: captureTarget.id,
              playerName: ST.playerLabel(captureTarget),
              reason: context.source || "特殊事件",
              at: new Date().toISOString()
            };
            messages.push(ST.playerLabel(captureTarget) + " 遭捕獲（待確認）");
          }
          break;
        case "release":
          if (!context.releasePlayerId) {
            throw new Error("返場效果需要先指定退場者。");
          }
          var released = getPlayer(draft, context.releasePlayerId);
          if (!released) throw new Error("找不到指定的退場者。");
          var returnLimit = isFinite(Number(rules.options.returnLimit)) ? Number(rules.options.returnLimit) : 2;
          if (released.returnCount >= returnLimit) {
            throw new Error(ST.playerLabel(released) + " 已達返場次數上限（" + returnLimit + " 次）。");
          }
          var returnDice = Math.max(1, Math.min(20, number(context.returnDice, 1)));
          released.inPlay = true;
          released.captured = false;
          released.retired = false;
          released.retiredReason = "";
          released.capturedAt = null;
          released.capturedReason = "";
          released.position = returnDice;
          released.returnCount += 1;
          draft.arrivalCounter += 1;
          released.arrivalSeq = draft.arrivalCounter;
          released.statuses = [];
          messages.push(ST.playerLabel(released) + " 返場至第 " + returnDice + " 格（第 " + released.returnCount + " 次返場）");
          break;
        case "retire":
          var retireTarget = context.captureTargetId ? getPlayer(draft, context.captureTargetId) : player;
          if (retireTarget) {
            retireTarget.inPlay = false;
            retireTarget.captured = false;
            retireTarget.retired = true;
            retireTarget.retiredReason = context.source || "事件退場";
            messages.push(ST.playerLabel(retireTarget) + " 退場");
          }
          break;
        case "note":
          if (effect.text) notes.push(effect.text);
          break;
        default:
          notes.push("未支援的效果：" + effect.type);
      }
    });

    return { messages: messages, notes: notes };
  }

  var Engine = {
    getPlayer: getPlayer,
    describeEffect: describeEffect,
    describeEffects: describeEffects,
    normalizeDrawValue: normalizeDrawValue,
    syntaxForChecks: syntaxForChecks,

    /** 取得目前角色所在格的事件資訊。 */
    getEventInfo: function (state, rules) {
      var player = active(state);
      var result = { player: player, facility: null, event: null, available: false, reasons: [] };
      if (!player) {
        result.reasons.push("目前沒有行動角色。");
        return result;
      }
      var facility = ST.getFacilityRules(rules, player.position, state.mode);
      result.facility = facility;
      if (!facility) {
        result.reasons.push("第 " + player.position + " 格沒有設施。");
        return result;
      }
      var event = facility.event;
      result.event = event;
      if (!event || event.status === "none") {
        result.reasons.push("此格在目前模式沒有事件規則。");
        return result;
      }
      if (state.turnFlags.skipEvent) {
        result.reasons.push("本次行動無法觸發事件（黑薔薇莊園效果或人工指定）。");
        return result;
      }
      if (Number(facility.id) === 1 && state.mode === "multi") {
        if (player.role !== "hider") {
          result.reasons.push("接待廳的返場事件只能由躲藏者觸發。");
          return result;
        }
        var outHiders = state.players.filter(function (p) {
          return p.role === "hider" && (!p.inPlay || p.captured);
        });
        if (!outHiders.length) {
          result.reasons.push("目前沒有退場的躲藏者，接待廳沒有可返場的對象。");
          return result;
        }
        var limit = isFinite(Number(rules.options.returnLimit)) ? Number(rules.options.returnLimit) : 2;
        var eligible = outHiders.filter(function (p) { return Number(p.returnCount) < limit; });
        if (!eligible.length) {
          result.reasons.push("所有退場者都已達返場次數上限（" + limit + " 次）。");
          return result;
        }
      }
      if (Number(facility.id) === 5) {
        var seekerInPlay = state.players.filter(function (p) { return p.role === "seeker" && p.inPlay; })[0];
        var hidersInPlay = state.players.filter(function (p) { return p.role === "hider" && p.inPlay && !p.captured; });
        var sameCell = player.role === "hider"
          ? !!(seekerInPlay && Number(seekerInPlay.position) === Number(player.position))
          : hidersInPlay.some(function (hider) { return Number(hider.position) === Number(player.position); });
        if (sameCell) {
          result.reasons.push("參與者目前在同一格，血月裁決不進行額外 draw；系統改以停留判定處理。");
          return result;
        }
      }
      result.available = true;
      return result;
    },

    /** 取得目前事件的骰子需求（異常的 draw 會顯示為 coin）。 */
    checksFor: function (event, player, mode) {
      if (!event || !event.checks) return [];
      return event.checks.map(function (check) {
        if (check.type === "draw" && mode === "multi" && player && player.role === "seeker") {
          return { key: check.key, type: "coin", label: (check.label || "draw") + "（異常使用 coin）" };
        }
        return check;
      });
    },

    /** 套用事件結果並進入下一個階段。 */
    applyEvent: function (draft, rules, options) {
      options = options || {};
      var player = active(draft);
      var info = Engine.getEventInfo(draft, rules);
      if (!info.available) throw new Error("目前無法處理事件：" + info.reasons.join("；"));
      var event = info.event;
      var value = normalizeDrawValue(options.value);
      var checks = Engine.checksFor(event, player, draft.mode);
      draft.turnResult = draft.turnResult || {};
      draft.turnResult.eventCheckSyntax = syntaxForChecks(checks);
      if (value === "特殊" && draft.mode === "multi" && player.role === "seeker") {
        draft.turnResult.eventFacilityId = info.facility.id;
        draft.turnResult.eventFacilityName = info.facility.name;
        draft.turnResult.eventResult = "coin 特殊：移動到距離最近的躲藏者並捕獲。";
        draft.movement = null;
        Engine.moveToNearestAndCapture(draft, rules);
        draft.phase = "judgment";
        ST.addLog(draft, {
          type: "event",
          actorId: player.id,
          message: "事件｜" + info.facility.name + "（coin 特殊）：異常移動到最近躲藏者並捕獲。"
        });
        return { special: true };
      }
      var outcome = outcomeFor(event, player.role, value);
      if (!outcome) {
        if (!value) throw new Error("請先選擇事件判定結果。");
        throw new Error("規則資料中沒有「" + value + "」對應的結果。");
      }
      var context = {
        role: player.role,
        player: player,
        source: info.facility.name + " 事件",
        diceValue: options.diceValue != null ? options.diceValue : null,
        teleportNode: options.teleportNode,
        releasePlayerId: options.releasePlayerId,
        returnDice: options.returnDice
      };
      var applied = applyEffects(draft, rules, outcome.effects || [], context);

      draft.turnResult = draft.turnResult || {};
      draft.turnResult.eventFacilityId = info.facility.id;
      draft.turnResult.eventFacilityName = info.facility.name;
      draft.turnResult.eventResult = outcome.text || "";
      draft.turnResult.eventDetail = applied.messages.concat(applied.notes).join("；");

      ST.addLog(draft, {
        type: "event",
        actorId: player.id,
        message: "事件｜" + info.facility.name + (value ? "（" + value + "）" : "") + "：" +
          (outcome.text || "") + (applied.messages.length ? "（" + applied.messages.join("；") + "）" : "")
      });

      if (draft.pendingCapture) {
        draft.phase = "judgment";
        draft.turnFlags.skipMovement = true;
      } else if (draft.turnFlags.endTurn) {
        draft.phase = "judgment";
      } else {
        draft.phase = "movement";
      }
      return { outcome: outcome, messages: applied.messages, notes: applied.notes, info: info };
    },

    skipEvent: function (draft, rules) {
      var player = active(draft);
      draft.phase = "movement";
      ST.addLog(draft, {
        type: "event",
        actorId: player ? player.id : null,
        message: "跳過事件階段。"
      });
    },

    /** 開始移動（建立預覽工作階段，尚未改變角色位置）。 */
    startMovement: function (draft, rules, options) {
      options = options || {};
      var player = active(draft);
      if (!player) throw new Error("目前沒有行動角色。");
      if (draft.turnFlags.skipMovement) {
        draft.phase = "judgment";
        return { skipped: true };
      }
      var flags = draft.turnFlags;
      var kind = options.kind === "extra" ? "extra" : "base";
      var baseRecord = draft.turnResult.baseMovement || null;
      if (kind === "extra") {
        if (!flags.extraMove || flags.extraMove.used) throw new Error("沒有待處理的額外移動。");
        if (!baseRecord) throw new Error("請先完成原本的移動。");
      } else if (baseRecord && flags.extraMove && !flags.extraMove.used) {
        throw new Error("原移動已完成，請先處理額外移動。");
      }

      var requested = Math.max(0, number(options.steps, 0));
      var finalSteps = Math.max(0, number(options.total, requested));
      var direction = kind === "extra"
        ? number(options.direction, 1)
        : (flags.forcedDirection != null ? Number(flags.forcedDirection) : number(options.direction, 1));
      var session = ST.Movement.create(draft, rules, {
        steps: finalSteps,
        direction: direction,
        passByLocked: !!flags.passByLocked,
        canRefusePassBy: !!flags.canRefusePassBy,
        kind: kind,
        alreadyTriggered: kind === "extra" && baseRecord ? baseRecord.triggered : [],
        priorPath: kind === "extra" && baseRecord ? baseRecord.path : null
      });
      session.baseSteps = options.baseSteps != null ? Number(options.baseSteps) : requested;
      session.stepMod = options.stepMod != null ? Number(options.stepMod) : Number(flags.stepMod || 0);
      session.bonusSteps = options.bonusSteps != null ? Number(options.bonusSteps) : Number(flags.bonusSteps || 0);
      session.groupDiceUsed = !!options.groupDiceUsed;
      session.groupDiceValue = Number(options.groupDiceValue) || 0;
      draft.movement = session;
      draft.phase = "movement";
      ST.addLog(draft, {
        type: "movement",
        actorId: player.id,
        message: (kind === "extra" ? "額外移動預覽｜" : "移動預覽｜") + ST.playerLabel(player) + " 往" +
          ST.Movement.directionLabel(session.direction) + "共 " + session.stepsTotal + " 格" +
          (kind === "extra" ? "（額外 dice4）" : "（基礎 " + session.baseSteps +
            (session.stepMod ? "、修正 " + session.stepMod : "") +
            (session.bonusSteps ? "、額外 " + session.bonusSteps : "") + "）") + "。"
      });
      return { session: session, finalSteps: finalSteps };
    },

    /** 套用目前停下來的途經效果。 */
    applyPassBy: function (draft, rules, options) {
      var session = draft.movement;
      if (!session || !session.pending) throw new Error("目前沒有待處理的途經效果。");
      var facility = ST.getFacilityRules(rules, session.pending.nodeId, draft.mode);
      var rule = facility.passBy;
      var value = normalizeDrawValue(options.value);
      var outcome = outcomeFor(rule, session.playerRole, value);
      if (!outcome) throw new Error("規則資料中沒有「" + (value || "未選擇") + "」對應的途經結果。");
      var player = getPlayer(draft, session.playerId);
      if (value === "特殊" && draft.mode === "multi" && session.playerRole === "seeker") {
        draft.movement = null;
        Engine.moveToNearestAndCapture(draft, rules);
        draft.phase = "judgment";
        ST.addLog(draft, {
          type: "passby",
          actorId: session.playerId,
          message: "途經｜coin 特殊：異常移動到最近躲藏者並捕獲。"
        });
        return { special: true };
      }
      var result = ST.Movement.applyPassBy(session, rules, {
        facilityName: facility.name,
        outcome: outcome,
        outcomeKey: value,
        diceValue: options.diceValue
      });
      var applied = applyEffects(draft, rules, result.external, {
        role: session.playerRole,
        player: player,
        source: facility.name + " 途經",
        diceValue: options.diceValue
      });
      ST.Movement.walk(session, rules);
      draft.movement = session;
      draft.turnResult = draft.turnResult || {};
      draft.turnResult.passByCheckSyntax = syntaxForChecks(Engine.checksFor(rule, player, draft.mode));
      draft.turnResult.passByText = facility.name + "：" + (outcome.text || "") +
        (result.messages.length ? "（" + result.messages.join("；") + "）" : "");
      ST.addLog(draft, {
        type: "passby",
        actorId: session.playerId,
        message: "途經｜" + facility.name + (value ? "（" + value + "）" : "") + "：" +
          (outcome.text || "") + (result.messages.length ? "（" + result.messages.join("；") + "）" : "")
      });
      if (draft.pendingCapture) {
        draft.phase = "judgment";
      }
      return { messages: result.messages, applied: applied };
    },

    refusePassBy: function (draft, rules) {
      var session = draft.movement;
      if (!session) throw new Error("目前沒有進行中的移動。");
      var result = ST.Movement.refusePassBy(session);
      if (!result.ok) throw new Error(result.message);
      ST.Movement.walk(session, rules);
      draft.movement = session;
      ST.addLog(draft, { type: "passby", actorId: session.playerId, message: result.message });
      return result;
    },

    stopMovement: function (draft) {
      var session = draft.movement;
      if (!session) throw new Error("目前沒有進行中的移動。");
      var player = getPlayer(draft, session.playerId);
      ST.Movement.stop(session);
      ST.addLog(draft, { type: "movement", actorId: session.playerId, message: ST.playerLabel(player) + " 就地停止移動。" });
      return session;
    },

    /** 確認移動，正式更新角色位置。 */
    confirmMovement: function (draft, rules) {
      var session = draft.movement;
      var check = ST.Movement.validate(session);
      if (!check.ok) throw new Error(check.errors.join("；"));
      var player = getPlayer(draft, session.playerId);
      var previous = player.position;
      var actualSteps = Math.max(0, session.path.length - 1);
      player.position = session.endPosition;
      if (actualSteps > 0) {
        draft.arrivalCounter += 1;
        player.arrivalSeq = draft.arrivalCounter;
      }
      if (session.groupDiceUsed) {
        draft.groupDice4 = draft.groupDice4 || {};
        delete draft.groupDice4[player.id];
      }

      var record = {
        playerId: player.id,
        playerName: player.name,
        playerCharacter: player.characterName,
        startPosition: session.startPosition,
        endPosition: session.endPosition,
        direction: session.direction,
        directionLabel: ST.Movement.directionLabel(session.direction),
        steps: actualSteps,
        path: session.path.slice(),
        triggered: session.triggered.slice(),
        resolved: session.resolved.slice(),
        notes: session.notes.slice(),
        kind: session.kind,
        at: new Date().toISOString()
      };

      draft.turnResult = draft.turnResult || {};
      draft.turnResult.movementStart = session.startPosition;
      draft.turnResult.movementEnd = session.endPosition;
      draft.turnResult.movementSteps = actualSteps;
      draft.turnResult.movementDirection = ST.Movement.directionLabel(session.direction);
      draft.turnResult.movementCheckSyntax = "(" + (draft.turnFlags.stepDice ? "dice" + draft.turnFlags.stepDice : "dice4") + ")";
      draft.movement = null;

      if (session.kind === "extra") {
        var base = draft.turnResult.baseMovement || draft.lastMovement;
        if (!base) throw new Error("找不到原本的移動紀錄。");
        var merged = {
          playerId: player.id,
          playerName: player.name,
          playerCharacter: player.characterName,
          startPosition: base.startPosition,
          endPosition: record.endPosition,
          direction: base.direction,
          directionLabel: base.directionLabel,
          steps: base.steps + record.steps,
          path: base.path.concat(record.path.slice(1)),
          triggered: uniqueList(base.triggered.concat(record.triggered)),
          resolved: base.resolved.concat(record.resolved),
          notes: base.notes.concat(record.notes),
          extraStart: record.startPosition,
          extraEnd: record.endPosition,
          extraDirection: record.direction,
          extraDirectionLabel: record.directionLabel,
          extraSteps: record.steps,
          at: new Date().toISOString()
        };
        draft.lastMovement = merged;
        draft.turnResult.movementEnd = merged.endPosition;
        draft.turnResult.movementSteps = merged.steps;
        draft.turnResult.movementDirection = merged.directionLabel;
        draft.turnResult.extraMoveText = "額外移動 (dice4) " + record.steps + " 格（" + record.directionLabel + "）";
        if (draft.turnFlags.extraMove) draft.turnFlags.extraMove.used = true;
        draft.phase = "judgment";
        ST.addLog(draft, {
          type: "movement",
          actorId: player.id,
          message: "額外移動｜" + ST.playerLabel(player) + " 從 " + ST.MAP.label(previous) + " 往" +
            record.directionLabel + "移動 " + actualSteps + " 格，抵達 " + ST.MAP.label(record.endPosition) + "。"
        });
        return merged;
      }

      draft.lastMovement = record;
      draft.turnResult.baseMovement = record;
      if (draft.turnFlags.extraMove && !draft.turnFlags.extraMove.used) {
        draft.phase = "movement";
        ST.addLog(draft, {
          type: "movement",
          actorId: player.id,
          message: "原移動結束｜" + ST.playerLabel(player) + " 抵達 " + ST.MAP.label(record.endPosition) +
            "，可額外移動 (dice4)，請選擇是否使用與方向。"
        });
        return Object.assign({ awaitingExtra: true }, record);
      }

      draft.phase = "judgment";
      ST.addLog(draft, {
        type: "movement",
        actorId: player.id,
        message: "移動｜" + ST.playerLabel(player) + " 從 " + ST.MAP.label(previous) + " 往" +
          record.directionLabel + "移動 " + actualSteps + " 格，抵達 " + ST.MAP.label(record.endPosition) + "。"
      });
      return record;
    },

    /** 血月裁決：原移動後放棄額外移動，直接進入判定。 */
    skipExtraMove: function (draft) {
      if (!draft.turnFlags.extraMove || draft.turnFlags.extraMove.used) return;
      draft.turnFlags.extraMove.used = true;
      draft.turnResult.extraMoveText = "額外移動：放棄";
      draft.phase = "judgment";
      ST.addLog(draft, {
        type: "movement",
        actorId: draft.activePlayerId,
        message: "額外移動｜主持人選擇放棄額外移動。"
      });
    },

    /** 目前判定的所有情境。 */
    judgmentInfo: function (state, rules) {
      return ST.Judgment.analyze(state, rules);
    },

    /**
     * 套用一個判定結果。value 為骰子結果或 "capture"／"skip"。
     */
    applyJudgment: function (draft, rules, options) {
      options = options || {};
      var info = Engine.judgmentInfo(draft, rules);
      var situation = info.situations.filter(function (item) { return item.id === options.situationId; })[0];
      if (!situation) throw new Error("找不到要套用的判定情境。");
      var value = normalizeDrawValue(options.value);
      var message = "";
      draft.turnResult = draft.turnResult || {};
      draft.turnResult.judgmentCheckSyntax = situation.diceType === "coin"
        ? "(coin)"
        : situation.diceType === "draw" ? "(draw)" : "（無需擲骰）";

      if (situation.kind === "seeker-stay") {
        if (value === "capture") {
          Engine.capture(draft, rules, situation.targetId, "追捕者停留在躲藏者所在格");
          message = "追捕者與 " + situation.targetName + " 同格，確認捕獲。";
        } else {
          message = "主持人裁定此判定不成立。";
        }
      } else if (situation.kind === "seeker-pass") {
        if (value === "吉") {
          Engine.capture(draft, rules, situation.targetId, "追捕者途經躲藏者所在格（draw 吉）");
          message = "draw 吉：追捕者發現了 " + situation.targetName + "，遊戲結束。";
        } else if (value === "特殊" && draft.mode === "multi") {
          Engine.moveToNearestAndCapture(draft, rules);
          message = "coin 特殊：異常移動到最近的躲藏者並捕獲。";
        } else if (value === "凶" || value === "骨") {
          message = "未發現躲藏者，判定結束。";
        } else if (value === "skip") {
          message = "主持人裁定此判定不成立。";
        } else {
          throw new Error("請先輸入 draw／coin 結果。");
        }
      } else if (situation.kind === "hider-stay") {
        if (value === "凶") {
          Engine.capture(draft, rules, situation.targetId, "躲藏者停留在追捕者所在格（draw 凶）");
          message = "draw 凶：" + situation.targetName + " 遭追捕者捕獲。";
        } else if (value === "吉") {
          message = "draw 吉：" + situation.targetName + " 未被捕獲。";
        } else if (value === "skip") {
          message = "主持人裁定此判定不成立。";
        } else {
          throw new Error("請先輸入 draw 結果。");
        }
      } else if (situation.kind === "hider-pass") {
        if (value === "吉") {
          draft.turnFlags.pendingEscape = true;
          draft.turnResult.judgmentText = "draw 吉：可加骰 dice4 按原方向加速逃離。";
          message = "draw 吉：請輸入 dice4 並加速逃離。";
        } else if (value === "凶") {
          message = "draw 凶：未被發現。";
        } else if (value === "skip") {
          message = "主持人裁定此判定不成立。";
        } else {
          throw new Error("請先輸入 draw 結果。");
        }
      }

      ST.addLog(draft, {
        type: "judgment",
        actorId: draft.activePlayerId,
        message: "判定｜" + situation.title + (value ? "（" + value + "）" : "") + "：" + message
      });
      draft.turnResult.judgmentText = message;
      draft.turnResult.resolvedJudgments = draft.turnResult.resolvedJudgments || [];
      draft.turnResult.resolvedJudgments.push({ id: situation.id, value: value, at: new Date().toISOString() });
      return { message: message, situation: situation, needsEscape: !!draft.turnFlags.pendingEscape };
    },

    /** 躲藏者途經追捕者且 draw 吉：加骰 dice4 加速逃離。 */
    resolveEscape: function (draft, rules, diceValue) {
      var info = Engine.judgmentInfo(draft, rules);
      var player = active(draft);
      if (!player) throw new Error("目前沒有行動角色。");
      var steps = Math.max(1, Math.min(4, number(diceValue, 1)));
      var direction = draft.lastMovement ? draft.lastMovement.direction : 1;
      var session = ST.Movement.create(draft, rules, {
        steps: steps,
        direction: direction,
        passByLocked: true,
        canRefusePassBy: false
      });
      player.position = session.endPosition;
      draft.arrivalCounter += 1;
      player.arrivalSeq = draft.arrivalCounter;
      if (draft.lastMovement) {
        draft.lastMovement.path = draft.lastMovement.path.concat(session.path.slice(1));
        draft.lastMovement.endPosition = session.endPosition;
        draft.lastMovement.steps += steps;
      }
      draft.turnResult.escaped = true;
      draft.turnResult.judgmentText = "加速逃離 dice4=" + steps + "，往" + ST.Movement.directionLabel(direction) + "移動至 " + ST.MAP.label(session.endPosition) + "。";
      draft.turnFlags.pendingEscape = false;
      ST.addLog(draft, {
        type: "judgment",
        actorId: player.id,
        message: "加速逃離｜" + ST.playerLabel(player) + " 額外往" + ST.Movement.directionLabel(direction) + "移動 " + steps + " 格，抵達 " + ST.MAP.label(session.endPosition) + "。"
      });
      return { steps: steps, position: session.endPosition, situations: info.situations };
    },

    /** 多人模式 coin 特殊：移動到最近的躲藏者並捕獲。 */
    moveToNearestAndCapture: function (draft, rules) {
      var nearest = ST.Judgment.nearestHider(draft);
      var seeker = draft.players.filter(function (p) { return p.role === "seeker"; })[0];
      if (!nearest || !seeker) throw new Error("找不到可捕獲的躲藏者。");
      seeker.position = nearest.hider.position;
      draft.arrivalCounter += 1;
      seeker.arrivalSeq = draft.arrivalCounter;
      Engine.capture(draft, rules, nearest.hider.id, "coin 特殊：移動到最近躲藏者並捕獲");
      draft.turnFlags.endTurn = true;
      draft.turnFlags.skipMovement = true;
      draft.turnFlags.skipJudgment = true;
      ST.addLog(draft, {
        type: "judgment",
        actorId: seeker.id,
        message: "coin 特殊｜異常移動到第 " + seeker.position + " 格，捕獲 " + nearest.hider.name + "。"
      });
      return nearest;
    },

    /** 套用捕獲。1V1 直接結束遊戲；多人模式退場並繼續。 */
    capture: function (draft, rules, playerId, reason) {
      var player = getPlayer(draft, playerId);
      if (!player) throw new Error("找不到要被捕獲的角色。");
      player.captured = true;
      player.inPlay = false;
      player.capturedAt = new Date().toISOString();
      player.capturedReason = reason || "";
      draft.pendingCapture = null;
      ST.addLog(draft, {
        type: "capture",
        actorId: player.id,
        message: "捕獲｜" + ST.playerLabel(player) + " 遭捕獲退場" + (reason ? "（" + reason + "）" : "") + "。"
      });
      var aliveHiders = draft.players.filter(function (p) { return p.role === "hider" && p.inPlay && !p.captured; });
      if (draft.mode === "1v1") {
        ST.TurnManager.endGame(draft, rules, "seeker", "躲藏者遭捕獲。");
      } else {
        draft.turnFlags.endTurn = true;
        draft.turnFlags.skipMovement = true;
        draft.turnFlags.skipJudgment = true;
        if (aliveHiders.length) {
          draft.pendingRelocation = {
            capturedId: player.id,
            capturedName: ST.playerLabel(player),
            round: draft.round,
            at: new Date().toISOString()
          };
        } else {
          draft.pendingRelocation = null;
        }
        if (!aliveHiders.length) {
          ST.TurnManager.endGame(draft, rules, "seeker", "所有躲藏者皆遭捕獲。");
        }
      }
      return player;
    },

    endGame: function (draft, rules, winner, reason) {
      return ST.TurnManager.endGame(draft, rules, winner, reason);
    },

    /** 完成目前角色的行動，換下一位。 */
    finishTurn: function (draft, rules) {
      if (draft.phase === "ended") return { status: "ended" };
      if (draft.pendingRelocation) {
        draft.pendingRelocation = null;
        ST.addLog(draft, { type: "movement", message: "退場後移動尚未處理，已隨行動結束略過。" });
      }
      var player = active(draft);
      if (player) {
        ST.addLog(draft, {
          type: "turn",
          actorId: player.id,
          message: ST.playerLabel(player) + " 結束行動。"
        });
      }
      var aliveHiders = draft.players.filter(function (p) { return p.role === "hider" && p.inPlay && !p.captured; });
      if (draft.mode === "multi" && !aliveHiders.length) {
        ST.TurnManager.endGame(draft, rules, "seeker", "所有躲藏者皆遭捕獲。");
        return { status: "ended" };
      }
      var result = ST.TurnManager.advance(draft, rules);
      return result;
    },

    /** 手動移動角色（不觸發途經與事件）。 */
    movePlayer: function (draft, playerId, nodeId, note) {
      var player = getPlayer(draft, playerId);
      if (!player) throw new Error("找不到角色。");
      var target = Math.max(1, Math.min(20, number(nodeId, player.position)));
      var previous = player.position;
      player.position = target;
      draft.arrivalCounter += 1;
      player.arrivalSeq = draft.arrivalCounter;
      ST.addLog(draft, {
        type: "manual",
        actorId: player.id,
        message: "手動移動｜" + ST.playerLabel(player) + " 從 " + ST.MAP.label(previous) + " 移到 " + ST.MAP.label(target) +
          (note ? "（" + note + "）" : "") + "。"
      });
      return player;
    },

    /** 多人模式同格加骰：輸入 N 次 draw；全吉或全凶時，各躲藏者移動時可多骰一次 dice4。 */
    applyGroupDraw: function (draft, rules, options) {
      var cell = Number(options.cell);
      var draws = (options.draws || []).map(normalizeDrawValue);
      var hiders = draft.players.filter(function (p) {
        return p.role === "hider" && p.inPlay && !p.captured && Number(p.position) === cell;
      });
      if (hiders.length < 2) throw new Error("該格沒有複數躲藏者。");
      if (draws.length !== hiders.length) throw new Error("需要輸入 " + hiders.length + " 次 draw 結果。");
      draws.forEach(function (value) {
        if (value !== "吉" && value !== "凶") throw new Error("draw 結果只能是吉或凶。");
      });
      var allSame = draws.every(function (value) { return value === draws[0]; });
      draft.groupDice4 = draft.groupDice4 || {};
      draft.groupDraws = draft.groupDraws || {};
      draft.groupDraws[draft.round + ":" + cell] = true;
      if (allSame) {
        hiders.forEach(function (hider) {
          draft.groupDice4[hider.id] = (Number(draft.groupDice4[hider.id]) || 0) + 1;
        });
      }
      ST.addLog(draft, {
        type: "judgment",
        message: "多人同格判定｜第 " + cell + " 格 " + hiders.length + " 位躲藏者 draw：" + draws.join("、") +
          (allSame ? "，全部相同，本回合這幾位躲藏者移動時可各多骰一次 (dice4)。" : "，結果不同，不觸發額外加骰。")
      });
      return { allSame: allSame, hiders: hiders };
    },

    /** 退場後其他躲藏者的選擇性移動（骰 dice20，不觸發途經）。 */
    applyPostCaptureMoves: function (draft, rules, moves) {
      if (!draft.pendingRelocation) return;
      (moves || []).forEach(function (move) {
        var player = getPlayer(draft, move.playerId);
        if (!player || !player.inPlay || player.captured) return;
        var target = Math.max(1, Math.min(20, number(move.position, player.position)));
        player.position = target;
        draft.arrivalCounter += 1;
        player.arrivalSeq = draft.arrivalCounter;
        ST.addLog(draft, {
          type: "movement",
          actorId: player.id,
          message: "退場後移動｜" + ST.playerLabel(player) + " 選擇移動到 " + ST.MAP.label(target) + "（不觸發途經）。"
        });
      });
      draft.pendingRelocation = null;
    },

    skipPostCaptureMoves: function (draft) {
      if (!draft.pendingRelocation) return;
      ST.addLog(draft, {
        type: "movement",
        message: "退場後移動｜其餘躲藏者選擇不移動。"
      });
      draft.pendingRelocation = null;
    },

    /** 轉換階段（主持人手動指定）。 */
    setPhase: function (draft, phase) {
      if (ST.Store.PHASES.indexOf(phase) < 0) throw new Error("階段不合法。");
      draft.phase = phase;
      if (phase !== "movement") draft.movement = null;
      ST.addLog(draft, { type: "manual", message: "手動切換至" + ({ event: "事件", movement: "移動", judgment: "判定", ended: "結束" }[phase] || phase) + "階段。" });
    }
  };

  ST.Engine = Engine;
})(window.ST = window.ST || {});
