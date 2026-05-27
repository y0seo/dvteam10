import { useNavigate } from "react-router";
import { Check, ShoppingCart, X } from "lucide-react";
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
  getCompanionAverageByCountry,
  type CompanionDatum,
} from "../data/companionData";

import { getCountryPercentagesByRegion, } from "../data/nationality";
import { CONTINENT_COLORS, getCountryMeta } from "../data/countrymeta";

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

function CountryYAxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const countryName = payload?.value || "";
  const { countryCode } = getCountryMeta(countryName);
  
  return (
    <g transform={`translate(${x},${y})`}>
      {countryCode && (
        <image
          href={`https://flagcdn.com/w20/${countryCode}.png`}
          x={-80}
          y={-6}
          width="16"
          height="11.5"
          preserveAspectRatio="xMidYMid slice"
        />
      )}
      <text x={countryCode ? -58 : -80} y={3.5} textAnchor="start" fill="#374151" fontSize={11.5} fontWeight="bold">
        {countryName}
      </text>
    </g>
  );
}

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

  const [selectedSubRegion, setSelectedSubRegion] = useState<string | null>(null);
  const [selectedSubRegionName, setSelectedSubRegionName] = useState<string | null>(null);
  const [hoveredSubRegion, setHoveredSubRegion] = useState<string | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isCompareLaunching, setIsCompareLaunching] = useState(false);
  const [isCompareClosing, setIsCompareClosing] = useState(false);
  const [compareRegions, setCompareRegions] = useState<CompareRegion[]>([]);
  const [highlightedCountry, setHighlightedCountry] = useState<string | null>(null);

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
  
  const visitorData = useMemo(() => getProvinceVisitorTotals(selectedMonth), [selectedMonth]);
  const subRegionVisitorData = useMemo(() => getDistrictVisitorTotals(currentViewLevel, selectedMonth), [currentViewLevel, selectedMonth]);
  const provinceVisitorScaleMax = useMemo(() => getProvinceVisitorScaleMax(), []);
  const subRegionVisitorScaleMax = useMemo(() => getDistrictVisitorScaleMax(currentViewLevel), [currentViewLevel]);
  
  const activeDisplayRegion = currentViewLevel === "national"
    ? (hoveredRegion || selectedRegion || "seoul")
    : (selectedSubRegion || currentViewLevel);
  
  const chartData = useMemo(() => {
    const baseRegionId = currentViewLevel === "national" ? activeDisplayRegion : currentViewLevel;
    const rawPercentages = getCountryPercentagesByRegion(activeDisplayRegion, baseRegionId, selectedSubRegionName, selectedMonth);
    const totalVisitors = selectedSubRegion ? (subRegionVisitorData[selectedSubRegion] || 0) : (visitorData[activeDisplayRegion] || 0);

    return rawPercentages.map(item => ({
      name: item.name,
      percentage: item.percentage,
      value: Math.floor((item.percentage / 100) * totalVisitors) || 0,
    }));
  }, [activeDisplayRegion, currentViewLevel, selectedSubRegion, selectedSubRegionName, selectedMonth, visitorData, subRegionVisitorData]);

  const companionPieData = useMemo(
    () => (highlightedCountry ? getCompanionAverageByCountry(highlightedCountry) : []),
    [highlightedCountry, selectedMonth],
  );

  const showAccommodation = currentViewLevel !== "national";
  const compareRegionIds = useMemo(() => compareRegions.map((region) => region.id), [compareRegions]);
  const currentProvinceName = regionsInfo.find((region) => region.id === currentViewLevel)?.name || "";

  const handleSubRegionSelect = (subId: string, subName: string) => {
    const isSameSelected = selectedSubRegion === subId || selectedSubRegionName === subName;
    setSelectedSubRegion(isSameSelected ? null : subId);
    setSelectedSubRegionName(isSameSelected ? null : subName);

    if (!isCompareMode) return;

    setCompareRegions((prev) => {
      if (prev.some((region) => region.id === subId)) return prev.filter((region) => region.id !== subId);
      if (prev.length >= 3) return prev;
      return [...prev, { id: subId, name: subName, provinceId: currentViewLevel, provinceName: currentProvinceName }];
    });
  };

  const removeCompareRegion = (regionId: string) => {
    setCompareRegions((prev) => prev.filter((region) => region.id !== regionId));
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
      setSelectedMonthIndex(Math.round((percent / 100) * MAX_MONTH_INDEX));
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleBarLeave = () => setHighlightedCountry(null);

  return (
    <div className="relative w-full h-screen bg-gray-100 flex overflow-hidden">
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50">
        <button
          onClick={goToComparePage}
          disabled={compareRegions.length < 2}
          className="group h-16 w-7 bg-white/95 shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-y border-l border-gray-200 hover:border-blue-500 disabled:opacity-35 disabled:hover:border-gray-200 disabled:cursor-not-allowed"
        >
          <span className="w-0 h-0 border-y-[9px] border-y-transparent border-r-[13px] border-r-blue-600 transition-transform group-hover:-translate-x-0.5" />
        </button>
      </div>

      {isCompareLaunching && (
        <div className={`fixed inset-0 z-[80] bg-gray-100 shadow-2xl overflow-y-auto overscroll-contain ${isCompareClosing ? "animate-[compare-slide-dismiss_520ms_ease-out_forwards]" : "animate-[compare-slide-cover_520ms_ease-out_forwards]"}`}>
          <ComparePage regionsOverride={compareRegions} embedded onClose={closeComparePage} />
        </div>
      )}

      {/* 지도 영역 */}
      <div className="absolute left-[1.5%] top-1/2 -translate-y-1/2 w-[45.5%] h-[94%] bg-white rounded-2xl shadow-lg border-[0.5px] border-gray-200 overflow-hidden">
        <div className="absolute right-5 top-5 z-40 flex flex-col items-end gap-3">
          <button
            onClick={() => setIsCompareMode((prev) => !prev)}
            className={`relative w-14 h-14 rounded-full shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-2 ${isCompareMode ? "bg-emerald-500 border-emerald-400" : "bg-white border-gray-200 hover:border-emerald-500"}`}
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
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{compareRegions.length}/3</span>
              </div>
              <div className="space-y-1.5">
                {compareRegions.length === 0 ? (
                  <p className="text-[11px] text-gray-500 leading-4">지도에서 선택</p>
                ) : (
                  compareRegions.map((region) => (
                    <div key={region.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-800 truncate">{region.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{region.provinceName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeCompareRegion(region.id);
                        }}
                        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        aria-label={`${region.name} 비교 지역에서 제거`}
                        title="비교 지역에서 제거"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
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
              setSelectedSubRegionName(null); 
              setHoveredSubRegion(null);
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
              setSelectedSubRegionName(null);
              setHoveredSubRegion(null);
            }}
            visitorData={subRegionVisitorData}
            colorScaleMax={subRegionVisitorScaleMax}
            onSubRegionClick={handleSubRegionSelect}
            onSubRegionHover={setHoveredSubRegion}
            selectedSubRegion={selectedSubRegion}
            externalHoveredSubRegion={hoveredSubRegion}
            selectedCompareSubRegions={compareRegionIds}
          />
        )}
      </div>

      {/* 우측 패널 */}
      <div className="absolute right-[1.5%] top-1/2 -translate-y-1/2 w-[50.5%] h-[94%] flex flex-col gap-4">
        {!showAccommodation && (
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
                    className={`absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all ${index === selectedMonthIndex ? "bg-blue-600 border-blue-600 scale-125" : index === hoveredMonthIndex ? "bg-sky-500 border-sky-500 scale-110" : "bg-white border-gray-300"}`}
                    style={{ left: `${getSliderPercent(index)}%` }}
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
                    className={`absolute top-0 w-9 h-8 -translate-x-1/2 rounded-md text-[11px] font-bold transition-colors ${index === selectedMonthIndex ? "bg-blue-600 text-white shadow-sm" : index === hoveredMonthIndex ? "bg-sky-500 text-white" : "text-gray-500 hover:bg-gray-100"}`}
                    style={{ left: `${getSliderPercent(index)}%` }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex gap-4 min-h-0 relative">
          {showAccommodation ? (
            <InfrastructureScatterPlot
              currentViewLevel={currentViewLevel}
              selectedRegion={selectedRegion}
              selectedSubRegion={selectedSubRegion}
              selectedSubRegionName={selectedSubRegionName}
              hoveredSubRegion={hoveredSubRegion}
              regionsInfo={regionsInfo}
              onDataPointHover={(item) => setHoveredSubRegion(item?.id ?? null)}
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
              {/* 차트 1: Top 10 방문 국가 */}
              <div className="flex-1 bg-white rounded-xl shadow-lg p-6 border-[0.25px] border-gray-100 flex flex-col">
                <h3 className="text-base font-bold text-gray-800 mb-5 flex items-center justify-between">
                  <span>Top 10 방문 국가</span>
                  <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2.5 py-1 rounded">
                    {selectedSubRegionName ? selectedSubRegionName : (regionsInfo.find(r => r.id === activeDisplayRegion)?.name || '상세 구역')} 기준
                  </span>
                </h3>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 6, left: 8, right: 10, bottom: 6 }} barCategoryGap={4}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => v.toLocaleString()} style={{ fontSize: "12px" }} />
                      
                      <YAxis type="category" dataKey="name" tick={<CountryYAxisTick />} width={90} interval={0} />
                      <Tooltip
                        cursor={{ fill: 'rgb(0, 0, 0, 0.05)' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }}
                        formatter={(value: number, name: string, props: any) => [`${value.toLocaleString()}명 (${props.payload?.percentage || 0}%)`, '방문객 수']}
                      />
                      <Bar
                        dataKey="value"
                        radius={[0, 4, 4, 0]}
                        animationDuration={300}
                        onMouseEnter={(d: { name?: string }) => d?.name && setHighlightedCountry(d.name)}
                        onMouseLeave={handleBarLeave}
                      >
                        {chartData.map((entry) => {
                          const meta = getCountryMeta(entry.name);
                          const baseColor = CONTINENT_COLORS[meta.continent];
                          const fill = highlightedCountry && highlightedCountry !== entry.name ? `${baseColor}33` : baseColor;
                          return <Cell key={entry.name} fill={fill} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* 대륙 색상 범례 */}
                <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 justify-center text-[10px] text-gray-500">
                   {Object.entries(CONTINENT_COLORS).filter(([k]) => k !== "기타").map(([continent, color]) => (
                     <div key={continent} className="flex items-center gap-1">
                       <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                       <span>{continent}</span>
                     </div>
                   ))}
                </div>
              </div>

              {/* 차트 2: 파이차트 */}
              {highlightedCountry && companionPieData.length > 0 && (
                <div className="absolute right-6 bottom-[4.45rem] z-50 w-[260px] h-[250px] rounded-xl border border-gray-200 bg-white/95 shadow-2xl p-3 pointer-events-none">
                  <div className="mb-1">
                    <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                      {getCountryMeta(highlightedCountry).countryCode && (
                        <img 
                          src={`https://flagcdn.com/w20/${getCountryMeta(highlightedCountry).countryCode}.png`} 
                          alt="flag" 
                          className="w-4 h-[11px] rounded-sm object-cover shadow-[0_0_2px_rgba(0,0,0,0.2)]" 
                        />
                      )}
                      <span>{highlightedCountry}</span>
                    </p>
                    <p className="text-[11px] text-gray-500">{selectedMonth}월 · 2023/2024 평균</p>
                  </div>
                  <ResponsiveContainer width="100%" height="86%">
                    <PieChart>
                      <Pie
                        data={companionPieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="50%"
                        outerRadius="82%"
                        paddingAngle={2}
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {companionPieData.map((entry: CompanionDatum) => (
                          <Cell key={entry.name} fill={COMPANION_COLORS[entry.name]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string, props: { payload?: CompanionDatum }) => [`${Number(value).toFixed(1)}% (${props.payload?.rawValue.toFixed(1)}%)`, name]} />
                      <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{ fontSize: "10px", lineHeight: "14px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
