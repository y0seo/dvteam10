import { Check, ShoppingCart, X } from "lucide-react";
import { useMemo, useState } from "react";
import { KoreaMap } from "./KoreaMap";
import { DetailRegionMap } from "./DetailRegionMap";
import { InfrastructureScatterPlot } from "./InfrastructureScatterPlot";
import { ComparePage } from "./ComparePage";
import { MainSelectionRadarChart } from "./MainSelectionRadarChart";
import { getDetailOpportunityScores, getMainOpportunityScores } from "../data/opportunityData";

const regionsInfo = [
  { id: "seoul", name: "서울" },
  { id: "incheon", name: "인천" },
  { id: "gyeonggi", name: "경기" },
  { id: "gangwon", name: "강원" },
  { id: "chungbuk", name: "충북" },
  { id: "chungnam", name: "충남" },
  { id: "sejong", name: "세종" },
  { id: "daejeon", name: "대전" },
  { id: "jeonbuk", name: "전북" },
  { id: "jeonnam", name: "전남" },
  { id: "gwangju", name: "광주" },
  { id: "gyeongbuk", name: "경북" },
  { id: "daegu", name: "대구" },
  { id: "gyeongnam", name: "경남" },
  { id: "ulsan", name: "울산" },
  { id: "busan", name: "부산" },
  { id: "jeju", name: "제주" },
];

type CompareRegion = {
  id: string;
  name: string;
  provinceId: string;
  provinceName: string;
};

function splitScatterPointId(id: string) {
  const [provinceId, ...subRegionParts] = id.split("-");
  return {
    provinceId,
    subRegionId: subRegionParts.length > 0 ? subRegionParts.join("-") : null,
  };
}

