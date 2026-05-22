import { useNavigate } from "react-router";
import { Calendar, Check, ShoppingCart } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useState, useMemo } from "react";
import { KoreaMap } from "./KoreaMap";
import { DetailRegionMap } from "./DetailRegionMap";
import {
  getDistrictVisitorTotals,
  getProvinceVisitorScaleMax,
  getProvinceVisitorTotals,
} from "../data/visitorData";
import {
  COMPANION_COLORS,
  COMPANION_KEYS,
  getCompanionByCountry,
  pickCompanionYear,
} from "../data/companionData";
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


const generateAccommodationData = (targetId: string, startDate: string, endDate: string) => {
  const types = ["관광호텔", "일반호텔", "여관업", "민박", "기타"];
  let idSeed = 0;
  for (let i = 0; i < targetId.length; i++) idSeed += targetId.charCodeAt(i);
  const dateSeed = new Date(startDate).getTime() * 0.00005 + new Date(endDate).getTime() * 0.00005;
  return types.map((type, i) => ({
    name: type,
    value: Math.floor((Math.sin(idSeed + dateSeed + i * 1.7) + 1) * 3000) + 200,
  })).sort((a, b) => b.value - a.value);
};

type CompareRegion = {
  id: string;
  name: string;
  provinceId: string;
  provinceName: string;
};

