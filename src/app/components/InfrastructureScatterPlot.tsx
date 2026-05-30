import {
  useMemo,
  useState,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { getScatterData, type ScatterDataItem } from "../data/infrastructureData";
import { getHeatmapColor } from "../data/heatmapPalette";
import { getDistrictVisitorTotals } from "../data/visitorData";
import { getAccommodationSpending } from "../data/comparisonData";

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

const SELECTED_POINT_COLOR = "#ea580c";
const HOVERED_POINT_COLOR = "#c17aab";

type HighlightedScatterPointPayload = ScatterDataItem & {
  highlightState?: "selected" | "hovered" | null;
  spending?: number;
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
let cachedScatterData: (ScatterDataItem & { spending: number })[] = [];
let cachedColorScaleMax = 1;
let cachedMaxPrice = 1;
let cachedMaxAccommodation = 1;
let cachedMaxSpending = 1;

function initializeNationwideDataOnce(regionsInfo: { id: string; name: string }[]) {
  if (cachedVisitorData !== null) return;

  const defaultMonth = 1;
  const visitors: Record<string, number> = {};
  let scatter: (ScatterDataItem & { spending: number })[] = [];

  regionsInfo.forEach((region) => {
    const data = getDistrictVisitorTotals(region.id, defaultMonth) || getDistrictVisitorTotals(region.id) || {};
    Object.entries(data).forEach(([districtName, value]) => {
      visitors[`${region.id}-${districtName}`] = value;
    });

    const scatterRaw = getScatterData(region.id) || [];
    const mappedData = scatterRaw.map((item) => {
      const actualSpending = getAccommodationSpending(region.id, item.name) || 0;
      return {
        ...item,
        id: `${region.id}-${item.id}`,
        spending: actualSpending, 
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
  
  const baseRadius = size ? Math.sqrt(size) : 5;
  const radius = isSelected || isHovered ? baseRadius + 3 : baseRadius; 
  
  const strokeColor = isSelected ? SELECTED_POINT_COLOR : isHovered ? HOVERED_POINT_COLOR : "#ffffff";
  const strokeWidth = isSelected || isHovered ? 3 : 1.5;

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
      <circle cx={cx} cy={cy} r={radius + 10} fill="#ffffff" opacity={0} pointerEvents="all" />
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
        className={`scatter-dot-${payload?.id}`}
        cx={cx}
        cy={cy}
        r={radius} 
        fill={fill}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    </g>
  );
}

export function InfrastructureScatterPlot({
  selectedRegion,
  selectedSubRegion,
  regionsInfo,
  onDataPointClick,
  onDataPointHover,
  hoveredSubRegion,
}: InfrastructureScatterPlotProps) {
  
  initializeNationwideDataOnce(regionsInfo);

  const visitorData = cachedVisitorData!;
  const scatterData = cachedScatterData;
  const colorScaleMax = cachedColorScaleMax;

  const [hoveredPoint, setHoveredPoint] = useState<ScatterDataItem | null>(null);
  const [clickedPointId, setClickedPointId] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setClickedPointId(null);
  }, [selectedRegion, selectedSubRegion]);
  
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

  useEffect(() => {
    if (!activePiePoint) return;
    const timer = setTimeout(() => {
      const dotElement = document.getElementsByClassName(`scatter-dot-${activePiePoint.id}`)[0];
      if (dotElement instanceof SVGCircleElement) {
        const cx = Number(dotElement.getAttribute("cx"));
        const cy = Number(dotElement.getAttribute("cy"));
        if (!isNaN(cx) && !isNaN(cy)) {
          setMousePos({ x: cx + 15, y: cy + 15 });
        }
      }
    }, 16);
    return () => clearTimeout(timer);
  }, [activePiePoint]);

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
          const isHovered = isChartHovered || isMapHovered;

          const isChartClicked = clickedPointId === entry.id;
          const isMapSelected = selectedSubRegion ? entry.id === `${selectedRegion}-${selectedSubRegion}` : false;
          const isSelected = isChartClicked || isMapSelected;

          const visitors = visitorData[entry.id] || 0;
          const spending = entry.spending || 0;

          return {
            ...entry,
            visitors,
            spending,
            highlightState: isSelected ? "selected" : isHovered ? "hovered" : null,
          };
        }),
    [clickedPointId, hoveredPoint, hoveredSubRegion, scatterData, selectedRegion, selectedSubRegion, visitorData],
  );

  const displayRegionTitle = useMemo(() => {
    if (!activePiePoint) return "";
    const idParts = activePiePoint.id.split("-");
    if (idParts.length > 1) {
      const provinceId = idParts[0];
      const fullProvinceNames: Record<string, string> = {
        seoul: "서울특별시", busan: "부산광역시", daegu: "대구광역시",
        incheon: "인천광역시", gwangju: "광주광역시", daejeon: "대전광역시",
        ulsan: "울산광역시", sejong: "세종특별자치시", gyeonggi: "경기도",
        gangwon: "강원특별자치도", chungbuk: "충청북도", chungnam: "충청남도",
        jeonbuk: "전북특별자치도", jeonnam: "전라남도", gyeongbuk: "경상북도",
        gyeongnam: "경상남도", jeju: "제주특별자치도"
      };
      const provinceName = fullProvinceNames[provinceId] || regionsInfo.find((r) => r.id === provinceId)?.name || "";
      return `${provinceName} ${activePiePoint.name}`;
    }
    return activePiePoint.name;
  }, [activePiePoint, regionsInfo]);

  const handlePointHover = (item: ScatterDataItem | null) => {
    setHoveredPoint(item);
    onDataPointHover?.(item);
  };

  const handlePointClick = (item: ScatterDataItem) => {
    setClickedPointId((prevId) => (prevId === item.id ? null : item.id));
    onDataPointClick?.(item);
  };

  const autoPositionStyle = useMemo(() => {
    if (!containerRef.current) return { left: `${mousePos.x}px`, top: `${mousePos.y}px` };
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;

    let posX = mousePos.x;
    let posY = mousePos.y;

    if (posX + 270 > w) posX = mousePos.x - 30 - 270;
    if (posX < 10) posX = 10;

    if (posY + 140 > h) posY = mousePos.y - 30 - 140;
    if (posY < 10) posY = 10;

    return { left: `${posX}px`, top: `${posY}px` };
  }, [mousePos, activePiePoint]);

  return (
    <div className="relative w-full h-full bg-white rounded-xl shadow-lg p-6 border-[0.5px] border-gray-200 flex flex-col min-h-0">
      <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center justify-between gap-2">
        <span>지역별 지가 대비 숙박 인프라 현황 분석 (전국 시군구 기준)</span>
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
            {/* 💡 [수정] 원의 크기를 결정하는 Z축 역시 남은 점들의 상대 평가가 되지 않도록 절대 스케일(domain) 고정! */}
            <ZAxis 
              type="number" 
              dataKey="spending" 
              range={[16, 576]} 
              domain={[0, cachedMaxSpending]} 
            />
            <Tooltip cursor={{ strokeDasharray: "3 3", stroke: "#cbd5e1" }} content={() => null} />
            <Scatter
              data={highlightedScatterData}
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
                // 색상 역시 이미 cachedColorScaleMax를 사용해 전국 기준으로 고정되어 있습니다.
                const cellColor = getHeatmapColor(visitorValue, colorScaleMax);

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
            className="pointer-events-none absolute z-20 rounded-lg border border-gray-200 bg-white/90 backdrop-blur-sm shadow-xl p-3 flex flex-col transition-all duration-150 ease-out"
            style={autoPositionStyle}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-800 truncate">{displayRegionTitle}</p>
                <p className="text-[10px] font-semibold text-gray-400 mt-0.5">상세 종합 입지 분석</p>
              </div>
              <span className="shrink-0 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                인프라 {activePiePoint.accommodation.toLocaleString()}개
              </span>
            </div>

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
                <p className="text-[10px] text-slate-500 font-semibold">2025 숙박 소비액(Size)</p>
                <p className="text-xs font-black text-slate-800">
                  {(activePiePoint.spending || 0).toLocaleString()}천원
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}