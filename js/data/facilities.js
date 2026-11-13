/*
 * 暮影領地捉迷藏｜設施規則資料（可編輯）
 * ------------------------------------------------------------------
 * 這個檔案是「規則庫」的預設內容。網站啟動後，實際使用的規則以
 * LocalStorage 中的 st_rules_v1 為準；也可以從「規則庫 → 進階 JSON」
 * 直接編輯、匯出、匯入，不需要修改程式碼。
 *
 * 設施欄位
 *   id            格號（1–20）
 *   name          設施全名
 *   emoji         設施代表符號
 *   quote         設施旁白
 *   tags          適用模式（"1v1" / "multi"）
 *   event         事件階段規則
 *   passBy        途經規則（null 表示無途經效果）
 *   notes         主持人補充（自由文字，會一併存檔）
 *   status        "confirmed" 已確認 / "draft" 待確認 / "none" 無規則
 *
 * 事件／途經的共通欄位
 *   summary       給主持人看的規則摘要
 *   optional      是否可選擇不擲骰
 *   checks        需要主持人輸入的骰子
 *                 [{ key:"draw", type:"draw"|"coin"|"dice4"|"dice6"|"dice20", label:"..." }]
 *   outcomes      依骰子結果套用的效果
 *                 { "吉": { text:"...", effects:[...] }, "凶": {...} }
 *                 沒有骰子的事件使用 outcomes.default
 *   roleOutcomes  需要依角色分流時使用
 *                 { hider:{ "吉": {...} }, seeker:{ "吉": {...} } }
 *   autoApply     是否允許引擎自動計算（false 時只顯示提示，由主持人判定）
 *
 * 效果（effects）語法
 *   { type:"stepMod", value:1 }                移動步數增減
 *   { type:"maxRoundMod", value:1 }            最大回合數增減
 *   { type:"stepDice", dice:6 }                本回合步數改以指定骰子決定
 *   { type:"bonusDice", dice:4 }               額外移動步數（直接加進本回合）
 *   { type:"extraMove", dice:4 }               原移動結束後再走一段（可選新方向）
 *   { type:"cancelRemaining" }                 取消剩餘步數
 *   { type:"reverseDirection" }                剩餘步數改往反方向
 *   { type:"resumeDice", dice:4, direction:"forward"|"reverse" }  取消後重新以骰子行進
 *   { type:"passByLock" }                      本回合不觸發途經
 *   { type:"allowRefusePassBy" }               本回合可拒絕途經一次
 *   { type:"eventLock", turns:1 }              接下來 N 次行動無法觸發事件
 *   { type:"endTurn" }                         結束本角色行動（跳過移動與判定）
 *   { type:"cancelMovement" }                  取消本回合移動
 *   { type:"teleport", target:"anyFacility" }  傳送（主持人選格）
 *   { type:"capture", target:"active" }        捕獲目前角色（進入判定確認）
 *   { type:"retire", target:"active" }         目前角色退場（不算被捕獲）
 *   { type:"release", target:"chosen" }        讓指定退場者返場（多人）
 *   { type:"note", text:"..." }                只顯示提示，不自動套用
 */
