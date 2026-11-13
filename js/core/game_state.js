/*
 * 暮影領地捉迷藏｜遊戲狀態
 * ------------------------------------------------------------------
 * 全站唯一的一份遊戲狀態。所有畫面、移動、判定、文字與存檔都讀寫這裡，
 * 不允許任何模組自行保存角色位置或回合數。
 */
(function (ST) {
  "use strict";

  var PHASES = ["event", "movement", "judgment", "ended"];
  var listeners = [];
  var undoStack = [];
  var MAX_UNDO = 40;
  var state = null;
  var rules = null;
  var storageWarnings = [];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return (prefix || "id") + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  }

  function clampInt(value, min, max, fallback) {
    var number = parseInt(value, 10);
    if (!isFinite(number)) number = fallback;
    return Math.min(max, Math.max(min, number));
  }

  function defaultTurnFlags() {
    return {
      stepMod: 0,
      bonusSteps: 0,
      bonusDice: [],
      forcedDirection: null,
      passByLocked: false,
      canRefusePassBy: false,
      skipEvent: false,
      skipMovement: false,
      skipJudgment: false,
      endTurn: false,
      stepDice: null,
      extraMove: null,
      notes: [],
      teleportNode: null
    };
  }

  function normalizePlurkId(value) {
    return String(value || "").replace(/^@+/, "").trim();
  }

  function makePlayer(role, name, characterName, position, index) {
    var fallbackId = role === "seeker" ? "host" : "player" + (index + 1);
    var fallbackCharacter = role === "seeker" ? "異常" : "躲藏者" + (index + 1);
    return {
      id: role === "seeker" ? "s1" : "h" + (index + 1),
      name: normalizePlurkId(name) || fallbackId,
      characterName: String(characterName || "").trim() || fallbackCharacter,
      role: role,
      position: clampInt(position, 1, 20, 1),
      inPlay: true,
      captured: false,
      retired: false,
      retiredReason: "",
      returnCount: 0,
      arrivalSeq: index + 1,
      statuses: [],
      notes: ""
    };
  }

  function addLog(target, entry) {
    var actor = entry && entry.actorId ? target.players.filter(function (p) { return p.id === entry.actorId; })[0] : null;
    target.logs.push({
      id: uid("log"),
      at: nowISO(),
      round: target.round,
      type: entry.type || "manual",
      actorId: entry.actorId || null,
      actorName: actor ? (actor.characterName || actor.name) : entry.actorName || "",
      message: entry.message || ""
    });
    if (target.logs.length > 400) target.logs = target.logs.slice(-400);
  }

  function createState(setup) {
    setup = setup || {};
    var mode = setup.mode === "multi" ? "multi" : "1v1";
    var maxHiders = mode === "multi" ? 4 : 1;
    var hiderInputs = Array.isArray(setup.hiders) && setup.hiders.length
      ? setup.hiders
      : [{ name: "", characterName: "躲藏者", position: 1 }];
    hiderInputs = hiderInputs.slice(0, maxHiders);

    var players = hiderInputs.map(function (hider, index) {
      return makePlayer("hider", hider.name, hider.characterName, hider.position, index);
    });
    var seeker = makePlayer("seeker", setup.seekerName, setup.seekerCharacterName, setup.seekerPosition, 0);
    players.push(seeker);

    var maxRound = clampInt(setup.maxRound, 1, 99, mode === "multi" ? 10 : 10);
    var newState = {
      version: 1,
      app: "shadow-territory",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      mode: mode,
      title: String(setup.title || "").trim() || "暮影領地捉迷藏",
      round: clampInt(setup.round, 1, 99, 1),
      maxRound: maxRound,
      phase: "event",
      activePlayerId: players[0].id,
      turnOrder: [],
      turnIndex: 0,
      players: players,
      movement: null,
      lastMovement: null,
      turnFlags: defaultTurnFlags(),
      turnResult: {},
      groupDice4: {},
      groupDraws: {},
      pendingCapture: null,
      pendingRelocation: null,
      result: null,
      arrivalCounter: players.length,
      settings: {
        showNames: true,
        includeHeader: true
      },
      logs: []
    };

    newState.turnOrder = orderFor(newState);
    newState.activePlayerId = newState.turnOrder[0] || null;
    addLog(newState, {
      type: "setup",
      message: "建立遊戲：" + ST.getMode(mode).label + "，共 " + newState.maxRound + " 回合。"
    });
    return newState;
  }

  function orderFor(target) {
    if (ST.TurnManager) return ST.TurnManager.computeOrder(target);
    return target.players.filter(function (p) { return p.role === "hider"; }).map(function (p) { return p.id; })
      .concat(target.players.filter(function (p) { return p.role === "seeker"; }).map(function (p) { return p.id; }));
  }

  function getPlayer(target, id) {
    return (target || state).players.filter(function (p) { return p.id === id; })[0] || null;
  }

  function getActive(target) {
    return getPlayer(target || state, (target || state).activePlayerId);
  }

  function normalizeState(input) {
    if (!input || typeof input !== "object") throw new Error("存檔內容不是物件。");
    var data = clone(input);
    if (!data.players || !Array.isArray(data.players) || !data.players.length) {
      throw new Error("存檔缺少 players 角色資料。");
    }
    if (data.mode !== "1v1" && data.mode !== "multi") data.mode = "1v1";
    data.version = 1;
    data.app = "shadow-territory";
    data.title = String(data.title || "暮影領地捉迷藏");
    data.round = clampInt(data.round, 1, 999, 1);
    data.maxRound = clampInt(data.maxRound, -99, 999, 10);
    data.phase = PHASES.indexOf(data.phase) >= 0 ? data.phase : "event";

    data.players = data.players.map(function (player, index) {
      var role = player.role === "seeker" ? "seeker" : "hider";
      var fallbackId = role === "seeker" ? "host" : "player" + (index + 1);
      return {
        id: String(player.id || (role === "seeker" ? "s1" : "h" + (index + 1))),
        name: normalizePlurkId(player.name) || fallbackId,
        characterName: String(player.characterName || "").trim() || (role === "seeker" ? "異常" : "躲藏者" + (index + 1)),
        role: role,
        position: clampInt(player.position, 1, 20, 1),
        inPlay: player.inPlay !== false,
        captured: player.captured === true,
        retired: player.retired === true,
        retiredReason: String(player.retiredReason || ""),
        returnCount: clampInt(player.returnCount, 0, 99, 0),
        arrivalSeq: clampInt(player.arrivalSeq, 1, 9999, index + 1),
        statuses: Array.isArray(player.statuses) ? player.statuses : [],
        notes: String(player.notes || "")
      };
    });

    var ids = data.players.map(function (p) { return p.id; });
    if (!data.activePlayerId || ids.indexOf(data.activePlayerId) < 0) {
      var first = data.players.filter(function (p) { return p.inPlay; })[0] || data.players[0];
      data.activePlayerId = first ? first.id : null;
    }
    data.turnOrder = Array.isArray(data.turnOrder)
      ? data.turnOrder.filter(function (id) { return ids.indexOf(id) >= 0; })
      : orderFor(data);
    if (!data.turnOrder.length) data.turnOrder = orderFor(data);
    data.turnIndex = clampInt(data.turnIndex, 0, Math.max(0, data.turnOrder.length - 1), 0);

    data.turnFlags = Object.assign(defaultTurnFlags(), data.turnFlags || {});
    if (!Array.isArray(data.turnFlags.notes)) data.turnFlags.notes = [];
    data.turnResult = data.turnResult && typeof data.turnResult === "object" ? data.turnResult : {};
    data.groupDice4 = data.groupDice4 && typeof data.groupDice4 === "object" ? data.groupDice4 : {};
    data.groupDraws = data.groupDraws && typeof data.groupDraws === "object" ? data.groupDraws : {};
    data.movement = data.movement && typeof data.movement === "object" ? data.movement : null;
    data.lastMovement = data.lastMovement && typeof data.lastMovement === "object" ? data.lastMovement : null;
    data.pendingCapture = data.pendingCapture && typeof data.pendingCapture === "object" ? data.pendingCapture : null;
    data.pendingRelocation = data.pendingRelocation && typeof data.pendingRelocation === "object" ? data.pendingRelocation : null;
    data.result = data.result && typeof data.result === "object" ? data.result : null;
    data.arrivalCounter = clampInt(data.arrivalCounter, data.players.length, 999999, data.players.length);
    data.logs = Array.isArray(data.logs) ? data.logs.slice(-400) : [];
    data.settings = Object.assign({ showNames: true, includeHeader: true }, data.settings || {});
    data.updatedAt = nowISO();
    return data;
  }

  function validateState(input) {
    var errors = [];
    var warnings = [];
    if (!input || typeof input !== "object") {
      return { ok: false, errors: ["內容不是有效的 JSON 物件。"], warnings: [] };
    }
    if (!Array.isArray(input.players) || !input.players.length) errors.push("缺少角色資料（players）。");
    if (input.mode && input.mode !== "1v1" && input.mode !== "multi") errors.push("遊戲模式必須是 1v1 或 multi。");
    if (input.round != null && !(input.round >= 1)) errors.push("目前回合必須大於等於 1。");
    if (input.maxRound != null && !(input.maxRound >= -99)) errors.push("最大回合必須大於等於 -99。");
    if (input.phase && PHASES.indexOf(input.phase) < 0) errors.push("行動階段不合法：" + input.phase);
    (input.players || []).forEach(function (player, index) {
      if (!player || typeof player !== "object") {
        errors.push("第 " + (index + 1) + " 位角色資料格式錯誤。");
        return;
      }
      if (!(player.position >= 1 && player.position <= 20)) {
        errors.push("角色「" + (player.name || index + 1) + "」的位置必須在 1–20 之間。");
      }
      if (player.role !== "hider" && player.role !== "seeker") {
        errors.push("角色「" + (player.name || index + 1) + "」類型必須是 hider 或 seeker。");
      }
    });
    var ids = (input.players || []).map(function (p) { return p.id; });
    if (input.activePlayerId && ids.indexOf(input.activePlayerId) < 0) {
      warnings.push("目前行動角色不存在，載入後會自動選擇第一位角色。");
    }
    if (input.mode === "1v1" && (input.players || []).filter(function (p) { return p.role === "hider"; }).length > 1) {
      warnings.push("1V1 模式有多位躲藏者，將以第一位為準。");
    }
    if (Number(input.round) > Number(input.maxRound)) {
      warnings.push("目前回合已超過最大回合，載入後可能直接視為遊戲結束。");
    }
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  var Store = {
    PHASES: PHASES,

    init: function () {
      var loadedState = null;
      try {
        loadedState = ST.SaveManager.loadGame();
        undoStack = ST.SaveManager.loadUndo() || [];
        ST.SaveManager.clearRules();
      } catch (error) {
        storageWarnings.push("無法讀取瀏覽器儲存空間：" + error.message);
      }
      // 規則固定寫在 js/data/facilities.js，不從瀏覽器讀取自訂規則。
      rules = ST.createDefaultRules();
      if (loadedState) {
        try {
          state = normalizeState(loadedState);
        } catch (error) {
          storageWarnings.push("自動存檔格式錯誤，已忽略：" + error.message);
          state = null;
        }
      }
      return Store;
    },

    getState: function () { return state; },
    getRules: function () { return rules; },
    getMode: function () { return ST.getMode(state ? state.mode : "1v1"); },
    getActive: function (target) {
      var targetState = target || state;
      return targetState ? getActive(targetState) : null;
    },
    getPlayer: function (id, target) {
      var targetState = target || state;
      return targetState ? getPlayer(targetState, id) : null;
    },
    getFacility: function (id, mode) { return ST.getFacilityRules(rules, id, mode || (state && state.mode) || "1v1"); },
    getPhaseLabel: function () {
      return { event: "事件階段", movement: "移動階段", judgment: "判定階段", ended: "遊戲結束" }[state ? state.phase : "event"];
    },
    hasGame: function () { return !!state; },
    warnings: function () { return storageWarnings.slice(); },

    subscribe: function (listener) {
      listeners.push(listener);
      return function () {
        listeners = listeners.filter(function (item) { return item !== listener; });
      };
    },

    emit: function () {
      listeners.forEach(function (listener) {
        try { listener(state, rules); } catch (error) { console.error(error); }
      });
    },

    /** 建立新遊戲（會先記錄可撤銷的狀態）。 */
    newGame: function (setup) {
      var next = createState(setup);
      var previous = state;
      if (previous) {
        undoStack.push({ label: "建立新遊戲", at: nowISO(), state: clone(previous) });
        trimUndo();
      }
      state = next;
      Store.save();
      Store.emit();
      return state;
    },

    /**
     * 唯一允許修改狀態的入口。
     * commit("移動", function(draft){ ... }, { message: "..." })
     */
    commit: function (label, mutator, options) {
      options = options || {};
      if (!state) throw new Error("尚未建立遊戲。");
      var previous = clone(state);
      var draft = clone(state);
      mutator(draft);
      draft.updatedAt = nowISO();
      if (options.message) {
        addLog(draft, { type: options.type || "manual", message: options.message, actorId: options.actorId });
      }
      state = draft;
      if (options.undoable !== false) {
        undoStack.push({ label: label || "操作", at: nowISO(), state: previous });
        trimUndo();
      }
      Store.save();
      Store.emit();
      return state;
    },

    /** 不做撤銷快照的更新（例如只改預覽）。 */
    touch: function (mutator) {
      if (!state) return;
      mutator(state);
      state.updatedAt = nowISO();
      Store.save();
      Store.emit();
    },

    replaceState: function (next, label) {
      var normalized = normalizeState(next);
      if (state) {
        undoStack.push({ label: label || "載入存檔", at: nowISO(), state: clone(state) });
        trimUndo();
      }
      state = normalized;
      Store.save();
      Store.emit();
    },

    resetGame: function () {
      if (state) {
        undoStack.push({ label: "清除遊戲", at: nowISO(), state: clone(state) });
        trimUndo();
      }
      state = null;
      ST.SaveManager.clearGame();
      Store.saveUndo();
      Store.emit();
    },

    undo: function () {
      if (!undoStack.length) return null;
      var snapshot = undoStack.pop();
      state = normalizeState(snapshot.state);
      addLog(state, { type: "undo", message: "已撤銷：" + snapshot.label });
      Store.save();
      Store.saveUndo();
      Store.emit();
      return snapshot;
    },

    undoLabel: function () {
      return undoStack.length ? undoStack[undoStack.length - 1].label : "";
    },

    undoSize: function () { return undoStack.length; },

    clearUndo: function () {
      undoStack = [];
      Store.saveUndo();
      Store.emit();
    },

    saveUndo: function () {
      try { ST.SaveManager.saveUndo(undoStack); } catch (error) { /* 忽略容量問題 */ }
    },

    save: function () {
      if (!state) return;
      try {
        ST.SaveManager.saveGame(state);
      } catch (error) {
        storageWarnings.push("儲存失敗：" + error.message);
      }
    },

    getUndoSnapshot: function () { return clone(undoStack.slice(-5)); }
  };

  function trimUndo() {
    if (undoStack.length > MAX_UNDO) undoStack = undoStack.slice(-MAX_UNDO);
  }

  ST.playerLabel = function (player) {
    if (!player) return "";
    return player.characterName || player.name || "";
  };
  ST.playerTag = function (player) {
    if (!player) return "";
    return "@" + normalizePlurkId(player.name);
  };

  ST.Store = Store;
  ST.createState = createState;
  ST.defaultTurnFlags = defaultTurnFlags;
  ST.addLog = addLog;
  ST.uid = uid;
  ST.normalizeState = normalizeState;
  ST.validateState = validateState;
  ST.orderFor = orderFor;
})(window.ST = window.ST || {});
