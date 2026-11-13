/*
 * 暮影領地捉迷藏｜存檔與操作紀錄
 */
(function (ST) {
  "use strict";

  function esc(value) { return ST.App.escape(value); }

  function render(state, rules) {
    var root = document.getElementById("saveContent");
    if (!root) return;
    var slots = ST.SaveManager.listSlots();
    var logs = ST.History.recent(state, 80);
    var html = [];
    html.push('<div class="two-column">');
    html.push('<div class="stack">');

    // 儲存狀態
    html.push('<section class="panel" style="padding:18px">');
    html.push('<div class="panel-head"><div><p class="eyebrow">Storage</p><h2>儲存狀態</h2></div>' +
      '<span class="chip ' + (ST.SaveManager.isAvailable() ? "chip-green" : "chip-draft") + '">' +
      esc(ST.SaveManager.storageLabel()) + "</span></div>");
    html.push('<div class="kv" style="margin-top:12px">');
    html.push("<dt>自動暫存</dt><dd>" + (ST.SaveManager.lastSavedAt() ? esc(ST.History.formatDate(ST.SaveManager.lastSavedAt())) : "尚未儲存") + "</dd>");
    html.push("<dt>遊戲狀態</dt><dd>" + (state ? "第 " + state.round + " / " + state.maxRound + " 回合｜" + esc(ST.getMode(state.mode).label) : "無") + "</dd>");
    html.push("<dt>可撤銷</dt><dd>" + ST.Store.undoSize() + " 步" + (ST.Store.undoLabel() ? "（" + esc(ST.Store.undoLabel()) + "）" : "") + "</dd>");
    html.push("</div>");
    html.push('<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">');
    html.push('<button type="button" class="btn btn-ghost btn-sm" data-save-export>匯出遊戲 JSON</button>');
    html.push('<button type="button" class="btn btn-ghost btn-sm" data-save-import>匯入遊戲 JSON</button>');
    html.push('<button type="button" class="btn btn-ghost btn-sm" data-undo>↶ 撤銷</button>');
    html.push('<button type="button" class="btn btn-ghost btn-sm" data-clear-undo>清除撤銷紀錄</button>');
    html.push("</div>");
    html.push("</section>");

    // 具名存檔
    html.push('<section class="panel" style="padding:18px">');
    html.push('<div class="panel-head"><div><p class="eyebrow">Save Slots</p><h2>具名存檔</h2></div><span class="muted tiny">最多 12 筆</span></div>');
    html.push('<div class="row" style="margin-top:12px;gap:8px;align-items:flex-end">');
    html.push('<div class="field" style="flex:1"><label>存檔名稱</label><input type="text" id="slotName" placeholder="例如：第 3 回合開始"></div>');
    html.push('<button type="button" class="btn btn-primary btn-sm" data-save-slot ' + (state ? "" : "disabled") + ">建立存檔</button>");
    html.push("</div>");
    if (!slots.length) {
      html.push('<p class="field-hint" style="margin-top:12px">尚無具名存檔。自動暫存只保留最新狀態，重要進度建議建立存檔或匯出 JSON。</p>');
    } else {
      html.push('<div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>名稱</th><th>時間</th><th>進度</th><th></th></tr></thead><tbody>');
      slots.forEach(function (slot) {
        html.push("<tr><td>" + esc(slot.name) + '<br><span class="muted tiny">' + esc(slot.summary || "") + "</span></td>");
        html.push("<td>" + esc(ST.History.formatDate(slot.savedAt)) + "</td>");
        html.push("<td>" + esc(ST.getMode(slot.mode).short) + "｜第 " + slot.round + " / " + slot.maxRound + " 回合</td>");
        html.push('<td><div class="row" style="gap:4px;justify-content:flex-end">' +
          '<button type="button" class="btn btn-ghost btn-xs" data-load-slot="' + esc(slot.id) + '">載入</button>' +
          '<button type="button" class="btn btn-ghost btn-xs" data-delete-slot="' + esc(slot.id) + '">刪除</button></div></td></tr>');
      });
      html.push("</tbody></table></div>");
    }
    html.push("</section>");

    // 危險區
    html.push('<section class="panel" style="padding:18px">');
    html.push('<div class="panel-head"><div><p class="eyebrow">Danger Zone</p><h2>清除遊戲</h2></div></div>');
    html.push('<p class="field-hint" style="margin-top:6px">清除後會移除目前的遊戲狀態與自動存檔。建議先匯出 JSON。</p>');
    html.push('<button type="button" class="btn btn-danger btn-sm" style="margin-top:12px" data-clear-game ' + (state ? "" : "disabled") + ">清除目前遊戲</button>");
    html.push("</section>");

    html.push("</div>");

    // 操作紀錄
    html.push('<section class="panel" style="padding:18px">');
    html.push('<div class="panel-head"><div><p class="eyebrow">History</p><h2>操作紀錄</h2></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-export-log ' + (state ? "" : "disabled") + ">匯出 TXT</button></div>");
    if (!logs.length) {
      html.push('<div class="empty" style="margin-top:12px">目前沒有操作紀錄。</div>');
    } else {
      html.push('<ul class="log-list" style="margin-top:8px">');
      logs.forEach(function (log) {
        html.push('<li class="log-item"><div class="log-head">' +
          '<span class="chip" style="font-size:10px">' + esc(ST.History.typeLabel(log.type)) + "</span>" +
          '<span class="log-round">第 ' + log.round + " 回合</span>" +
          '<span class="log-time" style="margin-left:auto">' + esc(ST.History.formatTime(log.at)) + "</span></div>" +
          '<div class="log-message">' + esc(log.message) + "</div></li>");
      });
      html.push("</ul>");
    }
    html.push("</section>");
    html.push("</div>");
    root.innerHTML = html.join("");
  }

  function importGame(text) {
    try {
      var parsed = ST.SaveManager.parseImport(text);
      if (parsed.kind !== "game") {
        ST.App.toast("這個檔案不是遊戲存檔。", "error");
        return;
      }
      var candidate = parsed.payload.state || parsed.payload;
      var check = ST.validateState(candidate);
      if (!check.ok) {
        ST.App.toast("格式檢查未通過：" + check.errors.join(" "), "error");
        return;
      }
      var warnings = check.warnings.length ? "\n\n注意：" + check.warnings.join(" ") : "";
      ST.App.confirm("匯入後會覆蓋目前的遊戲狀態（仍可撤銷）。" + warnings, {
        title: "匯入遊戲存檔",
        confirmLabel: "匯入",
        danger: true
      }).then(function (ok) {
        if (!ok) return;
        ST.Store.replaceState(ST.normalizeState(candidate), "匯入遊戲存檔");
        ST.App.toast("遊戲存檔已匯入。", "ok");
        ST.App.navigate("console");
      });
    } catch (error) {
      ST.App.toast("匯入失敗：" + error.message, "error");
    }
  }

  function init() {
    var root = document.getElementById("saveContent");

    root.addEventListener("click", function (event) {
      if (event.target.closest("[data-save-export]")) {
        var state = ST.Store.getState();
        if (!state) {
          ST.App.toast("目前沒有遊戲。", "error");
          return;
        }
        ST.SaveManager.exportGame(state);
        ST.App.toast("已匯出遊戲 JSON。", "ok");
        return;
      }
      if (event.target.closest("[data-save-import]")) {
        ST.App.pickJSONFile(importGame);
        return;
      }
      if (event.target.closest("[data-undo]")) {
        var snapshot = ST.Store.undo();
        if (!snapshot) {
          ST.App.toast("沒有可撤銷的操作。", "error");
          return;
        }
        ST.App.toast("已撤銷：" + snapshot.label, "ok");
        ST.App.refresh();
        return;
      }
      if (event.target.closest("[data-clear-undo]")) {
        ST.Store.clearUndo();
        ST.App.toast("已清除撤銷紀錄。", "ok");
        ST.App.refresh();
        return;
      }
      if (event.target.closest("[data-save-slot]")) {
        var stateToSave = ST.Store.getState();
        if (!stateToSave) return;
        var nameInput = document.getElementById("slotName");
        var name = nameInput ? nameInput.value.trim() : "";
        if (!name) {
          ST.App.toast("請輸入存檔名稱。", "error");
          return;
        }
        ST.SaveManager.saveSlot(name, stateToSave);
        ST.App.toast("已建立存檔：" + name, "ok");
        ST.App.refresh();
        return;
      }
      var loadButton = event.target.closest("[data-load-slot]");
      if (loadButton) {
        var slot = ST.SaveManager.getSlot(loadButton.getAttribute("data-load-slot"));
        if (!slot) return;
        ST.App.confirm("載入存檔「" + slot.name + "」會覆蓋目前狀態（仍可撤銷），確定嗎？", {
          title: "載入存檔",
          confirmLabel: "載入"
        }).then(function (ok) {
          if (!ok) return;
          ST.Store.replaceState(slot.state, "載入存檔：" + slot.name);
          ST.App.toast("已載入存檔。", "ok");
          ST.App.navigate("console");
        });
        return;
      }
      var deleteButton = event.target.closest("[data-delete-slot]");
      if (deleteButton) {
        ST.App.confirm("確定刪除這筆具名存檔？", {
          title: "刪除存檔",
          confirmLabel: "刪除",
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          ST.SaveManager.deleteSlot(deleteButton.getAttribute("data-delete-slot"));
          ST.App.toast("存檔已刪除。", "ok");
          ST.App.refresh();
        });
        return;
      }
      if (event.target.closest("[data-clear-game]")) {
        ST.App.confirm("確定清除目前遊戲？自動存檔也會一併移除，此動作無法復原。", {
          title: "清除目前遊戲",
          confirmLabel: "清除",
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          ST.Store.resetGame();
          ST.App.toast("已清除遊戲。");
          ST.App.navigate("console");
        });
        return;
      }
      if (event.target.closest("[data-export-log]")) {
        var currentState = ST.Store.getState();
        if (!currentState) return;
        ST.SaveManager.exportLogs(currentState);
        ST.App.toast("已匯出操作紀錄。", "ok");
      }
    });

    document.getElementById("gameExportBtn").addEventListener("click", function () {
      var state = ST.Store.getState();
      if (!state) {
        ST.App.toast("目前沒有遊戲。", "error");
        return;
      }
      ST.SaveManager.exportGame(state);
      ST.App.toast("已匯出遊戲 JSON。", "ok");
    });

    document.getElementById("gameImportBtn").addEventListener("click", function () {
      ST.App.pickJSONFile(importGame);
    });
  }

  ST.SaveView = { init: init, render: render };
})(window.ST = window.ST || {});
