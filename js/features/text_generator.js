/*
 * 暮影領地捉迷藏｜Plurk 文字生成
 * ------------------------------------------------------------------
 * 文字只讀取目前狀態，不會推進回合或改變角色位置。
 * 模板固定提供；主持人可在「文字輸出」頁修改產出的文字後複製到 Plurk。
 */
(function (ST) {
  "use strict";

  function positionLabel(id) {
    var node = ST.MAP.getNode(id);
    if (!node) return "第 " + id + " 格";
    return node.name ? node.id + "．" + node.name : node.id + " 號格";
  }

  function formatDate(date, withTime) {
    var d = date || new Date();
    function pad(value) { return String(value).padStart(2, "0"); }
    var base = d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate());
    return withTime ? base + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) : base;
  }

  function stateLabel(player) {
    if (!player) return "";
    if (player.captured) return "已遭捕獲";
    if (!player.inPlay) return "已退場";
    return positionLabel(player.position);
  }

  function playerLine(player) {
    if (!player) return "";
    var role = player.role === "seeker" ? "追捕者" : "躲藏者";
    return (player.characterName || player.name) + "（" + role + "）：" + stateLabel(player);
  }

  function currentEventChecks(state, rules, player) {
    if (!state || !player || !rules) return [];
    var facility = ST.getFacilityRules(rules, player.position, state.mode);
    if (!facility || !facility.event || facility.event.status === "none") return [];
    return ST.Engine.checksFor(facility.event, player, state.mode);
  }

  function currentJudgmentSyntax(state, rules) {
    if (!state || !rules) return "";
    var info = ST.Judgment.analyze(state, rules);
    if (!info.situations.length) return "";
    var type = info.situations[0].diceType;
    return type ? "(" + type + ")" : "（無需擲骰）";
  }

  function facilityBlock(state, rules, active) {
    if (!state || !active) return "";
    var node = ST.MAP.getNode(active.position);
    var facility = node && node.type === "facility" ? ST.getFacilityRules(rules, node.id, state.mode) : null;
    if (!facility) return node.id + " 號格（一般格）";
    var left = facility.emojiLeft != null ? facility.emojiLeft : "";
    var right = facility.emojiRight != null ? facility.emojiRight : (facility.emoji || "");
    return left + "Rides" + facility.id + "." + facility.name + right +
      (facility.quote ? "\n" + facility.quote : "");
  }

  function eventSummary(state, rules) {
    if (!state) return "尚未建立遊戲。";
    var info = ST.Engine.getEventInfo(state, rules);
    if (!info.facility) return "此格沒有設施事件。";
    if (state.turnFlags.skipEvent) return "本次行動無法觸發事件。";
    if (!info.available) return info.reasons.join("；") || "此格沒有可觸發的事件。";
    if (!info.event || info.event.status === "none") return "此格沒有事件。";
    return info.event.summary || "";
  }

  function eventCheckPrompt(state, rules, active) {
    if (!state || !active) return "";
    var info = ST.Engine.getEventInfo(state, rules);
    if (!info.available || !info.event) return "";
    var checks = ST.Engine.checksFor(info.event, active, state.mode);
    if (!checks.length) return "";
    return "請擲 " + ST.Engine.syntaxForChecks(checks) + "。";
  }

  function movementInstruction(state, active) {
    if (!state) return "";
    var flags = state.turnFlags || {};
    var session = state.movement;
    if (flags.skipMovement) return "本回合移動取消。";
    if (session) {
      if (session.pending) return "移動停在 " + positionLabel(session.pending.nodeId) + "，請先處理途經。";
      if (session.status === "ready") return "移動已結束，請確認位置。";
      if (session.kind === "extra") return "請擲 (dice4) 進行額外移動，可重新選擇方向。";
    }
    if (flags.extraMove && !flags.extraMove.used && state.turnResult && state.turnResult.baseMovement) {
      return "原移動已結束。請擲 (dice4) 進行額外移動，可重新選擇方向。";
    }
    var syntax = "(" + (flags.stepDice ? "dice" + flags.stepDice : "dice4") + ")";
    var text = "請擲 " + syntax + " 決定移動步數，並選擇順時針或逆時針。";
    if (flags.forcedDirection != null) {
      text = "請擲 " + syntax + " 決定移動步數；本回合方向由事件決定：" +
        (Number(flags.forcedDirection) < 0 ? "逆時針" : "順時針") + "。";
    }
    if (active && state.groupDice4 && state.groupDice4[active.id]) {
      text += " 同格加骰：移動時可再擲一次 (dice4)。";
    }
    return text;
  }

  function passbyPrompt(state, rules, active) {
    if (!state || !state.movement || !state.movement.pending || !rules) return "";
    var pending = state.movement.pending;
    var facility = ST.getFacilityRules(rules, pending.nodeId, state.mode);
    if (!facility || !facility.passBy) return "";
    var checks = ST.Engine.checksFor(facility.passBy, active, state.mode);
    var prompt = "途經 " + facility.name + "：" + facility.passBy.summary;
    if (checks.length) prompt += "\n請擲 " + ST.Engine.syntaxForChecks(checks) + "。";
    return prompt;
  }

  function judgmentPositionLine(state, active) {
    if (!state || !active) return "";
    if (state.lastMovement) return "移動到 " + positionLabel(state.lastMovement.endPosition) + "。";
    return "目前位置 " + positionLabel(active.position) + "。";
  }

  function judgmentInstructions(state, rules) {
    if (!state) return "";
    if (state.pendingCapture) {
      return "捕獲待確認：" + state.pendingCapture.playerName + " 遭追捕者捕獲。";
    }
    var info = ST.Judgment.analyze(state, rules);
    if (!info.situations.length) return "本次沒有觸發遭遇判定。";
    return "本次判定：\n" + info.situations.map(function (situation) {
      var text = "";
      if (situation.kind === "seeker-stay") {
        text = state.mode === "multi"
          ? "追捕者停留在躲藏者停留處，捕獲最後抵達該格的躲藏者。"
          : "追捕者停留在躲藏者停留處，遊戲結束。";
      } else if (situation.kind === "seeker-pass") {
        text = "追捕者途經於躲藏者停留處，追捕者擲" + (situation.diceType === "coin" ? "(coin)" : "(draw)") + "。";
      } else if (situation.kind === "hider-stay") {
        text = "躲藏者停留在追捕者停留處，躲藏者擲(draw)。";
      } else if (situation.kind === "hider-pass") {
        text = "躲藏者途經於追捕者停留處，躲藏者擲(draw)，吉則移動加(dice4)。";
      } else {
        text = situation.title;
      }
      return "- " + text;
    }).join("\n");
  }

  function judgmentReference(state, active) {
    if (!state || !active) return "";
    if (active.role === "seeker") {
      return "判定條件：\n" +
        (state.mode === "multi"
          ? "- 追捕者停留在躲藏者停留處，捕獲最後抵達該格的躲藏者。\n"
          : "- 追捕者停留在躲藏者停留處，遊戲結束。\n") +
        "- 追捕者途經於躲藏者停留處，追捕者擲" + (state.mode === "multi" ? "(coin)" : "(draw)") + "。";
    }
    return "判定條件：\n" +
      "- 躲藏者停留在追捕者停留處，躲藏者擲(draw)。\n" +
      "- 躲藏者途經於追捕者停留處，躲藏者擲(draw)，吉則移動加(dice4)。";
  }

  function tagLine(player) {
    if (!player) return "";
    return ST.playerTag(player) + "（" + (player.characterName || player.name) + "）";
  }

  function positionLine(player) {
    if (!player) return "";
    return (player.characterName || player.name) + "：" + stateLabel(player);
  }

  function buildContext(state, rules, extra) {
    extra = extra || {};
    var active = state ? ST.Store.getActive(state) : null;
    var movement = state && state.lastMovement ? state.lastMovement : null;
    var turn = (state && state.turnResult) || {};
    var flags = (state && state.turnFlags) || {};
    var mode = ST.getMode(state ? state.mode : "1v1");
    var facilityId = active ? active.position : turn.eventFacilityId || null;
    var facility = facilityId ? ST.MAP.getNode(facilityId) : null;
    var facilityRules = facility && facility.type === "facility" ? ST.getFacilityRules(rules, facility.id, state.mode) : null;
    var eventFacility = turn.eventFacilityId ? ST.MAP.getNode(turn.eventFacilityId) : facility;
    var startId = movement ? movement.startPosition : turn.movementStart || (active ? active.position : null);
    var endId = movement ? movement.endPosition : turn.movementEnd || (active ? active.position : null);
    var hiders = state ? state.players.filter(function (p) { return p.role === "hider"; }) : [];
    var seeker = state ? state.players.filter(function (p) { return p.role === "seeker"; })[0] : null;
    var judgmentResult = state && state.phase === "ended" && state.result
      ? state.result.winnerLabel + "：" + state.result.reason
      : turn.judgmentText || (state && state.result ? state.result.winnerLabel + "：" + state.result.reason : "");
    var resultSentence = state && state.result
      ? (state.result.winner === "seeker" ? "追捕者捕獲躲藏者，遊戲結束。" : "躲藏者順利逃脫，遊戲結束。")
      : "";

    var eventChecks = currentEventChecks(state, rules, active);
    var eventCheckSyntax = turn.eventCheckSyntax || (eventChecks.length ? ST.Engine.syntaxForChecks(eventChecks) : "（無需擲骰）");
    var movementCheckSyntax = turn.movementCheckSyntax ||
      "(" + (flags.stepDice ? "dice" + flags.stepDice : "dice4") + ")";
    var passbyCheckSyntax = turn.passByCheckSyntax || "";
    if (!passbyCheckSyntax && state && state.movement && state.movement.pending && rules) {
      var pendingFacility = ST.getFacilityRules(rules, state.movement.pending.nodeId, state.mode);
      if (pendingFacility && pendingFacility.passBy) {
        passbyCheckSyntax = ST.Engine.syntaxForChecks(ST.Engine.checksFor(pendingFacility.passBy, active, state.mode));
      }
    }
    var judgmentCheckSyntax = turn.judgmentCheckSyntax || currentJudgmentSyntax(state, rules);

    return {
      round: state ? state.round : 1,
      max_round: state ? state.maxRound : mode.defaultMaxRound,
      mode_label: mode.label,
      player_name: active ? active.name : "",
      player_tag: active ? ST.playerTag(active) : "",
      character_name: active ? (active.characterName || active.name) : "",
      role_label: active ? (active.role === "seeker" ? mode.seekerLabel : mode.hiderLabel) : "",
      facility_id: facility ? facility.id : "",
      facility_name: facilityRules ? facilityRules.name : facility ? facility.name || facility.id + " 號格" : "無設施格",
      facility_emoji: facilityRules ? facilityRules.emoji || "" : "",
      facility_quote: facilityRules ? facilityRules.quote || "" : "",
      facility_block: facilityBlock(state, rules, active),
      event_facility_name: eventFacility ? (eventFacility.name || eventFacility.id + " 號格") : "無設施格",
      event_summary: eventSummary(state, rules),
      event_check_prompt: eventCheckPrompt(state, rules, active),
      start_position: startId ? positionLabel(startId) : "",
      end_position: endId ? positionLabel(endId) : "",
      position: active ? positionLabel(active.position) : "",
      movement_steps: movement ? movement.steps : turn.movementSteps || 0,
      movement_direction: movement ? movement.directionLabel : turn.movementDirection || "",
      movement_check_syntax: movementCheckSyntax,
      movement_instruction: movementInstruction(state, active),
      passby_prompt: passbyPrompt(state, rules, active),
      extra_movement: turn.extraMoveText || "",
      event_result: turn.eventResult || "",
      event_detail: turn.eventDetail || "",
      event_check_syntax: eventCheckSyntax,
      judgment_result: judgmentResult,
      result_sentence: resultSentence,
      judgment_check_syntax: judgmentCheckSyntax,
      judgment_position_line: judgmentPositionLine(state, active),
      judgment_instructions: judgmentInstructions(state, rules),
      judgment_reference: judgmentReference(state, active),
      passby_result: turn.passByText || "",
      passby_check_syntax: passbyCheckSyntax,
      dice_result: extra.dice || "",
      hiders: hiders.map(playerLine).join("、"),
      hider_tags: hiders.map(tagLine).join("、"),
      hider_positions: hiders.map(positionLine).join("、"),
      seeker: playerLine(seeker),
      seeker_tag: tagLine(seeker),
      seeker_position: positionLine(seeker),
      start_positions: state ? state.players.map(playerLine).join("\n") : "",
      time: formatDate(new Date(), true),
      date: formatDate(new Date(), false)
    };
  }

  function render(template, context) {
    var output = String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, function (match, key) {
      if (Object.prototype.hasOwnProperty.call(context, key)) {
        var value = context[key];
        return value == null ? "" : String(value);
      }
      return match;
    });
    return output.replace(/\n{3,}/g, "\n\n").replace(/\n+$/g, "");
  }

  var TextGenerator = {
    positionLabel: positionLabel,
    buildContext: buildContext,
    render: render,

    templates: function (rules) {
      return (rules && rules.templates) || ST.DEFAULT_TEXT_TEMPLATES || [];
    },

    getTemplate: function (rules, key) {
      return TextGenerator.templates(rules).filter(function (template) { return template.key === key; })[0] || null;
    },

    generate: function (key, state, rules, extra) {
      var template = TextGenerator.getTemplate(rules, key);
      if (!template || template.enabled === false) return "";
      var context = buildContext(state, rules, extra);
      return render(template.template, context);
    },

    generateFromText: function (text, state, rules, extra) {
      return render(text, buildContext(state, rules, extra));
    },

    /** 依目前流程推薦最適合的模板。 */
    suggestedKey: function (state) {
      if (!state) return "layout";
      if (state.phase === "ended") return "game_end";
      if (state.pendingCapture) return "judgment_prompt";
      if (state.phase === "event") return "event_prompt";
      if (state.phase === "movement") return "movement_prompt";
      if (state.phase === "judgment") return "judgment_prompt";
      return "event_prompt";
    },

    generateSuggested: function (state, rules) {
      var key = TextGenerator.suggestedKey(state);
      var text = TextGenerator.generate(key, state, rules);
      if (!text && key !== "freeform") {
        text = TextGenerator.generate("freeform", state, rules);
      }
      return { key: key, text: text };
    },

    unknownVariables: function (template) {
      var known = {};
      (ST.TEXT_VARIABLES || []).forEach(function (variable) { known[variable.key] = true; });
      var unknown = [];
      String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, function (match, key) {
        if (!known[key] && unknown.indexOf(key) < 0) unknown.push(key);
        return match;
      });
      return unknown;
    },

    sampleContext: function () {
      return buildContext({
        round: 1,
        maxRound: 10,
        mode: "1v1",
        players: [],
        turnResult: {},
        turnFlags: {},
        lastMovement: null
      }, ST.createDefaultRules(), {});
    }
  };

  ST.TextGenerator = TextGenerator;
})(window.ST = window.ST || {});
