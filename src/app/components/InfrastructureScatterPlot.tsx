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
} from "recharts";
import { getScatterData, type ScatterDataItem } from "../data/infrastructureData";
import {
  getDistrictVisitorGrowthRates,
  getDistrictVisitorTotals,
} from "../data/visitorData";
import { getAccommodationSpending } from "../data/comparisonData";
import { getDetailOpportunityScores, zToPercentileScore } from "../data/opportunityData";

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
  // ✅ 메인 페이지에서 조작한 가중치를 받아오기 위한 Prop 추가
  weightMap?: Record<string, number>;
  onDataPointClick?: (item: ScatterDataItem) => void;
  onDataPointHover?: (item: ScatterDataItem | null) => void;
  // 박스 드래그 브러싱: 선택된 점 id 목록을 상위로 전달 (지도 cross-highlight)
  onBrushSelect?: (ids: string[]) => void;
  // 브러싱으로 선택된 점 id (상위에서 되돌려받아 산점도에서도 강조/dim)
  brushedIds?: string[];
}

// stroke: dusty amber 톤 (ATOM 스타일 — 비비드 자제)
const HOVERED_POINT_COLOR = "#ab418f"; // amber-400 — 부드러운 황금
const SELECTED_POINT_COLOR = "#d97706"; // amber-600 — 진한 황금 (차분)
const GLOW_COLOR = "#fef3c7"; // amber-100 — 매우 옅은 후광
// 장바구니: muted violet (lavender 톤)
const COMPARE_SELECTED_COLOR = "#8b5cf6"; // violet-500 (한 단계 옅게)

// 버블 색상 = 평균 지가 — 저렴할수록 청록/녹(안전), 비쌀수록 주황~빨강(경고)
const LANDPRICE_PALETTE = [
  "#1a9850", // 0 저렴 (안전)
  "#4cb05f", // 1
  "#7ac46f", // 2
  "#a6d96a", // 3
  "#d9ed8b", // 4
  "#fee08b", // 5
  "#fdbe6f", // 6
  "#f88d52", // 7
  "#e34933", // 8
  "#c5151b", // 9 비쌈 (경고)
];

// 버블 색상(신규) = 숙박업소 수 — 적을수록 블루오션(파랑), 많을수록 레드오션(빨강)
const OCEAN_PALETTE = [
  "#1d4ed8", // 0 블루오션 (경쟁 매우 적음)
  "#3b82f6", // 1
  "#60a5fa", // 2
  "#93c5fd", // 3
  "#c3d4e8", // 4 (중립 근처)
  "#e8c9c2", // 5
  "#f0a594", // 6
  "#ea7c66", // 7
  "#dc4c3a", // 8
  "#b91c1c", // 9 레드오션 (경쟁 매우 많음)
];

// 자본금 슬라이더 필터: 100평(약 330㎡) 기준 토지 매입가 환산용 상수
const BASE_AREA_M2 = 330; // 100평 ≈ 330㎡

// 분포가 극단적으로 우측 꼬리(수도권 쏠림)라 선형/sqrt 매핑은 다수를 한 구석에
// 뭉치게 만든다. → 위치·크기·색을 모두 "현재 화면 기준 백분위"로 변환해 균등 분산시킨다.
function percentilesOf(values: number[]): (v: number) => number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return (v: number) => {
    if (n === 0) return 50;
    let below = 0;
    let equal = 0;
    for (let i = 0; i < n; i++) {
      if (sorted[i] < v) below++;
      else if (sorted[i] === v) equal++;
    }
    return ((below + 0.5 * equal) / n) * 100;
  };
}

// 로그축 도메인 안전화: 0/음수 방지, min===max(단일 구역)일 때 양쪽으로 벌려 NaN 방지
function safeLogDomain(min: number, max: number): [number, number] {
  const lo = Math.max(1, min);
  const hi = Math.max(lo, max);
  if (lo === hi) return [Math.max(1, lo / 2), hi * 2];
  return [lo, hi];
}

