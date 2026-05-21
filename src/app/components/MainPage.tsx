import { useNavigate } from "react-router";
import { Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useMemo } from "react";
import { KoreaMap } from "./KoreaMap";
import { DetailRegionMap } from "./DetailRegionMap";
import {
  getDistrictVisitorScaleMax,
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

export function MainPage() {
  const navigate = useNavigate();
  const [currentViewLevel, setCurrentViewLevel] = useState<string>("national");
  const [selectedRegion, setSelectedRegion] = useState<string>("seoul");
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  // 
  const [selectedSubRegion, setSelectedSubRegion] = useState<string | null>(null);
  const [selectedSubRegionName, setSelectedSubRegionName] = useState<string | null>(null);

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
    () => getDistrictVisitorScaleMax(currentViewLevel),
    [currentViewLevel],
  );
  
  const activeDisplayRegion = currentViewLevel === "national"
    ? (hoveredRegion || selectedRegion || "seoul")
    : (selectedSubRegion || currentViewLevel);

  const chartData = useMemo(() => generateCountryData(activeDisplayRegion, startDate, endDate), [activeDisplayRegion, startDate, endDate]);
  const companionData = useMemo(() => generateCompanionData(startDate, endDate), [startDate, endDate]);
  const accommodationData = useMemo(() => generateAccommodationData(selectedSubRegion || currentViewLevel, startDate, endDate), [selectedSubRegion, currentViewLevel, startDate, endDate]);

  const showAccommodation = currentViewLevel !== "national" && selectedSubRegion !== null;

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
      >
        <Calendar className="w-8 h-8 text-blue-600" />
      </button>

      {/* 지도 영역 */}
      <div className="absolute left-[3%] top-1/2 -translate-y-1/2 w-[40%] h-[85%] bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
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
            onSubRegionClick={(subId, subName) => {
              setSelectedSubRegion(subId);
              setSelectedSubRegionName(subName); // 구역 이름 저장
            }}
            selectedSubRegion={selectedSubRegion}
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
