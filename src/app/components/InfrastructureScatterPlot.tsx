import {
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  CartesianGrid,
  Cell,
  Customized,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { getScatterData, type ScatterDataItem } from "../data/infrastructureData";
import { getDistrictVisitorTotals, provinceIdToCsvName } from "../data/visitorData";
import { getAccommodationSpending } from "../data/comparisonData";

interface InfrastructureScatterPlotProps {
  currentViewLevel: string;
  selectedRegion: string;
  selectedSubRegion: string | null;
  selectedSubRegionName: string | null;
  hoveredSubRegion?: string | null;
  hoveredProvinceId?: string | null;
  regionsInfo: { id: string; name: string }[];
  selectedComparePointIds?: string[];
  isCompareMode?: boolean;
  dynamicAllDetailOpportunityData?: Record<string, any>; 
  onDataPointClick?: (item: ScatterDataItem) => void;
  onDataPointHover?: (item: ScatterDataItem | null) => void;
}

const REGION_COLORS = ["#2563eb", "#10b981", "#f97316"];

const HOVERED_POINT_COLOR = "#483777"; 
const SELECTED_POINT_COLOR = "#483777";
const GLOW_COLOR = "#ffffff00"; 

const SCATTER_PALETTE = [
  "#d0c8ec", "#c2b7e5", "#b4a6de", "#a695d7", "#9884d0",
  "#8a73c9", "#7c62c2", "#6E5FB3", "#5b4a95", "#483777",
];

function getScatterColor(value: number, max: number): string {
  if (max <= 0 || value <= 0) return SCATTER_PALETTE[0];
  const ratio = Math.sqrt(Math.min(value / max, 1));
  const index = Math.min(
    Math.floor(ratio * SCATTER_PALETTE.length),
    SCATTER_PALETTE.length - 1,
  );
  return SCATTER_PALETTE[index];
}

type ExtendedScatterDataItem = ScatterDataItem & {
  spending: number;
  visitors: number;
};

type HighlightedScatterPointPayload = ExtendedScatterDataItem & {
  highlightState?: "selected" | "hovered" | null;
  isCompareSelected?: boolean;
  compareIndex?: number; 
  isDimmed?: boolean;
};

interface HighlightedScatterPointProps {
  cx?: number;
  cy?: number;
  size?: number;
  fill?: string;
  payload?: HighlightedScatterPointPayload;
  cursor?: string;
  onPointClick?: (item: ScatterDataItem) => void;
  onPointHover?: (item: ScatterDataItem | null) => void;
}

let cachedVisitorData: Record<string, number> | null = null;
let cachedScatterData: ExtendedScatterDataItem[] = [];
let cachedColorScaleMax = 1;
let cachedMaxPrice = 1;
let cachedMaxAccommodation = 1;
let cachedMaxSpending = 1;
let cachedRegression: { slope: number; intercept: number } = { slope: 0, intercept: 0 };

function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0 };
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  const denom = sumX2 - n * meanX * meanX;
  if (Math.abs(denom) < 1e-9) return { slope: 0, intercept: meanY };
  const slope = (sumXY - n * meanX * meanY) / denom;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

