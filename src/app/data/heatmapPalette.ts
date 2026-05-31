// Green opportunity heatmap palette (10 steps) — lightest → darkest green
export const HEATMAP_PALETTE = [
  "#f7fcf5", // 0  
  "#e5f5e0", // 1  
  "#c7e9c0", // 2  
  "#a1d99b", // 3  
  "#74c476", // 4  
  "#41ab5d", // 5 
  "#238b45", // 6  
  "#006d2c", // 7 
  "#005a32", // 8 
  "#00441b", // 9 
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