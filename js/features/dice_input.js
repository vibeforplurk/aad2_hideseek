/*
 * 暮影領地捉迷藏｜骰子輸入
 * 所有骰子結果都由主持人手動輸入；本模組只負責產生欄位與驗證合法性。
 */
(function (ST) {
  "use strict";

  var SPECS = {
    draw: { values: ["吉", "凶"], label: "draw" },
    coin: { values: ["P", "骨", "特殊"], label: "coin" },
    dice4: { min: 1, max: 4, label: "dice4" },
    dice6: { min: 1, max: 6, label: "dice6" },
    dice20: { min: 1, max: 20, label: "dice20" }
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  var Dice = {
    specs: SPECS,
    escapeHtml: escapeHtml,

    spec: function (type) {
      return SPECS[type] || SPECS.draw;
    },

    isValid: function (type, value) {
      var spec = SPECS[type];
      if (!spec) return false;
      if (spec.values) return spec.values.indexOf(value) >= 0;
      var number = Number(value);
      return isFinite(number) && number >= spec.min && number <= spec.max && Math.floor(number) === number;
    },

    labelFor: function (type, value) {
      var spec = SPECS[type];
      if (!spec) return String(value);
      return (spec.label || type) + " " + value;
    },

    /**
     * 產生單一骰子欄位。
     * check: { key, type, label }
     */
    fieldHTML: function (check, index) {
      var type = check.type || "draw";
      var spec = SPECS[type] || SPECS.draw;
      var key = check.key || type;
      var label = check.label || spec.label || type;
      var fieldId = "dice_" + key + "_" + (index || 0);
      if (spec.values) {
        return '' +
          '<div class="dice-field" data-dice-key="' + escapeHtml(key) + '" data-dice-type="' + escapeHtml(type) +
          '" data-dice-label="' + escapeHtml(label) + '">' +
          '<div class="dice-field-head"><span>' + escapeHtml(label) + '</span><small>' + escapeHtml(spec.label) + '</small></div>' +
          '<div class="dice-options" role="radiogroup" aria-label="' + escapeHtml(label) + '">' +
          spec.values.map(function (value, valueIndex) {
            return '<label class="dice-chip"><input type="radio" name="' + fieldId + '" value="' + escapeHtml(value) +
              '" id="' + fieldId + '_' + valueIndex + '"><span>' + escapeHtml(value) + '</span></label>';
          }).join("") +
          '</div></div>';
      }
      var options = ['<option value="">請選擇</option>'];
      for (var value = spec.min; value <= spec.max; value += 1) {
        options.push('<option value="' + value + '">' + value + '</option>');
      }
      return '' +
        '<div class="dice-field" data-dice-key="' + escapeHtml(key) + '" data-dice-type="' + escapeHtml(type) +
        '" data-dice-label="' + escapeHtml(label) + '">' +
        '<div class="dice-field-head"><span>' + escapeHtml(label) + '</span><small>' + escapeHtml(spec.label) + '</small></div>' +
        '<select class="dice-select" aria-label="' + escapeHtml(label) + '">' + options.join("") + '</select>' +
        '</div>';
    },

    fieldsHTML: function (checks) {
      if (!checks || !checks.length) return "";
      return '<div class="dice-grid">' + checks.map(function (check, index) {
        return Dice.fieldHTML(check, index);
      }).join("") + '</div>';
    },

    /** 讀取容器內所有骰子欄位。 */
    read: function (root) {
      var values = {};
      var errors = [];
      var fields = root ? root.querySelectorAll("[data-dice-key]") : [];
      Array.prototype.forEach.call(fields, function (field) {
        var key = field.getAttribute("data-dice-key");
        var type = field.getAttribute("data-dice-type");
        var label = field.getAttribute("data-dice-label") || key;
        var select = field.querySelector("select");
        var checked = field.querySelector("input[type=radio]:checked");
        var value = select ? select.value : checked ? checked.value : "";
        if (value === "") {
          errors.push(label + "：尚未輸入。");
        } else if (!Dice.isValid(type, value)) {
          errors.push(label + "：數值不合法。");
        }
        values[key] = value;
      });
      return { values: values, errors: errors, ok: errors.length === 0 };
    },

    /** 產生一組 draw 按鈕（供多人同格多次判定使用）。 */
    chipsHTML: function (name, values, selected) {
      var index = Math.random().toString(36).slice(2, 7);
      return '<div class="dice-options dice-options-inline">' + values.map(function (value, valueIndex) {
        var checked = selected === value ? " checked" : "";
        return '<label class="dice-chip"><input type="radio" name="' + escapeHtml(name) + '_' + index +
          '" value="' + escapeHtml(value) + '"' + checked + '><span>' + escapeHtml(value) + '</span></label>';
      }).join("") + '</div>';
    },

    summary: function (dice) {
      if (!dice) return "";
      return Object.keys(dice).map(function (key) {
        return dice[key];
      }).join("、");
    }
  };

  ST.Dice = Dice;
})(window.ST = window.ST || {});