// 백분위(0~100) → 팔레트 색. 분위수 기반이라 녹→빨강이 고르게 분포한다.
function getLandPriceColorByPct(pct: number): string {
  const idx = Math.min(
    Math.floor((pct / 100) * LANDPRICE_PALETTE.length),
    LANDPRICE_PALETTE.length - 1,
  );
  return LANDPRICE_PALETTE[Math.max(0, idx)];
}

// 숙박업소 수 백분위(0~100) → 블루↔레드오션 색. 낮을수록 파랑(블루오션), 높을수록 빨강(레드오션).
function getOceanColorByPct(pct: number): string {
  const idx = Math.min(
    Math.floor((pct / 100) * OCEAN_PALETTE.length),
    OCEAN_PALETTE.length - 1,
  );
  return OCEAN_PALETTE[Math.max(0, idx)];
}

// 축 눈금 압축 표기 (12000 → 1.2만)
function formatCompactTick(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString()}만`;
  if (value >= 1000) return `${Math.round(value / 1000)}천`;
  return value.toLocaleString();
}

type ExtendedScatterDataItem = ScatterDataItem & {
  spending: number;
  visitors: number;
  safety: number;
};

// 현재 화면 기준 백분위·로그용 파생 필드까지 포함한 점 데이터
type RankedScatterDataItem = ExtendedScatterDataItem & {
  xPct: number; // 소비액 백분위
  yPct: number; // 관광객 백분위
  pricePct: number; // 지가 백분위 (보조)
  safetyPct: number; // (구) 경쟁안전도 — 크기 제거로 미사용
  accommodationPct: number; // 숙박업소수 백분위 (색: 블루↔레드오션)
  landCostEok: number; // 100평 기준 토지비 환산(억) — 자본금 슬라이더 필터
  spendingLog: number; // 로그축용 (0 → 1로 바닥 처리)
  visitorsLog: number;
};

type HighlightedScatterPointPayload = RankedScatterDataItem & {
  highlightState?: "selected" | "hovered" | null;
  isCompareSelected?: boolean;
  isBrushed?: boolean;
  isDimmed?: boolean;
  isLocked?: boolean; // 자본금 초과 → 잠금(흐림·선택 불가)
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
let cachedMaxPrice = 1;
let cachedMaxAccommodation = 1;
let cachedMaxSpending = 1;
let cachedMaxVisitors = 1;
let cachedMaxSafety = 1;

// 성장률 ▲(빨강 상승) / ▼(파랑 하락) 아이콘
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
    const mappedData = scatterRaw.map((item) => ({
      ...item,
      id: `${region.id}-${item.id}`,
      spending: getAccommodationSpending(region.id, item.name) || 0,
      visitors: visitors[`${region.id}-${item.name}`] || 0,
      safety: 0,
    }));
    scatter = [...scatter, ...mappedData];
  });

  cachedMaxPrice = Math.ceil(Math.max(...scatter.map((s) => s.price), 1) * 1.05);
  cachedMaxAccommodation = Math.ceil(Math.max(...scatter.map((s) => s.accommodation), 1) * 1.05);
  cachedMaxSpending = Math.max(...scatter.map((s) => s.spending), 1);
  cachedMaxVisitors = Math.max(...scatter.map((s) => s.visitors), 1);

  // 버블 크기 = 경쟁 안전도: 최댓값 감산법 (전국 최댓값 − 현재 값 + 보정상수).
  // 경쟁 숙박업소가 적은 블루오션일수록 버블이 커지도록 역산한다.
  const maxAccommodationRaw = Math.max(...scatter.map((s) => s.accommodation), 0);
  const safetyConstant = Math.max(1, Math.round(maxAccommodationRaw * 0.08));
  scatter.forEach((s) => {
    s.safety = maxAccommodationRaw - s.accommodation + safetyConstant;
  });
  cachedMaxSafety = maxAccommodationRaw + safetyConstant;

  cachedVisitorData = visitors;
  cachedScatterData = scatter;
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
  const isBrushed = Boolean(payload?.isBrushed);
  const isDimmed = Boolean(payload?.isDimmed);
  const isLocked = Boolean(payload?.isLocked);

  const baseRadius = size ? Math.sqrt(size) : 6;
  const radius = isSelected || isHovered ? baseRadius + 3 : isBrushed ? baseRadius + 2 : baseRadius;

  // 우선순위: selected > hovered > brushed(주황, 지도와 동일) > default
  const strokeColor = isSelected
    ? SELECTED_POINT_COLOR
    : isHovered
      ? HOVERED_POINT_COLOR
      : isBrushed
        ? "#f97316"
        : "#b3b3b33a";
  const strokeWidth = isSelected || isHovered || isBrushed ? 3 : 1.5;

  return (
    <g
      cursor={isLocked ? "default" : cursor}
      data-scatter-hit={isLocked ? undefined : "true"}
      pointerEvents={isLocked ? "none" : "all"}
      onPointerDown={(e) => {
        if (isLocked) return;
        e.preventDefault();
        e.stopPropagation();
        if (payload) onPointClick?.(payload);
      }}
      onMouseEnter={() => {
        if (isLocked) return;
        if (payload) onPointHover?.(payload);
      }}
      onMouseLeave={() => {
        if (isLocked) return;
        onPointHover?.(null);
      }}
    >
      <circle cx={cx} cy={cy} r={radius + 10} fill="#ffffff" opacity={0} pointerEvents={isLocked ? "none" : "all"} />
      {(isSelected || isHovered) && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 4}
          fill="none"
          stroke={GLOW_COLOR}
          strokeWidth={5}
          opacity={0.3}
        />
      )}
      <circle
        className={`scatter-dot-${payload?.id}`}
        data-locked={isLocked ? "true" : undefined}
        cx={cx}
        cy={cy}
        r={radius}
        fill={isLocked ? "#cbd5e1" : fill}
        fillOpacity={isLocked ? 1 : isDimmed ? 1 : 0.8}
        stroke={isLocked ? "none" : strokeColor}
        strokeWidth={isLocked ? 0 : strokeWidth}
        opacity={isLocked ? 0.12 : isDimmed ? 0.18 : 1}
      />
      {payload?.isCompareSelected && (
        <g pointerEvents="none">
          <circle
            cx={cx}
            cy={cy}
            r={Math.max(radius + 6, 12)}
            fill={COMPARE_SELECTED_COLOR}
            stroke="#ffffff"
            strokeWidth={2}
          />
          <text
            x={cx}
            y={cy + 0.7}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.max(radius + 5, 13)}
            fontWeight={900}
            fill="#ffffff"
          >
            ✓
          </text>
        </g>
      )}
    </g>
  );
}

export function InfrastructureScatterPlot({
  selectedRegion,
  selectedSubRegion,
  regionsInfo,
  selectedComparePointIds = [],
  isCompareMode = false,
  weightMap, // 메인 페이지로부터 가중치를 받아옴
  onDataPointClick,
  onDataPointHover,
  onBrushSelect,
  brushedIds = [],
  hoveredSubRegion,
  hoveredProvinceId,
}: InfrastructureScatterPlotProps) {
  
  initializeNationwideDataOnce(regionsInfo);

  const scatterData = cachedScatterData;

  const [hoveredPoint, setHoveredPoint] = useState<ScatterDataItem | null>(null);
  const [clickedPointId, setClickedPointId] = useState<string | null>(null);
  // 축 변환 모드: 백분위 순위 / 로그 / 선형(sqrt)
  const [axisMode, setAxisMode] = useState<"percentile" | "log" | "sqrt">("percentile");
  // 자본금(억) 슬라이더 — null이면 "전체"(필터 없음, 화면 최대치 추적)
  const [capitalEok, setCapitalEok] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // 박스 드래그 브러싱 상태
  const [isBrushing, setIsBrushing] = useState(false);
  const [brushRect, setBrushRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const brushStartRef = useRef<{ x: number; y: number } | null>(null);
  const brushRectRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  useEffect(() => {
    setClickedPointId(null);
    setCapitalEok(null); // 화면(전국↔시도) 전환 시 자본금 필터 초기화
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

  // 현재 화면(전국 또는 특정 시·도)에 보이는 점들만 추려 백분위·로그 파생값을 계산.
  // 백분위는 "현재 화면 기준"이라 어떤 화면에서도 균등 분산된다.
  const rankedViewData = useMemo<RankedScatterDataItem[]>(() => {
    const view = scatterData.filter((entry) => {
      if (!selectedRegion || selectedRegion === "national") return true;
      return entry.id.startsWith(`${selectedRegion}-`);
    });
    const xRank = percentilesOf(view.map((d) => d.spending));
    const yRank = percentilesOf(view.map((d) => d.visitors));
    const priceRank = percentilesOf(view.map((d) => d.price));
    const safetyRank = percentilesOf(view.map((d) => d.safety));
    const accRank = percentilesOf(view.map((d) => d.accommodation));
    return view.map((d) => ({
      ...d,
      xPct: Math.round(xRank(d.spending)),
      yPct: Math.round(yRank(d.visitors)),
      pricePct: priceRank(d.price),
      safetyPct: Math.round(safetyRank(d.safety)),
      accommodationPct: Math.round(accRank(d.accommodation)),
      landCostEok: (d.price * BASE_AREA_M2) / 10000,
      spendingLog: Math.max(d.spending, 1),
      visitorsLog: Math.max(d.visitors, 1),
    }));
  }, [scatterData, selectedRegion]);

  // 자본금 슬라이더 범위(억): 현재 화면 점들의 100평 토지비 환산 min/max
  const capitalBounds = useMemo(() => {
    if (rankedViewData.length === 0) return { min: 1, max: 100 };
    const costs = rankedViewData.map((d) => d.landCostEok);
    const min = Math.max(1, Math.floor(Math.min(...costs)));
    const max = Math.max(min + 1, Math.ceil(Math.max(...costs)));
    return { min, max };
  }, [rankedViewData]);

  // 실효 자본금: 미설정(null)이면 화면 최대치 → 아무것도 잠그지 않음
  const effectiveCapital = capitalEok ?? capitalBounds.max;
  const affordableCount = useMemo(
    () => rankedViewData.filter((d) => d.landCostEok <= effectiveCapital + 1e-9).length,
    [rankedViewData, effectiveCapital],
  );

  // 로그축 도메인 (현재 화면 min/max, 0은 1로 바닥 처리)
  const axisBounds = useMemo(() => {
    if (rankedViewData.length === 0) {
      return { xMin: 1, xMax: cachedMaxSpending, yMin: 1, yMax: cachedMaxVisitors };
    }
    const xs = rankedViewData.map((d) => d.spendingLog);
    const ys = rankedViewData.map((d) => d.visitorsLog);
    return {
      xMin: Math.min(...xs),
      xMax: Math.max(...xs),
      yMin: Math.min(...ys),
      yMax: Math.max(...ys),
    };
  }, [rankedViewData]);

  const highlightedScatterData = useMemo(
    () =>
      rankedViewData
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
          const isCompareSelected = selectedComparePointIds.includes(entry.id);
          const isBrushed = brushedIds.includes(entry.id);
          const hasBrush = brushedIds.length > 0;

          const isProtected = isHovered || isSelected || isCompareSelected || isBrushed;
          // 자본금 초과 → 잠금(흐림·선택 불가). 단 이미 장바구니에 담긴 점은 유지.
          const isLocked = entry.landCostEok > effectiveCapital + 1e-9 && !isCompareSelected;

          return {
            ...entry,
            highlightState: (isSelected ? "selected" : isHovered ? "hovered" : null) as
              | "selected"
              | "hovered"
              | null,
            isCompareSelected,
            isBrushed,
            isLocked,
            // hover 중이거나 브러싱 선택이 있으면, 보호 대상이 아닌 점은 흐리게
            isDimmed: (hasHoveredPoint || hasBrush) && !isProtected && !isLocked,
          };
        })
        .sort((a, b) => {
          const rank = (item: {
            isCompareSelected: boolean;
            isBrushed: boolean;
            isLocked?: boolean;
            highlightState: "selected" | "hovered" | null;
          }) => {
            if (item.isLocked) return -1;
            if (item.isCompareSelected) return 4;
            if (item.highlightState === "selected") return 3;
            if (item.highlightState === "hovered") return 2;
            if (item.isBrushed) return 1;
            return 0;
          };
          return rank(a) - rank(b);
        }),
    [
      rankedViewData,
      clickedPointId,
      hoveredPoint,
      hoveredSubRegion,
      hoveredProvinceId,
      selectedComparePointIds,
      selectedRegion,
      selectedSubRegion,
      brushedIds,
      effectiveCapital,
    ],
  );

  // 축 모드별 설정 (백분위 순위 / 로그 / 선형 sqrt)
  const xConf = useMemo(() => {
    if (axisMode === "percentile") {
      return {
        dataKey: "xPct",
        scale: "linear" as const,
        domain: [0, 100] as [number, number],
        ticks: [0, 25, 50, 75, 100] as number[] | undefined,
        tickFormatter: (v: number) => `${v}`,
        label: "숙박 소비액 순위(%) →",
      };
    }
    if (axisMode === "log") {
      return {
        dataKey: "spendingLog",
        scale: "log" as const,
        domain: safeLogDomain(axisBounds.xMin, axisBounds.xMax),
        ticks: undefined as number[] | undefined,
        tickFormatter: formatCompactTick,
        label: "숙박 소비액 (시장성·로그) →",
      };
    }
    return {
      dataKey: "spending",
      scale: "sqrt" as const,
      domain: [0, cachedMaxSpending] as [number, number],
      ticks: undefined as number[] | undefined,
      tickFormatter: formatCompactTick,
      label: "숙박 소비액 (시장성) →",
    };
  }, [axisMode, axisBounds]);

  const yConf = useMemo(() => {
    if (axisMode === "percentile") {
      return {
        dataKey: "yPct",
        scale: "linear" as const,
        domain: [0, 100] as [number, number],
        ticks: [0, 25, 50, 75, 100] as number[] | undefined,
        tickFormatter: (v: number) => `${v}`,
        label: "관광객 수 순위(%) ↑",
      };
    }
    if (axisMode === "log") {
      return {
        dataKey: "visitorsLog",
        scale: "log" as const,
        domain: safeLogDomain(axisBounds.yMin, axisBounds.yMax),
        ticks: undefined as number[] | undefined,
        tickFormatter: formatCompactTick,
        label: "관광객 수 (수요·로그) ↑",
      };
    }
    return {
      dataKey: "visitors",
      scale: "sqrt" as const,
      domain: [0, cachedMaxVisitors] as [number, number],
      ticks: undefined as number[] | undefined,
      tickFormatter: formatCompactTick,
      label: "관광객 수 (수요) ↑",
    };
  }, [axisMode, axisBounds]);

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

  // ✅ 툴팁용 메타 데이터 실시간 연산 로직
  const activePointMeta = useMemo(() => {
    if (!activePiePoint) return null;
    const idParts = activePiePoint.id.split("-");
    const provinceId = idParts[0];
    const districtName = activePiePoint.name;

    const growthRates = getDistrictVisitorGrowthRates(provinceId);
    const growthRate = growthRates[districtName] || 0;

    const opportunityScores = getDetailOpportunityScores(provinceId);
    const datum = opportunityScores[districtName];

    let finalOpportunityScore = datum?.opportunityScore || 0;

    // 만약 MainPage에서 weightMap을 넘겨주었다면 산점도 툴팁에서도 실시간 동적 계산
    if (datum && weightMap && Object.keys(weightMap).length > 0) {
      const growthZ = growthRate / 0.15;
      const visitorZ = datum.nationalZ?.visitor ?? 0;
      const spendingZ = datum.nationalZ?.spending ?? 0;
      const priceZ = datum.nationalZ?.price ?? 0;
      const compZ = datum.nationalZ?.accommodation ?? 0;

      const dynamicWeightSumSq = Object.values(weightMap).reduce((sum, w) => sum + w * w, 0);
      const adjustmentFactor = Math.sqrt(dynamicWeightSumSq) || 1;

      const rawFinalZ =
        (weightMap["growth"] * growthZ) +
        (weightMap["visitor"] * visitorZ) +
        (weightMap["spending"] * spendingZ) -
        (weightMap["price"] * priceZ) -
        (weightMap["competition"] * compZ);

      const finalZ = rawFinalZ / adjustmentFactor;
      finalOpportunityScore = zToPercentileScore(finalZ);
    }

    return {
      growthRate,
      opportunityScore: finalOpportunityScore,
    };
  }, [activePiePoint, weightMap]);

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

  // 빈 공간에서만 브러싱 시작 (점 위 클릭은 기존 클릭 핸들러가 처리)
  const handleBrushStart = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!onBrushSelect) return;
    const target = e.target;
    if (target instanceof Element && target.closest("[data-scatter-hit='true']")) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    brushStartRef.current = { x, y };
    brushRectRef.current = { x0: x, y0: y, x1: x, y1: y };
    setBrushRect({ x0: x, y0: y, x1: x, y1: y });
    setIsBrushing(true);
  };

  useEffect(() => {
    if (!isBrushing) return;

    const handleMove = (e: globalThis.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const start = brushStartRef.current;
      if (!rect || !start) return;
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
      const next = { x0: start.x, y0: start.y, x1: x, y1: y };
      brushRectRef.current = next;
      setBrushRect(next);
    };

    const handleUp = () => {
      const rect = brushRectRef.current;
      brushStartRef.current = null;
      brushRectRef.current = null;
      setBrushRect(null);
      setIsBrushing(false);

      if (!rect) return;
      const minX = Math.min(rect.x0, rect.x1);
      const maxX = Math.max(rect.x0, rect.x1);
      const minY = Math.min(rect.y0, rect.y1);
      const maxY = Math.max(rect.y0, rect.y1);

      // 미세 드래그(=클릭)는 선택 해제로 처리
      if (maxX - minX < 5 && maxY - minY < 5) {
        onBrushSelect?.([]);
        return;
      }

      const container = containerRef.current;
      if (!container) return;
      const circles = container.querySelectorAll('circle[class*="scatter-dot-"]');
      const ids = new Set<string>();
      circles.forEach((circle) => {
        if (circle.getAttribute("data-locked") === "true") return; // 자본금 초과 점은 브러싱 제외
        const cx = Number(circle.getAttribute("cx"));
        const cy = Number(circle.getAttribute("cy"));
        if (Number.isNaN(cx) || Number.isNaN(cy)) return;
        if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
          const match = (circle.getAttribute("class") || "").match(/scatter-dot-(\S+)/);
          if (match) ids.add(match[1]);
        }
      });
      onBrushSelect?.([...ids]);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isBrushing, onBrushSelect]);

  return (
    <div className="relative w-full h-full bg-white rounded-xl shadow-lg p-6 border-[0.5px] border-gray-200 flex flex-col min-h-0">
      <div className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-800">외국인 숙박 입지 기회 산점도</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              가로=숙박 소비액(시장성) · 세로=관광객 수(수요) · 색=숙박업소수(블루↔레드오션) · 우상향+파랑일수록 유망
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
              {(
                [
                  ["percentile", "백분위"],
                  ["log", "로그"],
                  ["sqrt", "선형"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAxisMode(mode)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                    axisMode === mode
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                  title="X·Y 축 변환 방식"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-blue-600">블루오션</span>
              <span
                className="h-2 w-16 rounded-full"
                style={{ background: "linear-gradient(to right, #1d4ed8, #c3d4e8, #b91c1c)" }}
              />
              <span className="text-[10px] font-semibold text-red-600">레드오션</span>
            </div>
          </div>
        </div>

        {/* 자본금 슬라이더 — 100평 토지비 환산이 자본금을 넘는 지역은 잠금 */}
        <div className="mt-2.5 flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
          <span className="text-[11px] font-bold text-amber-700 whitespace-nowrap shrink-0">💰 자본금</span>
          <input
            type="range"
            min={capitalBounds.min}
            max={capitalBounds.max}
            step={1}
            value={effectiveCapital}
            onChange={(e) => setCapitalEok(Number(e.target.value))}
            className="flex-1 accent-amber-500 cursor-pointer"
            title="100평(약 330㎡) 토지 매입가 환산 기준"
          />
          <span
            className="text-xs font-black text-amber-800 tabular-nums whitespace-nowrap shrink-0 text-right"
            style={{ minWidth: 96 }}
          >
            {effectiveCapital >= capitalBounds.max ? "전체" : `${effectiveCapital.toLocaleString()}억 이하`}
          </span>
        </div>
        <p className="text-[10px] text-gray-400 mt-1 ml-1">
          100평(약 330㎡) 토지 매입가 환산 기준 · 예산 내{" "}
          <b className="text-amber-700">{affordableCount}개</b> 지역 선택 가능
        </p>
      </div>

      <div
        ref={containerRef}
        className={`flex-1 min-h-0 relative ${onBrushSelect ? "cursor-crosshair" : ""} ${isBrushing ? "select-none" : ""}`}
        onMouseDown={handleBrushStart}
        onMouseMove={(e) => {
          if (isBrushing) return;
          const target = e.target;
          if (!(target instanceof Element)) return;
          if (target.closest("[data-scatter-hit='true']")) return;
          if (!hoveredPoint) return;
          handlePointHover(null);
        }}
        onMouseLeave={() => {
          if (isBrushing) return;
          setHoveredPoint(null);
          onDataPointHover?.(null);
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 14, right: 26, bottom: 22, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              type="number"
              dataKey={xConf.dataKey}
              name="숙박 소비액"
              scale={xConf.scale}
              domain={xConf.domain}
              allowDataOverflow
              {...(xConf.ticks ? { ticks: xConf.ticks } : {})}
              tickFormatter={xConf.tickFormatter}
              style={{ fontSize: "12px", fill: "#64748b" }}
              label={{
                value: xConf.label,
                position: "insideBottom",
                offset: -12,
                fontSize: 12,
                fill: "#475569",
              }}
            />
            <YAxis
              type="number"
              dataKey={yConf.dataKey}
              name="관광객 수"
              scale={yConf.scale}
              domain={yConf.domain}
              allowDataOverflow
              {...(yConf.ticks ? { ticks: yConf.ticks } : {})}
              tickFormatter={yConf.tickFormatter}
              style={{ fontSize: "12px", fill: "#64748b" }}
              label={{
                value: yConf.label,
                angle: -90,
                position: "insideLeft",
                fontSize: 12,
                fill: "#475569",
              }}
            />
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
                const cellColor = getOceanColorByPct(entry.accommodationPct);

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

        {brushRect && (
          <div
            className="pointer-events-none absolute z-30 rounded-sm border-2 border-[#f97316] bg-[#f97316]/10"
            style={{
              left: Math.min(brushRect.x0, brushRect.x1),
              top: Math.min(brushRect.y0, brushRect.y1),
              width: Math.abs(brushRect.x1 - brushRect.x0),
              height: Math.abs(brushRect.y1 - brushRect.y0),
            }}
          />
        )}

        {activePiePoint && (
          <div 
            className="pointer-events-none absolute z-20 rounded-lg border border-gray-200 bg-white/90 backdrop-blur-sm shadow-xl p-3 flex flex-col transition-all duration-150 ease-out"
            style={autoPositionStyle}
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
                <p className="text-[10px] text-slate-500 font-semibold">숙박 소비액(X·시장성)</p>
                <p className="text-xs font-black text-slate-800">
                  {Math.round((activePiePoint.spending || 0) / 10).toLocaleString()}만원
                </p>
              </div>
              <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5">
                <p className="text-[10px] text-slate-500 font-semibold">관광객 수(Y·수요)</p>
                <p className="text-xs font-black text-slate-800">
                  {(activePiePoint.visitors || 0).toLocaleString()}명
                </p>
              </div>
              <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5">
                <p className="text-[10px] text-slate-500 font-semibold">숙박업소 수 (색·경쟁)</p>
                <p className="text-xs font-black text-slate-800">
                  {activePiePoint.accommodation.toLocaleString()}개
                </p>
              </div>
              <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5">
                <p className="text-[10px] text-slate-500 font-semibold">지가 (자본금 기준)</p>
                <p className="text-xs font-black text-slate-800">
                  {activePiePoint.price.toLocaleString()}만원/㎡
                </p>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                  100평 ≈ {Math.round((activePiePoint.price * BASE_AREA_M2) / 10000).toLocaleString()}억
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}