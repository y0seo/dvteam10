import { useEffect, useMemo, useRef, useState } from "react";

import {
  HEATMAP_GRADIENT,
  getHeatmapColorFromRatio,
} from "../data/heatmapPalette";
import type { OpportunityDatum } from "../data/opportunityData";
import SeoulSvg from "../../imports/simple/sl.svg?raw";
import BusanSvg from "../../imports/simple/bs.svg?raw";
import GyeonggiSvg from "../../imports/simple/gg.svg?raw";
import GangwonSvg from "../../imports/simple/gw.svg?raw";
import GyeongnamSvg from "../../imports/simple/gn.svg?raw";
import GyeongbukSvg from "../../imports/simple/gb.svg?raw";
import GwangjuSvg from "../../imports/simple/gj.svg?raw";
import DaeguSvg from "../../imports/simple/dg.svg?raw";
import DaejeonSvg from "../../imports/simple/dj.svg?raw";
import SejongSvg from "../../imports/simple/sj.svg?raw";
import UlsanSvg from "../../imports/simple/us.svg?raw";
import IncheonSvg from "../../imports/simple/ic.svg?raw";
import JeonnamSvg from "../../imports/simple/jn.svg?raw";
import JeonbukSvg from "../../imports/simple/jb.svg?raw";
import JejuSvg from "../../imports/simple/jj.svg?raw";
import ChungnamSvg from "../../imports/simple/cn.svg?raw";
import ChungbukSvg from "../../imports/simple/cb.svg?raw";

const regionSvgMap: Record<string, string> = {
  seoul: SeoulSvg, busan: BusanSvg, gyeonggi: GyeonggiSvg, incheon: IncheonSvg,
  gangwon: GangwonSvg, chungbuk: ChungbukSvg, chungnam: ChungnamSvg, sejong: SejongSvg,
  daejeon: DaejeonSvg, jeonbuk: JeonbukSvg, jeonnam: JeonnamSvg, gwangju: GwangjuSvg,
  gyeongbuk: GyeongbukSvg, daegu: DaeguSvg, gyeongnam: GyeongnamSvg, ulsan: UlsanSvg, jeju: JejuSvg,
};

const regionNames: Record<string, string> = {
  seoul: "서울", incheon: "인천", gyeonggi: "경기", gangwon: "강원",
  chungbuk: "충북", chungnam: "충남", sejong: "세종", daejeon: "대전",
  jeonbuk: "전북", jeonnam: "전남", gwangju: "광주", gyeongbuk: "경북",
  daegu: "대구", gyeongnam: "경남", ulsan: "울산", busan: "부산", jeju: "제주"
};

const REGION_COLORS = ["#0f766e", "#facc15", "#111827"];

const getSvgAttribute = (tag: string, attribute: string) => {
  const match = tag.match(new RegExp(`${attribute}="([^"]+)"`));
  return match?.[1] || "";
};

interface DetailRegionMapProps {
  regionId: string;
  onBack: () => void;
  opportunityData: Record<string, OpportunityDatum>;
  onSubRegionClick: (subId: string, subName: string) => void; 
  onSubRegionHover?: (subId: string | null) => void;
  selectedSubRegion: string | null;
  externalHoveredSubRegion?: string | null;
  selectedCompareSubRegions?: string[];
  brushedSubRegions?: string[];
}

