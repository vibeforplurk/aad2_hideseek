/*
 * 暮影領地捉迷藏｜遊戲設定
 * 建立新遊戲、手動接續、JSON 匯入／匯出。
 */
(function (ST) {
  "use strict";

  var ui = null;

  function esc(value) { return ST.App.escape(value); }

  function freshDraft(state) {
    if (state) {
      return {
        mode: state.mode,
        title: state.title || "暮影領地捉迷藏",
        maxRound: state.maxRound,
        round: state.round,
        hiders: state.players.filter(function (p) { return p.role === "hider"; }).map(function (p) {
          return { name: p.name, characterName: p.characterName, position: p.position };
        }),
        seekerName: (state.players.filter(function (p) { return p.role === "seeker"; })[0] || {}).name || "",
        seekerCharacterName: (state.players.filter(function (p) { return p.role === "seeker"; })[0] || {}).characterName || "異常",
        seekerPosition: (state.players.filter(function (p) { return p.role === "seeker"; })[0] || {}).position || 1
      };
    }
    return {
      mode: "1v1",
      title: "暮影領地捉迷藏",
      maxRound: (ST.Store.getRules() && ST.Store.getRules().options.defaultMaxRound) || 10,
      round: 1,
      hiders: [{ name: "", characterName: "小紅帽", position: 1 }],
      seekerName: "",
      seekerCharacterName: "異常",
      seekerPosition: 10
    };
  }

  function ensureDraft(state) {
    if (!ui) ui = freshDraft(state);
    if (ui.mode === "1v1" && ui.hiders.length > 1) ui.hiders = ui.hiders.slice(0, 1);
    if (!ui.hiders.length) ui.hiders = [{ name: "", characterName: "小紅帽", position: 1 }];
    return ui;
  }

  function positionOptions(selected) {
    return ST.MAP.nodes.map(function (node) {
      return '<option value="' + node.id + '"' + (Number(selected) === node.id ? " selected" : "") + ">" +
        node.id + (node.name ? "．" + esc(node.name) : " 號格") + "</option>";
    }).join("");
  }

  function readNewGameForm() {
    var root = document.getElementById("setupContent");
    if (!root || !ui) return;
    ui.title = (root.querySelector("[name=setupTitle]") || {}).value || ui.title;
    ui.maxRound = Number((root.querySelector("[name=setupMaxRound]") || {}).value || ui.maxRound);
    ui.round = Number((root.querySelector("[name=setupRound]") || {}).value || ui.round);
    ui.seekerName = (root.querySelector("[name=seekerName]") || {}).value || ui.seekerName;
    ui.seekerCharacterName = (root.querySelector("[name=seekerCharacterName]") || {}).value || ui.seekerCharacterName;
    ui.seekerPosition = Number((root.querySelector("[name=seekerPosition]") || {}).value || ui.seekerPosition);
    var rows = root.querySelectorAll("[data-hider-index]");
    if (rows.length) {
      ui.hiders = Array.prototype.map.call(rows, function (row, index) {
        return {
          name: (row.querySelector("[name=hiderName]") || {}).value || "",
          characterName: (row.querySelector("[name=hiderCharacter]") || {}).value || "",
          position: Number((row.querySelector("[name=hiderPosition]") || {}).value || 1)
        };
      });
    }
  }

  function newGamePanel(state) {
    var draft = ensureDraft(state);
    var maxHiders = draft.mode === "multi" ? 4 : 1;
    var html = [];
    html.push('<section class="panel" style="padding:18px">');
    html.push('<div class="panel-head"><div><p class="eyebrow">New Game</p><h2>建立新遊戲</h2></div></div>');
    html.push('<div class="segmented" style="margin-top:12px" role="group" aria-label="遊戲模式">');
    ["1v1", "multi"].forEach(function (mode) {
      html.push('<button type="button" data-setup-mode="' + mode + '" class="' + (draft.mode === mode ? "is-active" : "") + '">' +
        esc(ST.getMode(mode).label) + "</button>");
    });
    html.push("</div>");
    html.push('<p class="field-hint" style="margin-top:8px">' + esc(ST.getMode(draft.mode).description) + "</p>");

    html.push('<div class="form-grid" style="margin-top:14px">');
    html.push('<div class="field"><label>遊戲標題</label><input type="text" name="setupTitle" value="' + esc(draft.title) + '"></div>');
    html.push('<div class="field"><label>最大回合數</label><input type="number" name="setupMaxRound" min="1" max="99" value="' + draft.maxRound + '"></div>');
    html.push('<div class="field"><label>起始回合</label><input type="number" name="setupRound" min="1" max="99" value="' + draft.round + '"></div>');
    html.push('<div class="field"><label>追捕者 PLURK ID</label><input type="text" name="seekerName" value="' + esc(draft.seekerName) + '" placeholder="例如：shadow_host"></div>');
    html.push('<div class="field"><label>追捕者角色名稱</label><input type="text" name="seekerCharacterName" value="' + esc(draft.seekerCharacterName) + '" placeholder="例如：異常"></div>');
    html.push('<div class="field"><label>追捕者起始位置（dice20）</label><select name="seekerPosition">' + positionOptions(draft.seekerPosition) + "</select></div>");
    html.push("</div>");

    html.push('<hr class="divider">');
    html.push('<div class="row" style="justify-content:space-between"><h3 style="font-size:15px">躲藏者</h3>' +
      (draft.mode === "multi"
        ? '<button type="button" class="btn btn-ghost btn-xs" data-add-hider ' + (draft.hiders.length >= maxHiders ? "disabled" : "") + ">＋ 新增躲藏者</button>"
        : '<span class="muted tiny">1V1 模式固定一位</span>') + "</div>");
    draft.hiders.forEach(function (hider, index) {
      html.push('<div class="hider-row" data-hider-index="' + index + '">');
      html.push('<div class="field"><label>PLURK ID</label><input type="text" name="hiderName" value="' + esc(hider.name) + '" placeholder="例如：moon_player"></div>');
      html.push('<div class="field"><label>角色名稱</label><input type="text" name="hiderCharacter" value="' + esc(hider.characterName) + '" placeholder="例如：小紅帽"></div>');
      html.push('<div class="field"><label>起始位置（dice20）</label><select name="hiderPosition">' + positionOptions(hider.position) + "</select></div>");
      if (draft.mode === "multi" && draft.hiders.length > 1) {
        html.push('<button type="button" class="btn btn-ghost btn-sm hider-remove" data-remove-hider="' + index + '">移除</button>');
      }
      html.push("</div>");
    });

    html.push('<div class="notice" style="margin-top:14px">PLURK ID 用於文字輸出的 @ 標註；角色名稱是敘事中使用的名字。起始位置由參與者擲 (dice20) 決定，主持人將結果選入即可。</div>');
    html.push('<button type="button" class="btn btn-primary btn-block" id="createGameBtn" style="margin-top:14px">建立遊戲</button>');
    html.push("</section>");
    return html.join("");
  }

  function resumePanel(state, rules) {
    var html = [];
    html.push('<section class="panel" style="padding:18px">');
    html.push('<div class="panel-head"><div><p class="eyebrow">Resume</p><h2>手動接續／狀態修正</h2></div>' +
      '<span class="chip">' + esc(ST.SaveManager.storageLabel()) + "</span></div>");

    if (!state) {
      html.push('<div class="empty" style="margin-top:14px"><strong>目前沒有遊戲狀態</strong>可以先建立新遊戲，或貼上先前的 JSON 存檔接續。</div>');
    } else {
      html.push('<p class="field-hint" style="margin-top:8px">修正回合、階段與角色位置。套用後會建立一筆可撤銷的操作紀錄。</p>');
      html.push('<div class="form-grid" style="margin-top:12px">');
      html.push('<div class="field"><label>目前回合</label><input type="number" name="resumeRound" min="1" max="99" value="' + state.round + '"></div>');
      html.push('<div class="field"><label>最大回合</label><input type="number" name="resumeMaxRound" min="-99" max="99" value="' + state.maxRound + '"></div>');
      html.push('<div class="field"><label>目前階段</label><select name="resumePhase">' +
        ["event", "movement", "judgment", "ended"].map(function (phase) {
          return '<option value="' + phase + '"' + (state.phase === phase ? " selected" : "") + ">" +
            ({ event: "事件階段", movement: "移動階段", judgment: "判定階段", ended: "遊戲結束" }[phase]) + "</option>";
        }).join("") + "</select></div>");
      html.push('<div class="field"><label>目前行動角色</label><select name="resumeActive">' +
        '<option value="">（不指定）</option>' +
        state.players.map(function (player) {
          return '<option value="' + esc(player.id) + '"' + (state.activePlayerId === player.id ? " selected" : "") + ">" +
            esc(player.characterName || player.name) + "（@" + esc(player.name) + "）</option>";
        }).join("") + "</select></div>");
      html.push("</div>");
      html.push('<div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>角色</th><th>位置</th><th>在場</th><th>被捕獲</th></tr></thead><tbody>');
      state.players.forEach(function (player) {
        html.push("<tr><td>" + esc(player.characterName || player.name) + "<br><span class=\"muted tiny\">@" + esc(player.name) + " · " +
          esc(player.role === "seeker" ? "追捕者" : "躲藏者") + "</span></td>");
        html.push('<td><select data-resume-position="' + esc(player.id) + '" style="min-width:130px">' + positionOptions(player.position) + "</select></td>");
        html.push('<td><input type="checkbox" data-resume-inplay="' + esc(player.id) + '"' + (player.inPlay ? " checked" : "") + "></td>");
        html.push('<td><input type="checkbox" data-resume-captured="' + esc(player.id) + '"' + (player.captured ? " checked" : "") + "></td></tr>");
      });
      html.push("</tbody></table></div>");
      html.push('<button type="button" class="btn btn-primary btn-block" id="applyResumeBtn" style="margin-top:14px">套用目前的調整</button>');
    }

    html.push('<details style="margin-top:16px"' + (state ? "" : " open") + '><summary class="small" style="cursor:pointer;color:var(--gold)">貼上 JSON 接續（進階）</summary>');
    html.push('<div class="field" style="margin-top:10px"><label>遊戲狀態 JSON</label><textarea id="resumeJson" rows="8" placeholder="貼上包含 state 或 players 的 JSON…"></textarea></div>');
    html.push('<div class="row" style="margin-top:8px;gap:8px">');
    html.push('<button type="button" class="btn btn-ghost btn-sm" id="resumeJsonBtn" style="flex:1">驗證並接續</button>');
    html.push('<button type="button" class="btn btn-ghost btn-sm" id="exportGameBtn" style="flex:1">匯出目前遊戲 JSON</button>');
    html.push("</div>");
    html.push("</details>");
    html.push("</section>");
    return html.join("");
  }

  function currentSummary(state) {
    if (!state) return "";
    var mode = ST.getMode(state.mode);
    return '<section class="panel" style="padding:16px;margin-top:18px">' +
      '<div class="row" style="justify-content:space-between"><h3 class="card-title">目前遊戲</h3><span class="chip chip-gold">' + esc(mode.label) + "</span></div>" +
      '<div class="kv" style="margin-top:10px"><dt>回合</dt><dd>第 ' + state.round + " / " + state.maxRound + " 回合</dd>" +
      "<dt>階段</dt><dd>" + esc({ event: "事件", movement: "移動", judgment: "判定", ended: "結束" }[state.phase]) + "</dd>" +
      "<dt>角色</dt><dd>" + state.players.map(function (p) {
        return esc(p.characterName || p.name) + "（@" + esc(p.name) + "，" + p.position + "）";
      }).join("、") + "</dd></div></section>";
  }

  function render(state, rules) {
    var root = document.getElementById("setupContent");
    if (!root) return;
    ensureDraft(state);
    root.innerHTML = newGamePanel(state) + '<div class="stack">' + resumePanel(state, rules) + currentSummary(state) + "</div>";
  }

  function createGame() {
    readNewGameForm();
    var draft = ui;
    if (!draft) return;
    var mode = ST.getMode(draft.mode);
    if (draft.mode === "multi" && (draft.hiders.length < 1 || draft.hiders.length > 4)) {
      ST.App.toast("多人模式需要 1–4 位躲藏者。", "error");
      return;
    }
    var seen = {};
    var duplicate = false;
    var hiders = draft.hiders.slice(0, draft.mode === "multi" ? 4 : 1).map(function (hider) {
      if (seen[hider.position]) duplicate = true;
      seen[hider.position] = true;
      return {
        name: String(hider.name || "").replace(/^@+/, "").trim(),
        characterName: String(hider.characterName || "").trim(),
        position: hider.position
      };
    });
    if (seen[draft.seekerPosition]) duplicate = true;
    if (!hiders.length || hiders.some(function (hider) { return !hider.name; })) {
      ST.App.toast("請輸入每位躲藏者的 PLURK ID。", "error");
      return;
    }
    if (!String(draft.seekerName || "").replace(/^@+/, "").trim()) {
      ST.App.toast("請輸入追捕者的 PLURK ID。", "error");
      return;
    }

    function create() {
      ST.Store.newGame({
        mode: draft.mode,
        title: draft.title,
        maxRound: draft.maxRound,
        round: draft.round,
        hiders: hiders,
        seekerName: draft.seekerName,
        seekerCharacterName: draft.seekerCharacterName,
        seekerPosition: draft.seekerPosition
      });
      ui = null;
      ST.App.toast("遊戲已建立，開始第 " + draft.round + " 回合。", "ok");
      ST.App.navigate("console");
    }

    if (duplicate) {
      ST.App.confirm("有角色使用相同的起始格。規則允許同格開局，但會增加判定複雜度。仍要建立嗎？", {
        title: "起始位置重複",
        confirmLabel: "仍要建立"
      }).then(function (ok) { if (ok) create(); });
    } else {
      create();
    }
  }

  function applyResume() {
    var state = ST.Store.getState();
    if (!state) return;
    var root = document.getElementById("setupContent");
    var next = JSON.parse(JSON.stringify(state));
    next.round = Number((root.querySelector("[name=resumeRound]") || {}).value || state.round);
    var maxRoundField = root.querySelector("[name=resumeMaxRound]");
    next.maxRound = maxRoundField && maxRoundField.value !== "" ? Number(maxRoundField.value) : state.maxRound;
    next.phase = (root.querySelector("[name=resumePhase]") || {}).value || state.phase;
    var activeId = (root.querySelector("[name=resumeActive]") || {}).value || null;
    next.players.forEach(function (player) {
      var position = root.querySelector('[data-resume-position="' + player.id + '"]');
      var inPlay = root.querySelector('[data-resume-inplay="' + player.id + '"]');
      var captured = root.querySelector('[data-resume-captured="' + player.id + '"]');
      if (position) player.position = Number(position.value);
      if (inPlay) player.inPlay = !!inPlay.checked;
      if (captured) player.captured = !!captured.checked;
    });
    if (activeId) next.activePlayerId = activeId;
    else delete next.activePlayerId;
    if (next.phase !== "movement") next.movement = null;
    next.turnOrder = ST.TurnManager.computeOrder(next);
    if (next.activePlayerId && next.turnOrder.indexOf(next.activePlayerId) < 0) {
      next.turnOrder.push(next.activePlayerId);
    }
    var check = ST.validateState(next);
    if (!check.ok) {
      ST.App.toast(check.errors.join(" "), "error");
      return;
    }
    ST.Store.replaceState(next, "手動接續調整");
    ST.App.toast("已套用接續設定。", "ok");
    ST.App.navigate("console");
  }

  function applyResumeJSON(text) {
    try {
      var parsed = ST.SaveManager.parseImport(text);
      if (parsed.kind === "rules") {
        ST.App.toast("這個檔案不是遊戲存檔。", "error");
        return;
      }
      var candidate = parsed.payload.state || parsed.payload;
      var check = ST.validateState(candidate);
      if (!check.ok) {
        ST.App.toast("格式檢查未通過：" + check.errors.join(" "), "error");
        return;
      }
      var normalized = ST.normalizeState(candidate);
      ST.Store.replaceState(normalized, "JSON 接續");
      ST.App.toast("已從 JSON 接續遊戲。", "ok");
      ST.App.navigate("console");
    } catch (error) {
      ST.App.toast("JSON 解析失敗：" + error.message, "error");
    }
  }

  function init() {
    var root = document.getElementById("setupContent");

    root.addEventListener("click", function (event) {
      var modeButton = event.target.closest("[data-setup-mode]");
      if (modeButton) {
        readNewGameForm();
        ui.mode = modeButton.getAttribute("data-setup-mode");
        if (ui.mode === "1v1") ui.hiders = ui.hiders.slice(0, 1);
        render(ST.Store.getState(), ST.Store.getRules());
        return;
      }
      if (event.target.closest("[data-add-hider]")) {
        readNewGameForm();
        if (ui.hiders.length < 4) ui.hiders.push({ name: "", characterName: "躲藏者" + (ui.hiders.length + 1), position: 1 });
        render(ST.Store.getState(), ST.Store.getRules());
        return;
      }
      var remove = event.target.closest("[data-remove-hider]");
      if (remove) {
        readNewGameForm();
        ui.hiders.splice(Number(remove.getAttribute("data-remove-hider")), 1);
        if (!ui.hiders.length) ui.hiders.push({ name: "", characterName: "小紅帽", position: 1 });
        render(ST.Store.getState(), ST.Store.getRules());
        return;
      }
      if (event.target.closest("#createGameBtn")) {
        createGame();
        return;
      }
      if (event.target.closest("#applyResumeBtn")) {
        applyResume();
        return;
      }
      if (event.target.closest("#resumeJsonBtn")) {
        var textarea = document.getElementById("resumeJson");
        if (!textarea || !textarea.value.trim()) {
          ST.App.toast("請先貼上 JSON。", "error");
          return;
        }
        applyResumeJSON(textarea.value);
        return;
      }
      if (event.target.closest("#exportGameBtn")) {
        var state = ST.Store.getState();
        if (!state) {
          ST.App.toast("目前沒有遊戲可匯出。", "error");
          return;
        }
        ST.SaveManager.exportGame(state);
        ST.App.toast("已匯出遊戲 JSON。", "ok");
      }
    });
  }

  ST.SetupView = {
    init: init,
    render: render,
    reset: function () { ui = null; }
  };
})(window.ST = window.ST || {});