function RegressionShading(props: {
  xAxisMap?: Record<string, { scale: (v: number) => number; domain: [number, number] }>;
  yAxisMap?: Record<string, { scale: (v: number) => number; domain: [number, number] }>;
}) {
  const xAxis = props.xAxisMap && Object.values(props.xAxisMap)[0];
  const yAxis = props.yAxisMap && Object.values(props.yAxisMap)[0];
  if (!xAxis?.scale || !yAxis?.scale || !xAxis.domain || !yAxis.domain) return null;

  const [xMinData, xMaxData] = xAxis.domain;
  const [yMinData, yMaxData] = yAxis.domain;

  const lineY1 = cachedRegression.slope * xMinData + cachedRegression.intercept;
  const lineY2 = cachedRegression.slope * xMaxData + cachedRegression.intercept;
  const clipY = (v: number) => Math.max(yMinData, Math.min(yMaxData, v));
  const y1 = clipY(lineY1);
  const y2 = clipY(lineY2);

  const px1 = xAxis.scale(xMinData);
  const py1 = yAxis.scale(y1);
  const px2 = xAxis.scale(xMaxData);
  const py2 = yAxis.scale(y2);
  const pyTop = yAxis.scale(yMaxData);
  const pyBottom = yAxis.scale(yMinData);

  return (
    <g pointerEvents="none">
      <polygon
        points={`${px1},${pyBottom} ${px1},${py1} ${px2},${py2} ${px2},${pyBottom}`}
        fill="#3b82f6"
        opacity={0.06}
      />
      <polygon
        points={`${px1},${pyTop} ${px1},${py1} ${px2},${py2} ${px2},${pyTop}`}
        fill="#ef4444"
        opacity={0.06}
      />
      <line
        x1={px1}
        y1={py1}
        x2={px2}
        y2={py2}
        stroke="#94a3b8"
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />
      <text x={px2 - 8} y={pyBottom - 8} textAnchor="end" fontSize={10} fontWeight={700} fill="#3b82f6" opacity={0.7}>
        Blue Ocean
      </text>
      <text x={px2 - 8} y={pyTop + 16} textAnchor="end" fontSize={10} fontWeight={700} fill="#ef4444" opacity={0.7}>
        Red Ocean
      </text>
    </g>
  );
}

function GrowthIndicator({ rate }: { rate: number }) {
  const percent = Math.round(rate * 100);
  const threshold = 0.01;
  if (rate > threshold) {
    return (
      <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: "#dc2626" }}>
        ▲ +{percent}%
      </span>
    );
  }
  if (rate < -threshold) {
    return (
      <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: "#2563eb" }}>
        ▼ {percent}%
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold tabular-nums text-gray-400 shrink-0">― {percent}%</span>
  );
}

function initializeNationwideDataOnce(regionsInfo: { id: string; name: string }[]) {
  if (cachedVisitorData !== null) return;

  const visitors: Record<string, number> = {};
  let scatter: ExtendedScatterDataItem[] = [];

  regionsInfo.forEach((region) => {
    const data = getDistrictVisitorTotals(region.id) || {};
    Object.entries(data).forEach(([districtName, value]) => {
      visitors[`${region.id}-${districtName}`] = value;
    });

    const scatterRaw = getScatterData(region.id) || [];
    const mappedData = scatterRaw.map((item) => {
      const actualSpending = getAccommodationSpending(region.id, item.name) || 0;
      const actualVisitors = visitors[`${region.id}-${item.name}`] || 0; 

      return {
        ...item,
        id: `${region.id}-${item.id}`,
        spending: actualSpending, 
        visitors: actualVisitors, 
      };
    });
    scatter = [...scatter, ...mappedData];
  });

  const values = Object.values(visitors)
    .map((v) => Number(v) || 0)
    .sort((a, b) => a - b);

  let maxScale = 1;
  if (values.length > 10) {
    const trimmedValues = values.slice(5, -5); 
    maxScale = Math.max(...trimmedValues, 1);
  } else if (values.length > 0) {
    maxScale = Math.max(...values, 1);
  }

  cachedMaxPrice = Math.ceil(Math.max(...scatter.map(s => s.price), 1) * 1.05);
  cachedMaxAccommodation = Math.ceil(Math.max(...scatter.map(s => s.accommodation), 1) * 1.05);
  cachedMaxSpending = Math.max(...scatter.map(s => s.spending), 1);

  const regressionPoints = scatter
    .filter((item) => item.price > 0 && item.accommodation >= 0)
    .map((item) => ({ x: item.price, y: item.accommodation }));
  cachedRegression = linearRegression(regressionPoints);

  cachedVisitorData = visitors;
  cachedScatterData = scatter;
  cachedColorScaleMax = maxScale;
}