type RoomType = "싱글" | "더블" | "트윈" | "패밀리";
const ROOM_ORDER: RoomType[] = ["싱글", "더블", "트윈", "패밀리"];
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
  const [compareRegions, setCompareRegions] = useState<CompareRegion[]>([]);
  const [highlightedCountry, setHighlightedCountry] = useState<string | null>(null);
  const [sortKeys, setSortKeys] = useState<typeof COMPANION_KEYS[number][] | null>(null);
  const [hoverData, setHoverData] = useState<{
    country: string;
    pct: Record<string, number>;
    raw: Record<string, number>;
  } | null>(null);

  const MIN_YEAR = 2023;
  const TOTAL_MONTHS = 36;
  const MAX_MONTH_INDEX = TOTAL_MONTHS - 1;
  const [sliderValues, setSliderValues] = useState<[number, number]>([0, MAX_MONTH_INDEX]);

  const getMonthInfo = (monthIndex: number) => {
    const year = MIN_YEAR + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    return { year, month };
  };

  const getMonthStartDate = (monthIndex: number) => {
    const { year, month } = getMonthInfo(monthIndex);
    return `${year}-${String(month).padStart(2, "0")}-01`;
  };

  const getMonthEndDate = (monthIndex: number) => {
    const { year, month } = getMonthInfo(monthIndex);
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  };

  const getMonthLabel = (monthIndex: number) => {
    const { year, month } = getMonthInfo(monthIndex);
    return `${year}년 ${month}월`;
  };

  const getSliderPercent = (monthIndex: number) => (monthIndex / MAX_MONTH_INDEX) * 100;

  const startMonth = getMonthStartDate(sliderValues[0]).slice(0, 7);
  const endMonth = getMonthStartDate(sliderValues[1]).slice(0, 7);
  const startDate = getMonthStartDate(sliderValues[0]);
  const endDate = getMonthEndDate(sliderValues[1]);
  const startMonthLabel = getMonthLabel(sliderValues[0]);
  const endMonthLabel = getMonthLabel(sliderValues[1]);
  const visitorData = useMemo(
    () => getProvinceVisitorTotals(startMonth, endMonth),
    [startMonth, endMonth],
  );
  const subRegionVisitorData = useMemo(
    () => getDistrictVisitorTotals(currentViewLevel, startMonth, endMonth),
    [currentViewLevel, startMonth, endMonth],
  );
  const provinceVisitorScaleMax = useMemo(() => getProvinceVisitorScaleMax(), []);
  const subRegionVisitorScaleMax = useMemo(
    () => Math.max(...Object.values(subRegionVisitorData), 1),
    [subRegionVisitorData],
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
      selectedSubRegionName
    );

    const totalVisitors = selectedSubRegion 
      ? (subRegionVisitorData[selectedSubRegion] || 0) 
      : (visitorData[activeDisplayRegion] || 0);

    return rawPercentages.map(item => ({
    name: item.name,
    percentage: item.percentage, // 툴팁에 띄우기 위해 저장
    value: Math.floor((item.percentage / 100) * totalVisitors) || 0, // 실제 방문객 수 (차트 바 길이)
  }));
}, [activeDisplayRegion, currentViewLevel, selectedSubRegion, selectedSubRegionName, visitorData, subRegionVisitorData]);

  const accommodationData = useMemo(() => generateAccommodationData(selectedSubRegion || currentViewLevel, startDate, endDate), [selectedSubRegion, currentViewLevel, startDate, endDate]);
  const companionYear = useMemo(() => pickCompanionYear(endMonth), [endMonth]);
  const companionStackData = useMemo(() => getCompanionByCountry(companionYear), [companionYear]);

  const companionTop10 = useMemo(() => {
    const top10Names = chartData.map((d) => d.name);
    const set = new Set(top10Names);
    const filtered = companionStackData.filter((r) => set.has(r.country));
    if (sortKeys && sortKeys.length > 0) {
      return [...filtered].sort((a, b) => {
        const sumA = sortKeys.reduce((acc, k) => acc + a[k], 0);
        const sumB = sortKeys.reduce((acc, k) => acc + b[k], 0);
        return sumB - sumA;
      });
    }
    const indexMap = new Map(top10Names.map((n, i) => [n, i]));
    return [...filtered].sort((a, b) => (indexMap.get(a.country) ?? 99) - (indexMap.get(b.country) ?? 99));
  }, [chartData, companionStackData, sortKeys]);

  const top10Stack = useMemo(() => {
    const compMap = new Map(companionStackData.map((c) => [c.country, c]));
    return chartData.map((row) => {
      const comp = compMap.get(row.name);
      const entry: Record<string, number | string | boolean | Record<string, number>> = {
        country: row.name,
        total: row.value,
      };
      if (comp) {
        const pct: Record<string, number> = {};
        for (const key of COMPANION_KEYS) {
          entry[key] = Math.round(row.value * (comp[key] / 100));
          pct[key] = comp[key];
        }
        entry.__pct = pct;
        entry.__raw = comp.__raw;
      } else {
        for (const key of COMPANION_KEYS) entry[key] = 0;
        entry.__missing = true;
      }
      return entry;
    });
  }, [chartData, companionStackData]);

  const recommendation = useMemo(() => {
    const compTotals: Record<string, number> = {};
    for (const key of COMPANION_KEYS) compTotals[key] = 0;
    let visitorSum = 0;
    let companionSum = 0;

    for (const row of top10Stack) {
      if (row.__missing) continue;
      visitorSum += row.total as number;
      for (const key of COMPANION_KEYS) {
        compTotals[key] += row[key] as number;
        companionSum += row[key] as number;
      }
    }

    const roomTotals: Record<RoomType, number> = { 싱글: 0, 더블: 0, 트윈: 0, 패밀리: 0 };
    for (const key of COMPANION_KEYS) {
      roomTotals[ROOM_BY_COMPANION[key]] += compTotals[key];
    }
    const roomMix = ROOM_ORDER.map((name) => ({
      name,
      pct: companionSum > 0 ? Math.round((roomTotals[name] / companionSum) * 100) : 0,
    }));

    const topCountries = top10Stack
      .filter((r) => !r.__missing)
      .slice()
      .sort((a, b) => (b.total as number) - (a.total as number))
      .slice(0, 3)
      .map((r) => ({
        name: r.country as string,
        visitors: r.total as number,
        share: visitorSum > 0 ? Math.round(((r.total as number) / visitorSum) * 1000) / 10 : 0,
      }));

    return { roomMix, topCountries, visitorSum };
  }, [top10Stack]);

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
    if (compareRegions.length < 2) return;
    navigate("/compare", { state: { regions: compareRegions } });
  };

  const handlePointerDown = (index: 0 | 1) => (e: React.PointerEvent) => {
    e.preventDefault();
    const sliderEl = e.currentTarget.parentElement;
    if (!sliderEl) return;
    const onPointerMove = (moveEvent: PointerEvent) => {
      const rect = sliderEl.getBoundingClientRect();
      let percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      percent = Math.max(0, Math.min(100, percent));
      const monthIndex = Math.round((percent / 100) * MAX_MONTH_INDEX);
      setSliderValues(prev => {
        const newVals: [number, number] = [...prev] as [number, number];
        newVals[index] = monthIndex;
        if (index === 0 && newVals[0] > newVals[1]) newVals[0] = newVals[1];
        if (index === 1 && newVals[1] < newVals[0]) newVals[1] = newVals[0];
        return newVals;
      });
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

      <div className="fixed right-8 bottom-8 z-50">
        <button
          onClick={goToComparePage}
          disabled={compareRegions.length < 2}
          className="w-16 h-16 bg-white rounded-full shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-2 border-gray-200 hover:border-blue-500 disabled:opacity-45 disabled:hover:border-gray-200 disabled:cursor-not-allowed"
          aria-label="선택 지역 비교 페이지로 이동"
          title="선택 지역 비교"
        >
          <span className="w-10 h-10 rounded-full border-2 border-blue-600 text-blue-600 flex items-center justify-center text-sm font-black tracking-tight">
            VS
          </span>
        </button>
      </div>

      {/* 지도 영역 */}
      <div className="absolute left-[3%] top-1/2 -translate-y-1/2 w-[40%] h-[85%] bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
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
      <div className="absolute right-[3%] top-1/2 -translate-y-1/2 w-[50%] h-[85%] flex flex-col gap-4">

        {/* 슬라이더 영역 */}
        <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">기간 선택 (2023 - 2025)</h3>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-100">{startMonthLabel}</span>
              <span className="text-gray-400">→</span>
              <span className="bg-red-50 text-red-700 font-semibold px-2 py-0.5 rounded border border-red-100">{endMonthLabel}</span>
            </div>
          </div>
          <div className="relative w-full h-2.5 bg-gray-200 rounded-full mb-6">
            <div className="absolute h-full bg-blue-500 rounded-full pointer-events-none transition-all duration-75" style={{ left: `${getSliderPercent(sliderValues[0])}%`, width: `${getSliderPercent(sliderValues[1]) - getSliderPercent(sliderValues[0])}%` }} />
            <div className="absolute top-1/2 w-5 h-5 bg-white border-[3px] border-blue-600 rounded-full shadow cursor-grab active:cursor-grabbing z-10 touch-none" style={{ left: `calc(${getSliderPercent(sliderValues[0])}% - 10px)`, transform: 'translateY(-50%)' }} onPointerDown={handlePointerDown(0)} />
            <div className="absolute top-1/2 w-5 h-5 bg-white border-[3px] border-red-500 rounded-full shadow cursor-grab active:cursor-grabbing z-10 touch-none" style={{ left: `calc(${getSliderPercent(sliderValues[1])}% - 10px)`, transform: 'translateY(-50%)' }} onPointerDown={handlePointerDown(1)} />
            <div className="absolute left-0 top-4 text-[10px] font-semibold text-gray-400">2023</div>
            <div className="absolute left-1/2 top-4 text-[10px] font-semibold text-gray-400 -translate-x-1/2">2024</div>
            <div className="absolute right-0 top-4 text-[10px] font-semibold text-gray-400">2025</div>
          </div>
        </div>

        {/* 듀얼 차트 영역 */}
        <div className="flex-1 flex gap-4 min-h-0 relative">
          
          {/* 차트 1: Top 10 방문 국가 (방문자 수) */}
          <div className="flex-1 bg-white rounded-xl shadow-lg p-5 border border-gray-200 flex flex-col">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center justify-between">
              <span>Top 10 방문 국가</span>
              <span className="text-[10px] font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded">
                {selectedSubRegionName
                  ? selectedSubRegionName
                  : (regionsInfo.find(r => r.id === activeDisplayRegion)?.name || '상세 구역')} 기준
              </span>
            </h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, left: -4, right: 8, bottom: 4 }} barCategoryGap={3}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => v.toLocaleString()} style={{ fontSize: "10px" }} />
                  <YAxis type="category" dataKey="name" width={90} interval={0} style={{ fontSize: "11px", fontWeight: "bold" }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '11px' }}
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
                        fill={highlightedCountry && highlightedCountry !== entry.name ? "#47556933" : "#475569"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 차트 2: Top 10 국적별 동반자 유형 (스택바) OR 숙박업소 현황 */}
          <div className="flex-1 bg-white rounded-xl shadow-lg p-5 border border-gray-200 flex flex-col">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center justify-between gap-2">
              <span>{showAccommodation ? "숙박업소 현황" : "Top 10 국적별 동반자 유형"}</span>
              <div className="flex items-center gap-1.5">
                {!showAccommodation && (
                  sortChip ? (
                    <button
                      onClick={() => setSortKeys(null)}
                      className="text-[10px] font-bold hover:opacity-90 px-2 py-1 rounded flex items-center gap-1"
                      style={{ background: sortChip.color, color: sortChip.textColor }}
                      title="정렬 해제"
                    >
                      {sortChip.label} ↓ ✕
                    </button>
                  ) : (
                    <span className="text-[10px] font-medium text-gray-400 italic">
                      바/범례 클릭 → 정렬
                    </span>
                  )
                )}
                {showAccommodation && selectedSubRegionName ? (
                  <span className="text-[10px] font-normal text-orange-600 bg-orange-50 px-2 py-1 rounded">
                    {selectedSubRegionName} 기준
                  </span>
                ) : !showAccommodation ? (
                  <span className="text-[10px] font-normal text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
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
                    <XAxis type="number" style={{ fontSize: "11px" }} />
                    <YAxis type="category" dataKey="name" width={65} style={{ fontSize: "11px", fontWeight: "bold" }} />
                    <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} animationDuration={300} />
                  </BarChart>
                ) : (
                  <BarChart data={companionTop10} layout="vertical" margin={{ top: 4, left: -4, right: 8, bottom: 4 }} barCategoryGap={3}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} style={{ fontSize: "10px" }} />
                    <YAxis type="category" dataKey="country" width={67} interval={0} style={{ fontSize: "11px", fontWeight: "bold" }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      content={() => null}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "10px", paddingTop: 4, cursor: "pointer" }}
                      iconSize={8}
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
          {hoverData && !showAccommodation && (
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

        </div>

        {/* 추천 숙박 구성 카드 */}
        <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-800">추천 숙박 구성</h3>
            <span className="text-[10px] font-normal text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
              {selectedSubRegionName
                ? `${selectedSubRegionName} · ${companionYear}`
                : `${regionsInfo.find((r) => r.id === activeDisplayRegion)?.name || '전국'} · ${companionYear}`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">
                Top 3 외국인 국적
              </div>
              <ul className="space-y-1">
                {recommendation.topCountries.map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-gray-800">{c.name}</span>
                    </span>
                    <span className="text-gray-500">
                      {c.share}% <span className="text-[10px]">({c.visitors.toLocaleString()}명)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1 flex items-center justify-between">
                <span>추천 방 구성</span>
                <span className="text-[9px] font-normal text-gray-400 normal-case tracking-normal">클릭하면 정렬</span>
              </div>
              <ul className="space-y-1">
                {recommendation.roomMix.map((r) => {
                  const keys = (Object.keys(ROOM_BY_COMPANION) as (typeof COMPANION_KEYS[number])[])
                    .filter((k) => ROOM_BY_COMPANION[k] === r.name);
                  const isActive = sortKeys != null
                    && sortKeys.length === keys.length
                    && keys.every((k) => sortKeys.includes(k));
                  return (
                    <li
                      key={r.name}
                      onClick={() => setSortKeys((prev) => {
                        if (prev && prev.length === keys.length && keys.every((k) => prev.includes(k))) return null;
                        return keys;
                      })}
                      className={`flex items-center gap-2 text-xs cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors ${isActive ? "bg-gray-100" : "hover:bg-gray-50"}`}
                      role="button"
                      aria-pressed={isActive}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-sm"
                        style={{ background: ROOM_COLORS[r.name] }}
                      />
                      <span className={`font-semibold w-10 ${isActive ? "text-gray-900" : "text-gray-800"}`}>{r.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${r.pct}%`, background: ROOM_COLORS[r.name] }}
                        />
                      </div>
                      <span className="text-gray-600 w-8 text-right">{r.pct}%</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
