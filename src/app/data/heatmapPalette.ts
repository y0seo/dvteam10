// Steel-blue heatmap palette — lightest → darkest navy.
// Discrete steps give crisp visual distinction (opacity-based maps tend to look washed-out).
export const HEATMAP_PALETTE = [
  "#dbe9f1", // 0 - very pale
  "#a4c5d4",
  "#7aabc1",
  "#5d92ac",
  "#3a6e8c",
  "#22557a",
  "#143d5c", // 6 - deep navy
] as const;

export const HEATMAP_MISSING_COLOR = "#e5e7eb"; // gray-200 for no-data regions

// Non-linear exponent (< 1 stretches low values into more color bins,
// useful when a few outliers dominate the absolute max).
const HEATMAP_EXPONENT = 0.45;

export function getHeatmapColor(value: number, max: number): string {
  if (!value || value <= 0) return HEATMAP_MISSING_COLOR;
  const ratio = Math.max(0, Math.min(1, value / Math.max(max, 1)));
  const stretched = Math.pow(ratio, HEATMAP_EXPONENT);
  const idx = Math.min(
    HEATMAP_PALETTE.length - 1,
    Math.floor(stretched * HEATMAP_PALETTE.length),
  );
  return HEATMAP_PALETTE[idx];
}

// Build linear CSS gradient string spanning the palette (low → high).
// Use as `background` on the legend bar.
export const HEATMAP_GRADIENT = `linear-gradient(to top, ${HEATMAP_PALETTE.join(", ")})`;

export const formatVisitorsInMan = (value: number) =>
  `${Math.round(value / 10000).toLocaleString()}만명`;
