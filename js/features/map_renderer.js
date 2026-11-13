/*
 * 暮影領地捉迷藏｜地圖繪製
 * ------------------------------------------------------------------
 * 以既有 map.png 為底圖，用 SVG 疊加 20 格節點、設施名稱、角色標記、
 * 移動路徑、起點與終點。地圖只負責顯示，所有位置都來自 Store 的狀態。
 */
(function (ST) {
  "use strict";

  var STYLE = {
    parchment: "#f7f2e4",
    ink: "#22332c",
    facility: "#35543f",
    facilitySoft: "rgba(53, 84, 63, 0.10)",
    path: "#b07d22",
    pathSoft: "rgba(176, 125, 34, 0.18)",
    hider: "#28675d",
    hiderRing: "#f7f2e4",
    seeker: "#7c2f3c",
    seekerRing: "#f7f2e4",
    active: "#c9a227",
    label: "#22332c",
    labelHalo: "#f7f2e4",
    badge: "#22332c"
  };

  var SHORT_NAMES = {
    1: "接待廳",
    3: "黑薔薇莊園",
    5: "血月裁決",
    7: "旋轉木馬",
    10: "貝瑟妮茶館",
    12: "飛天試煉",
    14: "古堡探險",
    16: "三明治男爵",
    19: "幽影海盜船"
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function shortName(node) {
    return node.label || SHORT_NAMES[node.id] || node.name || "";
  }

  function labelPosition(node) {
    // 每一格可在 js/data/map.js 用 labelDx / labelDy / labelAnchor 微調；
    // 預設統一放在圓點下方。
    var dx = node.labelDx != null ? Number(node.labelDx) : 0;
    var dy = node.labelDy != null ? Number(node.labelDy) : 78;
    return {
      x: node.x + dx,
      y: node.y + dy,
      anchor: node.labelAnchor || "middle"
    };
  }

  function tokenRadius(count) {
    return count > 4 ? 17 : count > 1 ? 19 : 23;
  }

  function tokenOffset(index, count) {
    if (count <= 1) return { dx: 0, dy: 0 };
    var ring = count > 4 ? 30 : 27;
    var angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return { dx: Math.cos(angle) * ring, dy: Math.sin(angle) * ring };
  }

  var MapRenderer = {
    STYLE: STYLE,
    shortName: shortName,
    labelPosition: labelPosition,
    tokenOffset: tokenOffset,
    tokenRadius: tokenRadius,

    /** 目前應顯示的角色位置（移動預覽時，行動角色顯示在預覽終點）。 */
    displayPositions: function (state, options) {
      options = options || {};
      var positions = {};
      if (!state) return positions;
      state.players.forEach(function (player) { positions[player.id] = player.position; });
      if (options.mode === "movement" && state.movement) {
        var session = state.movement;
        positions[session.playerId] = session.endPosition != null
          ? session.endPosition
          : session.path[session.path.length - 1];
      } else if (options.mode === "movement" && state.lastMovement) {
        positions[state.lastMovement.playerId] = state.lastMovement.endPosition;
      }
      return positions;
    },

    /** 依節點分組角色，並計算同一格內的偏移。 */
    tokenGroups: function (state, options) {
      var positions = MapRenderer.displayPositions(state, options);
      var groups = {};
      Object.keys(positions).forEach(function (playerId) {
        var nodeId = positions[playerId];
        groups[nodeId] = groups[nodeId] || [];
        groups[nodeId].push(playerId);
      });
      var result = [];
      Object.keys(groups).forEach(function (nodeId) {
        var list = groups[nodeId].map(function (playerId) {
          return state.players.filter(function (p) { return p.id === playerId; })[0];
        }).filter(function (player) {
          return player && player.inPlay && !player.captured;
        });
        list.sort(function (a, b) {
          if (a.role !== b.role) return a.role === "seeker" ? 1 : -1;
          return String(a.characterName || a.name).localeCompare(String(b.characterName || b.name), "zh-Hant");
        });
        list.forEach(function (player, index) {
          var offset = tokenOffset(index, list.length);
          result.push({
            player: player,
            nodeId: Number(nodeId),
            x: ST.MAP.getNode(nodeId).x + offset.dx,
            y: ST.MAP.getNode(nodeId).y + offset.dy,
            radius: tokenRadius(list.length),
            preview: options && options.mode === "movement" && state.movement && state.movement.playerId === player.id
          });
        });
      });
      return result;
    },

    render: function (container, state, options) {
      if (!container) return;
      options = options || {};
      var mode = options.mode === "movement" ? "movement" : "status";
      var svg = [];
      svg.push('<svg class="map-svg" viewBox="0 0 ' + ST.MAP.width + " " + ST.MAP.renderHeight + '" role="img" aria-label="暮影領地地圖">');
      svg.push('<defs>');
      svg.push('<marker id="st-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="' + STYLE.path + '"/></marker>');
      svg.push('<filter id="st-token-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1a241f" flood-opacity="0.35"/></filter>');
      svg.push('</defs>');
      svg.push('<rect x="0" y="0" width="' + ST.MAP.width + '" height="' + ST.MAP.renderHeight + '" fill="' + STYLE.parchment + '"/>');
      if (ST.MAP_IMAGE_DATA_URI) {
        svg.push('<image href="' + ST.MAP_IMAGE_DATA_URI + '" x="0" y="0" width="' + ST.MAP.width + '" height="' + ST.MAP.height + '" preserveAspectRatio="xMidYMid meet"/>');
      }
      svg.push('<rect x="0" y="0" width="' + ST.MAP.width + '" height="' + ST.MAP.height + '" fill="none"/>');

      // 節點與設施名稱
      svg.push('<g class="map-nodes">');
      ST.MAP.nodes.forEach(function (node) {
        var isFacility = node.type === "facility";
        var label = labelPosition(node);
        svg.push('<g class="map-node' + (isFacility ? " is-facility" : "") + '" data-node="' + node.id + '" transform="translate(' + node.x + "," + node.y + ')">');
        svg.push('<circle class="node-hit" r="' + (isFacility ? 52 : 40) + '" fill="transparent"/>');
        if (isFacility) {
          svg.push('<circle class="node-facility-ring" r="43" fill="none" stroke="' + STYLE.facility + '" stroke-width="2.4" stroke-dasharray="7 6" opacity="0.75"/>');
        }
        svg.push('<circle class="node-badge-circle" cx="24" cy="-24" r="15" fill="' + (isFacility ? STYLE.facility : STYLE.badge) + '"/>');
        svg.push('<text class="node-badge" x="24" y="-18.5" text-anchor="middle" fill="#f7f2e4" font-size="17" font-weight="700">' + node.id + '</text>');
        if (isFacility) {
          svg.push('<text class="node-label" x="' + (label.x - node.x) + '" y="' + (label.y - node.y) + '" text-anchor="' + label.anchor +
            '" font-size="27" font-weight="700" fill="' + STYLE.label + '" stroke="' + STYLE.labelHalo + '" stroke-width="7" paint-order="stroke" stroke-linejoin="round">' +
            escapeHtml(shortName(node)) + '</text>');
        }
        svg.push('</g>');
      });
      svg.push('</g>');

      // 移動路徑
      var pathInfo = MapRenderer.activePath(state, mode);
      if (pathInfo && pathInfo.path.length > 1) {
        var points = pathInfo.path.map(function (nodeId) {
          var node = ST.MAP.getNode(nodeId);
          return node.x + "," + node.y;
        }).join(" ");
        svg.push('<g class="map-path" pointer-events="none">');
        svg.push('<polyline points="' + points + '" fill="none" stroke="' + STYLE.pathSoft + '" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>');
        svg.push('<polyline points="' + points + '" fill="none" stroke="' + STYLE.path + '" stroke-width="6" stroke-dasharray="14 10" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#st-arrow)"/>');
        pathInfo.triggered.forEach(function (nodeId) {
          var node = ST.MAP.getNode(nodeId);
          svg.push('<circle cx="' + node.x + '" cy="' + node.y + '" r="32" fill="none" stroke="' + STYLE.path + '" stroke-width="3" opacity="0.9"/>');
        });
        var startNode = ST.MAP.getNode(pathInfo.path[0]);
        svg.push('<circle cx="' + startNode.x + '" cy="' + startNode.y + '" r="32" fill="' + STYLE.parchment + '" fill-opacity="0.9" stroke="' + STYLE.path + '" stroke-width="4"/>');
        svg.push('<text x="' + startNode.x + '" y="' + (startNode.y - 50) + '" text-anchor="middle" font-size="17" font-weight="700" fill="' + STYLE.path + '" stroke="' + STYLE.labelHalo + '" stroke-width="6" paint-order="stroke">起點</text>');
        var endNode = ST.MAP.getNode(pathInfo.end);
        if (pathInfo.complete === false) {
          svg.push('<circle cx="' + endNode.x + '" cy="' + endNode.y + '" r="32" fill="none" stroke="' + STYLE.path + '" stroke-width="3" stroke-dasharray="5 5"/>');
          svg.push('<text x="' + endNode.x + '" y="' + (endNode.y - 62) + '" text-anchor="middle" font-size="17" font-weight="700" fill="' + STYLE.path + '" stroke="' + STYLE.labelHalo + '" stroke-width="6" paint-order="stroke">目前</text>');
        } else {
          svg.push('<circle cx="' + endNode.x + '" cy="' + endNode.y + '" r="32" fill="' + STYLE.path + '" fill-opacity="0.92"/>');
          svg.push('<text x="' + endNode.x + '" y="' + (endNode.y - 62) + '" text-anchor="middle" font-size="17" font-weight="700" fill="' + STYLE.path + '" stroke="' + STYLE.labelHalo + '" stroke-width="6" paint-order="stroke">終點</text>');
        }
        svg.push('</g>');
      }

      // 角色標記
      svg.push('<g class="map-tokens" pointer-events="none">');
      MapRenderer.tokenGroups(state, { mode: mode }).forEach(function (token) {
        var player = token.player;
        var fill = player.role === "seeker" ? STYLE.seeker : STYLE.hider;
        var initial = String(player.characterName || player.name || "?").slice(0, 1);
        var active = state && state.activePlayerId === player.id;
        svg.push('<g class="map-token map-token-' + player.role + (active ? " is-active" : "") + (token.preview ? " is-preview" : "") + '">');
        if (active) {
          svg.push('<circle cx="' + token.x + '" cy="' + token.y + '" r="' + (token.radius + 8) + '" fill="none" stroke="' + STYLE.active + '" stroke-width="3" stroke-dasharray="4 4"/>');
        }
        svg.push('<circle cx="' + token.x + '" cy="' + token.y + '" r="' + token.radius + '" fill="' + fill + '" stroke="' + STYLE.hiderRing + '" stroke-width="3" filter="url(#st-token-shadow)"/>');
        svg.push('<text x="' + token.x + '" y="' + (token.y + 7) + '" text-anchor="middle" font-size="' + (token.radius > 20 ? 20 : 17) + '" font-weight="700" fill="#fff8ee">' + escapeHtml(initial) + '</text>');
        if (token.preview) {
          svg.push('<text x="' + token.x + '" y="' + (token.y + token.radius + 22) + '" text-anchor="middle" font-size="16" font-weight="700" fill="' + STYLE.path + '" stroke="' + STYLE.labelHalo + '" stroke-width="5" paint-order="stroke">預覽</text>');
        }
        svg.push('</g>');
      });
      svg.push('</g>');
      svg.push('</svg>');

      container.innerHTML = svg.join("");

      var svgNode = container.querySelector("svg");
      if (svgNode && typeof options.onNodeClick === "function") {
        svgNode.addEventListener("click", function (event) {
          var group = event.target.closest("[data-node]");
          if (group) options.onNodeClick(Number(group.getAttribute("data-node")), event);
        });
      }
      return svgNode;
    },

    /** 取得目前要畫的路徑（預覽優先，其次為上一次移動）。 */
    activePath: function (state, mode) {
      if (!state) return null;
      if (mode === "movement") {
        var session = state.movement;
        if (session) {
          var path = session.kind === "extra" && session.priorPath
            ? session.priorPath.concat(session.path.slice(1))
            : session.path.slice();
          var complete = session.status === "ready" && session.endPosition != null;
          return {
            path: path,
            end: complete ? session.endPosition : path[path.length - 1],
            complete: complete,
            triggered: session.resolved.map(function (item) { return item.nodeId; })
          };
        }
        var record = state.lastMovement;
        if (record) {
          return { path: record.path.slice(), end: record.endPosition, complete: true, triggered: record.triggered };
        }
      }
      return null;
    }
  };

  ST.MapRenderer = MapRenderer;
})(window.ST = window.ST || {});