export function MainPage() {
  const [currentViewLevel, setCurrentViewLevel] = useState<string>("national");
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [selectedSubRegion, setSelectedSubRegion] = useState<string | null>(null);
  const [selectedSubRegionName, setSelectedSubRegionName] = useState<string | null>(null);
  const [hoveredSubRegion, setHoveredSubRegion] = useState<string | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isCompareLaunching, setIsCompareLaunching] = useState(false);
  const [isCompareClosing, setIsCompareClosing] = useState(false);
  const [compareRegions, setCompareRegions] = useState<CompareRegion[]>([]);

  const mainOpportunityData = useMemo(() => getMainOpportunityScores(), []);
  const detailOpportunityData = useMemo(
    () => getDetailOpportunityScores(currentViewLevel),
    [currentViewLevel],
  );
  const compareRegionIds = useMemo(() => compareRegions.map((region) => region.id), [compareRegions]);
  const compareScatterPointIds = useMemo(
    () => compareRegions.map((region) => `${region.provinceId}-${region.id}`),
    [compareRegions],
  );
  const currentProvinceName = regionsInfo.find((region) => region.id === currentViewLevel)?.name || "";

  const toggleCompareRegion = (subId: string, subName: string) => {
    setCompareRegions((prev) => {
      if (prev.some((region) => region.id === subId)) {
        return prev.filter((region) => region.id !== subId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, { id: subId, name: subName, provinceId: currentViewLevel, provinceName: currentProvinceName }];
    });
  };

  const handleSubRegionSelect = (subId: string, subName: string) => {
    const isSameSelected = selectedSubRegion === subId || selectedSubRegionName === subName;
    setSelectedSubRegion(isSameSelected ? null : subId);
    setSelectedSubRegionName(isSameSelected ? null : subName);

    if (!isCompareMode) return;
    toggleCompareRegion(subId, subName);
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

  const resetSubRegionState = () => {
    setSelectedSubRegion(null);
    setSelectedSubRegionName(null);
    setHoveredSubRegion(null);
  };

  const handleScatterHover = (item: { id: string } | null) => {
    if (currentViewLevel === "national") {
      // 전국 뷰: 산점도 점 hover → 지도의 해당 광역 강조
      if (item) {
        const { provinceId } = splitScatterPointId(item.id);
        setHoveredRegion(provinceId);
      } else {
        setHoveredRegion(null);
      }
      setHoveredSubRegion(null);
      return;
    }

    const { provinceId, subRegionId } = item ? splitScatterPointId(item.id) : { provinceId: "", subRegionId: null };
    setHoveredSubRegion(provinceId === currentViewLevel ? subRegionId : null);
  };

  const handleScatterClick = (item: { id: string; name: string }) => {
    const { provinceId, subRegionId } = splitScatterPointId(item.id);

    if (currentViewLevel === "national") {
      setSelectedRegion(provinceId);
      resetSubRegionState();
      setCurrentViewLevel(provinceId);
      return;
    }

    if (!subRegionId || provinceId !== currentViewLevel) return;

    if (isCompareMode) {
      resetSubRegionState();
      toggleCompareRegion(subRegionId, item.name);
      return;
    }

    handleSubRegionSelect(subRegionId, item.name);
  };

  return (
    <div className="relative w-full h-screen bg-gray-100 flex overflow-hidden">
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50">
        <button
          type="button"
          onClick={goToComparePage}
          disabled={compareRegions.length < 2}
          className="group h-16 w-7 bg-white/95 shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-y border-l border-gray-200 hover:border-[#8b5cf6] disabled:opacity-35 disabled:hover:border-gray-200 disabled:cursor-not-allowed"
        >
          <span className="w-0 h-0 border-y-[9px] border-y-transparent border-r-[13px] border-r-[#8b5cf6] transition-transform group-hover:-translate-x-0.5" />
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

      <div className="absolute left-[1.5%] top-1/2 -translate-y-1/2 w-[45.5%] h-[94%] bg-white rounded-2xl shadow-lg border-[0.5px] border-gray-200 overflow-hidden">
        <div className="absolute right-5 top-5 z-40 flex flex-col items-end gap-3">
          <button
            type="button"
            onClick={() => setIsCompareMode((prev) => !prev)}
            className={`relative w-14 h-14 rounded-full shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-2 ${
              isCompareMode ? "bg-[#8b5cf6] border-[#8b5cf6]" : "bg-white border-gray-200 hover:border-[#8b5cf6]"
            }`}
          >
            <ShoppingCart className={`w-7 h-7 ${isCompareMode ? "text-white" : "text-[#8b5cf6]"}`} />
            {compareRegions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center ring-2 ring-white">
                {compareRegions.length}
              </span>
            )}
          </button>

          {isCompareMode && (
            <div className="w-36 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-[#8b5cf6]/20 p-3">
              <div className="flex justify-end mb-2">
                <span className="text-[11px] font-bold text-[#8b5cf6] bg-[#8b5cf6]/10 px-2 py-0.5 rounded-full">
                  {compareRegions.length}/3
                </span>
              </div>
              <div className="space-y-1.5">
                {compareRegions.length === 0 ? (
                  <p className="text-[11px] text-gray-500 leading-4">지도에서 선택</p>
                ) : (
                  compareRegions.map((region) => (
                    <div key={region.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5">
                      <Check className="w-3.5 h-3.5 text-[#8b5cf6] shrink-0" />
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
              resetSubRegionState();
            }}
            onRegionHover={setHoveredRegion}
            onRegionDoubleClick={(id) => {
              setSelectedRegion(id);
              resetSubRegionState();
              setCurrentViewLevel(id);
            }}
            selectedRegion={selectedRegion}
            externalHoveredRegion={hoveredRegion}
            opportunityData={mainOpportunityData}
          />
        ) : (
          <DetailRegionMap
            regionId={currentViewLevel}
            onBack={() => {
              setCurrentViewLevel("national");
              resetSubRegionState();
            }}
            opportunityData={detailOpportunityData}
            onSubRegionClick={handleSubRegionSelect}
            onSubRegionHover={setHoveredSubRegion}
            selectedSubRegion={selectedSubRegion}
            externalHoveredSubRegion={hoveredSubRegion}
            selectedCompareSubRegions={compareRegionIds}
          />
        )}
      </div>

      <div className="absolute right-[1.5%] top-1/2 -translate-y-1/2 w-[50.5%] h-[94%] flex flex-col gap-4">
        <div className={`${compareRegions.length > 0 ? "flex-[1.35]" : "flex-1"} min-h-0 relative`}>
          <InfrastructureScatterPlot
            currentViewLevel={currentViewLevel}
            selectedRegion={currentViewLevel === "national" ? "national" : currentViewLevel}
            selectedSubRegion={selectedSubRegion}
            selectedSubRegionName={selectedSubRegionName}
            hoveredSubRegion={hoveredSubRegion}
            hoveredProvinceId={currentViewLevel === "national" ? hoveredRegion : null}
            regionsInfo={regionsInfo}
            selectedComparePointIds={compareScatterPointIds}
            isCompareMode={isCompareMode}
            onDataPointHover={handleScatterHover}
            onDataPointClick={handleScatterClick}
          />
        </div>
        {compareRegions.length > 0 && (
          <div className="flex-[0.95] min-h-0">
            <MainSelectionRadarChart selectedRegions={compareRegions} />
          </div>
        )}
      </div>
    </div>
  );
}
