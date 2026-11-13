/*
 * 暮影領地捉迷藏｜主持控制台
 * 左：遊戲資訊／中：地圖／右：依階段變化的操作面板。
 */
(function (ST) {
  "use strict";

  var mapMode = "status";
  var lastSessionId = null;

  function esc(value) { return ST.App.escape(value); }

  function currentState() { return ST.Store.getState(); }
  function currentRules() { return ST.Store.getRules(); }

  function playerById(state, id) {
    return state.players.filter(function (player) { return player.id === id; })[0] || null;
  }

  function roleLabel(player) {
    if (!player) return "";
    var mode = ST.getMode(currentState() ? currentState().mode : "1v1");
    return player.role === "seeker" ? mode.seekerLabel : mode.hiderLabel;
  }

  function positionText(state, nodeId) {
    return ST.MAP.label(nodeId);
  }

  function phaseLabel(phase) {
    return { event: "事件階段", movement: "移動階段", judgment: "判定階段", ended: "遊戲結束" }[phase] || "事件階段";
  }

  function facilityFor(state, rules, nodeId) {
    return ST.getFacilityRules(rules, nodeId, state.mode);
  }

  function facilityTitle(facility) {
    if (!facility) return "設施";
    var left = facility.emojiLeft || "";
    var right = facility.emojiRight || "";
    return (left ? left + " " : "") + (facility.name || "設施") + (right ? " " + right : "");
  }

  function statusChips(player, state) {
    var chips = [];
    if (player.captured) chips.push('<span class="chip chip-danger">被捕獲</span>');
    else if (!player.inPlay) chips.push('<span class="chip">已退場</span>');
    (player.statuses || []).forEach(function (status) {
      chips.push('<span class="chip chip-draft">' + esc(status.label || "特殊狀態") + "</span>");
    });
    if (player.returnCount > 0) chips.push('<span class="chip">返場 ' + player.returnCount + " 次</span>");
    if (state.groupDice4 && state.groupDice4[player.id]) {
      chips.push('<span class="chip chip-gold">同格加骰 (dice4)</span>');
    }
    if (state.turnFlags && state.turnFlags.extraMove && !state.turnFlags.extraMove.used && state.activePlayerId === player.id) {
      chips.push('<span class="chip chip-gold">可額外移動 (dice4)</span>');
    }
    return chips.join("");
  }

  function fieldValue(root, selector) {
    var node = root.querySelector(selector);
    return node ? node.value : "";
  }

  function commit(label, mutator, type, successMessage) {
    try {
      ST.Store.commit(label, mutator, { type: type || "manual" });
      if (successMessage) ST.App.toast(successMessage, "ok");
      return true;
    } catch (error) {
      console.error(error);
      ST.App.toast(error.message, "error");
      return false;
    }
  }

  /* ---------------------------------------------------------------- 資訊面板 */

  function renderInfo() {
    var container = document.getElementById("infoPanel");
    var state = currentState();
    var rules = currentRules();
    if (!state) {
      container.innerHTML = '' +
        '<div class="empty">' +
        '<strong>尚未建立遊戲</strong>' +
        '建立 1V1 或多人遊戲，或匯入先前的 JSON 存檔。' +
        '<div class="row" style="justify-content:center;margin-top:16px;flex-wrap:wrap">' +
        '<button type="button" class="btn btn-primary btn-sm" data-action="go-setup">建立遊戲</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="manual-resume">手動接續</button>' +
        "</div></div>";
      return;
    }

    var mode = ST.getMode(state.mode);
    var active = ST.Store.getActive(state);
    var phase = state.phase;
    var phaseIndex = ["event", "movement", "judgment"].indexOf(phase);
    var progress = state.maxRound > 0
      ? Math.min(100, Math.round((state.round / state.maxRound) * 100))
      : 100;

    var html = [];
    html.push('<div class="row-wrap" style="justify-content:space-between">');
    html.push('<span class="chip chip-gold">' + esc(mode.label) + "</span>");
    html.push('<span class="chip ' + (phase === "ended" ? "chip-danger" : "") + '">' + esc(phaseLabel(phase)) + "</span>");
    html.push("</div>");

    html.push('<div style="margin-top:16px">');
    html.push('<div class="row" style="justify-content:space-between;align-items:baseline">');
    html.push('<span class="muted small">目前回合</span>');
    html.push('<span style="font-family:var(--font-display);font-size:26px;font-weight:700">' + state.round + ' <span class="muted" style="font-size:14px">/ ' + state.maxRound + "</span></span>");
    html.push("</div>");
    html.push('<div class="progress-bar"><span style="width:' + progress + '%"></span></div>');
    html.push("</div>");

    if (phase !== "ended" && active) {
      html.push('<div class="active-card">');
      html.push('<p class="eyebrow" style="margin-bottom:4px">目前行動</p>');
      html.push('<div class="row">');
      html.push('<span class="avatar avatar-' + active.role + '">' + esc(String(active.characterName || active.name).slice(0, 1)) + "</span>");
      html.push("<div><div class=\"char-name\" style=\"font-size:16px\">" + esc(active.characterName || active.name) +
        ' <span class="chip chip-' + active.role + '">' + esc(roleLabel(active)) + "</span></div>");
      html.push('<div class="char-meta">' + esc(roleLabel(active)) + " · " + esc(positionText(state, active.position)) + "</div></div>");
      html.push("</div>");
      html.push('<div class="phase-steps">');
      ["事件", "移動", "判定"].forEach(function (label, index) {
        var cls = "phase-step";
        if (phaseIndex > index) cls += " is-done";
        if (phaseIndex === index) cls += " is-current";
        html.push('<span class="' + cls + '">' + label + "</span>");
      });
      html.push("</div>");
      html.push("</div>");
    }

    if (phase === "ended" && state.result) {
      html.push('<div class="notice ' + (state.result.winner === "seeker" ? "notice-danger" : "notice-ok") + '" style="margin-top:14px">');
      html.push('<strong>' + esc(state.result.winnerLabel) + "</strong><br>" + esc(state.result.reason));
      html.push("</div>");
    }

    html.push('<hr class="divider">');
    html.push('<div class="row" style="justify-content:space-between;margin-bottom:8px">');
    html.push('<h3 style="font-size:14px">角色狀態</h3>');
    html.push('<span class="muted tiny">' + state.players.length + " 位</span>");
    html.push("</div>");
    html.push('<div class="char-list">');
    state.players.forEach(function (player) {
      var isActive = active && active.id === player.id;
      html.push('<div class="char-row' + (isActive ? " is-active" : "") + (!player.inPlay ? " is-out" : "") + '">');
      html.push('<span class="avatar avatar-' + player.role + '">' + esc(String(player.characterName || player.name).slice(0, 1)) + "</span>");
      html.push('<div class="char-main">');
      html.push('<div class="char-name">' + esc(player.characterName || player.name) + "</div>");
      html.push('<div class="char-meta">' + esc(roleLabel(player)) + " · " + esc(positionText(state, player.position)) + "</div>");
      html.push('<div class="row-wrap" style="gap:4px;margin-top:4px">' + statusChips(player, state) + "</div>");
      html.push("</div>");
      html.push('<div class="char-actions">');
      if (player.inPlay) {
        html.push('<button type="button" class="btn btn-ghost btn-xs" data-action="manual-move" data-player="' + player.id + '">移動</button>');
        if (!isActive) {
          html.push('<button type="button" class="btn btn-ghost btn-xs" data-action="set-active" data-player="' + player.id + '">設為行動</button>');
        }
      }
      html.push("</div>");
      html.push("</div>");
    });
    html.push("</div>");

    var order = state.turnOrder && state.turnOrder.length ? state.turnOrder : ST.TurnManager.computeOrder(state);
    if (order.length) {
      html.push('<hr class="divider">');
      html.push('<div class="row" style="justify-content:space-between;margin-bottom:6px">');
      html.push('<h3 style="font-size:14px">本回合順序</h3>');
      html.push('<span class="muted tiny">依規則自動排序</span>');
      html.push("</div>");
      html.push('<div class="turn-order">');
      order.forEach(function (id, index) {
        var player = playerById(state, id);
        if (!player) return;
        var classes = "turn-order-item";
        if (active && active.id === id) classes += " is-active";
        if (!player.inPlay) classes += " is-out";
        html.push('<div class="' + classes + '"><span class="turn-index">' + (index + 1) + "</span>" +
          '<span class="avatar avatar-' + player.role + '" style="width:22px;height:22px;font-size:11px;border-width:1px">' +
          esc(String(player.characterName || player.name).slice(0, 1)) + "</span><span>" + esc(player.characterName || player.name) + "</span>" +
          '<span class="muted tiny" style="margin-left:auto">' + esc(positionText(state, player.position)) + "</span></div>");
      });
      html.push("</div>");
    }

    html.push('<hr class="divider">');
    html.push('<div class="stack" style="gap:8px">');
    html.push('<button type="button" class="btn btn-primary btn-sm btn-block" data-action="next-turn">結束目前行動 / 下一角色</button>');
    html.push('<div class="row" style="gap:8px">');
    html.push('<button type="button" class="btn btn-ghost btn-sm" style="flex:1" data-action="manual-resume">手動接續</button>');
    html.push('<button type="button" class="btn btn-ghost btn-sm" style="flex:1" data-action="new-game">新遊戲</button>');
    html.push("</div>");
    html.push('<button type="button" class="btn btn-ghost btn-sm btn-block" data-action="undo">↶ 撤銷上一步' +
      (ST.Store.undoSize() ? "（" + esc(ST.Store.undoLabel()) + "）" : "") + "</button>");
    html.push("</div>");

    container.innerHTML = html.join("");
  }

  /* ------------------------------------------------------------------ 地圖 */

  function renderMap() {
    var stage = document.getElementById("mapStage");
    var state = currentState();
    var rules = currentRules();
    var subtitle = document.getElementById("mapSubtitle");
    var hint = document.getElementById("mapHint");

    var session = state && state.movement;
    if (session && session.id !== lastSessionId) {
      lastSessionId = session.id;
      mapMode = "movement";
    }
    if (!session && lastSessionId) {
      lastSessionId = null;
      mapMode = "status";
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-map-mode]"), function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-map-mode") === mapMode);
    });

    if (subtitle) {
      subtitle.textContent = state
        ? "第 " + state.round + " 回合｜" + (mapMode === "movement"
          ? "移動預覽：起點、路徑與" + (state.movement && state.movement.status !== "ready" ? "目前位置（尚未完成）" : "終點")
          : "所有角色目前位置與存活狀態")
        : "20 格環狀地圖｜建立遊戲後可標示角色位置";
    }
    if (hint) {
      hint.textContent = state && ST.Store.getActive(state) ? "點擊格位可手動移動目前角色" : "建立遊戲後可點擊格位調整位置";
    }

    if (!state) {
      stage.innerHTML = "";
      ST.MapRenderer.render(stage, null, { mode: "status", onNodeClick: function () {
        ST.App.toast("尚未建立遊戲，請先到「遊戲設定」建立或匯入存檔。", "error");
      } });
      return;
    }

    ST.MapRenderer.render(stage, state, {
      mode: mapMode,
      onNodeClick: function (nodeId) {
        var active = ST.Store.getActive(state);
        if (!active) return;
        if (state.movement) {
          ST.App.toast("請先完成或取消目前的移動預覽，再手動調整位置。", "error");
          return;
        }
        openMoveModal(active.id, nodeId);
      }
    });
  }

  /* ----------------------------------------------------------- 操作面板共用 */

  function quickTextPanel(state, rules) {
    if (!state) return "";
    var enabled = ST.TextGenerator.templates(rules).filter(function (template) { return template.enabled; });
    var suggested = ST.TextGenerator.generateSuggested(state, rules);
    var options = enabled.map(function (template) {
      return '<option value="' + esc(template.key) + '"' + (template.key === suggested.key ? " selected" : "") + ">" + esc(template.name) + "</option>";
    }).join("");
    var html = [];
    html.push('<details class="quick-text" open>');
    html.push('<summary><span>Plurk 文字輸出</span><span class="muted tiny">預覽與複製不會改變狀態</span></summary>');
    html.push('<div class="stack" style="gap:8px;margin-top:10px">');
    html.push('<div class="row" style="gap:8px">');
    html.push('<select data-quick-template aria-label="選擇文字模板" style="flex:1">' + options + "</select>");
    html.push('<button type="button" class="btn btn-ghost btn-sm" data-action="regen-text">重新生成</button>');
    html.push("</div>");
    html.push('<textarea id="quickText" rows="7" placeholder="文字會依目前狀態生成，可直接修改。">' + esc(suggested.text) + "</textarea>");
    html.push('<div class="row-wrap syntax-mini">');
    html.push('<span class="muted tiny">插入語法</span>');
    (ST.DICE_SYNTAX || []).forEach(function (item) {
      html.push('<button type="button" class="var-chip" data-insert-quick="' + esc(item.syntax) + '">' + esc(item.syntax) + "</button>");
    });
    html.push("</div>");
    html.push('<div class="row" style="gap:8px">');
    html.push('<button type="button" class="btn btn-primary btn-sm" style="flex:1" data-action="copy-text">複製文字</button>');
    html.push('<button type="button" class="btn btn-ghost btn-sm" data-action="open-text">文字輸出頁</button>');
    html.push("</div>");
    html.push("</div></details>");
    return html.join("");
  }

  function actionHeader(title, subtitle) {
    return '<div class="action-head"><div><p class="eyebrow">' + esc(subtitle || "Action") + "</p><h2>" + esc(title) + "</h2></div></div>";
  }

  /* ------------------------------------------------------------- 事件階段 */

  function renderEventPanel(state, rules, active) {
    var info = ST.Engine.getEventInfo(state, rules);
    var html = [];
    html.push(actionHeader("事件階段", "Event"));
    html.push(groupDrawCard(state));

    if (state.turnFlags.skipEvent) {
      html.push('<div class="notice notice-danger">本次行動無法觸發事件（黑薔薇莊園效果或人工指定）。</div>');
      html.push('<div class="stack" style="margin-top:12px">');
      html.push('<button type="button" class="btn btn-primary btn-block" data-action="skip-event">前往移動階段</button>');
      html.push("</div>");
      return html.join("") + quickTextPanel(state, rules);
    }

    if (!info.facility) {
      html.push('<div class="notice">目前位於第 ' + active.position + " 格，此格沒有設施事件。</div>");
      html.push('<div class="stack" style="margin-top:12px"><button type="button" class="btn btn-primary btn-block" data-action="skip-event">前往移動階段</button></div>');
      return html.join("") + quickTextPanel(state, rules);
    }

    var facility = info.facility;
    var event = info.event;
    html.push('<div class="facility-card">');
    html.push('<div class="row" style="justify-content:space-between"><span class="chip chip-gold">Rides ' + facility.id + "</span>" +
      '<span class="chip chip-green">固定規則</span></div>');
    html.push("<h3>" + esc(facilityTitle(facility)) + "</h3>");
    html.push('<p class="facility-quote">' + esc(facility.quote) + "</p>");

    if (!info.available) {
      html.push('<div class="notice">' + info.reasons.map(esc).join("<br>") + "</div>");
      html.push('<button type="button" class="btn btn-primary btn-block" style="margin-top:12px" data-action="skip-event">前往移動階段</button>');
      html.push("</div>");
      return html.join("") + quickTextPanel(state, rules);
    }

    html.push('<p class="small" style="margin-bottom:10px">' + esc(event.summary) + "</p>");
    if (info.reasons.length) {
      html.push('<div class="notice">' + info.reasons.map(esc).join("<br>") + "</div>");
    }
    var effects = collectEffectTypes(event, active.role);
    var warnings = [];
    if (effects.stepMod) warnings.push("移動步數會依結果增減。");
    if (effects.passByLock) warnings.push("本回合將不觸發途經。");
    if (effects.stepDice) warnings.push("移動階段會改用 (dice" + effects.stepDice + ")。");
    if (effects.bonusDice) warnings.push("可額外增加 (dice4) 步數。");
    if (effects.extraMove) warnings.push("原移動後可額外移動 (dice4)。");
    if (effects.capture) warnings.push("部分結果會直接捕獲角色。");
    if (effects.endTurn) warnings.push("部分結果會直接結束本回合行動。");
    if (effects.maxRoundMod) warnings.push("最大回合數可能變動。");
    if (effects.retire) warnings.push("部分結果會讓目前角色退場。");
    if (warnings.length) {
      html.push('<div class="notice">' + warnings.map(esc).join(" ") + "</div>");
    }

    var checks = ST.Engine.checksFor(event, active, state.mode);
    if (checks.length) {
      html.push('<div id="eventChecks" style="margin-top:12px">' + ST.Dice.fieldsHTML(checks) + "</div>");
    }

    var needsTeleport = !!effects.teleport;
    var needsRelease = !!effects.release;
    var needsBonus = !!effects.bonusDice;
    if (needsTeleport || needsRelease || needsBonus) {
      html.push('<div class="event-extras" style="margin-top:12px">');
      if (needsTeleport) {
        html.push('<div class="field"><label>傳送目的地（僅在結果為吉時使用）</label><select data-teleport-node>' +
          '<option value="">請選擇設施</option>' +
          ST.MAP.facilityIds.map(function (id) {
            return '<option value="' + id + '">' + esc(positionText(state, id)) + "</option>";
          }).join("") + "</select></div>");
      }
      if (needsBonus) {
        html.push('<div class="field"><label>額外移動骰值 (dice4)（若事件提供）</label>' +
          '<select data-bonus-dice><option value="">不使用</option>' +
          [1, 2, 3, 4].map(function (value) { return '<option value="' + value + '">' + value + "</option>"; }).join("") +
          "</select></div>");
      }
      if (needsRelease) {
        var limit = Number(rules.options.returnLimit) || 2;
        var out = state.players.filter(function (player) {
          return player.role === "hider" && !player.inPlay && Number(player.returnCount) < limit;
        });
        html.push('<div class="field"><label>指定返場的退場者</label><select data-release-player>' +
          (out.length ? out.map(function (player) {
            return '<option value="' + player.id + '">' + esc(player.characterName || player.name) + "（返場 " + player.returnCount + " 次）</option>";
          }).join("") : '<option value="">目前沒有退場者</option>') + "</select></div>");
        html.push('<div class="field"><label>返場起始位置 dice20</label><select data-return-dice>' +
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(function (value) {
            return '<option value="' + value + '">' + value + "</option>";
          }).join("") + "</select></div>");
      }
      html.push("</div>");
    }

    var outcomes = outcomeTable(event, active.role);
    if (Object.keys(outcomes).length) {
      html.push('<div class="outcome-list">');
      Object.keys(outcomes).forEach(function (key) {
        html.push('<div class="outcome-item"><span class="chip">' + esc(outcomeLabel(key)) + "</span><span>" + esc(outcomes[key].text || "") + "</span></div>");
      });
      html.push("</div>");
    }

    html.push('<div class="stack" style="margin-top:14px;gap:8px">');
    html.push('<button type="button" class="btn btn-primary btn-block" data-action="apply-event">套用事件結果</button>');
    html.push('<button type="button" class="btn btn-ghost btn-block" data-action="skip-event">' +
      (event.optional ? "不擲骰，照常行動" : "跳過事件，直接移動") + "</button>");
    html.push("</div>");
    html.push("</div>");
    return html.join("") + quickTextPanel(state, rules);
  }

  function outcomeTable(rule, role) {
    if (!rule) return {};
    return rule.roleOutcomes ? rule.roleOutcomes[role] || {} : rule.outcomes || {};
  }

  function outcomeLabel(key) {
    return key === "default" ? "預設結果" : key;
  }

  /** 多人模式：回合開始同格複數躲藏者的 draw 判定。 */
  function groupDrawCard(state) {
    if (state.mode !== "multi") return "";
    var groups = ST.Judgment.groupStacks(state).filter(function (group) {
      return !(state.groupDraws && state.groupDraws[state.round + ":" + group.cell]);
    });
    if (!groups.length) return "";
    var html = [];
    html.push('<div class="card" style="margin-bottom:12px;border-color:rgba(201,162,39,.3)">');
    html.push('<div class="card-head"><div><div class="card-title">同格躲藏者判定</div>' +
      '<div class="card-subtitle">回合開始時，同格兩人以上需擲等量 (draw)；全吉或全凶時，該格每位躲藏者移動時可各多骰一次 (dice4)。</div></div>' +
      '<span class="chip chip-gold">多人</span></div>');
    groups.forEach(function (group) {
      html.push('<div class="row" style="justify-content:space-between;margin-top:8px;gap:8px">');
      html.push('<span class="small">第 ' + group.cell + ' 格：' + group.hiders.map(function (hider) {
        return esc(hider.characterName || hider.name);
      }).join("、") + "（" + group.hiders.length + " 人）</span>");
      html.push('<button type="button" class="btn btn-ghost btn-sm" data-action="group-draw" data-cell="' + group.cell + '">輸入 (draw)</button>');
      html.push("</div>");
    });
    html.push("</div>");
    return html.join("");
  }

  function openGroupDrawModal(cell) {
    var state = currentState();
    if (!state) return;
    var group = ST.Judgment.groupStacks(state).filter(function (item) { return item.cell === Number(cell); })[0];
    if (!group) return;
    var body = [];
    body.push('<p class="field-hint">第 ' + cell + " 格：" + group.hiders.map(function (hider) { return esc(hider.characterName || hider.name); }).join("、") + "</p>");
    body.push('<div class="dice-grid" style="margin-top:12px">');
    group.hiders.forEach(function (hider, index) {
      body.push('<div class="dice-field"><div class="dice-field-head"><span>' + esc(hider.characterName || hider.name) + " 的 (draw)</span><small>draw</small></div>" +
        '<select data-group-draw="' + index + '"><option value="吉">吉</option><option value="凶">凶</option></select></div>');
    });
    body.push("</div>");
    body.push('<p class="field-hint" style="margin-top:12px">若全部相同，這些躲藏者本回合移動時可各多骰一次 (dice4)；沒使用就作廢。</p>');
    ST.App.openModal({
      title: "同格 draw 判定",
      body: body.join(""),
      footer: '<button type="button" class="btn btn-ghost" data-modal-close>取消</button>' +
        '<button type="button" class="btn btn-primary" data-apply-group>套用結果</button>',
      onMount: function (root) {
        root.querySelector("[data-apply-group]").addEventListener("click", function () {
          var draws = Array.prototype.map.call(root.querySelectorAll("[data-group-draw]"), function (select) {
            return select.value;
          });
          if (commit("多人同格 draw 判定", function (draft) {
            ST.Engine.applyGroupDraw(draft, currentRules(), { cell: Number(cell), draws: draws });
          }, "judgment")) {
            ST.App.closeModal();
            ST.App.toast("已記錄同格判定。", "ok");
          }
        });
      }
    });
  }

  function collectEffectTypes(rule, role) {
    var result = {};
    var table = outcomeTable(rule, role);
    Object.keys(table).forEach(function (key) {
      (table[key].effects || []).forEach(function (effect) {
        result[effect.type] = effect;
      });
    });
    return result;
  }

  /* ------------------------------------------------------------- 移動階段 */

  function renderMovementPanel(state, rules, active) {
    var html = [];
    html.push(actionHeader("移動階段", "Movement"));
    var flags = state.turnFlags;
    var session = state.movement;
    var baseRecord = state.turnResult.baseMovement;

    if (flags.skipMovement && !session) {
      html.push('<div class="notice notice-danger">本回合移動已取消或跳過。</div>');
      html.push('<div class="stack" style="margin-top:12px">');
      html.push('<button type="button" class="btn btn-primary btn-block" data-action="goto-judgment">前往判定階段</button>');
      html.push("</div>");
      return html.join("") + quickTextPanel(state, rules);
    }

    // 血月裁決：原移動結束後的額外移動
    if (!session && flags.extraMove && !flags.extraMove.used && baseRecord) {
      html.push('<div class="notice notice-ok"><strong>血月裁決：</strong>原移動已結束。可額外移動 (dice4) 格，方向可重新選擇；這次移動會重新判定途經。</div>');
      html.push('<div class="move-form">');
      html.push('<div class="field"><label>額外移動骰值 dice4</label><select data-extra-dice>' +
        [1, 2, 3, 4].map(function (value) { return '<option value="' + value + '">' + value + "</option>"; }).join("") + "</select></div>");
      html.push('<div class="field"><label>額外移動方向</label><select data-extra-direction>' +
        '<option value="1">順時針</option><option value="-1">逆時針</option></select></div>');
      html.push('<button type="button" class="btn btn-primary btn-block" data-action="start-extra-move">開始額外移動</button>');
      html.push('<button type="button" class="btn btn-ghost btn-block" data-action="skip-extra-move">放棄額外移動，進入判定</button>');
      html.push("</div>");
      return html.join("") + quickTextPanel(state, rules);
    }

    if (!session) {
      var stepDice = flags.stepDice || 4;
      var baseOptions = [];
      for (var value = 1; value <= stepDice; value += 1) baseOptions.push('<option value="' + value + '">' + value + "</option>");
      html.push('<div class="notice">依規則骰 <strong>(dice' + stepDice + ')</strong> 決定步數，再選擇方向。確認移動前不會改變角色位置。</div>');
      if (flags.stepMod || flags.bonusSteps) {
        html.push('<div class="row-wrap" style="margin-top:10px">');
        if (flags.stepMod) html.push('<span class="chip ' + (flags.stepMod > 0 ? "chip-green" : "chip-danger") + '">事件修正 ' + (flags.stepMod > 0 ? "+" : "") + flags.stepMod + "</span>");
        if (flags.bonusSteps) html.push('<span class="chip chip-gold">額外步數 +' + flags.bonusSteps + "</span>");
        html.push("</div>");
      }
      html.push('<div class="move-form">');
      html.push('<div class="field"><label>骰子結果（步數）</label><select data-move-steps>' + baseOptions.join("") + "</select></div>");
      html.push('<div class="field"><label>方向</label><select data-move-direction' + (flags.forcedDirection != null ? " disabled" : "") + '>' +
        '<option value="1"' + (flags.forcedDirection === 1 ? " selected" : "") + ">順時針</option>" +
        '<option value="-1"' + (flags.forcedDirection === -1 ? " selected" : "") + ">逆時針</option></select></div>");
      html.push('<div class="field"><label>額外步數（手動加減）</label><input type="number" data-extra-steps min="0" max="40" value="' +
        Number(flags.bonusSteps || 0) + '"></div>');
      var groupDiceAvailable = state.groupDice4 && state.groupDice4[active.id];
      if (groupDiceAvailable) {
        html.push('<div class="field"><label>同格加骰 dice4（可選）</label><select data-group-dice4>' +
          '<option value="0">不使用</option>' +
          [1, 2, 3, 4].map(function (value) { return '<option value="' + value + '">' + value + "</option>"; }).join("") +
          "</select></div>");
      }
      var initialTotal = Math.max(0, 1 + Number(flags.bonusSteps || 0) + Number(flags.stepMod || 0));
      html.push('<div class="move-total" id="moveTotal">預估合計 ' + initialTotal + ' 格（基礎 1、額外 ' + Number(flags.bonusSteps || 0) +
        (flags.stepMod ? "、事件 " + flags.stepMod : "") + (groupDiceAvailable ? "、同格加骰 0" : "") + '）</div>');
      if (flags.forcedDirection != null) {
        html.push('<div class="notice">本回合方向由事件決定：' + (flags.forcedDirection === 1 ? "順時針" : "逆時針") + "。</div>");
      }
      html.push('<button type="button" class="btn btn-primary btn-block" data-action="preview-movement" style="margin-top:4px">預覽移動</button>');
      html.push("</div>");
      html.push('<button type="button" class="btn btn-ghost btn-block" style="margin-top:8px" data-action="manual-move" data-player="' + active.id + '">直接手動移動（不觸發途經）</button>');
      return html.join("") + quickTextPanel(state, rules);
    }

    var summary = ST.Movement.summary(session);
    var displayPath = session.kind === "extra" && session.priorPath
      ? session.priorPath.concat(session.path.slice(1))
      : session.path;
    html.push('<div class="move-summary">');
    html.push('<div class="row-wrap" style="justify-content:space-between">');
    html.push('<span class="chip chip-gold">' + (session.kind === "extra" ? "額外移動" : "原移動") + " · " + esc(ST.Movement.directionLabel(session.direction)) + "</span>");
    html.push('<span class="chip">剩餘 ' + session.remainingSteps + " 步</span>");
    html.push("</div>");
    html.push('<div class="path-chain">' + displayPath.map(function (nodeId) {
      return '<span class="path-node">' + nodeId + "</span>";
    }).join('<span class="path-arrow">→</span>') + "</div>");
    html.push('<div class="kv" style="margin-top:10px">');
    html.push("<dt>起點</dt><dd>" + esc(positionText(state, session.startPosition)) + "</dd>");
    html.push("<dt>目前位置</dt><dd>" + esc(positionText(state, summary.endPosition)) + "</dd>");
    html.push("<dt>總步數</dt><dd>" + summary.stepsTotal + " 步</dd>");
    html.push("</div>");
    html.push("</div>");

    if (session.pending) {
      var facility = facilityFor(state, rules, session.pending.nodeId);
      var passBy = facility ? facility.passBy : null;
      html.push('<div class="facility-card" style="margin-top:12px">');
      html.push('<div class="row" style="justify-content:space-between"><span class="chip chip-gold">途經</span><span class="chip">' + esc(positionText(state, session.pending.nodeId)) + "</span></div>");
      html.push("<h3>" + esc(facilityTitle(facility)) + "</h3>");
      html.push('<p class="small">' + esc(passBy ? passBy.summary : "") + "</p>");
      html.push('<div id="passbyChecks" style="margin-top:10px">' +
        (passBy ? ST.Dice.fieldsHTML(ST.Engine.checksFor(passBy, active, state.mode)) : "") + "</div>");
      var passEffects = collectEffectTypes(passBy, active.role);
      if (passEffects.resumeDice) {
        html.push('<div class="field" style="margin-top:10px"><label>重新行進骰值 dice4</label><select data-resume-dice>' +
          [1, 2, 3, 4].map(function (value) { return '<option value="' + value + '">' + value + "</option>"; }).join("") + "</select></div>");
      }
      var passOutcomes = outcomeTable(passBy, active.role);
      if (Object.keys(passOutcomes).length) {
        html.push('<div class="outcome-list">');
        Object.keys(passOutcomes).forEach(function (key) {
          html.push('<div class="outcome-item"><span class="chip">' + esc(outcomeLabel(key)) + "</span><span>" + esc(passOutcomes[key].text || "") + "</span></div>");
        });
        html.push("</div>");
      }
      html.push('<div class="stack" style="margin-top:12px;gap:8px">');
      html.push('<button type="button" class="btn btn-primary btn-block" data-action="apply-passby">套用途經結果</button>');
      if (session.canRefusePassBy) {
        html.push('<button type="button" class="btn btn-ghost btn-block" data-action="refuse-passby">拒絕觸發途經（剩一次）</button>');
      }
      html.push('<button type="button" class="btn btn-ghost btn-block" data-action="stop-movement">就地停止移動</button>');
      html.push("</div>");
      html.push("</div>");
    } else {
      var confirmLabel = session.kind === "extra"
        ? "確認額外移動並進入判定"
        : (flags.extraMove && !flags.extraMove.used ? "確認原移動" : "確認移動並進入判定");
      html.push('<div class="notice notice-ok" style="margin-top:12px">移動已結束，終點：' + esc(positionText(state, summary.endPosition)) + "。確認後才會正式更新角色位置。</div>");
      html.push('<div class="stack" style="margin-top:12px;gap:8px">');
      html.push('<button type="button" class="btn btn-primary btn-block" data-action="confirm-movement">' + confirmLabel + "</button>");
      html.push('<button type="button" class="btn btn-ghost btn-block" data-action="discard-movement">取消本次預覽</button>');
      html.push("</div>");
    }
    return html.join("") + quickTextPanel(state, rules);
  }

  /* ------------------------------------------------------------- 判定階段 */

  function relocationCard(state) {
    if (!state.pendingRelocation) return "";
    var remaining = state.players.filter(function (player) {
      return player.role === "hider" && player.inPlay && !player.captured;
    });
    if (!remaining.length) return "";
    return '<div class="card" style="border-color:rgba(201,162,39,.3)">' +
      '<div class="card-head"><div><div class="card-title">退場後選擇性移動</div>' +
      '<div class="card-subtitle">' + esc(state.pendingRelocation.capturedName) + ' 退場。其餘躲藏者可骰 (dice20)，決定是否移動到骰出的格位；此移動不觸發途經。</div></div>' +
      '<span class="chip chip-gold">多人</span></div>' +
      '<div class="row-wrap" style="margin-top:8px">' + remaining.map(function (player) {
        return '<span class="chip chip-hider">' + esc(player.characterName || player.name) + "（" + player.position + "）</span>";
      }).join("") + "</div>" +
      '<div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="post-capture-move">輸入 (dice20) 移動</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="skip-relocation">全員不移動</button>' +
      "</div></div>";
  }

  function openRelocationModal() {
    var state = currentState();
    if (!state || !state.pendingRelocation) return;
    var remaining = state.players.filter(function (player) {
      return player.role === "hider" && player.inPlay && !player.captured;
    });
    var body = [];
    body.push('<p class="field-hint">勾選要移動的躲藏者，選入 (dice20) 的結果。未勾選者留在原格。</p>');
    remaining.forEach(function (player) {
      body.push('<div class="relocate-row">');
      body.push('<label class="check-row" style="flex:1"><input type="checkbox" data-relocate-player="' + esc(player.id) + '">' +
        "<span>" + esc(player.characterName || player.name) + "（目前 " + player.position + "）</span></label>");
      body.push('<select data-relocate-position="' + esc(player.id) + '" style="max-width:160px">' +
        positionOptionsFor(player.position) + "</select>");
      body.push("</div>");
    });
    ST.App.openModal({
      title: "退場後移動（dice20）",
      body: body.join(""),
      footer: '<button type="button" class="btn btn-ghost" data-modal-close>取消</button>' +
        '<button type="button" class="btn btn-primary" data-apply-relocation>套用移動</button>',
      onMount: function (root) {
        root.querySelector("[data-apply-relocation]").addEventListener("click", function () {
          var moves = [];
          state.players.forEach(function (player) {
            var checkbox = root.querySelector('[data-relocate-player="' + player.id + '"]');
            if (!checkbox || !checkbox.checked) return;
            var select = root.querySelector('[data-relocate-position="' + player.id + '"]');
            moves.push({ playerId: player.id, position: Number(select ? select.value : player.position) });
          });
          if (commit("退場後移動", function (draft) {
            if (moves.length) ST.Engine.applyPostCaptureMoves(draft, currentRules(), moves);
            else ST.Engine.skipPostCaptureMoves(draft);
          }, "movement", moves.length ? "已套用退場後移動。" : "其餘躲藏者選擇不移動。")) {
            ST.App.closeModal();
          }
        });
      }
    });
  }

  function positionOptionsFor(selected) {
    return ST.MAP.nodes.map(function (node) {
      return '<option value="' + node.id + '"' + (Number(selected) === node.id ? " selected" : "") + ">" +
        node.id + (node.name ? "．" + esc(node.name) : "") + "</option>";
    }).join("");
  }

  function renderJudgmentPanel(state, rules, active) {
    var html = [];
    html.push(actionHeader("判定階段", "Judgment"));
    var pending = state.pendingCapture;

    if (pending) {
      var target = playerById(state, pending.playerId);
      html.push('<div class="notice notice-danger"><strong>捕獲待確認</strong><br>' +
        esc(target ? target.name : pending.playerName) + "：" + esc(pending.reason) + "</div>");
      html.push('<div class="stack" style="margin-top:12px">');
      html.push('<button type="button" class="btn btn-danger btn-block" data-action="confirm-capture">確認捕獲</button>');
      html.push('<button type="button" class="btn btn-ghost btn-block" data-action="cancel-capture">取消（人工裁定）</button>');
      html.push("</div>");
      return html.join("") + quickTextPanel(state, rules);
    }

    if (state.turnFlags.endTurn) {
      if (state.pendingRelocation) html.push(relocationCard(state));
      html.push('<div class="notice">本回合行動已結束（移動或判定已略過）。</div>');
      html.push('<div class="stack" style="margin-top:12px">');
      html.push('<button type="button" class="btn btn-primary btn-block" data-action="finish-turn">結束行動，換下一位</button>');
      html.push("</div>");
      return html.join("") + quickTextPanel(state, rules);
    }

    if (state.pendingRelocation) {
      html.push(relocationCard(state));
    }

    var info = ST.Engine.judgmentInfo(state, rules);
    if (state.turnFlags.pendingEscape) {
      html.push('<div class="notice notice-ok"><strong>draw 吉：</strong>加骰 dice4，按原方向加速逃離。</div>');
      html.push('<div class="move-form">');
      html.push('<div class="field"><label>加速步數 dice4</label><select data-escape-dice>' +
        [1, 2, 3, 4].map(function (value) { return '<option value="' + value + '">' + value + "</option>"; }).join("") + "</select></div>");
      html.push('<button type="button" class="btn btn-primary btn-block" data-action="resolve-escape">加速逃離</button>');
      html.push("</div>");
    }

    if (!info.situations.length) {
      html.push('<div class="notice notice-ok" style="margin-top:12px">本次行動沒有觸發遭遇判定。</div>');
    } else {
      info.situations.forEach(function (situation) {
        html.push('<div class="situation-card">');
        html.push('<div class="card-head"><div><div class="card-title">' + esc(situation.title) + "</div>" +
          '<div class="card-subtitle">' + esc(situation.detail) + "</div></div>" +
          '<span class="chip ' + (situation.kind.indexOf("seeker") === 0 ? "chip-seeker" : "chip-hider") + '">' +
          esc(situation.diceType || "自動") + "</span></div>");
        if (situation.multiNote) html.push('<div class="notice">' + esc(situation.multiNote) + "</div>");
        html.push('<div class="row-wrap" style="margin-top:10px;gap:6px">');
        situation.options.forEach(function (option) {
          var buttonClass = option.value === "capture" || option.value === "凶" ? "btn-danger" : "btn-ghost";
          html.push('<button type="button" class="btn ' + buttonClass + ' btn-sm" data-action="apply-judgment" data-situation="' +
            esc(situation.id) + '" data-value="' + esc(option.value) + '">' + esc(option.label) + "</button>");
        });
        html.push("</div>");
        html.push("</div>");
      });
    }

    if (info.stacks && info.stacks.length) {
      html.push('<div class="card" style="margin-top:12px">');
      html.push('<div class="card-head"><div><div class="card-title">同格躲藏者</div><div class="card-subtitle">多人模式：追捕者判定只捕獲最後抵達者</div></div></div>');
      info.stacks.forEach(function (stack) {
        html.push('<div class="small">第 ' + stack.cell + " 格：" + stack.hiders.map(function (hider) {
          return esc(hider.name) + "（序 " + hider.arrivalSeq + "）";
        }).join("、") + "</div>");
      });
      html.push("</div>");
    }

    html.push('<div class="stack" style="margin-top:14px;gap:8px">');
    html.push('<button type="button" class="btn btn-primary btn-block" data-action="finish-turn">完成判定，結束行動</button>');
    html.push('<button type="button" class="btn btn-ghost btn-block" data-action="manual-move" data-player="' + active.id + '">手動調整位置</button>');
    html.push("</div>");
    return html.join("") + quickTextPanel(state, rules);
  }

  /* ---------------------------------------------------------------- 主面板 */

  function renderAction() {
    var container = document.getElementById("actionPanel");
    var state = currentState();
    var rules = currentRules();

    if (!state) {
      var example = ST.Store.getRules();
      container.innerHTML = '' +
        '<div class="empty" style="text-align:left">' +
        '<p class="eyebrow">Start Here</p>' +
        '<strong>建立第一場遊戲</strong>' +
        '<p class="small" style="margin:8px 0 14px">網站需要先有遊戲狀態，才能計算移動、判定與產生文字。設施規則已內建，操作時會在右側面板顯示。</p>' +
        '<div class="stack">' +
        '<button type="button" class="btn btn-primary btn-block" data-action="new-game">建立新遊戲</button>' +
        '<button type="button" class="btn btn-ghost btn-block" data-action="manual-resume">手動接續既有遊戲</button>' +
        "</div></div>" +
        '<div class="card" style="margin-top:14px"><div class="card-title">這個工作台會做什麼？</div>' +
        '<ul class="list-plain" style="margin-top:6px">' +
        "<li>管理 20 格地圖、角色位置與回合。</li>" +
        "<li>依設施規則協助事件、途經與捕獲判定。</li>" +
        "<li>產生可直接貼到 Plurk 的文字與地圖 PNG。</li>" +
        "<li>自動暫存，並可匯出 JSON 備份。</li>" +
        "</ul></div>";
      return;
    }

    if (state.phase === "ended") {
      var result = state.result || {};
      container.innerHTML = '' +
        actionHeader("遊戲結束", "Result") +
        '<div class="notice ' + (result.winner === "seeker" ? "notice-danger" : "notice-ok") + '">' +
        "<strong>" + esc(result.winnerLabel || "遊戲結束") + "</strong><br>" + esc(result.reason || "") + "</div>" +
        '<div class="stat-grid" style="margin-top:12px">' +
        "<div class=\"stat\"><dt>結束回合</dt><dd>" + (result.round || state.round) + "</dd></div>" +
        "<div class=\"stat\"><dt>遊戲模式</dt><dd>" + esc(ST.getMode(state.mode).short) + "</dd></div>" +
        "</div>" +
        '<div class="stack" style="margin-top:14px">' +
        '<button type="button" class="btn btn-primary btn-block" data-action="new-game">建立新遊戲</button>' +
        '<button type="button" class="btn btn-ghost btn-block" data-action="undo">撤銷最後一個操作</button>' +
        "</div>" +
        quickTextPanel(state, rules);
      return;
    }

    var active = ST.Store.getActive(state);
    if (!active) {
      container.innerHTML = actionHeader("尚未指定行動角色", "Paused") +
        '<div class="notice">請由左側角色列表選擇「設為行動」。</div>';
      return;
    }

    if (state.phase === "event") container.innerHTML = renderEventPanel(state, rules, active);
    else if (state.phase === "movement") container.innerHTML = renderMovementPanel(state, rules, active);
    else if (state.phase === "judgment") container.innerHTML = renderJudgmentPanel(state, rules, active);
    else container.innerHTML = actionHeader("待命", "Idle") + '<div class="notice">請確認遊戲狀態。</div>';
  }

  /* ---------------------------------------------------------------- 手動移動 */

  function openMoveModal(playerId, presetNode) {
    var state = currentState();
    if (!state) {
      ST.App.toast("請先建立遊戲。", "error");
      return;
    }
    var player = playerById(state, playerId);
    if (!player) return;
    var body = '<div class="node-grid">';
    ST.MAP.nodes.forEach(function (node) {
      var isCurrent = Number(player.position) === node.id;
      body += '<button type="button" class="node-button' + (isCurrent ? " is-current" : "") + (node.type === "facility" ? " is-facility" : "") +
        '" data-node-pick="' + node.id + '"><strong>' + node.id + "</strong><span>" + esc(node.name || "一般格") + "</span></button>";
    });
    body += "</div><p class=\"muted tiny\" style=\"margin-top:10px\">手動移動不會觸發事件或途經效果，僅調整位置。</p>";
    ST.App.openModal({
      title: "手動移動：" + player.name,
      size: "wide",
      body: body,
      footer: '<button type="button" class="btn btn-ghost" data-modal-close>取消</button>',
      onMount: function (root) {
        root.querySelectorAll("[data-node-pick]").forEach(function (button) {
          button.addEventListener("click", function () {
            var nodeId = Number(button.getAttribute("data-node-pick"));
            if (commit("手動移動 " + player.name, function (draft) {
              ST.Engine.movePlayer(draft, player.id, nodeId, "由地圖面板手動調整");
            }, "manual", player.name + " 已移動到 " + ST.MAP.label(nodeId))) {
              ST.App.closeModal();
            }
          });
        });
        var preset = presetNode ? root.querySelector('[data-node-pick="' + presetNode + '"]') : null;
        if (preset) preset.classList.add("is-current");
      }
    });
  }

  /* ---------------------------------------------------------------- 事件操作 */

  function applyEvent() {
    var state = currentState();
    var rules = currentRules();
    var active = ST.Store.getActive(state);
    var info = ST.Engine.getEventInfo(state, rules);
    if (!info.available) {
      ST.App.toast(info.reasons.join("；"), "error");
      return;
    }
    var checks = ST.Engine.checksFor(info.event, active, state.mode);
    var diceResult = ST.Dice.read(document.getElementById("eventChecks"));
    if (checks.length && !diceResult.ok) {
      ST.App.toast(diceResult.errors.join(" "), "error");
      return;
    }
    var value = null;
    if (checks.length) {
      var firstKey = checks[0].key;
      value = diceResult.values[firstKey];
      if (value == null) value = Object.keys(diceResult.values).map(function (key) { return diceResult.values[key]; })[0];
      value = ST.Engine.normalizeDrawValue(value);
    }
    var panel = document.getElementById("actionPanel");
    var teleportNode = fieldValue(panel, "[data-teleport-node]") || null;
    var releasePlayer = fieldValue(panel, "[data-release-player]") || null;
    var returnDice = fieldValue(panel, "[data-return-dice]") || null;
    var bonusDiceRaw = fieldValue(panel, "[data-bonus-dice]");
    var bonusDice = bonusDiceRaw === "" ? null : Number(bonusDiceRaw);

    commit("套用事件：" + info.facility.name, function (draft) {
      ST.Engine.applyEvent(draft, rules, {
        value: value,
        diceValue: bonusDice,
        teleportNode: teleportNode ? Number(teleportNode) : null,
        releasePlayerId: releasePlayer || null,
        returnDice: returnDice ? Number(returnDice) : null
      });
    }, "event", "事件結果已套用。");
  }

  function skipEvent() {
    var rules = currentRules();
    commit("跳過事件", function (draft) {
      ST.Engine.skipEvent(draft, rules);
    }, "event", "已進入移動階段。");
  }

  /* ---------------------------------------------------------------- 移動操作 */

  function updateMoveTotal() {
    var state = currentState();
    var totalNode = document.getElementById("moveTotal");
    if (!state || !totalNode) return;
    var panel = document.getElementById("actionPanel");
    var base = Number(fieldValue(panel, "[data-move-steps]") || 0);
    var extra = Number(fieldValue(panel, "[data-extra-steps]") || 0);
    var modifier = Number(state.turnFlags.stepMod || 0);
    var group = Number(fieldValue(panel, "[data-group-dice4]") || 0);
    var total = Math.max(0, base + extra + modifier + group);
    totalNode.textContent = "預估合計 " + total + " 格（基礎 " + base + "、額外 " + extra +
      (modifier ? "、事件 " + modifier : "") + (group ? "、同格加骰 " + group : "") + "）";
  }

  function previewMovement() {
    var state = currentState();
    var rules = currentRules();
    var panel = document.getElementById("actionPanel");
    var base = Number(fieldValue(panel, "[data-move-steps]") || 0);
    var extra = Number(fieldValue(panel, "[data-extra-steps]") || 0);
    var direction = Number(fieldValue(panel, "[data-move-direction]") || 1);
    if (state.turnFlags.forcedDirection != null) direction = state.turnFlags.forcedDirection;
    var groupDice = Number(fieldValue(panel, "[data-group-dice4]") || 0);
    var total = Math.max(0, base + extra + Number(state.turnFlags.stepMod || 0) + groupDice);
    commit("預覽移動", function (draft) {
      ST.Engine.startMovement(draft, rules, {
        steps: total,
        total: total,
        direction: direction,
        baseSteps: base,
        stepMod: state.turnFlags.stepMod,
        bonusSteps: extra,
        groupDiceUsed: groupDice > 0,
        groupDiceValue: groupDice
      });
    }, "movement", "已產生移動預覽，請處理途經效果。");
  }

  function startExtraMove() {
    var panel = document.getElementById("actionPanel");
    var dice = Number(fieldValue(panel, "[data-extra-dice]") || 1);
    var direction = Number(fieldValue(panel, "[data-extra-direction]") || 1);
    commit("開始額外移動", function (draft) {
      ST.Engine.startMovement(draft, currentRules(), {
        kind: "extra",
        steps: dice,
        total: dice,
        direction: direction
      });
    }, "movement", "已開始額外移動，請處理途經效果。");
  }

  function skipExtraMove() {
    commit("放棄額外移動", function (draft) {
      ST.Engine.skipExtraMove(draft);
    }, "movement", "已放棄額外移動，進入判定。");
  }

  function applyPassBy() {
    var state = currentState();
    var rules = currentRules();
    var session = state.movement;
    if (!session || !session.pending) {
      ST.App.toast("目前沒有待處理的途經。", "error");
      return;
    }
    var facility = facilityFor(state, rules, session.pending.nodeId);
    var checks = ST.Engine.checksFor(facility.passBy, ST.Store.getActive(state), state.mode);
    var diceResult = ST.Dice.read(document.getElementById("passbyChecks"));
    if (checks.length && !diceResult.ok) {
      ST.App.toast(diceResult.errors.join(" "), "error");
      return;
    }
    var value = null;
    if (checks.length) {
      var firstKey = checks[0].key;
      value = diceResult.values[firstKey];
      if (value == null) value = Object.keys(diceResult.values).map(function (key) { return diceResult.values[key]; })[0];
      value = ST.Engine.normalizeDrawValue(value);
    }
    var panel = document.getElementById("actionPanel");
    var resumeRaw = fieldValue(panel, "[data-resume-dice]");
    var resumeDice = resumeRaw === "" ? null : Number(resumeRaw);
    commit("途經：" + facility.name, function (draft) {
      ST.Engine.applyPassBy(draft, rules, { value: value, diceValue: resumeDice });
    }, "passby", "途經效果已套用。");
  }

  function confirmMovement() {
    var rules = currentRules();
    commit("確認移動", function (draft) {
      ST.Engine.confirmMovement(draft, rules);
    }, "movement", "角色位置已更新，請進行判定。");
  }

  /* ---------------------------------------------------------------- 判定操作 */

  function applyJudgment(situationId, value) {
    var rules = currentRules();
    commit("遭遇判定", function (draft) {
      ST.Engine.applyJudgment(draft, rules, { situationId: situationId, value: value });
    }, "judgment", "判定已套用。");
  }

  function resolveEscape() {
    var rules = currentRules();
    var panel = document.getElementById("actionPanel");
    var dice = Number(fieldValue(panel, "[data-escape-dice]") || 1);
    commit("加速逃離", function (draft) {
      ST.Engine.resolveEscape(draft, rules, dice);
    }, "judgment", "已加速逃離。");
  }

  function confirmCapture() {
    var state = currentState();
    var rules = currentRules();
    if (!state.pendingCapture) return;
    var pending = state.pendingCapture;
    commit("確認捕獲", function (draft) {
      ST.Engine.capture(draft, rules, pending.playerId, pending.reason);
    }, "capture", "捕獲已套用。");
  }

  function cancelCapture() {
    commit("取消捕獲", function (draft) {
      draft.pendingCapture = null;
      draft.turnFlags.endTurn = false;
      if (draft.phase !== "ended") draft.phase = "judgment";
    }, "manual", "已取消捕獲，維持原狀態。");
  }

  function finishTurn() {
    var rules = currentRules();
    commit("結束角色行動", function (draft) {
      ST.Engine.finishTurn(draft, rules);
    }, "turn", "已結束目前行動。");
  }

  function nextTurn() {
    var state = currentState();
    var active = ST.Store.getActive(state);
    if (!state) return;
    var needsConfirm = active && state.phase !== "judgment" && state.phase !== "ended";
    if (!needsConfirm) {
      finishTurn();
      return;
    }
    ST.App.confirm("目前仍在「" + phaseLabel(state.phase) + "」，尚未完成的步驟會被略過。確定結束 " + active.name + " 的行動？", {
      title: "結束目前行動",
      confirmLabel: "結束行動",
      danger: true
    }).then(function (ok) {
      if (ok) finishTurn();
    });
  }

  /* ---------------------------------------------------------------- 文字操作 */

  function currentQuickText() {
    var area = document.getElementById("quickText");
    return area ? area.value : "";
  }

  function regenerateQuickText() {
    var state = currentState();
    var rules = currentRules();
    var select = document.querySelector("[data-quick-template]");
    var key = select ? select.value : ST.TextGenerator.suggestedKey(state);
    var template = ST.TextGenerator.getTemplate(rules, key);
    var area = document.getElementById("quickText");
    if (!area || !template) return;
    area.value = ST.TextGenerator.render(template.template, ST.TextGenerator.buildContext(state, rules, {}));
  }

  function copyQuickText() {
    var text = currentQuickText();
    if (!text.trim()) {
      ST.App.toast("沒有可複製的文字。", "error");
      return;
    }
    function fallback() {
      var area = document.getElementById("quickText");
      if (!area) return;
      area.select();
      try {
        document.execCommand("copy");
        ST.App.toast("已複製文字。", "ok");
      } catch (error) {
        ST.App.toast("瀏覽器不允許自動複製，請手動選取。", "error");
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        ST.App.toast("已複製文字，可貼到 Plurk。", "ok");
      }).catch(fallback);
    } else {
      fallback();
    }
  }

  /* ---------------------------------------------------------------- 匯出 */

  function previewExport(mode) {
    var state = currentState();
    if (!state) {
      ST.App.toast("請先建立遊戲。", "error");
      return;
    }
    ST.App.openModal({
      title: "地圖匯出預覽",
      size: "wide",
      body: '<div class="export-loading">正在產生圖片…</div>',
      footer: '<button type="button" class="btn btn-ghost" data-modal-close>關閉</button>'
    });
    ST.MapExport.exportPNG(state, { mode: mode }).then(function (dataUrl) {
      var root = document.getElementById("modalRoot");
      var body = root.querySelector(".modal-body");
      body.innerHTML = '<img class="export-preview" alt="地圖匯出預覽" src="' + dataUrl + '">' +
        '<p class="muted tiny" style="margin-top:8px">圖片尺寸 1717 × ' + (ST.MAP.renderHeight + 96 + 50) + '，適合直接上傳 Plurk。</p>';
      var footer = root.querySelector(".modal-footer");
      footer.innerHTML = '<button type="button" class="btn btn-ghost" data-modal-close>關閉</button>' +
        '<button type="button" class="btn btn-primary" data-download-png>下載 PNG</button>';
      footer.querySelector("[data-download-png]").addEventListener("click", function () {
        ST.MapExport.download(dataUrl, ST.MapExport.filename(state, mode));
        ST.App.toast("PNG 已下載。", "ok");
      });
    }).catch(function (error) {
      ST.App.toast("匯出失敗：" + error.message, "error");
      ST.App.closeModal();
    });
  }

  function downloadExport(mode) {
    var state = currentState();
    if (!state) {
      ST.App.toast("請先建立遊戲。", "error");
      return;
    }
    ST.MapExport.exportPNG(state, { mode: mode }).then(function (dataUrl) {
      ST.MapExport.download(dataUrl, ST.MapExport.filename(state, mode));
      ST.App.toast("PNG 已下載。", "ok");
    }).catch(function (error) {
      ST.App.toast("匯出失敗：" + error.message, "error");
    });
  }

  /* ---------------------------------------------------------------- 事件綁定 */

  function init() {
    document.getElementById("mapModeSwitch").addEventListener("click", function (event) {
      var button = event.target.closest("[data-map-mode]");
      if (!button) return;
      mapMode = button.getAttribute("data-map-mode");
      renderMap();
    });

    document.getElementById("infoPanel").addEventListener("click", function (event) {
      var button = event.target.closest("[data-action]");
      if (!button) return;
      var action = button.getAttribute("data-action");
      if (action === "go-setup" || action === "new-game" || action === "manual-resume") {
        ST.App.navigate("setup");
      } else if (action === "manual-move") {
        openMoveModal(button.getAttribute("data-player"));
      } else if (action === "set-active") {
        var playerId = button.getAttribute("data-player");
        commit("切換行動角色", function (draft) {
          ST.TurnManager.setActive(draft, currentRules(), playerId);
        }, "turn", "已切換行動角色。");
      } else if (action === "next-turn") {
        nextTurn();
      } else if (action === "undo") {
        var snapshot = ST.Store.undo();
        if (snapshot) ST.App.toast("已撤銷：" + snapshot.label, "ok");
        else ST.App.toast("沒有可撤銷的操作。", "error");
      }
    });

    document.getElementById("actionPanel").addEventListener("click", function (event) {
      var button = event.target.closest("[data-action]");
      if (!button) return;
      var action = button.getAttribute("data-action");
      switch (action) {
        case "new-game":
        case "manual-resume":
          ST.App.navigate("setup");
          break;
        case "go-setup":
          ST.App.navigate("setup");
          break;
        case "apply-event": applyEvent(); break;
        case "skip-event": skipEvent(); break;
        case "group-draw": openGroupDrawModal(button.getAttribute("data-cell")); break;
        case "preview-movement": previewMovement(); break;
        case "start-extra-move": startExtraMove(); break;
        case "skip-extra-move": skipExtraMove(); break;
        case "apply-passby": applyPassBy(); break;
        case "refuse-passby":
          commit("拒絕途經", function (draft) {
            ST.Engine.refusePassBy(draft, currentRules());
          }, "passby", "已拒絕觸發途經。");
          break;
        case "stop-movement":
          commit("停止移動", function (draft) {
            ST.Engine.stopMovement(draft);
          }, "movement", "已停止移動。");
          break;
        case "confirm-movement": confirmMovement(); break;
        case "discard-movement":
          commit("取消移動預覽", function (draft) {
            draft.movement = null;
            draft.phase = "movement";
          }, "movement", "已取消移動預覽。");
          break;
        case "goto-judgment":
          commit("前往判定", function (draft) {
            draft.phase = "judgment";
          }, "manual");
          break;
        case "apply-judgment":
          applyJudgment(button.getAttribute("data-situation"), button.getAttribute("data-value"));
          break;
        case "resolve-escape": resolveEscape(); break;
        case "confirm-capture": confirmCapture(); break;
        case "cancel-capture": cancelCapture(); break;
        case "post-capture-move": openRelocationModal(); break;
        case "skip-relocation":
          commit("退場後不移動", function (draft) {
            ST.Engine.skipPostCaptureMoves(draft);
          }, "movement", "其餘躲藏者選擇不移動。");
          break;
        case "finish-turn": finishTurn(); break;
        case "manual-move": openMoveModal(button.getAttribute("data-player")); break;
        case "copy-text": copyQuickText(); break;
        case "regen-text": regenerateQuickText(); break;
        case "open-text": ST.App.navigate("text"); break;
        case "undo":
          var snapshot = ST.Store.undo();
          if (snapshot) ST.App.toast("已撤銷：" + snapshot.label, "ok");
          break;
      }
    });

    document.getElementById("actionPanel").addEventListener("click", function (event) {
      var chip = event.target.closest("[data-insert-quick]");
      if (!chip) return;
      var area = document.getElementById("quickText");
      if (!area) return;
      var token = chip.getAttribute("data-insert-quick");
      var focused = document.activeElement === area;
      var start = focused ? area.selectionStart : area.value.length;
      var end = focused ? area.selectionEnd : area.value.length;
      area.value = area.value.slice(0, start) + token + area.value.slice(end);
      area.focus();
      area.selectionStart = area.selectionEnd = start + token.length;
    });

    document.getElementById("actionPanel").addEventListener("change", function (event) {
      if (event.target.matches("[data-quick-template]")) {
        regenerateQuickText();
      } else if (event.target.matches("[data-move-steps], [data-extra-steps], [data-group-dice4]")) {
        updateMoveTotal();
      }
    });

    document.getElementById("actionPanel").addEventListener("input", function (event) {
      if (event.target.matches("[data-extra-steps]")) updateMoveTotal();
    });
    document.getElementById("exportPreviewBtn").addEventListener("click", function () {
      previewExport(mapMode === "movement" ? "movement" : "status");
    });
    document.getElementById("exportPngBtn").addEventListener("click", function () {
      downloadExport(mapMode === "movement" ? "movement" : "status");
    });
  }

  function render() {
    renderInfo();
    renderMap();
    renderAction();
  }

  ST.Console = {
    init: init,
    render: render,
    openMoveModal: openMoveModal,
    setMapMode: function (mode) { mapMode = mode; renderMap(); }
  };
})(window.ST = window.ST || {});
