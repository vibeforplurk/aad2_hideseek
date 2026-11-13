/*
 * 暮影領地捉迷藏｜網站入口
 * 負責導覽、共用彈窗／提示、自動存檔狀態與各頁面渲染。
 */
(function (ST) {
  "use strict";

  var currentView = "console";
  var modalStack = [];

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function viewExists(view) {
    return !!document.querySelector('.view[data-view="' + view + '"]');
  }

  function navigate(view) {
    if (!viewExists(view)) view = "console";
    currentView = view;
    Array.prototype.forEach.call(document.querySelectorAll(".view"), function (section) {
      section.classList.toggle("is-active", section.getAttribute("data-view") === view);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".nav-btn"), function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-nav") === view);
    });
    renderView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderView(view) {
    var state = ST.Store.getState();
    var rules = ST.Store.getRules();
    try {
      switch (view) {
        case "console": ST.Console.render(); break;
        case "setup": ST.SetupView.render(state, rules); break;
        case "text": ST.TextView.render(state, rules); break;
        case "save": ST.SaveView.render(state, rules); break;
      }
    } catch (error) {
      console.error(error);
      toast("畫面渲染失敗：" + error.message, "error");
    }
  }

  function refresh() {
    updateTopbar();
    renderView(currentView);
  }

  function updateTopbar() {
    var state = ST.Store.getState();
    var dot = document.getElementById("saveDot");
    var status = document.getElementById("saveStatus");
    var undoBtn = document.getElementById("globalUndoBtn");
    if (!state) {
      dot.className = "dot";
      status.textContent = "尚未建立遊戲";
    } else {
      dot.className = "dot is-saved";
      var time = ST.SaveManager.lastSavedAt();
      status.textContent = "已自動暫存" + (time ? " · " + new Date(time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "");
    }
    undoBtn.disabled = ST.Store.undoSize() === 0;
    undoBtn.title = ST.Store.undoSize() ? "撤銷：" + ST.Store.undoLabel() : "沒有可撤銷的操作";
  }

  function toast(message, type) {
    var root = document.getElementById("toastRoot");
    if (!root) return;
    while (root.children.length >= 3) root.removeChild(root.firstChild);
    var item = document.createElement("div");
    item.className = "toast" + (type === "error" ? " is-error" : type === "ok" ? " is-ok" : "");
    item.textContent = message;
    root.appendChild(item);
    setTimeout(function () {
      item.style.transition = "opacity 220ms ease, transform 220ms ease";
      item.style.opacity = "0";
      item.style.transform = "translateY(6px)";
      setTimeout(function () { item.remove(); }, 240);
    }, type === "error" ? 4200 : 2600);
  }

  function paintModal() {
    var root = document.getElementById("modalRoot");
    var config = modalStack[modalStack.length - 1];
    if (!config) {
      root.hidden = true;
      document.body.style.overflow = "";
      return;
    }
    root.hidden = false;
    document.body.style.overflow = "hidden";
    var modal = root.querySelector(".modal");
    modal.className = "modal" + (config.size ? " modal-" + config.size : "");
    document.getElementById("modalTitle").textContent = config.title || "";
    document.getElementById("modalBody").innerHTML = config.body || "";
    document.getElementById("modalFooter").innerHTML = config.footer || "";
    if (typeof config.onMount === "function") config.onMount(root, config);
  }

  /**
   * 開啟彈窗。config: { title, body, footer, size, onMount }
   * 支援堆疊：確認視窗可以疊在編輯表單上方。
   */
  function openModal(config) {
    modalStack.push(config || {});
    paintModal();
    return document.getElementById("modalRoot");
  }

  function closeModal() {
    modalStack.pop();
    paintModal();
  }

  function confirmDialog(message, options) {
    options = options || {};
    return new Promise(function (resolve) {
      var settled = false;
      openModal({
        title: options.title || "請確認",
        size: "narrow",
        body: '<p class="notice ' + (options.danger ? "notice-danger" : "") + '">' + escapeHtml(message) + '</p>',
        footer: '<button type="button" class="btn btn-ghost" data-confirm="cancel">取消</button>' +
          '<button type="button" class="btn ' + (options.danger ? "btn-danger" : "btn-primary") + '" data-confirm="ok">' +
          escapeHtml(options.confirmLabel || "確認") + '</button>',
        onMount: function (root) {
          root.querySelectorAll("[data-confirm]").forEach(function (button) {
            button.addEventListener("click", function () {
              if (settled) return;
              settled = true;
              var ok = button.getAttribute("data-confirm") === "ok";
              closeModal();
              resolve(ok);
            });
          });
        },
        onClose: function () {
          if (!settled) {
            settled = true;
            resolve(false);
          }
        }
      });
    });
  }

  function pickJSONFile(callback) {
    var input = document.getElementById("hiddenFileInput");
    input.value = "";
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      ST.SaveManager.readFileAsText(file).then(function (text) {
        callback(text, file);
      }).catch(function (error) {
        toast(error.message, "error");
      });
    };
    input.click();
  }

  function bindGlobal() {
    document.addEventListener("click", function (event) {
      var navButton = event.target.closest("[data-nav]");
      if (navButton) {
        navigate(navButton.getAttribute("data-nav"));
        return;
      }
      var closeTrigger = event.target.closest("[data-modal-close]");
      if (closeTrigger) {
        var config = modalStack[modalStack.length - 1];
        if (config && typeof config.onClose === "function") config.onClose();
        closeModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modalStack.length) {
        var config = modalStack[modalStack.length - 1];
        if (config && typeof config.onClose === "function") config.onClose();
        closeModal();
        return;
      }
      // Ctrl/Cmd + Z：撤銷（避免在輸入框中誤觸）
      var target = event.target;
      var typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z" && !typing) {
        event.preventDefault();
        undo();
      }
    });

    document.getElementById("globalUndoBtn").addEventListener("click", undo);
  }

  function undo() {
    var snapshot = ST.Store.undo();
    if (!snapshot) {
      toast("目前沒有可撤銷的操作。", "error");
      return;
    }
    toast("已撤銷：" + snapshot.label, "ok");
    refresh();
  }

  var App = {
    navigate: navigate,
    renderView: renderView,
    refresh: refresh,
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    confirm: confirmDialog,
    pickJSONFile: pickJSONFile,
    escape: escapeHtml,
    currentView: function () { return currentView; },
    updateTopbar: updateTopbar
  };

  ST.App = App;

  function boot() {
    ST.Store.init();

    ST.Console.init();
    ST.SetupView.init();
    ST.TextView.init();
    ST.SaveView.init();

    bindGlobal();
    ST.Store.subscribe(function () {
      updateTopbar();
      if (currentView === "console") {
        try { ST.Console.render(); } catch (error) { console.error(error); }
      }
    });

    updateTopbar();
    navigate("console");

    var warnings = ST.Store.warnings();
    warnings.forEach(function (warning) { toast(warning, "error"); });
    if (!ST.SaveManager.isAvailable()) {
      toast("此瀏覽器環境無法使用 LocalStorage，遊戲進度只會暫存在本次頁面；請定期匯出 JSON。", "error");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.ST = window.ST || {});
