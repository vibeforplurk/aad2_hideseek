/*
 * 暮影領地捉迷藏｜文字輸出
 * 固定標準模板＋可編輯輸出文字＋Plurk 擲骰語法支援。
 */
(function (ST) {
  "use strict";

  var selectedKey = null;

  function esc(value) { return ST.App.escape(value); }

  function ensureSelected(rules) {
    var templates = ST.TextGenerator.templates(rules);
    if (!templates.some(function (template) { return template.key === selectedKey; })) {
      selectedKey = templates.length ? templates[0].key : null;
    }
  }

  function selectedTemplate(rules) {
    return ST.TextGenerator.getTemplate(rules, selectedKey);
  }

  function renderOutput() {
    var area = document.getElementById("outputText");
    if (!area) return;
    var state = ST.Store.getState();
    var rules = ST.Store.getRules();
    var template = selectedTemplate(rules);
    if (!template) {
      area.value = "";
      return;
    }
    area.value = ST.TextGenerator.render(template.template, ST.TextGenerator.buildContext(state, rules, {}));
  }

  function render(state, rules) {
    var root = document.getElementById("textContent");
    if (!root) return;
    ensureSelected(rules);
    var templates = ST.TextGenerator.templates(rules);
    var template = selectedTemplate(rules);
    var html = [];

    html.push('<div class="text-workspace">');
    html.push('<aside class="panel" style="padding:12px">');
    html.push('<div class="row" style="justify-content:space-between;padding:0 4px 8px">' +
      '<span class="field-label">標準模板</span><span class="muted tiny">固定</span></div>');
    html.push('<div class="template-list">');
    templates.forEach(function (item) {
      html.push('<button type="button" class="template-item' + (item.key === selectedKey ? " is-active" : "") +
        (item.enabled ? "" : " is-off") + '" data-output-template="' + esc(item.key) + '">' +
        '<span class="dot-small"></span><span style="flex:1">' + esc(item.name) + "</span></button>");
    });
    html.push("</div>");
    html.push('<p class="field-hint" style="margin-top:10px">模板內容固定，網站不提供修改規則或模板的入口。</p>');
    html.push("</aside>");

    html.push('<section class="panel" style="padding:18px">');
    if (!template) {
      html.push('<div class="empty">目前沒有可用模板。</div>');
      root.innerHTML = html.join("");
      return;
    }
    html.push('<div class="row" style="justify-content:space-between;align-items:flex-start">');
    html.push("<div><p class=\"eyebrow\">Plurk Output</p><h2>" + esc(template.name) + "</h2>" +
      '<p class="muted small" style="margin-top:4px">' + esc(template.description || "") + "</p></div>");
    html.push('<span class="chip chip-gold">標準模板</span>');
    html.push("</div>");

    html.push('<div class="field" style="margin-top:14px"><label>模板語法</label>' +
      '<pre class="code">' + esc(template.template) + "</pre></div>");
    html.push('<div class="field" style="margin-top:12px"><label>輸出文字（可直接修改）</label>' +
      '<textarea id="outputText" rows="9" placeholder="選擇模板或按重新生成…"></textarea></div>');
    html.push('<div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">');
    html.push('<button type="button" class="btn btn-primary" data-output-regen>重新生成</button>');
    html.push('<button type="button" class="btn btn-ghost" data-output-copy>複製文字</button>');
    html.push('<button type="button" class="btn btn-ghost" data-output-clear>清空</button>');
    html.push('<span class="spacer"></span>');
    html.push('<button type="button" class="btn btn-ghost btn-sm" data-output-download>下載 TXT</button>');
    html.push("</div>");

    html.push('<div class="syntax-panel">');
    html.push('<div class="row" style="justify-content:space-between"><h3 style="font-size:16px">Plurk 擲骰語法</h3>' +
      '<span class="muted tiny">貼到 Plurk 送出後會自動產生結果</span></div>');
    html.push('<p class="field-hint" style="margin-top:4px">將語法貼進噗浪，送出後看結果，再回到網站回填。' +
      '不要把結果直接打在這段文字裡取代語法，除非你確定要純文字敘述。</p>');
    html.push('<div class="syntax-grid">');
    (ST.DICE_SYNTAX || []).forEach(function (item) {
      html.push('<div class="syntax-item"><code>' + esc(item.syntax) + "</code>" +
        '<span class="muted tiny">' + esc(item.detail) + "</span>" +
        '<div class="row" style="gap:4px;margin-left:auto">' +
        '<button type="button" class="btn btn-ghost btn-xs" data-syntax-insert="' + esc(item.syntax) + '">插入</button>' +
        '<button type="button" class="btn btn-ghost btn-xs" data-syntax-copy="' + esc(item.syntax) + '">複製</button>' +
        "</div></div>");
    });
    html.push("</div>");
    if (state && state.players.length) {
      html.push('<div class="row-wrap" style="margin-top:12px;gap:6px"><span class="field-label">PLURK 標註</span>');
      state.players.forEach(function (player) {
        html.push('<button type="button" class="var-chip" data-insert-tag="' + esc(ST.playerTag(player)) + '">' +
          esc(ST.playerTag(player)) + "</button>");
      });
      html.push("</div>");
    }
    html.push("</div>");
    html.push("</section></div>");

    root.innerHTML = html.join("");
    renderOutput();
    if (!state) {
      var area = document.getElementById("outputText");
      if (area) area.placeholder = "尚未建立遊戲；建立後可按「重新生成」帶入角色與回合。";
    }
  }

  function insertAtCursor(text) {
    var area = document.getElementById("outputText");
    if (!area) return;
    var focused = document.activeElement === area;
    var start = focused ? area.selectionStart : area.value.length;
    var end = focused ? area.selectionEnd : area.value.length;
    area.value = area.value.slice(0, start) + text + area.value.slice(end);
    area.focus();
    area.selectionStart = area.selectionEnd = start + text.length;
  }

  function copyText(text) {
    if (!text.trim()) {
      ST.App.toast("沒有可複製的文字。", "error");
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        ST.App.toast("已複製文字。", "ok");
      }).catch(function () {
        ST.App.toast("瀏覽器不允許自動複製，請手動選取。", "error");
      });
    } else {
      ST.App.toast("瀏覽器不支援自動複製，請手動選取。", "error");
    }
  }

  function downloadText() {
    var area = document.getElementById("outputText");
    if (!area || !area.value.trim()) {
      ST.App.toast("沒有可下載的文字。", "error");
      return;
    }
    var blob = new Blob([area.value], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "shadow-territory-plurk.txt";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
    ST.App.toast("已下載文字檔。", "ok");
  }

  function init() {
    var root = document.getElementById("textContent");

    root.addEventListener("click", function (event) {
      var templateButton = event.target.closest("[data-output-template]");
      if (templateButton) {
        selectedKey = templateButton.getAttribute("data-output-template");
        render(ST.Store.getState(), ST.Store.getRules());
        return;
      }
      if (event.target.closest("[data-output-regen]")) {
        renderOutput();
        ST.App.toast("已依目前狀態重新生成。", "ok");
        return;
      }
      if (event.target.closest("[data-output-copy]")) {
        copyText(document.getElementById("outputText").value);
        return;
      }
      if (event.target.closest("[data-output-clear]")) {
        var area = document.getElementById("outputText");
        if (area) area.value = "";
        return;
      }
      if (event.target.closest("[data-output-download]")) {
        downloadText();
        return;
      }
      var insert = event.target.closest("[data-syntax-insert]");
      if (insert) {
        insertAtCursor(insert.getAttribute("data-syntax-insert"));
        return;
      }
      var copy = event.target.closest("[data-syntax-copy]");
      if (copy) {
        copyText(copy.getAttribute("data-syntax-copy"));
        return;
      }
      var tag = event.target.closest("[data-insert-tag]");
      if (tag) {
        insertAtCursor(tag.getAttribute("data-insert-tag") + " ");
      }
    });
  }

  ST.TextView = {
    init: init,
    render: render,
    select: function (key) { selectedKey = key; }
  };
})(window.ST = window.ST || {});