function HighlightedScatterPoint({
  cx,
  cy,
  size,
  fill,
  payload,
  cursor = "default",
  onPointClick,
  onPointHover,
}: HighlightedScatterPointProps) {
  if (typeof cx !== "number" || typeof cy !== "number") return null;

  const highlightState = payload?.highlightState;
  const isSelected = highlightState === "selected";
  const isHovered = highlightState === "hovered";
  const isCompareSelected = payload?.isCompareSelected;
  const compareIndex = payload?.compareIndex ?? -1;
  const isDimmed = Boolean(payload?.isDimmed);
  
  const baseRadius = size ? Math.sqrt(size) : 5;
  const radius = baseRadius; 
  
  let strokeColor = "#b3b3b33a";
  let strokeWidth = 1.5;

  if (isCompareSelected && compareIndex >= 0) {
    strokeColor = REGION_COLORS[compareIndex % REGION_COLORS.length];
    strokeWidth = 3;
  } else if (isSelected) {
    strokeColor = SELECTED_POINT_COLOR;
    strokeWidth = 3;
  } else if (isHovered) {
    strokeColor = HOVERED_POINT_COLOR;
    strokeWidth = 2;
  }

  return (
    <g
      cursor={cursor}
      data-scatter-hit="true"
      pointerEvents="all"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (payload) onPointClick?.(payload);
      }}
      onMouseEnter={() => {
        if (payload) onPointHover?.(payload);
      }}
      onMouseLeave={() => {
        onPointHover?.(null);
      }}
    >
      {(isSelected || isCompareSelected) && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 2}
          fill="none"
          stroke={isCompareSelected ? strokeColor : GLOW_COLOR}
          strokeWidth={5}
          opacity={0.3}
        />
      )}
      
      <circle
        className={`scatter-dot-${payload?.id}`}
        cx={cx}
        cy={cy}
        r={radius}
        fill={fill}
        fillOpacity={isDimmed ? 1 : 0.8}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={isDimmed ? 0.2 : 0.8}
      />
    </g>
  );
}