(function (ST) {
  "use strict";

  ST.RULES_VERSION = 1;

  ST.FACILITIES = [
    {
      id: 1,
      name: "領地接待廳",
      emoji: "💁🏻🥘",
      emojiLeft: "💁🏻",
      emojiRight: "🥘",
      quote: "「玩累了，該回家啦。」",
      tags: ["1v1", "multi"],
      event: {
        summary: "1V1 規則未記載此格事件；經過時亦無途經效果。",
        status: "none",
        autoApply: false,
        checks: [],
        outcomes: {}
      },
      eventMulti: {
        summary: "已有躲藏者退場時，可選擇是否擲(draw)並指定一位退場者。吉則該人返場；凶則該人返場，本人退場。返場者骰(dice20)決定起始位置，下回合開始動作；同一位躲藏者一局最多返場 2 次。追捕者不能觸發此事件。",
        status: "confirmed",
        autoApply: true,
        optional: true,
        checks: [{ key: "draw", type: "draw", label: "返場判定 (draw)" }],
        outcomes: {
          "吉": {
            text: "該名退場者返場，擲 (dice20) 決定起始位置。",
            effects: [{ type: "release", target: "chosen" }]
          },
          "凶": {
            text: "該名退場者返場；觸發此事件的躲藏者本人退場。",
            effects: [
              { type: "release", target: "chosen" },
              { type: "retire", target: "active" },
              { type: "endTurn" }
            ]
          }
        }
      },
      passBy: null,
      notes: ""
    },
    {
      id: 3,
      name: "黑薔薇莊園",
      emoji: "🌹🏡",
      emojiLeft: "🌹",
      emojiRight: "🏡",
      quote: "「一步，兩步，轉個圈。與幽靈共舞，享受最後的時光。」",
      tags: ["1v1", "multi"],
      event: {
        summary: "本回合行動步數 -1，下一次行動無法觸發「事件」。",
        status: "confirmed",
        autoApply: true,
        checks: [],
        outcomes: {
          "default": {
            text: "本回合步數 -1；下一次行動無法觸發事件。",
            effects: [
              { type: "stepMod", value: -1 },
              { type: "eventLock", turns: 1 }
            ]
          }
        }
      },
      passBy: {
        summary: "擲(draw)，吉則移動步數 +1，凶則移動步數 -1。",
        status: "confirmed",
        autoApply: true,
        checks: [{ key: "draw", type: "draw", label: "途經 (draw)" }],
        outcomes: {
          "吉": { text: "移動步數 +1。", effects: [{ type: "stepMod", value: 1 }] },
          "凶": { text: "移動步數 -1。", effects: [{ type: "stepMod", value: -1 }] }
        }
      },
      notes: ""
    },
    {
      id: 5,
      name: "血月裁決",
      emoji: "🌕🩸",
      emojiLeft: "🌕",
      emojiRight: "🩸",
      quote: "「當滿月高升，當血色侵襲，對勇氣與命運的審判開始。」",
      tags: ["1v1", "multi"],
      event: {
        summary: "如參與者不在同一格，移動階段可額外擲(draw)。躲藏者吉可額外往自定方向移動(dice4)，凶則遭捕獲、遊戲結束。追捕者吉可額外往自定方向移動(dice4)，凶則本回合移動取消。",
        status: "confirmed",
        autoApply: true,
        optional: true,
        checks: [{ key: "draw", type: "draw", label: "血月裁決 (draw)" }],
        roleOutcomes: {
          hider: {
            "吉": {
              text: "原移動結束後，可額外往自定方向移動 (dice4) 格，並重新判定途經。",
              effects: [{ type: "extraMove", dice: 4, direction: "self" }]
            },
            "凶": {
              text: "遭捕獲，遊戲結束。",
              effects: [{ type: "capture", target: "active" }]
            }
          },
          seeker: {
            "吉": {
              text: "原移動結束後，可額外往自定方向移動 (dice4) 格，並重新判定途經。",
              effects: [{ type: "extraMove", dice: 4, direction: "self" }]
            },
            "凶": {
              text: "本回合移動取消。",
              effects: [{ type: "cancelMovement" }]
            }
          }
        }
      },
      passBy: null,
      notes: ""
    },
    {
      id: 7,
      name: "王室旋轉木馬",
      emoji: "🎠🎵",
      emojiLeft: "🎠",
      emojiRight: "🎵",
      quote: "「華麗木馬在舞台上旋轉，你能跟上節奏嗎？」",
      tags: ["1v1", "multi"],
      event: {
        summary: "本回合行動步數 +1，本回合無法觸發「途經」。",
        status: "confirmed",
        autoApply: true,
        checks: [],
        outcomes: {
          "default": {
            text: "本回合步數 +1；本回合不觸發途經。",
            effects: [
              { type: "stepMod", value: 1 },
              { type: "passByLock" }
            ]
          }
        }
      },
      passBy: {
        summary: "剩餘步數取消，擲(draw)：吉照原方向行進(dice4)格，凶往反方向行進(dice4)格。",
        status: "confirmed",
        autoApply: true,
        checks: [{ key: "draw", type: "draw", label: "途經 (draw)" }],
        outcomes: {
          "吉": {
            text: "剩餘步數取消，照原方向再行進 dice4 格。",
            effects: [
              { type: "cancelRemaining" },
              { type: "resumeDice", dice: 4, direction: "forward" }
            ]
          },
          "凶": {
            text: "剩餘步數取消，往反方向再行進 dice4 格。",
            effects: [
              { type: "cancelRemaining" },
              { type: "resumeDice", dice: 4, direction: "reverse" }
            ]
          }
        }
      },
      notes: ""
    },
    {
      id: 10,
      name: "貝瑟妮茶館",
      emoji: "☕🍪",
      emojiLeft: "☕",
      emojiRight: "🍪",
      quote: "「芬芳茶香撫慰身心，你的雙腿渴望休息。」",
      tags: ["1v1", "multi"],
      event: {
        summary: "本回合移動步數為(dice6)。本回合可拒絕觸發「途經」一次。",
        status: "confirmed",
        autoApply: true,
        checks: [],
        outcomes: {
          "default": {
            text: "本回合步數改用 dice6 決定；本回合可拒絕一次途經。",
            effects: [
              { type: "stepDice", dice: 6 },
              { type: "allowRefusePassBy" }
            ]
          }
        }
      },
      passBy: {
        summary: "移動剩餘步數前需擲(draw)：吉可繼續行進，凶則停止移動。",
        status: "confirmed",
        autoApply: true,
        checks: [{ key: "draw", type: "draw", label: "途經 (draw)" }],
        outcomes: {
          "吉": { text: "繼續行進。", effects: [] },
          "凶": { text: "停止移動。", effects: [{ type: "cancelRemaining" }] }
        }
      },
      notes: ""
    },
    {
      id: 12,
      name: "飛天試煉",
      emoji: "🧙🏻‍🧹",
      emojiLeft: "🧙🏻",
      emojiRight: "🧹",
      quote: "「智者不畏艱險、慧者不懼挑戰，你做好準備了嗎？」",
      tags: ["1v1", "multi"],
      event: {
        summary: "選擇是否擲(draw)。吉則挪至任意設施並結束自己的回合，跳過行動及判定階段；凶則留在原地並結束自己的回合，跳過行動及判定階段。",
        status: "confirmed",
        autoApply: true,
        optional: true,
        checks: [{ key: "draw", type: "draw", label: "飛天試煉 (draw)" }],
        outcomes: {
          "吉": {
            text: "傳送至任一設施，結束本回合行動（跳過移動與判定）。",
            effects: [
              { type: "teleport", target: "anyFacility" },
              { type: "endTurn" }
            ]
          },
          "凶": {
            text: "留在原地，結束本回合行動（跳過移動與判定）。",
            effects: [{ type: "endTurn" }]
          }
        }
      },
      passBy: null,
      notes: ""
    },
    {
      id: 14,
      name: "古堡探險",
      emoji: "🏰🧩",
      emojiLeft: "🏰",
      emojiRight: "🧩",
      quote: "「古堡深處的神祕正在誘惑你，別停下腳步。」",
      tags: ["1v1", "multi"],
      event: {
        summary: "擲(draw)：吉則照常處理行動及判定階段，凶則結束自己的回合，跳過行動及判定階段。",
        status: "confirmed",
        autoApply: true,
        checks: [{ key: "draw", type: "draw", label: "古堡探險 (draw)" }],
        outcomes: {
          "吉": { text: "照常行動。", effects: [] },
          "凶": { text: "結束本回合行動（跳過移動與判定）。", effects: [{ type: "endTurn" }] }
        }
      },
      passBy: {
        summary: "躲藏者經過則本次遊戲最大回合數 +1；追捕者經過則最大回合數 -1。若最大回合數被扣到 0 或負數，這回合的追捕者行動後遊戲結束。",
        status: "confirmed",
        autoApply: true,
        checks: [],
        roleOutcomes: {
          hider: {
            "default": {
              text: "最大回合數 +1。",
              effects: [{ type: "maxRoundMod", value: 1 }]
            }
          },
          seeker: {
            "default": {
              text: "最大回合數 -1。",
              effects: [{ type: "maxRoundMod", value: -1 }]
            }
          }
        }
      },
      notes: ""
    },
    {
      id: 16,
      name: "三明治男爵",
      emoji: "🥪🍟",
      emojiLeft: "🥪",
      emojiRight: "🍟",
      quote: "「香噴噴的酥炸美味，是誰在飢腸轆轆？」",
      tags: ["1v1", "multi"],
      event: {
        summary: "本回合可移動步數額外多(dice4)。",
        status: "confirmed",
        autoApply: true,
        checks: [],
        outcomes: {
          "default": {
            text: "本回合額外移動 dice4 格（由主持人輸入骰值後計入步數）。",
            effects: [{ type: "bonusDice", dice: 4, direction: "self" }]
          }
        }
      },
      passBy: {
        summary: "移動剩餘步數前需擲(draw)：吉可繼續行進，凶則停止移動。",
        status: "confirmed",
        autoApply: true,
        checks: [{ key: "draw", type: "draw", label: "途經 (draw)" }],
        outcomes: {
          "吉": { text: "繼續行進。", effects: [] },
          "凶": { text: "停止移動。", effects: [{ type: "cancelRemaining" }] }
        }
      },
      notes: ""
    },
    {
      id: 19,
      name: "幽影海盜船",
      emoji: "🏴‍☠️⛵",
      emojiLeft: "🏴‍☠️",
      emojiRight: "⛵",
      quote: "「海霧令人迷失方向，但願幸運伴你左右。」",
      tags: ["1v1", "multi"],
      event: {
        summary: "本回合無法自行決定方向：擲(draw)，吉則順時針移動，凶則逆時針移動。",
        status: "confirmed",
        autoApply: true,
        checks: [{ key: "draw", type: "draw", label: "海盜船 (draw)" }],
        outcomes: {
          "吉": { text: "本回合強制順時針移動。", effects: [{ type: "setDirection", direction: 1 }] },
          "凶": { text: "本回合強制逆時針移動。", effects: [{ type: "setDirection", direction: -1 }] }
        }
      },
      passBy: {
        summary: "移動剩餘步數前需擲(draw)：吉可照原方向行進，凶則朝反方向行進。",
        status: "confirmed",
        autoApply: true,
        checks: [{ key: "draw", type: "draw", label: "途經 (draw)" }],
        outcomes: {
          "吉": { text: "照原方向繼續行進。", effects: [] },
          "凶": { text: "剩餘步數改朝反方向行進。", effects: [{ type: "reverseDirection" }] }
        }
      },
      notes: ""
    }
  ];

  ST.createDefaultRules = function () {
    return {
      rulesVersion: ST.RULES_VERSION,
      updatedAt: new Date().toISOString(),
      customNotes: "",
      options: {
        mapNodes: 20,
        defaultMaxRound: 10,
        minMaxRound: 1,
        maxHiders: 4,
        returnLimit: 2,
        endpointTriggersPassBy: false,
        allowMultiplePassBy: false,
        passByCancelOnZero: true,
        eventLockScope: "nextAction",
        teleportTriggersEvent: false,
        stepFloor: 0,
        captureEndsGame: true,
        roundLimitWinner: "hider",
        seekerDiceType: "draw"
      },
      facilities: JSON.parse(JSON.stringify(ST.FACILITIES)),
      templates: JSON.parse(JSON.stringify(ST.DEFAULT_TEXT_TEMPLATES || [])),
      answers: {}
    };
  };

  /** 規則庫正規化：補齊缺少欄位，避免舊存檔或手動編輯造成錯誤。 */
  ST.normalizeRules = function (input) {
    var defaults = ST.createDefaultRules();
    if (!input || typeof input !== "object") return defaults;
    var rules = {
      rulesVersion: ST.RULES_VERSION,
      updatedAt: input.updatedAt || new Date().toISOString(),
      customNotes: String(input.customNotes || ""),
      options: Object.assign({}, defaults.options, input.options || {}),
      facilities: [],
      templates: [],
      answers: input.answers && typeof input.answers === "object" ? input.answers : {}
    };

    rules.options.endpointTriggersPassBy = !!rules.options.endpointTriggersPassBy;
    rules.options.allowMultiplePassBy = !!rules.options.allowMultiplePassBy;
    rules.options.teleportTriggersEvent = !!rules.options.teleportTriggersEvent;
    rules.options.defaultMaxRound = Math.max(1, parseInt(rules.options.defaultMaxRound, 10) || 10);
    rules.options.minMaxRound = Math.max(1, parseInt(rules.options.minMaxRound, 10) || 1);
    rules.options.maxHiders = Math.min(8, Math.max(1, parseInt(rules.options.maxHiders, 10) || 4));
    rules.options.returnLimit = Math.min(9, Math.max(0, parseInt(rules.options.returnLimit, 10) || 2));
    rules.options.stepFloor = Math.max(0, parseInt(rules.options.stepFloor, 10) || 0);

    var sourceFacilities = Array.isArray(input.facilities) ? input.facilities : defaults.facilities;
    rules.facilities = sourceFacilities.map(function (facility) {
      var base = JSON.parse(JSON.stringify(facility || {}));
      base.id = Number(base.id);
      base.name = String(base.name || "");
      base.emoji = String(base.emoji || "");
      base.quote = String(base.quote || "");
      base.tags = Array.isArray(base.tags) ? base.tags : ["1v1", "multi"];
      base.notes = String(base.notes || "");
      base.event = normalizeRule(base.event);
      base.eventMulti = base.eventMulti ? normalizeRule(base.eventMulti) : null;
      base.passBy = base.passBy ? normalizeRule(base.passBy) : null;
      if (!base.event) {
        base.event = { summary: "", status: "none", autoApply: false, checks: [], outcomes: {} };
      }
      return base;
    }).filter(function (facility) {
      return isFinite(facility.id) && facility.id >= 1 && facility.id <= 20;
    });
    if (!rules.facilities.length) rules.facilities = defaults.facilities;

    var sourceTemplates = Array.isArray(input.templates) ? input.templates : defaults.templates;
    rules.templates = sourceTemplates.map(function (template) {
      return {
        key: String(template.key || ST.uid("tpl")),
        name: String(template.name || "未命名模板"),
        stage: String(template.stage || "free"),
        enabled: template.enabled !== false,
        template: String(template.template || ""),
        description: String(template.description || "")
      };
    });
    if (!rules.templates.length) rules.templates = defaults.templates;
    return rules;
  };

  function normalizeRule(rule) {
    if (!rule || typeof rule !== "object") return null;
    var result = {
      summary: String(rule.summary || ""),
      status: ["confirmed", "draft", "none"].indexOf(rule.status) >= 0 ? rule.status : "draft",
      autoApply: rule.autoApply !== false,
      optional: !!rule.optional,
      checks: Array.isArray(rule.checks) ? rule.checks.map(function (check) {
        return {
          key: String(check.key || check.type || "draw"),
          type: ["draw", "coin", "dice4", "dice6", "dice20"].indexOf(check.type) >= 0 ? check.type : "draw",
          label: String(check.label || check.type || "draw")
        };
      }) : [],
      outcomes: rule.outcomes && typeof rule.outcomes === "object" ? rule.outcomes : {}
    };
    if (rule.roleOutcomes && typeof rule.roleOutcomes === "object") {
      result.roleOutcomes = {};
      ["hider", "seeker"].forEach(function (role) {
        if (rule.roleOutcomes[role] && typeof rule.roleOutcomes[role] === "object") {
          result.roleOutcomes[role] = rule.roleOutcomes[role];
        }
      });
    }
    return result;
  }

  /** 取得目前模式下可用的設施規則（接待廳在多人模式有追加事件）。 */
  ST.getFacilityRules = function (rules, id, mode) {
    var list = (rules && rules.facilities) || ST.FACILITIES;
    var facility = list.filter(function (item) { return Number(item.id) === Number(id); })[0];
    if (!facility) return null;
    var copy = JSON.parse(JSON.stringify(facility));
    if (mode === "multi" && facility.eventMulti) {
      copy.event = facility.eventMulti;
      copy.eventMultiActive = true;
    }
    return copy;
  };
})(window.ST = window.ST || {});
