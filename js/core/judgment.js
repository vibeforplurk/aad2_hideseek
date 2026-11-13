/*
 * 暮影領地捉迷藏｜判定
 * ------------------------------------------------------------------
 * 依規則書的判定階段條件，分析目前行動是否構成：
 *   1. 追捕者停留在躲藏者所在格
 *   2. 追捕者途經躲藏者所在格
 *   3. 躲藏者停留在追捕者所在格
 *   4. 躲藏者途經追捕者所在格
 * 分析結果交由主持人輸入 draw／coin 後確認，不自動決定勝負。
 */
(function (ST) {
  "use strict";

  function playersOf(state, role) {
    return state.players.filter(function (p) { return p.role === role && p.inPlay && !p.captured; });
  }

  function getPlayer(state, id) {
    return state.players.filter(function (p) { return p.id === id; })[0] || null;
  }

  function displayName(player) {
    return player ? (player.characterName || player.name) : "";
  }

  function lastArrivalAt(state, nodeId, role) {    var list = state.players.filter(function (p) {
      return p.role === role && p.inPlay && !p.captured && Number(p.position) === Number(nodeId);
    });
    if (!list.length) return null;
    list.sort(function (a, b) { return Number(a.arrivalSeq) - Number(b.arrivalSeq); });
    return list[list.length - 1];
  }

  function passByNodes(state) {
    var movement = state.lastMovement;
    if (!movement || !Array.isArray(movement.path)) return [];
    return movement.path.slice(1, -1);
  }

  var Judgment = {
    lastArrivalAt: lastArrivalAt,

    /**
     * 回傳目前行動角色的所有判定情境。
     * 每個情境都包含 id、kind、diceType、needDice、敘述與可能的結果。
     */
    analyze: function (state, rules) {
      var active = ST.Store.getActive(state);
      if (!active || state.phase === "ended") return { situations: [], active: active, stacks: [] };
      var passed = passByNodes(state);
      var situations = [];
      var stacks = [];
      var mode = state.mode;

      if (state.mode === "multi") {
        var byCell = {};
        playersOf(state, "hider").forEach(function (hider) {
          byCell[hider.position] = byCell[hider.position] || [];
          byCell[hider.position].push(hider);
        });
        Object.keys(byCell).forEach(function (cell) {
          if (byCell[cell].length > 1) {
            stacks.push({
              cell: Number(cell),
              hiders: byCell[cell].slice().sort(function (a, b) { return a.arrivalSeq - b.arrivalSeq; })
            });
          }
        });
      }

      if (active.role === "seeker") {
        var hiders = playersOf(state, "hider");
        var seenStayCells = {};
        var seenPassCells = {};
        hiders.forEach(function (hider) {
          if (Number(hider.position) === Number(active.position)) {
            if (seenStayCells[hider.position]) return;
            seenStayCells[hider.position] = true;
            var target = mode === "multi" ? lastArrivalAt(state, active.position, "hider") : hider;
            situations.push({
              id: "seeker-stay:" + hider.id + ":" + hider.position,
              kind: "seeker-stay",
              title: "追捕者停留在躲藏者所在格",
              detail: "追捕者與躲藏者同在第 " + active.position + " 格，依規則遊戲結束。",
              targetId: target ? target.id : hider.id,
              targetName: target ? displayName(target) : displayName(hider),
              cellId: active.position,
              needDice: false,
              diceType: null,
              immediate: true,
              options: [
                { value: "capture", label: "確認捕獲" },
                { value: "skip", label: "不成立（人工裁定）" }
              ],
              multiNote: mode === "multi" && byCell[hider.position] && byCell[hider.position].length > 1
                ? "同格有 " + byCell[hider.position].length + " 位躲藏者，依規則只捕獲最後抵達者：" + (target ? displayName(target) : "")
                : ""
            });
          } else if (passed.indexOf(Number(hider.position)) >= 0) {
            if (seenPassCells[hider.position]) return;
            seenPassCells[hider.position] = true;
            var passTarget = mode === "multi" ? lastArrivalAt(state, hider.position, "hider") : hider;
            situations.push({
              id: "seeker-pass:" + hider.id + ":" + hider.position,
              kind: "seeker-pass",
              title: "追捕者途經躲藏者所在格",
              detail: "追捕者本次移動經過第 " + hider.position + " 格（" + ST.MAP.label(hider.position) + "），需擲 " + (mode === "multi" ? "(coin)" : "(draw)") + " 判定是否發現躲藏者。",
              targetId: passTarget ? passTarget.id : hider.id,
              targetName: passTarget ? displayName(passTarget) : displayName(hider),
              cellId: hider.position,
              needDice: true,
              diceType: mode === "multi" ? "coin" : "draw",
              immediate: false,
              options: mode === "multi"
                ? [
                  { value: "P", label: "(coin) P → 發現" },
                  { value: "骨", label: "(coin) 骨 → 未發現" },
                  { value: "特殊", label: "(coin) 特殊 → 最近躲藏者" },
                  { value: "skip", label: "不成立（人工裁定）" }
                ]
                : [
                  { value: "吉", label: "(draw) 吉 → 發現" },
                  { value: "凶", label: "(draw) 凶 → 未發現" },
                  { value: "skip", label: "不成立（人工裁定）" }
                ],
              multiNote: mode === "multi" && byCell[hider.position] && byCell[hider.position].length > 1
                ? "同格有 " + byCell[hider.position].length + " 位躲藏者，判定對象為最後抵達者。"
                : ""
            });
          }
        });
      } else {
        var seeker = playersOf(state, "seeker")[0];
        if (seeker) {
          if (Number(seeker.position) === Number(active.position)) {
            situations.push({
              id: "hider-stay:" + active.id,
              kind: "hider-stay",
              title: "躲藏者停留在追捕者所在格",
              detail: "躲藏者與追捕者同在第 " + active.position + " 格，需擲 (draw)；凶則遭捕獲。",
              targetId: active.id,
              targetName: displayName(active),
              cellId: active.position,
              needDice: true,
              diceType: "draw",
              immediate: false,
              options: [
                { value: "吉", label: "(draw) 吉 → 未被捕獲" },
                { value: "凶", label: "(draw) 凶 → 遭捕獲" },
                { value: "skip", label: "不成立（人工裁定）" }
              ]
            });
          } else if (passed.indexOf(Number(seeker.position)) >= 0) {
            situations.push({
              id: "hider-pass:" + active.id,
              kind: "hider-pass",
              title: "躲藏者途經追捕者所在格",
              detail: "躲藏者本次移動經過第 " + seeker.position + " 格（" + ST.MAP.label(seeker.position) + "），需擲 (draw)；吉則加骰 (dice4) 按原方向加速逃離。",
              targetId: active.id,
              targetName: displayName(active),
              cellId: seeker.position,
              needDice: true,
              diceType: "draw",
              immediate: false,
              options: [
                { value: "吉", label: "(draw) 吉 → 加骰 (dice4) 逃離" },
                { value: "凶", label: "(draw) 凶 → 未被發現" },
                { value: "skip", label: "不成立（人工裁定）" }
              ]
            });
          }
        }
      }

      if (state.turnResult && state.turnResult.escaped) {
        situations = situations.filter(function (item) { return item.kind !== "hider-pass"; });
      }
      var resolved = (state.turnResult && state.turnResult.resolvedJudgments) || [];
      if (resolved.length) {
        situations = situations.filter(function (item) {
          return !resolved.some(function (record) { return record.id === item.id; });
        });
      }

      return { situations: situations, active: active, stacks: stacks, passed: passed };
    },

    /** 多人模式：找出所有同格兩人以上的躲藏者群組。 */
    groupStacks: function (state) {
      var byCell = {};
      playersOf(state, "hider").forEach(function (hider) {
        byCell[hider.position] = byCell[hider.position] || [];
        byCell[hider.position].push(hider);
      });
      return Object.keys(byCell).filter(function (cell) { return byCell[cell].length > 1; }).map(function (cell) {
        return {
          cell: Number(cell),
          hiders: byCell[cell].slice().sort(function (a, b) { return a.arrivalSeq - b.arrivalSeq; })
        };
      });
    },

    /** 多人模式：距離追捕者最近的躲藏者（同距離順時針優先）。 */
    nearestHider: function (state) {
      var seeker = state.players.filter(function (p) { return p.role === "seeker" && p.inPlay; })[0];
      if (!seeker) return null;
      var hiders = playersOf(state, "hider");
      var best = null;
      var bestDistance = Infinity;
      hiders.forEach(function (hider) {
        var distance = (Number(hider.position) - Number(seeker.position) + 20) % 20;
        if (distance === 0) distance = 0;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = hider;
        }
      });
      if (best && bestDistance === 0) {
        var sameCell = hiders.filter(function (h) { return h.position === best.position; })
          .sort(function (a, b) { return a.arrivalSeq - b.arrivalSeq; });
        best = sameCell[sameCell.length - 1];
      }
      return best ? { hider: best, distance: bestDistance } : null;
    }
  };

  ST.Judgment = Judgment;
})(window.ST = window.ST || {});
