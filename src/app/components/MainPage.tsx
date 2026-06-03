import { Check, ShoppingCart, Menu, X, SlidersHorizontal } from "lucide-react";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { KoreaMap } from "./KoreaMap";
import { DetailRegionMap } from "./DetailRegionMap";
import { InfrastructureScatterPlot } from "./InfrastructureScatterPlot";
import { InlineComparePanel } from "./InlineComparePanel";

// 데이터 불러오기 및 변환 함수들
import { 
  getDetailOpportunityScores, 
  getMainOpportunityScores, 
  zToPercentileScore 
} from "../data/opportunityData";

const regionsInfo = [
  { id: "seoul", name: "서울" }, { id: "incheon", name: "인천" },
  { id: "gyeonggi", name: "경기" }, { id: "gangwon", name: "강원" },
  { id: "chungbuk", name: "충북" }, { id: "chungnam", name: "충남" },
  { id: "sejong", name: "세종" }, { id: "daejeon", name: "대전" },
  { id: "jeonbuk", name: "전북" }, { id: "jeonnam", name: "전남" },
  { id: "gwangju", name: "광주" }, { id: "gyeongbuk", name: "경북" },
  { id: "daegu", name: "대구" }, { id: "gyeongnam", name: "경남" },
  { id: "ulsan", name: "울산" }, { id: "busan", name: "부산" },
  { id: "jeju", name: "제주" },
];

type CompareRegion = {
  id: string;
  name: string;
  provinceId: string;
  provinceName: string;
};

