/*
 * 暮影領地捉迷藏｜20 格環狀地圖資料
 * 座標來源：assets/map/map_nodes.json（1717 × 961 px，左上角為原點）
 * 座標只負責「顯示」，遊戲規則與狀態一律由 Store 管理。
 */
(function (ST) {
  "use strict";

  var MAP_NODES = [
    { id: 1,  x: 576.5,  y: 81.5,  name: "領地接待廳",   label: "接待廳",     type: "facility", labelDy: 118 },
    { id: 2,  x: 778.5,  y: 88.5,  name: "",             type: "normal" },
    { id: 3,  x: 964.5,  y: 99.5,  name: "黑薔薇莊園",   label: "黑薔薇莊園", type: "facility", labelDy: 78 },
    { id: 4,  x: 1141.5, y: 181.5, name: "",             type: "normal" },
    { id: 5,  x: 1279.5, y: 306.5, name: "血月裁決",     label: "血月裁決",   type: "facility", labelDy: 78 },
    { id: 6,  x: 1449.5, y: 357.5, name: "",             type: "normal" },
    { id: 7,  x: 1615.5, y: 450.5, name: "王室旋轉木馬", label: "旋轉木馬",   type: "facility", labelDy: 78 },
    { id: 8,  x: 1651.5, y: 640.5, name: "",             type: "normal" },
    { id: 9,  x: 1545.5, y: 822.5, name: "",             type: "normal" },
    { id: 10, x: 1351.5, y: 879.5, name: "貝瑟妮茶館",   label: "貝瑟妮茶館", type: "facility", labelDy: 78 },
    { id: 11, x: 1176.5, y: 840.5, name: "",             type: "normal" },
    { id: 12, x: 997.5,  y: 834.5, name: "飛天試煉",     label: "飛天試煉",   type: "facility", labelDy: 78 },
    { id: 13, x: 822.5,  y: 837.5, name: "",             type: "normal" },
    { id: 14, x: 643.5,  y: 795.5, name: "古堡探險",     label: "古堡探險",   type: "facility", labelDy: 78 },
    { id: 15, x: 456.5,  y: 702.5, name: "",             type: "normal" },
    { id: 16, x: 247.5,  y: 738.5, name: "三明治男爵",   label: "三明治男爵", type: "facility", labelDy: 78 },
    { id: 17, x: 69.5,   y: 608.5, name: "",             type: "normal" },
    { id: 18, x: 63.5,   y: 393.5, name: "",             type: "normal" },
    { id: 19, x: 211.5,  y: 240.5, name: "幽影海盜船",   label: "幽影海盜船", type: "facility", labelDy: 78 },
    { id: 20, x: 397.5,  y: 165.5, name: "",             type: "normal" }
  ];

  var byId = {};
  MAP_NODES.forEach(function (node) { byId[node.id] = node; });

  ST.MAP = {
    width: 1717,
    height: 961,
    labelPadding: 64,
    renderHeight: 961 + 64,
    nodes: MAP_NODES,
    facilityIds: MAP_NODES.filter(function (n) { return n.type === "facility"; }).map(function (n) { return n.id; }),
    center: { x: 858.5, y: 480.5 },

    getNode: function (id) {
      return byId[Number(id)] || null;
    },

    /** 20 格環狀移動：方向 +1 為順時針（編號遞增），-1 為逆時針。 */
    step: function (fromId, direction, steps) {
      var count = MAP_NODES.length;
      var index = Number(fromId) - 1;
      index = ((index + direction * steps) % count + count) % count;
      return index + 1;
    },

    /** 回傳移動路徑（不含起點），供預覽與地圖繪製使用。 */
    path: function (fromId, direction, steps) {
      var result = [];
      var position = Number(fromId);
      for (var i = 0; i < steps; i += 1) {
        position = ST.MAP.step(position, direction, 1);
        result.push(position);
      }
      return result;
    },

    label: function (id) {
      var node = byId[Number(id)];
      if (!node) return "未知格";
      return facilityOrNode(node);
    },

    facilityName: function (id) {
      var node = byId[Number(id)];
      if (!node) return "";
      return node.name || "";
    }
  };

  function facilityOrNode(node) {
    return node.name ? node.id + "．" + node.name : node.id + " 號格";
  }
})(window.ST = window.ST || {});
