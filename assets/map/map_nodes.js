// Map node coordinates for the 1717 × 961 map.png.
// Coordinates are measured from the top-left corner; (0, 0) is the top-left pixel.
// Node IDs follow the clockwise game order supplied by the game host.
// Review the coordinates visually before using them for precision-critical placement.

export const MAP_WIDTH = 1717;
export const MAP_HEIGHT = 961;

export const mapNodes = [
  { id: 1, x: 576.5, y: 81.5, name: "領地接待廳", type: "facility" },
  { id: 2, x: 778.5, y: 88.5, name: "", type: "normal" },
  { id: 3, x: 964.5, y: 99.5, name: "", type: "normal" },
  { id: 4, x: 1141.5, y: 181.5, name: "", type: "normal" },
  { id: 5, x: 1279.5, y: 306.5, name: "", type: "normal" },
  { id: 6, x: 1449.5, y: 357.5, name: "", type: "normal" },
  { id: 7, x: 1615.5, y: 450.5, name: "", type: "normal" },
  { id: 8, x: 1651.5, y: 640.5, name: "", type: "normal" },
  { id: 9, x: 1545.5, y: 822.5, name: "", type: "normal" },
  { id: 10, x: 1351.5, y: 879.5, name: "", type: "normal" },
  { id: 11, x: 1176.5, y: 840.5, name: "", type: "normal" },
  { id: 12, x: 997.5, y: 834.5, name: "", type: "normal" },
  { id: 13, x: 822.5, y: 837.5, name: "", type: "normal" },
  { id: 14, x: 643.5, y: 795.5, name: "", type: "normal" },
  { id: 15, x: 456.5, y: 702.5, name: "", type: "normal" },
  { id: 16, x: 247.5, y: 738.5, name: "", type: "normal" },
  { id: 17, x: 69.5, y: 608.5, name: "", type: "normal" },
  { id: 18, x: 63.5, y: 393.5, name: "", type: "normal" },
  { id: 19, x: 211.5, y: 240.5, name: "", type: "normal" },
  { id: 20, x: 397.5, y: 165.5, name: "", type: "normal" }
];

export function getMapNode(id) {
  return mapNodes.find((node) => node.id === Number(id)) ?? null;
}