const INITIAL_METRICS = [
  { id: "growth", label: "관광객 증감률", type: "positive" },
  { id: "visitor", label: "관광객 규모", type: "positive" },
  { id: "spending", label: "숙박 소비액", type: "positive" },
  { id: "price", label: "평균 지가", type: "negative" },
  { id: "competition", label: "경쟁 숙박업소 수", type: "negative" },
];

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
  const [brushedPointIds, setBrushedPointIds] = useState<string[]>([]);
  
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isRankOpen, setIsRankOpen] = useState(false); // 가중치 설정 패널 상태
  const [compareRegions, setCompareRegions] = useState<CompareRegion[]>([]);
  const [inlineCompareDismissed, setInlineCompareDismissed] = useState(false); // 사용자가 X로 닫음
  const [inlineCompareVisible, setInlineCompareVisible] = useState(false); // 슬라이드-인 트리거

  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const _metrics = [...metrics];
    const draggedItemContent = _metrics.splice(dragItem.current, 1)[0];
    _metrics.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setMetrics(_metrics);
  };

  const weightMap = useMemo(() => {
    const w: Record<string, number> = {};
    metrics.forEach((m, idx) => {
      w[m.id] = (5 - idx) / 15;
    });
    return w;
  }, [metrics]);

  const allDetailDataMap = useMemo(() => {
    const map: Record<string, any> = {};
    regionsInfo.forEach((region) => {
      const provData = getDetailOpportunityScores(region.id);
      Object.entries(provData).forEach(([districtName, datum]) => {
        map[`${region.id}-${districtName}`] = datum;
      });
    });
    return map;
  }, []);

  const calculateDynamicScores = useCallback((baseData: Record<string, any> | undefined) => {
    const dynamicData: Record<string, any> = {};
    if (!baseData) return dynamicData;
    
    const rawScores: { id: string; rawZ: number; datum: any }[] = [];

    for (const [id, datum] of Object.entries(baseData)) {
      if (!datum || !datum.nationalZ) continue;

      // 💡 여기서 새롭게 구조화된 datum.nationalZ 객체를 참조합니다!
      const rawZ = 
        (weightMap["growth"] * datum.nationalZ.growth) +
        (weightMap["visitor"] * datum.nationalZ.visitor) +
        (weightMap["spending"] * datum.nationalZ.spending) -
        (weightMap["price"] * datum.nationalZ.price) -
        (weightMap["competition"] * datum.nationalZ.accommodation);

      rawScores.push({ id, rawZ, datum });
    }

    const rawZMean = rawScores.length 
      ? rawScores.reduce((acc, curr) => acc + curr.rawZ, 0) / rawScores.length 
      : 0;
    const rawZStd = rawScores.length 
      ? Math.sqrt(rawScores.reduce((acc, curr) => acc + Math.pow(curr.rawZ - rawZMean, 2), 0) / rawScores.length) || 1
      : 1;

    for (const item of rawScores) {
      const finalZ = (item.rawZ - rawZMean) / rawZStd; 
      dynamicData[item.id] = {
        ...item.datum,
        opportunityScore: zToPercentileScore(finalZ) 
      };
    }

    return dynamicData;
  }, [weightMap]);

  const dynamicMainOpportunityData = useMemo(() => {
    const baseData = getMainOpportunityScores();
    return calculateDynamicScores(baseData);
  }, [calculateDynamicScores]);

  const dynamicAllDetailOpportunityData = useMemo(() => {
    return calculateDynamicScores(allDetailDataMap);
  }, [calculateDynamicScores, allDetailDataMap]);

  const dynamicDetailOpportunityData = useMemo(() => {
    if (currentViewLevel === "national") return {};
    const provinceData: Record<string, any> = {};
    Object.entries(dynamicAllDetailOpportunityData).forEach(([compositeKey, datum]) => {
      if (compositeKey.startsWith(`${currentViewLevel}-`)) {
        const districtName = compositeKey.replace(`${currentViewLevel}-`, "");
        provinceData[districtName] = datum;
      }
    });
    return provinceData;
  }, [currentViewLevel, dynamicAllDetailOpportunityData]);

  const compareRegionIds = useMemo(() => compareRegions.map((region) => region.id), [compareRegions]);
  const compareScatterPointIds = useMemo(
    () => compareRegions.map((region) => `${region.provinceId}-${region.id}`),
    [compareRegions],
  );
  const currentProvinceName = regionsInfo.find((region) => region.id === currentViewLevel)?.name || "";

  // 인라인 비교패널: 장바구니 3곳 모두 선택했을 때만 마운트, 수동으로 닫지 않았으면 표시
  const shouldMountInlineCompare = compareRegions.length === 3;
  const showInlineCompare = shouldMountInlineCompare && !inlineCompareDismissed;

  // 장바구니 구성이 바뀌면(추가/제거) 수동 닫기 해제 → 자동으로 다시 열림
  useEffect(() => {
    setInlineCompareDismissed(false);
  }, [compareRegions.length]);

  // 슬라이드-인: 마운트 직후 off-screen → 0 으로 전환해 트랜지션 유발.
  // (rAF는 백그라운드 탭에서 멈추므로 setTimeout 사용 → 어떤 경우에도 결국 표시됨)
  useEffect(() => {
    if (!showInlineCompare) {
      setInlineCompareVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setInlineCompareVisible(true), 20);
    return () => window.clearTimeout(timer);
  }, [showInlineCompare]);

  // 산점도 브러싱 결과 → 지도 cross-highlight용 파생 목록
  const handleBrushSelect = useCallback((ids: string[]) => {
    setBrushedPointIds(ids);
  }, []);

  const brushedProvinceIds = useMemo(
    () => [...new Set(brushedPointIds.map((id) => splitScatterPointId(id).provinceId))],
    [brushedPointIds],
  );

  const brushedSubRegionIds = useMemo(
    () =>
      brushedPointIds
        .map((id) => splitScatterPointId(id))
        .filter((parts) => parts.provinceId === currentViewLevel && parts.subRegionId)
        .map((parts) => parts.subRegionId as string),
    [brushedPointIds, currentViewLevel],
  );

  // 전국 ↔ 시·도 화면 전환 시 브러싱 하이라이트 초기화
  useEffect(() => {
    setBrushedPointIds([]);
  }, [currentViewLevel]);

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

  const resetSubRegionState = () => {
    setSelectedSubRegion(null);
    setSelectedSubRegionName(null);
    setHoveredSubRegion(null);
  };

  const handleScatterHover = (item: { id: string } | null) => {
    if (currentViewLevel === "national") {
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
      {/* 우측 가장자리 탭: 비교패널을 닫은 상태에서 다시 열기 */}
      {shouldMountInlineCompare && !showInlineCompare && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50">
          <button
            type="button"
            onClick={() => setInlineCompareDismissed(false)}
            className="group h-16 w-7 bg-white/95 shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-y border-l border-gray-200 hover:border-[#8b5cf6]"
            title="비교 패널 다시 열기"
          >
            <span className="w-0 h-0 border-y-[9px] border-y-transparent border-r-[13px] border-r-[#8b5cf6] transition-transform group-hover:-translate-x-0.5" />
          </button>
        </div>
      )}

      {/* 좌측 지도 패널 */}
      <div className="absolute left-[1.5%] top-1/2 -translate-y-1/2 w-[45.5%] h-[94%] bg-white rounded-2xl shadow-lg border-[0.5px] border-gray-200 overflow-hidden">
        
        <div className="absolute right-5 top-5 z-40 flex items-start gap-3">
          <div className="relative flex flex-col items-end">
            <button
              type="button"
              onClick={() => setIsRankOpen((prev) => !prev)}
              className={`relative w-14 h-14 rounded-full shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-2 ${
                isRankOpen ? "bg-[#8b5cf6] border-[#8b5cf6]" : "bg-white border-gray-200 hover:border-[#8b5cf6]"
              }`}
              title="평가 지표 가중치 설정"
            >
              <SlidersHorizontal className={`w-6 h-6 ${isRankOpen ? "text-white" : "text-[#8b5cf6]"}`} />
            </button>

            {isRankOpen && (
              <div className="absolute top-16 right-0 w-64 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-[#8b5cf6]/20 p-4">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    평가 지표 우선순위
                  </h4>
                  <button onClick={() => setIsRankOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mb-3 leading-snug">
                  드래그하여 중요도를 변경하면 점수가 실시간으로 재계산됩니다.
                </p>
                <div className="space-y-2">
                  {metrics.map((metric, index) => (
                    <div
                      key={metric.id}
                      draggable
                      onDragStart={() => (dragItem.current = index)}
                      onDragEnter={() => (dragOverItem.current = index)}
                      onDragEnd={handleDragSort}
                      onDragOver={(e) => e.preventDefault()}
                      className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-2 cursor-grab active:cursor-grabbing hover:border-[#8b5cf6] transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <Menu className="w-4 h-4 text-gray-400 group-hover:text-[#8b5cf6] shrink-0" />
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] text-[10px] font-bold shrink-0">
                          {index + 1}
                        </div>
                        <span className="text-xs font-semibold text-gray-700 truncate">{metric.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex flex-col items-end">
            <button
              type="button"
              onClick={() => setIsCompareMode((prev) => !prev)}
              className={`relative w-14 h-14 rounded-full shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-2 ${
                isCompareMode ? "bg-[#8b5cf6] border-[#8b5cf6]" : "bg-white border-gray-200 hover:border-[#8b5cf6]"
              }`}
              title="비교 모드 켜기/끄기"
            >
              <ShoppingCart className={`w-7 h-7 ${isCompareMode ? "text-white" : "text-[#8b5cf6]"}`} />
              {compareRegions.length > 0 && (
                <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center ring-2 ring-white">
                  {compareRegions.length}
                </span>
              )}
            </button>

            {isCompareMode && (
              <div className="absolute top-16 right-0 w-44 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-[#8b5cf6]/20 p-3">
                <div className="flex justify-end mb-2">
                  <span className="text-[11px] font-bold text-[#8b5cf6] bg-[#8b5cf6]/10 px-2 py-0.5 rounded-full">
                    {compareRegions.length}/3
                  </span>
                </div>
                <div className="space-y-1.5">
                  {compareRegions.length === 0 ? (
                    <p className="text-[11px] text-gray-500 leading-4 text-center py-2">지도에서 선택하세요</p>
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
            opportunityData={dynamicMainOpportunityData}
            brushedRegions={brushedProvinceIds}
          />
        ) : (
          <DetailRegionMap
            regionId={currentViewLevel}
            onBack={() => {
              setCurrentViewLevel("national");
              resetSubRegionState();
            }}
            opportunityData={dynamicDetailOpportunityData}
            onSubRegionClick={handleSubRegionSelect}
            onSubRegionHover={setHoveredSubRegion}
            selectedSubRegion={selectedSubRegion}
            externalHoveredSubRegion={hoveredSubRegion}
            selectedCompareSubRegions={compareRegionIds}
            brushedSubRegions={brushedSubRegionIds}
          />
        )}
      </div>

      <div className="absolute right-[1.5%] top-1/2 -translate-y-1/2 w-[50.5%] h-[94%] flex flex-col gap-4">
        <div className="flex-1 min-h-0 relative">
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
            opportunityDataByPoint={dynamicAllDetailOpportunityData}
            onDataPointHover={handleScatterHover}
            onDataPointClick={handleScatterClick}
            onBrushSelect={handleBrushSelect}
            brushedIds={brushedPointIds}
          />
        </div>

        {/* 인라인 비교패널: 우측 컬럼 위로 슬라이드 오버 (장바구니 3곳 모두 선택 시) */}
        {shouldMountInlineCompare && (
          <div
            className={`absolute inset-0 z-30 transition-transform duration-500 ease-out ${
              showInlineCompare && inlineCompareVisible
                ? "translate-x-0"
                : "translate-x-[105%] pointer-events-none"
            }`}
          >
            <InlineComparePanel
              regions={compareRegions}
              weightMap={weightMap}
              onClose={() => setInlineCompareDismissed(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