export function InfrastructureScatterPlot({
  selectedRegion,
  selectedSubRegion,
  regionsInfo,
  selectedComparePointIds = [],
  isCompareMode = false,
  dynamicAllDetailOpportunityData,
  onDataPointClick,
  onDataPointHover,
  hoveredSubRegion,
  hoveredProvinceId,
}: InfrastructureScatterPlotProps) {
  
  initializeNationwideDataOnce(regionsInfo);

  const scatterData = cachedScatterData;
  const colorScaleMax = cachedColorScaleMax;

  const [hoveredPoint, setHoveredPoint] = useState<ScatterDataItem | null>(null);
  const [clickedPointId, setClickedPointId] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setClickedPointId(null);
  }, [selectedRegion]);
  
  const clickedPoint = useMemo(
    () => scatterData.find((entry) => entry.id === clickedPointId) ?? null,
    [clickedPointId, scatterData],
  );
  
  const selectedPoint = useMemo(
    () => (selectedSubRegion ? scatterData.find((entry) => entry.id === `${selectedRegion}-${selectedSubRegion}`) : null),
    [scatterData, selectedRegion, selectedSubRegion],
  );

  const mapHoveredPoint = useMemo(
    () => (hoveredSubRegion ? scatterData.find((entry) => entry.id === `${selectedRegion}-${hoveredSubRegion}`) : null),
    [hoveredSubRegion, selectedRegion, scatterData],
  );

  const activePiePoint = clickedPoint ?? selectedPoint ?? hoveredPoint ?? mapHoveredPoint;

  const highlightedScatterData = useMemo(
    () =>
      scatterData
        .filter((entry) => {
          if (!selectedRegion || selectedRegion === "national") return true;
          return entry.id.startsWith(`${selectedRegion}-`);
        })
        .map((entry) => {
          const isChartHovered = hoveredPoint?.id === entry.id;
          const isMapHovered = hoveredSubRegion ? entry.id === `${selectedRegion}-${hoveredSubRegion}` : false;
          const isProvinceHovered = hoveredProvinceId
            ? entry.id.startsWith(`${hoveredProvinceId}-`)
            : false;
          const isHovered = isChartHovered || isMapHovered || isProvinceHovered;
          const hasHoveredPoint = Boolean(hoveredPoint || hoveredSubRegion || hoveredProvinceId);

          const isChartClicked = clickedPointId === entry.id;
          const isMapSelected = selectedSubRegion ? entry.id === `${selectedRegion}-${selectedSubRegion}` : false;
          const isSelected = isChartClicked || isMapSelected;
          
          const compareIndex = selectedComparePointIds.indexOf(entry.id);
          const isCompareSelected = compareIndex !== -1;

          return {
            ...entry,
            highlightState: (isSelected ? "selected" : isHovered ? "hovered" : null) as
              | "selected"
              | "hovered"
              | null,
            isCompareSelected,
            compareIndex,
            isDimmed: hasHoveredPoint && !isHovered && !isSelected && !isCompareSelected,
          };
        })
        .sort((a, b) => {
          const rank = (item: { isCompareSelected: boolean; highlightState: "selected" | "hovered" | null }) => {
            if (item.isCompareSelected) return 3;
            if (item.highlightState === "selected") return 2;
            if (item.highlightState === "hovered") return 1;
            return 0;
          };
          return rank(a) - rank(b);
        }),
    [
      clickedPointId,
      hoveredPoint,
      hoveredSubRegion,
      hoveredProvinceId,
      scatterData,
      selectedComparePointIds,
      selectedRegion,
      selectedSubRegion,
    ],
  );

  const displayRegionTitle = useMemo(() => {
    if (!activePiePoint) return "";
    const idParts = activePiePoint.id.split("-");
    if (idParts.length > 1) {
      const provinceId = idParts[0];
      const provinceName = provinceIdToCsvName[provinceId] || regionsInfo.find((r) => r.id === provinceId)?.name || "";
      return `${provinceName} ${activePiePoint.name}`;
    }
    return activePiePoint.name;
  }, [activePiePoint, regionsInfo]);

  const activePointMeta = useMemo(() => {
    if (!activePiePoint || !dynamicAllDetailOpportunityData) return null;
    
    const datum = dynamicAllDetailOpportunityData[activePiePoint.id];
    if (!datum) return null;

    return {
      growthRate: datum.growthRate || 0,
      opportunityScore: datum.opportunityScore || 0, 
    };
  }, [activePiePoint, dynamicAllDetailOpportunityData]);

  const handlePointHover = (item: ScatterDataItem | null) => {
    setHoveredPoint(item);
    onDataPointHover?.(item);
  };

  const handlePointClick = (item: ScatterDataItem) => {
    if (isCompareMode) {
      setClickedPointId(null);
      setHoveredPoint(null);
      onDataPointHover?.(null);
      onDataPointClick?.(item);
      return;
    }

    setClickedPointId((prevId) => (prevId === item.id ? null : item.id));
    onDataPointClick?.(item);
  };

  return (
    <div className="relative w-full h-full bg-white rounded-xl shadow-lg p-6 border-[0.5px] border-gray-200 flex flex-col min-h-0">
      <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center justify-between gap-2">
        <span>지역별 분석 (전국 시군구)</span>
      </h3>

      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative"
        onMouseMove={(e) => {
          const target = e.target;
          if (!(target instanceof Element)) return;
          if (target.closest("[data-scatter-hit='true']")) return;
          if (!hoveredPoint) return;
          handlePointHover(null);
        }}
        onMouseLeave={() => {
          setHoveredPoint(null);
          onDataPointHover?.(null);
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 14, right: 26, bottom: 22, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              type="number"
              dataKey="price"
              name="평균 지가"
              domain={[0, cachedMaxPrice]}
              tickFormatter={(value) => value.toLocaleString()}
              style={{ fontSize: "12px", fill: "#64748b" }}
              label={{
                value: "1m2당 평균거래금액(만원)",
                position: "insideBottom",
                offset: -12,
                fontSize: 12,
                fill: "#475569",
              }}
            />
            <YAxis
              type="number"
              dataKey="accommodation"
              name="숙박업소 수"
              domain={[0, cachedMaxAccommodation]}
              tickFormatter={(value) => value.toLocaleString()}
              style={{ fontSize: "12px", fill: "#64748b" }}
              label={{
                value: "숙박업소 수 (개)",
                angle: -90,
                position: "insideLeft",
                fontSize: 12,
                fill: "#475569",
              }}
            />
            <ZAxis
              type="number"
              dataKey="spending"
              range={[16, 576]}
              domain={[0, cachedMaxSpending]}
            />
            <Customized component={RegressionShading} />
            <Tooltip cursor={{ strokeDasharray: "3 3", stroke: "#cbd5e1" }} content={() => null} />
            <Scatter
              data={highlightedScatterData}
              isAnimationActive={false}
              shape={
                <HighlightedScatterPoint
                  cursor={onDataPointClick ? "pointer" : "default"}
                  onPointClick={handlePointClick}
                  onPointHover={handlePointHover}
                />
              }
            >
              {highlightedScatterData.map((entry) => {
                const visitorValue = entry.visitors || 0;
                const cellColor = getScatterColor(visitorValue, colorScaleMax);

                return (
                  <Cell
                    key={entry.id}
                    fill={cellColor}
                    stroke={activePiePoint?.id === entry.id ? "#000" : "#ffffff"}
                    strokeWidth={activePiePoint?.id === entry.id ? 1.5 : 0.5}
                  />
                );
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {activePiePoint && (
          <div 
            className="pointer-events-none absolute top-3 right-6 z-20 rounded-lg border border-gray-200 bg-white/95 backdrop-blur-md shadow-xl p-3 flex flex-col transition-opacity duration-150 ease-out min-w-[220px]"
          >
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <p className="text-xs font-bold text-gray-800 truncate flex-1">{displayRegionTitle}</p>
              {activePointMeta?.growthRate !== undefined && (
                <GrowthIndicator rate={activePointMeta.growthRate} />
              )}
            </div>

            {activePointMeta?.opportunityScore !== undefined && (
              <div className="mb-2 rounded-md bg-emerald-50 border border-emerald-100 px-2 py-1.5 flex items-baseline justify-between gap-2">
                <p className="text-[10px] text-emerald-700 font-semibold">입지기회도 점수</p>
                <p className="text-sm font-black text-emerald-900 tabular-nums">
                  {activePointMeta.opportunityScore.toFixed(1)}점
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5">
                <p className="text-[10px] text-slate-500 font-semibold">평균 지가(X축)</p>
                <p className="text-xs font-black text-slate-800">
                  {activePiePoint.price.toLocaleString()}만원
                </p>
              </div>
              <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5">
                <p className="text-[10px] text-slate-500 font-semibold">숙박업소 수(Y축)</p>
                <p className="text-xs font-black text-slate-800">
                  {activePiePoint.accommodation.toLocaleString()}개
                </p>
              </div>
              <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5">
                <p className="text-[10px] text-slate-500 font-semibold">숙박 소비액(크기)</p>
                <p className="text-xs font-black text-slate-800">
                  {Math.round((activePiePoint.spending || 0) / 10).toLocaleString()}만원
                </p>
              </div>
              <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5">
                <p className="text-[10px] text-slate-500 font-semibold">관광객 수(색)</p>
                <p className="text-xs font-black text-slate-800">
                  {(activePiePoint.visitors || 0).toLocaleString()}명
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}