export function DetailRegionMap({ regionId, onBack, opportunityData, onSubRegionClick, onSubRegionHover, selectedSubRegion, externalHoveredSubRegion = null, selectedCompareSubRegions = [], brushedSubRegions = [] }: DetailRegionMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  const [checkMarkers, setCheckMarkers] = useState<{ id: string; x: number; y: number; color: string }[]>([]);
  const [hoveredSubRegion, setHoveredSubRegion] = useState<string | null>(null);

  const svgContent = useMemo(() => {
    const raw = regionSvgMap[regionId] || "";
    return raw
      .replace(/width="[0-9.]+"/g, 'width="100%"')
      .replace(/height="[0-9.]+"/g, 'height="100%"')
      .replace(/\sfill="[^"]*"/g, "");
  }, [regionId]);

  const subRegionMap = useMemo(() => {
    const mapping: Record<string, string> = {};
    const pathTags = svgContent.match(/<path\b[^>]*>/g) || [];
    pathTags.forEach((tag) => {
      const id = getSvgAttribute(tag, "id");
      if (id) mapping[id] = getSvgAttribute(tag, "name") || getSvgAttribute(tag, "title") || id;
    });
    return mapping;
  }, [svgContent]);

  const subRegionIds = useMemo(() => Object.keys(subRegionMap), [subRegionMap]);
  const activeHoveredSubRegion = hoveredSubRegion || externalHoveredSubRegion;

  const updateHoveredSubRegion = (id: string | null) => {
    setHoveredSubRegion(id);
    onSubRegionHover?.(id);
  };
  
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const container = mapContainerRef.current;

    const bringToFront = (id: string) => {
      const element = container.querySelector(`[id="${id}"]`);
      if (element && element.parentNode) {
        element.parentNode.appendChild(element);
      }
    };

    brushedSubRegions.forEach(bringToFront);
    if (activeHoveredSubRegion) bringToFront(activeHoveredSubRegion);
    if (selectedCompareSubRegions.length > 0) selectedCompareSubRegions.forEach(bringToFront);
    if (selectedSubRegion) bringToFront(selectedSubRegion);

  }, [selectedSubRegion, selectedCompareSubRegions, activeHoveredSubRegion, brushedSubRegions, svgContent]);

  const dynamicStyles = useMemo(() => {
    let styles = "";
    subRegionIds.forEach((id) => {
      const score = opportunityData[id]?.opportunityScore;
      const heatmapColor = getHeatmapColorFromRatio(
        typeof score === "number" ? score * 0.01 : undefined,
      );
      const isSelected = selectedSubRegion === id;
      
      const compareIndex = selectedCompareSubRegions.indexOf(id);
      const isCompareSelected = compareIndex !== -1;
      const isHovered = activeHoveredSubRegion === id;
      const isBrushed = brushedSubRegions.includes(id);

      let strokeColor = "#ffffff";
      let strokeWidth = "0.5px";
      // 우선순위: hover > brushed > compare > selected
      if (isHovered) {
        strokeColor = "#6E5FB3";
        strokeWidth = "2.5px";
      } else if (isBrushed) {
        strokeColor = "#f97316";
        strokeWidth = "3px";
      } else if (isCompareSelected) {
        strokeColor = REGION_COLORS[compareIndex];
        strokeWidth = "2.5px";
      } else if (isSelected) {
        strokeColor = "#415aab";
        strokeWidth = "2px";
      }

      styles += `
        svg [id="${id}"] {
          fill: ${heatmapColor} !important;
          stroke: ${strokeColor} !important;
          stroke-width: ${strokeWidth} !important;
          vector-effect: non-scaling-stroke;
          transition: fill 0.3s ease, stroke 0.3s ease, stroke-width 0.3s ease;
          cursor: pointer;
        }
      `;
    });
    return styles;
  }, [opportunityData, selectedSubRegion, selectedCompareSubRegions, activeHoveredSubRegion, brushedSubRegions, subRegionIds]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const container = mapContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const markers = selectedCompareSubRegions
        .map((id, index) => { 
          const regionElement = container.querySelector<SVGGraphicsElement>(`[id="${id}"]`);
          if (!regionElement) return null;

          const rect = regionElement.getBoundingClientRect();
          return {
            id,
            x: rect.left + rect.width / 2 - containerRect.left,
            y: rect.top + rect.height / 2 - containerRect.top,
            color: REGION_COLORS[index], 
          };
        })
        .filter((marker): marker is { id: string; x: number; y: number; color: string } => Boolean(marker));

      setCheckMarkers(markers);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [svgContent, selectedCompareSubRegions]);

  const handleInteraction = (e: React.MouseEvent<HTMLDivElement>, type: "click" | "hover") => {
    const target = e.target as SVGElement;
    const regionElement = target.id ? target : (target.closest('path') || target.closest('g'));
    const id = regionElement?.id;

    if (id && subRegionMap[id]) {
      if (type === "click") onSubRegionClick(id, subRegionMap[id]);
      if (type === "hover") updateHoveredSubRegion(id);
    } else if (type === "hover") {
      updateHoveredSubRegion(null);
    }
  };

  const currentRegionId = activeHoveredSubRegion || selectedSubRegion;
  const currentOpportunity = currentRegionId ? opportunityData[currentRegionId] : null;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-5 bg-transparent overflow-hidden">
      <style>{dynamicStyles}</style>

      <div className="absolute top-5 left-5 z-20 flex flex-col gap-4">
        <button onClick={onBack} className="w-14 h-14 flex items-center justify-center bg-white border border-gray-200 shadow-md rounded-full hover:bg-gray-100 text-3xl font-bold text-gray-600">
          ←
        </button>
        <div className="bg-white/90 backdrop-blur-md px-5 py-4 rounded-xl shadow-xl border border-blue-100 min-w-[184px]">
          <p className="text-sm font-semibold text-gray-500 mb-1">
            {currentRegionId ? subRegionMap[currentRegionId] : "구역을 선택하세요"}
          </p>
          <p className="text-3xl font-black text-blue-600 tracking-tight">
            {currentOpportunity?.opportunityScore.toFixed(1) ?? "-"}
            <span className="text-base text-gray-600 font-medium ml-1">점</span>
          </p>
        </div>
      </div>

      <div 
        ref={mapContainerRef}
        className="relative w-[94%] max-w-[680px] h-[88%] flex items-center justify-center mt-12 [&>svg]:drop-shadow-lg"
        onClick={(e) => handleInteraction(e, "click")}
        onMouseMove={(e) => handleInteraction(e, "hover")}
        onMouseLeave={() => updateHoveredSubRegion(null)}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />

      <div className="absolute left-1/2 top-[calc(50%+1.5rem)] z-30 w-[94%] max-w-[680px] h-[88%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        {checkMarkers.map((marker) => (
          <div
            key={marker.id}
            className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full text-white shadow-lg ring-4 ring-white flex items-center justify-center text-lg font-black transition-colors duration-300"
            style={{ 
              left: marker.x, 
              top: marker.y,
              backgroundColor: marker.color 
            }}
          >
            ✓
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-2.5 rounded-lg shadow-lg border border-gray-100 pointer-events-none z-20">
        <p className="text-[10px] font-bold text-gray-700 mb-2">입지 기회도</p>
        <div className="flex items-stretch gap-2.5">
          <div
            className="w-3 h-[106px] rounded-full border border-slate-200"
            style={{ background: HEATMAP_GRADIENT }}
          />
          <div className="flex h-[106px] flex-col justify-between text-[10px] font-semibold text-gray-600">
            <span>100점 (최적)</span>
            <span>0점</span>
          </div>
        </div>
      </div>
    </div>
  );
}
