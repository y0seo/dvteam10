import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  getAccommodationAdjustedData,
  type AccommodationAdjustedDatum,
} from "../data/accommodationAdjusted";
import { getScatterData, type ScatterDataItem } from "../data/infrastructureData";
import { HEATMAP_PALETTE } from "../data/heatmapPalette";

interface InfrastructureScatterPlotProps {
  currentViewLevel: string;
  selectedRegion: string;
  selectedSubRegion: string | null;
  selectedSubRegionName: string | null;
  hoveredSubRegion?: string | null;
  regionsInfo: { id: string; name: string }[];
  onDataPointClick?: (item: ScatterDataItem) => void;
  onDataPointHover?: (item: ScatterDataItem | null) => void;
}

const PIE_COLORS = ["#2563eb", "#10b981", "#f97316", "#9ca3af"];
const SELECTED_POINT_COLOR = "#ea580c";
const HOVERED_POINT_COLOR = "#c17aab";

type HighlightedScatterPointPayload = ScatterDataItem & {
  highlightState?: "selected" | "hovered" | null;
};

function HighlightedScatterPoint({
  cx,
  cy,
  fill,
  payload,
}: {
  cx?: number;
  cy?: number;
  fill?: string;
  payload?: HighlightedScatterPointPayload;
}) {
  if (typeof cx !== "number" || typeof cy !== "number") return null;

  const highlightState = payload?.highlightState;
  const isSelected = highlightState === "selected";
  const isHovered = highlightState === "hovered";
  const radius = isSelected || isHovered ? 7 : 5;
  const strokeColor = isSelected ? SELECTED_POINT_COLOR : isHovered ? HOVERED_POINT_COLOR : "#ffffff";
  const strokeWidth = isSelected || isHovered ? 3 : 1.5;
  const pointFill = isSelected ? "#fed7aa" : isHovered ? "#fbcfe8" : fill;

  return (
    <g>
      {(isSelected || isHovered) && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 4}
          fill="none"
          stroke="#ffffff"
          strokeWidth={5}
          opacity={0.95}
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={pointFill}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    </g>
  );
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: AccommodationAdjustedDatum; value?: number; name?: string }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const value = Number(item.value ?? item.payload?.value ?? 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-gray-800">{item.name}</p>
      <p className="text-gray-600">{value.toLocaleString()}개</p>
    </div>
  );
}

export function InfrastructureScatterPlot({
  currentViewLevel,
  selectedRegion,
  selectedSubRegion,
  selectedSubRegionName,
  hoveredSubRegion,
  regionsInfo,
  onDataPointClick,
  onDataPointHover,
}: InfrastructureScatterPlotProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ScatterDataItem | null>(null);
  const scatterData = useMemo(
    () => getScatterData(currentViewLevel),
    [currentViewLevel],
  );
  const activePiePoint = hoveredPoint;
  const highlightedScatterData = useMemo(
    () =>
      scatterData.map((entry) => {
        const isHovered =
          currentViewLevel === "national"
            ? hoveredPoint?.id === entry.id
            : hoveredSubRegion === entry.id ||
              hoveredPoint?.id === entry.id ||
              hoveredPoint?.name === entry.name;
        const isSelected =
          currentViewLevel === "national"
            ? selectedRegion === entry.id
            : selectedSubRegion === entry.id || selectedSubRegionName === entry.name;

        return {
          ...entry,
          highlightState: isHovered ? "hovered" : isSelected ? "selected" : null,
        };
      }),
    [
      currentViewLevel,
      hoveredPoint,
      hoveredSubRegion,
      scatterData,
      selectedRegion,
      selectedSubRegion,
      selectedSubRegionName,
    ],
  );

  const pieData = useMemo(
    () => getAccommodationAdjustedData(currentViewLevel, activePiePoint?.name ?? null),
    [currentViewLevel, activePiePoint],
  );

  const currentRegionLabel = useMemo(() => {
    if (currentViewLevel === "national") return "전국 시도 기준";
    const region = regionsInfo.find((item) => item.id === currentViewLevel);
    return `${region?.name ?? ""} 시군구 기준`;
  }, [currentViewLevel, regionsInfo]);

  const pieTotal = useMemo(
    () => pieData.reduce((sum, item) => sum + item.value, 0),
    [pieData],
  );

  return (
    <div className="relative w-full h-full bg-white rounded-xl shadow-lg p-6 border-[0.5px] border-gray-200 flex flex-col min-h-0">
      <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center justify-between gap-2">
        <span>지역별 지가 대비 숙박 인프라 현황 분석</span>
      </h3>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 14, right: 26, bottom: 22, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              type="number"
              dataKey="price"
              name="평균 지가"
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
              tickFormatter={(value) => value.toLocaleString()}
              style={{ fontSize: "12px", fill: "#64748b" }}
              label={{
                value: "숙박업소 수",
                angle: -90,
                position: "insideLeft",
                fontSize: 12,
                fill: "#475569",
              }}
            />
            <ZAxis range={[80, 180]} />
            <Tooltip cursor={{ strokeDasharray: "3 3", stroke: "#cbd5e1" }} content={() => null} />
            <Scatter
              data={highlightedScatterData}
              shape={<HighlightedScatterPoint />}
              cursor={onDataPointClick ? "pointer" : "default"}
              onMouseEnter={(payload: { payload?: ScatterDataItem }) => {
                if (!payload.payload) return;
                setHoveredPoint(payload.payload);
                onDataPointHover?.(payload.payload);
              }}
              onMouseLeave={() => {
                setHoveredPoint(null);
                onDataPointHover?.(null);
              }}
              onClick={(payload: { payload?: ScatterDataItem }) => {
                if (!payload.payload) return;
                onDataPointClick?.(payload.payload);
              }}
            >
              {highlightedScatterData.map((entry) => (
                <Cell key={entry.id} fill={HEATMAP_PALETTE[4]} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {activePiePoint && (
          <div className="absolute right-0 top-0 z-20 w-[270px] h-[266px] rounded-lg border border-gray-200 bg-white/90 backdrop-blur-sm shadow-xl p-3 flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-800 truncate">{activePiePoint.name}</p>
              </div>
              <span className="shrink-0 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                {pieTotal.toLocaleString()}개
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5">
                <p className="text-[10px] text-slate-500 font-semibold">평균 지가</p>
                <p className="text-xs font-black text-slate-800">
                  {activePiePoint.price.toLocaleString()}만원
                </p>
              </div>
              <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5">
                <p className="text-[10px] text-slate-500 font-semibold">숙박업소 수</p>
                <p className="text-xs font-black text-slate-800">
                  {activePiePoint.accommodation.toLocaleString()}개
                </p>
              </div>
            </div>

            {pieData.length > 0 ? (
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="57%"
                      outerRadius="91%"
                      paddingAngle={2}
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "10px", lineHeight: "14px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center text-xs text-gray-400 leading-5">
                숙박 유형 데이터가 없습니다.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
