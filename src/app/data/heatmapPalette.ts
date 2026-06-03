// Opportunity heatmap palette (10 steps) — single-hue teal → deep navy.
// Cool, low-fatigue ramp: pale teal (low score) → deep navy (명당/high score).
// Warm tones (amber/red) are reserved for caution signals elsewhere (지가, brushing).
export const HEATMAP_PALETTE = [
  "#f3faf3", // 0
  "#e2f3e2", // 1
  "#cde8cd", // 2
  "#b4dbb4", // 3
  "#8fc98f", // 4
  "#5FB35F", // 5 (center)
  "#4b9d4b", // 6
  "#388738", // 7
  "#286f28", // 8
  "#184f18", // 9
] as const;

// Missing data
export const HEATMAP_MISSING_COLOR = "#f3f4f6"; 

// Non-linear exponent (< 1 stretches low values into more color bins,
// useful when a few outliers dominate the absolute max).
const HEATMAP_EXPONENT = 0.99;

export function getHeatmapColor(value: number | null | undefined, max: number): string {
  if (value == null || Number.isNaN(value) || value < 0) return HEATMAP_MISSING_COLOR;
  
  const ratio = Math.max(0, Math.min(1, value / Math.max(max, 1)));
  const stretched = Math.pow(ratio, HEATMAP_EXPONENT);
  const idx = Math.min(
    HEATMAP_PALETTE.length - 1,
    Math.floor(stretched * HEATMAP_PALETTE.length),
  );
  return HEATMAP_PALETTE[idx];
}

export function getHeatmapColorFromRatio(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || value < 0) return HEATMAP_MISSING_COLOR;
  
  const ratio = Math.max(0, Math.min(1, value));
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