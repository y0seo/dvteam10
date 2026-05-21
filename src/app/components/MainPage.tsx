import { useNavigate } from "react-router";
import { Calendar, Check, ShoppingCart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useMemo } from "react";
import { KoreaMap } from "./KoreaMap";
import { DetailRegionMap } from "./DetailRegionMap";
import {
  getDistrictVisitorTotals,
  getProvinceVisitorScaleMax,
  getProvinceVisitorTotals,
} from "../data/visitorData";

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

const generateRegionVisitorData = (startDate: string, endDate: string) => {
  const seed = new Date(startDate).getTime() * 0.0001 + new Date(endDate).getTime() * 0.0001;
  const data: { [key: string]: number } = {};
  regionsInfo.forEach((region, i) => {
    data[region.id] = Math.floor((Math.sin(seed + i * 2.5) + 1) * 30000) + 5000;
  });
  return data;
};

const generateCountryData = (targetId: string, startDate: string, endDate: string) => {
  const countries = ["중국", "일본", "미국", "태국", "베트남", "필리핀", "대만", "홍콩", "스웨덴", "러시아"];
  let idSeed = 0;
  for (let i = 0; i < targetId.length; i++) idSeed += targetId.charCodeAt(i);
  const dateSeed = new Date(startDate).getTime() * 0.00005 + new Date(endDate).getTime() * 0.00005;
  const finalSeed = idSeed + dateSeed;
  return countries
    .map((country, i) => ({
      name: country,
      value: Math.floor((Math.sin(finalSeed + i * 1.5) + 1) * 8000) + 1000,
    }))
    .sort((a, b) => b.value - a.value);
};

const generateCompanionData = (startDate: string, endDate: string) => {
  const types = ["친구", "배우자", "자녀", "부모님", "혼자", "기타"];
  const dateSeed = new Date(startDate).getTime() * 0.00005 + new Date(endDate).getTime() * 0.00005;
  return types.map((type, i) => ({
    name: type,
    value: Math.floor((Math.sin(dateSeed + i * 2.1) + 1) * 5000) + 500,
  })).sort((a, b) => b.value - a.value);
};

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

  const chartData = useMemo(() => generateCountryData(activeDisplayRegion, startDate, endDate), [activeDisplayRegion, startDate, endDate]);
  const companionData = useMemo(() => generateCompanionData(startDate, endDate), [startDate, endDate]);
  const accommodationData = useMemo(() => generateAccommodationData(selectedSubRegion || currentViewLevel, startDate, endDate), [selectedSubRegion, currentViewLevel, startDate, endDate]);

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
      <div className="absolute right-[3%] top-1/2 -translate-y-1/2 w-[50%] h-[85%] flex flex-col gap-6">
        
        {/* 슬라이더 영역 */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <h3 className="text-base font-bold text-gray-800 mb-8">기간 선택 (2023 - 2025)</h3>
          <div className="relative w-full h-3 bg-gray-200 rounded-full mb-10 mt-2">
            <div className="absolute h-full bg-blue-500 rounded-full pointer-events-none transition-all duration-75" style={{ left: `${getSliderPercent(sliderValues[0])}%`, width: `${getSliderPercent(sliderValues[1]) - getSliderPercent(sliderValues[0])}%` }} />
            <div className="absolute top-1/2 w-6 h-6 bg-white border-4 border-blue-600 rounded-full shadow cursor-grab active:cursor-grabbing z-10 touch-none" style={{ left: `calc(${getSliderPercent(sliderValues[0])}% - 12px)`, transform: 'translateY(-50%)' }} onPointerDown={handlePointerDown(0)} />
            <div className="absolute top-1/2 w-6 h-6 bg-white border-4 border-red-500 rounded-full shadow cursor-grab active:cursor-grabbing z-10 touch-none" style={{ left: `calc(${getSliderPercent(sliderValues[1])}% - 12px)`, transform: 'translateY(-50%)' }} onPointerDown={handlePointerDown(1)} />
            <div className="absolute left-0 top-6 text-xs font-semibold text-gray-400">2023</div>
            <div className="absolute left-1/2 top-6 text-xs font-semibold text-gray-400 -translate-x-1/2">2024</div>
            <div className="absolute right-0 top-6 text-xs font-semibold text-gray-400">2025</div>
          </div>
          <div className="flex justify-between gap-4 mt-2">
            <div className="flex-1 bg-blue-50 p-3 rounded-lg border border-blue-100">
              <div className="text-xs text-blue-600 font-bold mb-1">시작일</div>
              <div className="text-sm font-semibold text-blue-900">{startMonthLabel}</div>
            </div>
            <div className="flex-1 bg-red-50 p-3 rounded-lg border border-red-100">
              <div className="text-xs text-red-600 font-bold mb-1">종료일</div>
              <div className="text-sm font-semibold text-red-900">{endMonthLabel}</div>
            </div>
          </div>
        </div>

        {/* 듀얼 차트 영역 */}
        <div className="flex-1 flex gap-4 min-h-[350px]">
          
          {/* 차트 1: Top 10 방문 국가 */}
          <div className="flex-1 bg-white rounded-xl shadow-lg p-5 border border-gray-200 flex flex-col">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center justify-between">
              <span>Top 10 방문 국가</span>
              {/* 선택된 상세구역 이름이 있으면 표시, 없으면 기본 광역지역 표시 */}
              <span className="text-[10px] font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded">
                {selectedSubRegionName 
                  ? selectedSubRegionName 
                  : (regionsInfo.find(r => r.id === activeDisplayRegion)?.name || '상세 구역')} 기준
              </span>
            </h3>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" style={{ fontSize: "11px" }} />
                  <YAxis type="category" dataKey="name" width={60} style={{ fontSize: "11px", fontWeight: "bold" }} />
                  <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} animationDuration={300} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 차트 2: 동반자 유형 OR 숙박업소 현황 */}
          <div className="flex-1 bg-white rounded-xl shadow-lg p-5 border border-gray-200 flex flex-col">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center justify-between">
              <span>{showAccommodation ? "숙박업소 현황" : "동반자 유형"}</span>
              {showAccommodation && selectedSubRegionName && (
                <span className="text-[10px] font-normal text-orange-600 bg-orange-50 px-2 py-1 rounded">
                  {selectedSubRegionName} 기준
                </span>
              )}
            </h3>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={showAccommodation ? accommodationData : companionData} layout="vertical" margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" style={{ fontSize: "11px" }} />
                  <YAxis type="category" dataKey="name" width={60} style={{ fontSize: "11px", fontWeight: "bold" }} />
                  <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                  <Bar dataKey="value" fill={showAccommodation ? "#f59e0b" : "#10b981"} radius={[0, 4, 4, 0]} animationDuration={300} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
