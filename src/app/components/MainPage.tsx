import { useNavigate } from "react-router";
import { Calendar, Check, ShoppingCart } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Legend } from "recharts";
import { useState, useMemo } from "react";
import { KoreaMap } from "./KoreaMap";
import { DetailRegionMap } from "./DetailRegionMap";
import { InfrastructureScatterPlot } from "./InfrastructureScatterPlot";
import { ComparePage } from "./ComparePage";
import {
  getDistrictVisitorScaleMax,
  getDistrictVisitorTotals,
  getProvinceVisitorScaleMax,
  getProvinceVisitorTotals,
} from "../data/visitorData";
import {
  COMPANION_COLORS,
  COMPANION_KEYS,
  getCompanionAverageByCountry,
  type CompanionDatum,
} from "../data/companionData";
import { getAccommodationStatusData } from "../data/accommodationStatus";
import { getCountryPercentagesByRegion } from "../data/nationality";

const regionsInfo = [
  { id: "seoul", name: "서울" }, { id: "incheon", name: "인천" },
  { id: "gyeonggi", name: "경기" }, { id: "gangwon", name: "강원" },
  { id: "chungbuk", name: "충북" }, { id: "chungnam", name: "충남" },
  { id: "sejong", name: "세종" }, { id: "daejeon", name: "대전" },
  { id: "jeonbuk", name: "전북" }, { id: "jeonnam", name: "전남" },
  { id: "gwangju", name: "광주" }, { id: "gyeongbuk", name: "경북" },
  { id: "daegu", name: "대구" }, { id: "gyeongnam", name: "경남" },
  { id: "ulsan", name: "울산" }, { id: "busan", name: "부산" },
  { id: "jeju", name: "제주" }
];

function AccommodationYAxisTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const lines = String(payload?.value ?? "").split("\n");

  return (
    <text x={x} y={y} textAnchor="end" fill="#374151" fontSize={10} fontWeight={700}>
      {lines.map((line, index) => (
        <tspan key={line} x={x} dy={index === 0 ? (lines.length > 1 ? -3 : 4) : 12}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

type CompareRegion = {
  id: string;
  name: string;
  provinceId: string;
  provinceName: string;
};

type RoomType = "싱글" | "더블" | "트윈" | "패밀리";
const ROOM_BY_COMPANION: Record<string, RoomType> = {
  "친구": "트윈",
  "배우자/파트너": "더블",
  "자녀": "패밀리",
  "그외 가족/친지": "패밀리",
  "부모님": "패밀리",
  "직장동료": "트윈",
  "기타": "싱글",
};
const ROOM_COLORS: Record<RoomType, string> = {
  싱글: "#9ca3af",
  더블: "#10b981",
  트윈: "#3b82f6",
  패밀리: "#ec4899",
};

export function MainPage() {
  const navigate = useNavigate();
  const [currentViewLevel, setCurrentViewLevel] = useState<string>("national");
  const [selectedRegion, setSelectedRegion] = useState<string>("seoul");
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  // 
  const [selectedSubRegion, setSelectedSubRegion] = useState<string | null>(null);
  const [selectedSubRegionName, setSelectedSubRegionName] = useState<string | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isCompareLaunching, setIsCompareLaunching] = useState(false);
  const [isCompareClosing, setIsCompareClosing] = useState(false);
  const [compareRegions, setCompareRegions] = useState<CompareRegion[]>([]);
  const [highlightedCountry, setHighlightedCountry] = useState<string | null>(null);
  const [sortKeys, setSortKeys] = useState<typeof COMPANION_KEYS[number][] | null>(null);
  const [hoverData, setHoverData] = useState<{
    country: string;
    pct: Record<string, number>;
    raw: Record<string, number>;
  } | null>(null);

  const TOTAL_MONTHS = 12;
  const MAX_MONTH_INDEX = TOTAL_MONTHS - 1;
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);

  const getMonthLabel = (monthIndex: number) => {
    const month = monthIndex + 1;
    return `${month}월`;
  };
  const monthLabels = Array.from({ length: 12 }, (_, index) => `${index + 1}월`);

  const getSliderPercent = (monthIndex: number) => (monthIndex / MAX_MONTH_INDEX) * 100;

  const selectedMonth = selectedMonthIndex + 1;
  const selectedMonthLabel = getMonthLabel(selectedMonthIndex);
  const visitorData = useMemo(
    () => getProvinceVisitorTotals(selectedMonth),
    [selectedMonth],
  );
  const subRegionVisitorData = useMemo(
    () => getDistrictVisitorTotals(currentViewLevel, selectedMonth),
    [currentViewLevel, selectedMonth],
  );
  const provinceVisitorScaleMax = useMemo(() => getProvinceVisitorScaleMax(), []);
  const subRegionVisitorScaleMax = useMemo(
    () => getDistrictVisitorScaleMax(currentViewLevel),
    [currentViewLevel],
  );
  
  const activeDisplayRegion = currentViewLevel === "national"
    ? (hoveredRegion || selectedRegion || "seoul")
    : (selectedSubRegion || currentViewLevel);
  
   
  const chartData = useMemo(() => {
    const baseRegionId =
      currentViewLevel === "national"
        ? activeDisplayRegion
        : currentViewLevel;

    const rawPercentages = getCountryPercentagesByRegion(
      activeDisplayRegion,
      baseRegionId,
      selectedSubRegionName,
      selectedMonth
    );

    const totalVisitors = selectedSubRegion 
      ? (subRegionVisitorData[selectedSubRegion] || 0) 
      : (visitorData[activeDisplayRegion] || 0);

    return rawPercentages.map(item => ({
    name: item.name,
    percentage: item.percentage, // 툴팁에 띄우기 위해 저장
    value: Math.floor((item.percentage / 100) * totalVisitors) || 0, // 실제 방문객 수 (차트 바 길이)
  }));
}, [activeDisplayRegion, currentViewLevel, selectedSubRegion, selectedSubRegionName, selectedMonth, visitorData, subRegionVisitorData]);

  const companionPieData = useMemo(
    () => (highlightedCountry ? getCompanionAverageByCountry(highlightedCountry) : []),
    [highlightedCountry, selectedMonth],
  );

  const sortChip = useMemo(() => {
    if (!sortKeys || sortKeys.length === 0) return null;
    const pickTextColor = (hex: string) => {
      const h = hex.replace("#", "");
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return L > 0.6 ? "#1f2937" : "#ffffff";
    };
    let bg: string;
    let label: string;
    if (sortKeys.length === 1) {
      const k = sortKeys[0];
      label = k;
      bg = COMPANION_COLORS[k];
    } else {
      const roomTypes = new Set(sortKeys.map((k) => ROOM_BY_COMPANION[k]));
      if (roomTypes.size === 1) {
        const room = [...roomTypes][0];
        label = `${room} 그룹`;
        bg = ROOM_COLORS[room];
      } else {
        label = `${sortKeys.length}개 기준`;
        bg = "#374151";
      }
    }
    return { label, color: bg, textColor: pickTextColor(bg) };
  }, [sortKeys]);

  const stackOrder = useMemo(() => {
    if (!sortKeys || sortKeys.length === 0) return COMPANION_KEYS;
    const set = new Set(sortKeys);
    const front = COMPANION_KEYS.filter((k) => set.has(k));
    const back = COMPANION_KEYS.filter((k) => !set.has(k));
    return [...front, ...back];
  }, [sortKeys]);

  const cellFill = (key: typeof COMPANION_KEYS[number], country: string) => {
    const base = COMPANION_COLORS[key];
    if (sortKeys && !sortKeys.includes(key)) return `${base}33`;
    if (highlightedCountry && highlightedCountry !== country) return `${base}33`;
    return base;
  };

  const handleBarEnter = (payload: { country?: string } | undefined) => {
    if (payload?.country) setHighlightedCountry(payload.country);
  };
  const handleBarLeave = () => setHighlightedCountry(null);

  const handleCompanionBarEnter = (payload: Record<string, unknown> | undefined) => {
    const country = payload?.country as string | undefined;
    if (!country) return;
    setHighlightedCountry(country);
    const pct: Record<string, number> = {};
    for (const k of COMPANION_KEYS) {
      const v = payload?.[k];
      pct[k] = typeof v === "number" ? v : 0;
    }
    setHoverData({
      country,
      pct,
      raw: (payload?.__raw as Record<string, number>) ?? {},
    });
  };
  const handleCompanionBarLeave = () => {
    setHighlightedCountry(null);
    setHoverData(null);
  };

  const toggleSortKey = (key: typeof COMPANION_KEYS[number]) => {
    setSortKeys((prev) => {
      if (prev && prev.length === 1 && prev[0] === key) return null;
      return [key];
    });
  };

  const showAccommodation = currentViewLevel !== "national" && selectedSubRegion !== null;
  const compareRegionIds = useMemo(() => compareRegions.map((region) => region.id), [compareRegions]);
  const currentProvinceName = regionsInfo.find((region) => region.id === currentViewLevel)?.name || "";

  const handleSubRegionSelect = (subId: string, subName: string) => {
    setSelectedSubRegion(subId);
    setSelectedSubRegionName(subName);

    if (!isCompareMode) return;

    setCompareRegions((prev) => {
      if (prev.some((region) => region.id === subId)) {
        return prev.filter((region) => region.id !== subId);
      }

      if (prev.length >= 3) return prev;

      return [
        ...prev,
        {
          id: subId,
          name: subName,
          provinceId: currentViewLevel,
          provinceName: currentProvinceName,
        },
      ];
    });
  };

  const goToComparePage = () => {
    if (compareRegions.length < 2 || isCompareLaunching) return;
    setIsCompareClosing(false);
    setIsCompareLaunching(true);
  };

  const closeComparePage = () => {
    setIsCompareClosing(true);
    window.setTimeout(() => {
      setIsCompareLaunching(false);
      setIsCompareClosing(false);
    }, 520);
  };

  const handlePointerDown = () => (e: React.PointerEvent) => {
    e.preventDefault();
    const sliderEl = e.currentTarget.parentElement;
    if (!sliderEl) return;
    const onPointerMove = (moveEvent: PointerEvent) => {
      const rect = sliderEl.getBoundingClientRect();
      let percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      percent = Math.max(0, Math.min(100, percent));
      const monthIndex = Math.round((percent / 100) * MAX_MONTH_INDEX);
      setSelectedMonthIndex(monthIndex);
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="relative w-full h-screen bg-gray-100 flex overflow-hidden">
      
      <button
        onClick={() => navigate("/calendar")}
        className="fixed left-8 bottom-8 w-16 h-16 bg-white rounded-full shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-2 border-gray-200 hover:border-blue-500 z-50"
        aria-label="캘린더로 이동"
      >
        <Calendar className="w-8 h-8 text-blue-600" />
      </button>

      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50">
        <button
          onClick={goToComparePage}
          disabled={compareRegions.length < 2}
          className="group h-16 w-7 bg-white/95 shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-y border-l border-gray-200 hover:border-blue-500 disabled:opacity-35 disabled:hover:border-gray-200 disabled:cursor-not-allowed"
          aria-label="선택 지역 비교 페이지로 이동"
          title="선택 지역 비교"
        >
          <span className="w-0 h-0 border-y-[9px] border-y-transparent border-r-[13px] border-r-blue-600 transition-transform group-hover:-translate-x-0.5" />
        </button>
      </div>

      {isCompareLaunching && (
        <div
          className={`fixed inset-0 z-[80] bg-gray-100 shadow-2xl overflow-y-auto overscroll-contain ${
            isCompareClosing
              ? "animate-[compare-slide-dismiss_520ms_ease-out_forwards]"
              : "animate-[compare-slide-cover_520ms_ease-out_forwards]"
          }`}
        >
          <ComparePage regionsOverride={compareRegions} embedded onClose={closeComparePage} />
        </div>
      )}

      {/* 지도 영역 */}
      <div className="absolute left-[1.5%] top-1/2 -translate-y-1/2 w-[45.5%] h-[94%] bg-white rounded-2xl shadow-lg border-[0.5px] border-gray-200 overflow-hidden">
        <div className="absolute right-5 top-5 z-40 flex flex-col items-end gap-3">
          <button
            onClick={() => setIsCompareMode((prev) => !prev)}
            className={`relative w-14 h-14 rounded-full shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-2 ${
              isCompareMode
                ? "bg-emerald-500 border-emerald-400"
                : "bg-white border-gray-200 hover:border-emerald-500"
            }`}
            aria-label="비교 장바구니"
            title="비교 장바구니"
          >
            <ShoppingCart className={`w-7 h-7 ${isCompareMode ? "text-white" : "text-emerald-600"}`} />
            {compareRegions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center ring-2 ring-white">
                {compareRegions.length}
              </span>
            )}
          </button>

          {isCompareMode && (
            <div className="w-36 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-emerald-100 p-3">
              <div className="flex justify-end mb-2">
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {compareRegions.length}/3
                </span>
              </div>
              <div className="space-y-1.5">
                {compareRegions.length === 0 ? (
                  <p className="text-[11px] text-gray-500 leading-4">지도에서 선택</p>
                ) : (
                  compareRegions.map((region) => (
                    <div key={region.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{region.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{region.provinceName}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {currentViewLevel === "national" ? (
          <KoreaMap
            onRegionClick={(id) => {
              setSelectedRegion(id);
              setSelectedSubRegion(null);
              setSelectedSubRegionName(null); // 초기화
              setCurrentViewLevel(id);
            }}
            onRegionHover={setHoveredRegion}
            selectedRegion={selectedRegion}
            visitorData={visitorData}
            colorScaleMax={provinceVisitorScaleMax}
          />
        ) : (
          <DetailRegionMap 
            regionId={currentViewLevel}
            onBack={() => {
              setCurrentViewLevel("national");
              setSelectedSubRegion(null);
              setSelectedSubRegionName(null); // 초기화
            }}
            visitorData={subRegionVisitorData}
            colorScaleMax={subRegionVisitorScaleMax}
            onSubRegionClick={handleSubRegionSelect}
            selectedSubRegion={selectedSubRegion}
            selectedCompareSubRegions={compareRegionIds}
          />
        )}
      </div>

      {/* 우측 패널 */}
      <div className="absolute right-[1.5%] top-1/2 -translate-y-1/2 w-[50.5%] h-[94%] flex flex-col gap-4">

        {/* 슬라이더 영역 */}
        {!showAccommodation && (
        <>
        <div className="bg-white rounded-xl shadow-lg px-5 py-4 border-[0.5px] border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-800">월 선택</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-blue-600 text-white font-bold px-3 py-1.5 rounded-md shadow-sm">{selectedMonthLabel}</span>
              <span className="text-gray-500 font-semibold">2023-2025 평균</span>
            </div>
          </div>
          <div className="px-2">
            <div className="relative w-full h-7 mb-2">
              <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 bg-gray-200 rounded-full" />
              {monthLabels.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSelectedMonthIndex(index)}
                  onMouseEnter={() => setHoveredMonthIndex(index)}
                  onMouseLeave={() => setHoveredMonthIndex(null)}
                  className={`absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all ${
                    index === selectedMonthIndex
                      ? "bg-blue-600 border-blue-600 scale-125"
                      : index === hoveredMonthIndex
                        ? "bg-sky-500 border-sky-500 scale-110"
                      : "bg-white border-gray-300"
                  }`}
                  style={{ left: `${getSliderPercent(index)}%` }}
                  aria-label={`${label} 선택`}
                />
              ))}
              <div
                className="absolute top-1/2 w-6 h-6 -translate-y-1/2 bg-white border-[3px] border-blue-600 rounded-full shadow-md cursor-grab active:cursor-grabbing z-10 touch-none transition-[left] duration-150"
                style={{ left: `calc(${getSliderPercent(selectedMonthIndex)}% - 12px)` }}
                onPointerDown={handlePointerDown()}
              />
            </div>
            <div className="relative h-8">
              {monthLabels.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSelectedMonthIndex(index)}
                  onMouseEnter={() => setHoveredMonthIndex(index)}
                  onMouseLeave={() => setHoveredMonthIndex(null)}
                  className={`absolute top-0 w-9 h-8 -translate-x-1/2 rounded-md text-[11px] font-bold transition-colors ${
                    index === selectedMonthIndex
                      ? "bg-blue-600 text-white shadow-sm"
                      : index === hoveredMonthIndex
                        ? "bg-sky-500 text-white"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                  style={{ left: `${getSliderPercent(index)}%` }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 듀얼 차트 영역 */}
        </>
        )}
        <div className="flex-1 flex gap-4 min-h-0 relative">
          {showAccommodation ? (
            <InfrastructureScatterPlot
              currentViewLevel={currentViewLevel}
              selectedRegion={selectedRegion}
              selectedSubRegion={selectedSubRegion}
              selectedSubRegionName={selectedSubRegionName}
              regionsInfo={regionsInfo}
              onDataPointClick={(item) => {
                if (currentViewLevel === "national") {
                  setSelectedRegion(item.id);
                  setSelectedSubRegion(null);
                  setSelectedSubRegionName(null);
                  setCurrentViewLevel(item.id);
                  return;
                }

                handleSubRegionSelect(item.id, item.name);
              }}
            />
          ) : (
            <>
          
          {/* 차트 1: Top 10 방문 국가 (방문자 수) */}
          <div className="flex-1 bg-white rounded-xl shadow-lg p-6 border-[0.25px] border-gray-100 flex flex-col">
            <h3 className="text-base font-bold text-gray-800 mb-5 flex items-center justify-between">
              <span>Top 10 방문 국가</span>
              <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2.5 py-1 rounded">
                {selectedSubRegionName
                  ? selectedSubRegionName
                  : (regionsInfo.find(r => r.id === activeDisplayRegion)?.name || '상세 구역')} 기준
              </span>
            </h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 6, left: -18, right: 10, bottom: 6 }} barCategoryGap={4}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => v.toLocaleString()} style={{ fontSize: "12px" }} />
                  <YAxis type="category" dataKey="name" width={82} interval={0} style={{ fontSize: "11px", fontWeight: "bold" }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }}
                    formatter={(value: number, name: string, props: any) => {
                      const percentage = props.payload?.percentage || 0;
                      return [`${value.toLocaleString()}명 (${percentage}%)`, '방문객 수'];
                    }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 4, 4, 0]}
                    animationDuration={300}
                    onMouseEnter={(d: { name?: string }) => d?.name && setHighlightedCountry(d.name)}
                    onMouseLeave={handleBarLeave}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={highlightedCountry && highlightedCountry !== entry.name ? "#22557a33" : "#22557a"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 차트 2: Top 10 국적별 동반자 유형 (스택바) OR 숙박업소 현황 */}
          {highlightedCountry && companionPieData.length > 0 && (
            <div className="absolute right-6 bottom-[4.45rem] z-50 w-[260px] h-[250px] rounded-xl border border-gray-200 bg-white/95 shadow-2xl p-3 pointer-events-none">
              <div className="mb-1">
                <p className="text-sm font-bold text-gray-800">{highlightedCountry}</p>
                <p className="text-[11px] text-gray-500">{selectedMonth}월 · 2023/2024 평균</p>
              </div>
              <ResponsiveContainer width="100%" height="86%">
                <PieChart>
                  <Pie
                    data={companionPieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="42%"
                    outerRadius="68%"
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {companionPieData.map((entry: CompanionDatum) => (
                      <Cell key={entry.name} fill={COMPANION_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, props: { payload?: CompanionDatum }) => [
                      `${Number(value).toFixed(1)}% (${props.payload?.rawValue.toFixed(1)}%)`,
                      name,
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "10px", lineHeight: "14px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {false && (
          <>
          <div className="hidden">
            <h3 className="text-base font-bold text-gray-800 mb-5 flex items-center justify-between gap-2">
              <span>{showAccommodation ? "숙박업소 현황" : "Top 10 국적별 동반자 유형"}</span>
              <div className="flex items-center gap-1.5">
                {!showAccommodation && (
                  sortChip ? (
                    <button
                      onClick={() => setSortKeys(null)}
                      className="text-xs font-bold hover:opacity-90 px-2.5 py-1 rounded flex items-center gap-1"
                      style={{ background: sortChip.color, color: sortChip.textColor }}
                      title="정렬 해제"
                    >
                      {sortChip.label} ↓ ✕
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-gray-400 italic">
                      바/범례 클릭 → 정렬
                    </span>
                  )
                )}
                {showAccommodation && selectedSubRegionName ? (
                  <span className="text-xs font-normal text-orange-600 bg-orange-50 px-2.5 py-1 rounded">
                    {selectedSubRegionName} 기준
                  </span>
                ) : !showAccommodation ? (
                  <span className="text-xs font-normal text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">
                    {companionYear}년 기준
                  </span>
                ) : null}
              </div>
            </h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                {showAccommodation ? (
                  <BarChart data={accommodationData} layout="vertical" margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" style={{ fontSize: "12px" }} />
                    <YAxis type="category" dataKey="name" width={74} tick={<AccommodationYAxisTick />} />
                    <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} animationDuration={300} />
                  </BarChart>
                ) : (
                  <BarChart data={companionTop10} layout="vertical" margin={{ top: 6, left: -30, right: 14, bottom: 6 }} barCategoryGap={4}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} style={{ fontSize: "12px" }} />
                    <YAxis type="category" dataKey="country" width={86} interval={0} style={{ fontSize: "11px", fontWeight: "bold" }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      content={() => null}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", paddingTop: 6, cursor: "pointer" }}
                      iconSize={10}
                      onClick={(payload: { dataKey?: string }) => {
                        const key = payload?.dataKey as typeof COMPANION_KEYS[number] | undefined;
                        if (key) toggleSortKey(key);
                      }}
                      formatter={(value: string) => (
                        <span style={{ color: COMPANION_COLORS[value as typeof COMPANION_KEYS[number]] || "#374151", fontWeight: 600 }}>
                          {value}
                        </span>
                      )}
                    />
                    {stackOrder.map((key) => (
                      <Bar
                        key={key}
                        dataKey={key}
                        stackId="companion"
                        cursor="pointer"
                        onMouseEnter={handleCompanionBarEnter}
                        onMouseLeave={handleCompanionBarLeave}
                        onClick={() => toggleSortKey(key)}
                      >
                        {companionTop10.map((entry) => (
                          <Cell key={entry.country} fill={cellFill(key, entry.country)} />
                        ))}
                      </Bar>
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* 커스텀 호버 패널 — Top 10 영역 위에 겹쳐 표시 */}
          {false && hoverData && !showAccommodation && (
            <div className="absolute left-3 top-3 z-50 bg-white shadow-2xl rounded-lg p-3 border border-gray-200 pointer-events-none min-w-[220px] backdrop-blur-sm">
              <div className="text-sm font-bold text-gray-800 mb-2 pb-1.5 border-b border-gray-100">
                {hoverData.country}
              </div>
              <div className="space-y-1">
                {COMPANION_KEYS.map((key) => {
                  const pct = hoverData.pct[key] ?? 0;
                  const raw = hoverData.raw[key];
                  return (
                    <div key={key} className="flex items-center gap-2 text-[11px]">
                      <span
                        className="w-2 h-2 rounded-sm shrink-0"
                        style={{ background: COMPANION_COLORS[key] }}
                      />
                      <span className="flex-1 text-gray-700">{key}</span>
                      <span className="font-mono font-semibold text-gray-900 tabular-nums">
                        {pct.toFixed(1)}%
                      </span>
                      {raw != null && (
                        <span className="font-mono text-[10px] text-gray-400 tabular-nums">
                          ({raw}%)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-[9px] text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100">
                좌: 구성비 · 우: 응답률
              </div>
            </div>
          )}
          </>
          )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
