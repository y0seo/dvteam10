import { useState, useMemo, useEffect, useRef } from "react";

import KoreaMapSvgRaw from "../../imports/kr1.svg?raw";
import {
  HEATMAP_GRADIENT,
  formatVisitorsInMan,
  getHeatmapColor,
} from "../data/heatmapPalette";

interface KoreaMapProps {
  onRegionClick: (region: string) => void;
  onRegionHover: (region: string | null) => void; 
  selectedRegion: string | null;
  visitorData: { [key: string]: number };
  colorScaleMax: number;
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

export function KoreaMap({ onRegionClick, onRegionHover, selectedRegion, visitorData, colorScaleMax }: KoreaMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");

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
      const heatmapColor = getHeatmapColor(visitors, colorScaleMax);
      const isSelected = selectedRegion === region.id;
      const isHovered = hoveredRegion === region.id;

      styles += `
        svg #${region.id} {
          fill: ${heatmapColor} !important;
          stroke: ${isSelected || isHovered ? "#fbbf24" : "#ffffff"} !important;
          stroke-width: ${isSelected || isHovered ? "2.5px" : "0.6px"} !important;
          transition: fill 0.3s ease, stroke 0.2s ease, stroke-width 0.2s ease;
          cursor: pointer;
        }
      `;
    });
    return styles;
  }, [visitorData, selectedRegion, hoveredRegion, colorScaleMax]);

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
    <div className="relative w-full h-full flex flex-col items-center justify-center p-5 bg-transparent overflow-hidden">
      <style>{dynamicStyles}</style>

      {currentRegion && (
        <div className="absolute top-6 left-6 bg-white px-5 py-4 rounded-xl shadow-xl border border-blue-100 pointer-events-none z-20 transition-all backdrop-blur-md bg-opacity-90">
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
        className="relative w-[94%] max-w-[680px] h-[94%] flex items-center justify-center [&>svg]:drop-shadow-lg"
        onClick={(e) => handleInteraction(e, "click")}
        onMouseMove={(e) => handleInteraction(e, "hover")}
        onMouseLeave={() => {
          setHoveredRegion(null);
          onRegionHover(null);
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />

      <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-2.5 rounded-lg shadow-lg border border-gray-100 pointer-events-none z-20">
        <p className="text-[10px] font-bold text-gray-700 mb-2">외국인 방문자수</p>
        <div className="flex items-stretch gap-2.5">
          <div
            className="w-3 h-[106px] rounded-full border border-slate-200"
            style={{ background: HEATMAP_GRADIENT }}
          />
          <div className="flex h-[106px] flex-col justify-between text-[10px] font-semibold text-gray-600">
            <span>{formatVisitorsInMan(colorScaleMax)}</span>
            <span>0명</span>
          </div>
        </div>
      </div>
    </div>
  );
}
