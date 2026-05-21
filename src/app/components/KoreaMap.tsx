import { useState, useMemo, useEffect, useRef } from "react";

import KoreaMapSvgRaw from "../../imports/kr1.svg?raw"; 

interface KoreaMapProps {
  onRegionClick: (region: string) => void;
  onRegionHover: (region: string | null) => void; 
  selectedRegion: string | null;
  visitorData: { [key: string]: number };
}

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

// Color Intensity 
const getHeatmapColor = (value: number, min: number, max: number): string => {
  if (min === max) return `rgba(255, 99, 91, 0.5)`; // 기본 
  const normalized = (value - min) / (max - min || 1);
  const opacity = 0.15 + normalized * 0.85; // 최소 투명도 15% ~ 최대 100%
  return `rgba(255, 99, 91, ${opacity})`;
};

const formatVisitorsInMan = (value: number) => `${Math.round(value / 10000).toLocaleString()}만명`;

export function KoreaMap({ onRegionClick, onRegionHover, selectedRegion, visitorData }: KoreaMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");

  const visitorValues = Object.values(visitorData);
  const minVisitors = Math.min(...visitorValues, 0);
  const maxVisitors = Math.max(...visitorValues, 1);

  useEffect(() => {
    if (KoreaMapSvgRaw) {
      const responsiveSvg = KoreaMapSvgRaw
        .replace(/width="[0-9.]+"/g, 'width="100%"')
        .replace(/height="[0-9.]+"/g, 'height="100%"');
      setSvgContent(responsiveSvg);
    }
  }, []);

  const dynamicStyles = useMemo(() => {
    let styles = "";
    regionsInfo.forEach((region) => {
      const visitors = visitorData[region.id] || 0;
      const heatmapColor = getHeatmapColor(visitors, minVisitors, maxVisitors);
      const isSelected = selectedRegion === region.id;
      const isHovered = hoveredRegion === region.id;

      styles += `
        svg #${region.id} {
          fill: ${heatmapColor} !important;
          stroke: ${isSelected || isHovered ? "#1e3a8a" : "#ffffff"} !important;
          stroke-width: ${isSelected || isHovered ? "2.5px" : "0.5px"} !important;
          transition: fill 0.3s ease, stroke 0.2s ease, stroke-width 0.2s ease;
          cursor: pointer;
        }
      `;
    });
    return styles;
  }, [visitorData, selectedRegion, hoveredRegion, minVisitors, maxVisitors]);

  const validIds = regionsInfo.map(r => r.id);

  const handleInteraction = (e: React.MouseEvent<HTMLDivElement>, type: "click" | "hover") => {
    const target = e.target as SVGElement;
    const regionId = target.id || target.closest('g')?.id || target.closest('path')?.id;
    
    if (regionId && validIds.includes(regionId)) {
      if (type === "click") onRegionClick(regionId);
      if (type === "hover") {
        setHoveredRegion(regionId);
        onRegionHover(regionId);
      }
    } else if (type === "hover") {
      setHoveredRegion(null);
      onRegionHover(null);
    }
  };

  const currentRegion = regionsInfo.find(r => r.id === (hoveredRegion || selectedRegion));

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4 bg-transparent overflow-hidden">
      <style>{dynamicStyles}</style>

      {currentRegion && (
        <div className="absolute top-6 left-6 bg-white px-6 py-4 rounded-2xl shadow-xl border border-blue-100 pointer-events-none z-20 transition-all backdrop-blur-md bg-opacity-90">
          <p className="text-sm font-semibold text-gray-500 mb-1">
            {currentRegion.name} 관광객 수
          </p>
          <p className="text-3xl font-black text-blue-600 tracking-tight">
            {visitorData[currentRegion.id]?.toLocaleString() || 0}
            <span className="text-base text-gray-600 font-medium ml-1">명</span>
          </p>
        </div>
      )}

      <div 
        ref={mapContainerRef}
        className="relative w-full max-w-[450px] h-full flex items-center justify-center [&>svg]:drop-shadow-lg"
        onClick={(e) => handleInteraction(e, "click")}
        onMouseMove={(e) => handleInteraction(e, "hover")}
        onMouseLeave={() => {
          setHoveredRegion(null);
          onRegionHover(null);
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />

      <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg border border-gray-100 pointer-events-none z-20">
        <p className="text-xs font-bold text-gray-700 mb-3">외국인 방문자수</p>
        <div className="flex items-stretch gap-3">
          <div
            className="w-4 h-36 rounded-full border border-red-100"
            style={{ background: "linear-gradient(to top, rgba(255, 99, 91, 0.15), rgba(255, 99, 91, 1))" }}
          />
          <div className="flex h-36 flex-col justify-between text-[11px] font-semibold text-gray-600">
            <span>{formatVisitorsInMan(maxVisitors)}</span>
            <span>0명</span>
          </div>
        </div>
      </div>

      <div className="hidden absolute bottom-6 right-6 bg-white/90 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg border border-gray-100 pointer-events-none z-20">
        <p className="text-xs font-bold text-gray-700 mb-3">방문객 밀집도</p>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(255, 99, 91, 0.2)" }}></div>
          <span className="text-[11px] font-medium text-gray-600">적음</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(255, 99, 91, 0.6)" }}></div>
          <span className="text-[11px] font-medium text-gray-600">보통</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(255, 99, 91, 1)" }}></div>
          <span className="text-[11px] font-medium text-gray-600">많음</span>
        </div>
      </div>
    </div>
  );
}
