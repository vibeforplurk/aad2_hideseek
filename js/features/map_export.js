/*
 * 暮影領地捉迷藏｜地圖 PNG 匯出
 * ------------------------------------------------------------------
 * 以 Canvas 重新繪製底圖、節點、角色與路徑，輸出適合 Plurk 貼文的圖片。
 * 匯出內容不包含任何操作按鈕或主持人面板。
 */
(function (ST) {
  "use strict";

  var HEADER = 96;
  var FOOTER = 50;
  var imageCache = null;

  function loadMapImage() {
    if (imageCache) return Promise.resolve(imageCache);
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        imageCache = image;
        resolve(image);
      };
      image.onerror = function () { reject(new Error("地圖底圖載入失敗。")); };
      image.src = ST.MAP_IMAGE_DATA_URI || "";
    });
  }

  function font(size, weight) {
    return (weight || 400) + " " + size + 'px "Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
  }

  function roundRect(ctx, x, y, width, height, radius) {
    var r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawLabel(ctx, text, x, y, anchor, size, color) {
    ctx.font = font(size, 700);
    ctx.textAlign = anchor;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 7;
    ctx.strokeStyle = ST.MapRenderer.STYLE.labelHalo;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color || ST.MapRenderer.STYLE.label;
    ctx.fillText(text, x, y);
  }

  function drawArrow(ctx, from, to) {
    var angle = Math.atan2(to.y - from.y, to.x - from.x);
    var size = 22;
    ctx.save();
    ctx.translate(to.x, to.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size * 0.55);
    ctx.lineTo(-size * 0.7, 0);
    ctx.lineTo(-size, size * 0.55);
    ctx.closePath();
    ctx.fillStyle = ST.MapRenderer.STYLE.path;
    ctx.fill();
    ctx.restore();
  }

  function drawPath(ctx, pathInfo) {
    if (!pathInfo || pathInfo.path.length < 2) return;
    var points = pathInfo.path.map(function (id) {
      var node = ST.MAP.getNode(id);
      return { x: node.x, y: node.y };
    });
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(function (point) { ctx.lineTo(point.x, point.y); });
    ctx.strokeStyle = ST.MapRenderer.STYLE.pathSoft;
    ctx.lineWidth = 16;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(function (point) { ctx.lineTo(point.x, point.y); });
    ctx.strokeStyle = ST.MapRenderer.STYLE.path;
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    drawArrow(ctx, points[points.length - 2], points[points.length - 1]);

    pathInfo.triggered.forEach(function (nodeId) {
      var node = ST.MAP.getNode(nodeId);
      ctx.beginPath();
      ctx.arc(node.x, node.y, 32, 0, Math.PI * 2);
      ctx.strokeStyle = ST.MapRenderer.STYLE.path;
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    var start = points[0];
    var end = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(start.x, start.y, 32, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(247,242,228,0.92)";
    ctx.fill();
    ctx.strokeStyle = ST.MapRenderer.STYLE.path;
    ctx.lineWidth = 4;
    ctx.stroke();
    drawLabel(ctx, "起點", start.x, start.y - 50, "center", 17, ST.MapRenderer.STYLE.path);

    ctx.beginPath();
    ctx.arc(end.x, end.y, 32, 0, Math.PI * 2);
    if (pathInfo.complete === false) {
      ctx.strokeStyle = ST.MapRenderer.STYLE.path;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      drawLabel(ctx, "目前", end.x, end.y - 62, "center", 17, ST.MapRenderer.STYLE.path);
    } else {
      ctx.fillStyle = ST.MapRenderer.STYLE.path;
      ctx.fill();
      drawLabel(ctx, "終點", end.x, end.y - 62, "center", 17, ST.MapRenderer.STYLE.path);
    }
    ctx.restore();
  }

  function drawNodes(ctx) {
    var style = ST.MapRenderer.STYLE;
    ST.MAP.nodes.forEach(function (node) {
      if (node.type === "facility") {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 43, 0, Math.PI * 2);
        ctx.setLineDash([7, 6]);
        ctx.strokeStyle = style.facility;
        ctx.lineWidth = 2.4;
        ctx.globalAlpha = 0.75;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.arc(node.x + 24, node.y - 24, 15, 0, Math.PI * 2);
      ctx.fillStyle = node.type === "facility" ? style.facility : style.badge;
      ctx.fill();
      ctx.font = font(17, 700);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#f7f2e4";
      ctx.fillText(String(node.id), node.x + 24, node.y - 23.5);

      if (node.type === "facility") {
        var label = ST.MapRenderer.labelPosition(node);
        drawLabel(ctx, ST.MapRenderer.shortName(node), label.x, label.y, label.anchor, 27, style.label);
      }
    });
  }

  function drawTokens(ctx, state, mode) {
    var style = ST.MapRenderer.STYLE;
    ST.MapRenderer.tokenGroups(state, { mode: mode }).forEach(function (token) {
      var player = token.player;
      var fill = player.role === "seeker" ? style.seeker : style.hider;
      if (state.activePlayerId === player.id) {
        ctx.beginPath();
        ctx.arc(token.x, token.y, token.radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = style.active;
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.arc(token.x, token.y, token.radius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = style.hiderRing;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = font(token.radius > 20 ? 20 : 17, 700);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff8ee";
      ctx.fillText(String(player.characterName || player.name || "?").slice(0, 1), token.x, token.y + 1);
    });
  }

  function drawHeader(ctx, state, options) {
    var style = ST.MapRenderer.STYLE;
    ctx.fillStyle = "#22332c";
    ctx.fillRect(0, 0, ST.MAP.width, HEADER);
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(0, HEADER - 4, ST.MAP.width, 4);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = '700 38px "Noto Serif TC","Songti TC","Microsoft JhengHei",serif';
    ctx.fillStyle = "#f7f2e4";
    ctx.fillText("暮影領地捉迷藏", 46, 54);
    ctx.font = font(21, 400);
    ctx.fillStyle = "rgba(247,242,228,0.72)";
    ctx.fillText(options.label || "遊戲狀態地圖", 46, 82);

    ctx.textAlign = "right";
    ctx.font = font(24, 700);
    ctx.fillStyle = "#f7f2e4";
    var mode = ST.getMode(state.mode);
    ctx.fillText("第 " + state.round + " / " + state.maxRound + " 回合", ST.MAP.width - 46, 50);
    ctx.font = font(20, 400);
    ctx.fillStyle = "rgba(247,242,228,0.72)";
    ctx.fillText(mode.label + "｜" + state.players.filter(function (p) { return p.inPlay; }).length + " 位角色", ST.MAP.width - 46, 80);
  }

  function drawFooter(ctx, state) {
    var top = HEADER + ST.MAP.renderHeight;
    ctx.fillStyle = "#22332c";
    ctx.fillRect(0, top, ST.MAP.width, FOOTER);
    var style = ST.MapRenderer.STYLE;
    var x = 46;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = font(18, 400);
    ctx.fillStyle = "rgba(247,242,228,0.82)";
    ctx.beginPath();
    ctx.arc(x + 6, top + FOOTER / 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = style.hider;
    ctx.fill();
    ctx.fillStyle = "rgba(247,242,228,0.82)";
    ctx.fillText("躲藏者", x + 22, top + FOOTER / 2);
    x += 120;
    ctx.beginPath();
    ctx.arc(x + 6, top + FOOTER / 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = style.seeker;
    ctx.fill();
    ctx.fillStyle = "rgba(247,242,228,0.82)";
    ctx.fillText("追捕者", x + 22, top + FOOTER / 2);
    x += 120;
    ctx.strokeStyle = style.path;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(x, top + FOOTER / 2);
    ctx.lineTo(x + 34, top + FOOTER / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(247,242,228,0.82)";
    ctx.fillText("移動路徑", x + 46, top + FOOTER / 2);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(247,242,228,0.55)";
    ctx.fillText("暮影領地捉迷藏｜主持人地圖工具 · " + new Date().toLocaleString("zh-TW", { hour12: false }), ST.MAP.width - 46, top + FOOTER / 2);
  }

  var MapExport = {
    /**
     * 產生 PNG dataURL。
     * options: { mode: "status"|"movement", label }
     */
    exportPNG: function (state, options) {
      options = options || {};
      var mode = options.mode === "movement" ? "movement" : "status";
      return loadMapImage().then(function (image) {
        var canvas = document.createElement("canvas");
        canvas.width = ST.MAP.width;
        canvas.height = ST.MAP.renderHeight + HEADER + FOOTER;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = ST.MapRenderer.STYLE.parchment;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        drawHeader(ctx, state, {
          label: options.label || (mode === "movement" ? "移動過程地圖" : "遊戲狀態地圖")
        });

        ctx.save();
        ctx.translate(0, HEADER);
        ctx.drawImage(image, 0, 0, ST.MAP.width, ST.MAP.height);
        var pathInfo = ST.MapRenderer.activePath(state, mode);
        drawPath(ctx, pathInfo);
        drawNodes(ctx);
        drawTokens(ctx, state, mode);
        ctx.restore();

        drawFooter(ctx, state);
        return canvas.toDataURL("image/png");
      });
    },

    download: function (dataUrl, filename) {
      var anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = filename || "shadow-territory-map.png";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    },

    filename: function (state, mode) {
      var now = new Date();
      function pad(value) { return String(value).padStart(2, "0"); }
      var stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "-" + pad(now.getHours()) + pad(now.getMinutes());
      return "shadow-territory-" + (mode === "movement" ? "move" : "status") + "-r" + state.round + "-" + stamp + ".png";
    }
  };

  ST.MapExport = MapExport;
})(window.ST = window.ST || {});
