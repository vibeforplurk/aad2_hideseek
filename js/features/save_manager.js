/*
 * 暮影領地捉迷藏｜存檔管理
 * ------------------------------------------------------------------
 * LocalStorage 自動存檔、具名存檔、JSON 匯出／匯入。
 * 若瀏覽器停用 LocalStorage（例如部分 file:// 環境），改用記憶體暫存，
 * 並在介面提示使用 JSON 匯出備份。
 */
(function (ST) {
  "use strict";

  var PREFIX = "st_v1_";
  var memory = {};
  var available = (function () {
    try {
      var key = PREFIX + "__test__";
      window.localStorage.setItem(key, "1");
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  })();
  var lastSavedAt = null;

  function read(key) {
    try {
      var raw = available ? window.localStorage.getItem(PREFIX + key) : memory[key];
      return raw == null ? null : JSON.parse(raw);
    } catch (error) {
      console.warn("讀取 " + key + " 失敗", error);
      return null;
    }
  }

  function write(key, value) {
    var raw = JSON.stringify(value);
    if (available) {
      window.localStorage.setItem(PREFIX + key, raw);
    } else {
      memory[key] = raw;
    }
    lastSavedAt = new Date().toISOString();
  }

  function remove(key) {
    if (available) window.localStorage.removeItem(PREFIX + key);
    else delete memory[key];
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function stamp() {
    var now = new Date();
    function pad(value) { return String(value).padStart(2, "0"); }
    return now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "-" + pad(now.getHours()) + pad(now.getMinutes());
  }

  var SaveManager = {
    isAvailable: function () { return available; },
    storageLabel: function () { return available ? "瀏覽器 LocalStorage" : "暫時記憶體（請匯出 JSON）"; },
    lastSavedAt: function () { return lastSavedAt; },

    loadGame: function () { return read("game"); },
    saveGame: function (state) { write("game", state); },
    clearGame: function () { remove("game"); },

    loadRules: function () { return read("rules"); },
    saveRules: function (rules) { write("rules", rules); },
    clearRules: function () { remove("rules"); },

    loadUndo: function () { return read("undo") || []; },
    saveUndo: function (stack) {
      try {
        write("undo", (stack || []).slice(-20));
      } catch (error) {
        write("undo", []);
      }
    },

    listSlots: function () {
      var slots = read("slots");
      return Array.isArray(slots) ? slots : [];
    },

    saveSlot: function (name, state) {
      var slots = SaveManager.listSlots();
      var slot = {
        id: ST.uid("slot"),
        name: String(name || "").trim() || "未命名存檔",
        savedAt: new Date().toISOString(),
        round: state.round,
        maxRound: state.maxRound,
        mode: state.mode,
        summary: state.players.map(function (p) {
          return (p.characterName || p.name) + "（" + p.position + "）";
        }).join("、"),
        state: JSON.parse(JSON.stringify(state))
      };
      slots.unshift(slot);
      if (slots.length > 12) slots = slots.slice(0, 12);
      write("slots", slots);
      return slot;
    },

    deleteSlot: function (id) {
      var slots = SaveManager.listSlots().filter(function (slot) { return slot.id !== id; });
      write("slots", slots);
      return slots;
    },

    getSlot: function (id) {
      return SaveManager.listSlots().filter(function (slot) { return slot.id === id; })[0] || null;
    },

    exportGame: function (state) {
      var payload = {
        app: "shadow-territory",
        type: "game",
        version: 1,
        exportedAt: new Date().toISOString(),
        state: state
      };
      download("shadow-territory-game-" + stamp() + ".json", JSON.stringify(payload, null, 2));
      return payload;
    },

    exportRules: function (rules) {
      var payload = {
        app: "shadow-territory",
        type: "rules",
        version: ST.RULES_VERSION,
        exportedAt: new Date().toISOString(),
        rules: rules
      };
      download("shadow-territory-rules-" + stamp() + ".json", JSON.stringify(payload, null, 2));
      return payload;
    },

    /** 讀取 JSON 檔並辨識是遊戲存檔或規則庫。 */
    parseImport: function (text) {
      var data = JSON.parse(text);
      if (data && data.app === "shadow-territory") {
        if (data.type === "rules") return { kind: "rules", payload: data };
        if (data.type === "game") return { kind: "game", payload: data };
        if (data.state) return { kind: "game", payload: data };
        if (data.rules) return { kind: "rules", payload: data };
      }
      if (data && data.state) return { kind: "game", payload: data };
      if (data && data.rules) return { kind: "rules", payload: data };
      if (data && Array.isArray(data.players)) return { kind: "game", payload: { state: data } };
      if (data && Array.isArray(data.facilities)) return { kind: "rules", payload: { rules: data } };
      throw new Error("無法辨識檔案格式：需要包含 state（遊戲）或 rules（規則庫）。");
    },

    readFileAsText: function (file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result || "")); };
        reader.onerror = function () { reject(new Error("讀取檔案失敗。")); };
        reader.readAsText(file, "utf-8");
      });
    },

    exportLogs: function (state) {
      var lines = state.logs.map(function (log) {
        return "[" + new Date(log.at).toLocaleString("zh-TW") + "] 第" + log.round + "回合 " + log.message;
      });
      download("shadow-territory-log-" + stamp() + ".txt", lines.join("\r\n"), "text/plain;charset=utf-8");
    }
  };

  ST.SaveManager = SaveManager;
})(window.ST = window.ST || {});
