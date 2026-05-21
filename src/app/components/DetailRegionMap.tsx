import { useEffect, useMemo, useRef, useState } from "react";

import {
  HEATMAP_GRADIENT,
  formatVisitorsInMan,
  getHeatmapColor,
} from "../data/heatmapPalette";
import SeoulSvg from "../../imports/simple/11.svg?raw";
import BusanSvg from "../../imports/simple/26.svg?raw";
import GyeonggiSvg from "../../imports/simple/41.svg?raw";
import GangwonSvg from "../../imports/simple/31.svg?raw";
import GyeongnamSvg from "../../imports/simple/51.svg?raw";
import GyeongbukSvg from "../../imports/simple/52.svg?raw";
import GwangjuSvg from "../../imports/simple/61.svg?raw";
import DaeguSvg from "../../imports/simple/71.svg?raw";
import DaejeonSvg from "../../imports/simple/72.svg?raw";
import SejongSvg from "../../imports/simple/81.svg?raw";
import UlsanSvg from "../../imports/simple/73.svg?raw";
import IncheonSvg from "../../imports/simple/33.svg?raw";
import JeonnamSvg from "../../imports/simple/62.svg?raw";
import JeonbukSvg from "../../imports/simple/63.svg?raw";
import JejuSvg from "../../imports/simple/99.svg?raw";
import ChungnamSvg from "../../imports/simple/88.svg?raw";
import ChungbukSvg from "../../imports/simple/87.svg?raw";

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

const getSvgAttribute = (tag: string, attribute: string) => {
  const match = tag.match(new RegExp(`${attribute}="([^"]+)"`));
  return match?.[1] || "";
};

interface DetailRegionMapProps {
  regionId: string;
  onBack: () => void;
  visitorData: Record<string, number>;
  colorScaleMax: number;
  onSubRegionClick: (subId: string, subName: string) => void; 
  selectedSubRegion: string | null;
  selectedCompareSubRegions?: string[];
}

export function DetailRegionMap({ regionId, onBack, visitorData, colorScaleMax, onSubRegionClick, selectedSubRegion, selectedCompareSubRegions = [] }: DetailRegionMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [checkMarkers, setCheckMarkers] = useState<{ id: string; x: number; y: number }[]>([]);

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

  const subRegionData = visitorData;

  const dynamicStyles = useMemo(() => {
    let styles = "";
    subRegionIds.forEach((id) => {
      const visitors = subRegionData[id] || 0;
      const heatmapColor = getHeatmapColor(visitors, colorScaleMax);
      const isSelected = selectedSubRegion === id;
      const isCompareSelected = selectedCompareSubRegions.includes(id);

      styles += `
        svg [id="${id}"] {
          fill: ${heatmapColor} !important;
          stroke: ${isCompareSelected ? "#16a34a" : isSelected ? "#fbbf24" : "#ffffff"} !important;
          stroke-width: ${isCompareSelected || isSelected ? "3px" : "0.6px"} !important;
          transition: fill 0.3s ease;
          cursor: pointer;
        }
        svg [id="${id}"]:hover {
          stroke: #fbbf24 !important;
          stroke-width: 2px !important;
        }
      `;
    });
    return styles;
  }, [subRegionData, selectedSubRegion, colorScaleMax, selectedCompareSubRegions]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const container = mapContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const markers = selectedCompareSubRegions
        .map((id) => {
          const regionElement = container.querySelector<SVGGraphicsElement>(`[id="${id}"]`);
          if (!regionElement) return null;

          const rect = regionElement.getBoundingClientRect();
          return {
            id,
            x: rect.left + rect.width / 2 - containerRect.left,
            y: rect.top + rect.height / 2 - containerRect.top,
          };
        })
        .filter((marker): marker is { id: string; x: number; y: number } => Boolean(marker));

      setCheckMarkers(markers);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [svgContent, selectedCompareSubRegions]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4 bg-transparent overflow-hidden">
      <style>{dynamicStyles}</style>

      <div className="absolute top-3 left-3 z-20 flex flex-col gap-4">
        <button onClick={onBack} className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 shadow-md rounded-full hover:bg-gray-100 text-2xl font-bold text-gray-600">
          ←
        </button>
        <div className="bg-white/90 backdrop-blur-md px-6 py-4 rounded-2xl shadow-xl border border-blue-100 min-w-[200px]">
          <p className="text-sm font-semibold text-gray-500 mb-1">
            {selectedSubRegion ? subRegionMap[selectedSubRegion] : "구역을 선택하세요"}
          </p>
          <p className="text-3xl font-black text-blue-600 tracking-tight">
            {selectedSubRegion ? subRegionData[selectedSubRegion]?.toLocaleString() : "0"}
            <span className="text-base text-gray-600 font-medium ml-1">명</span>
          </p>
        </div>
      </div>

      <div 
        ref={mapContainerRef}
        className="relative w-full max-w-[450px] h-[80%] flex items-center justify-center mt-12 [&>svg]:drop-shadow-lg"
        onClick={(e) => {
          const target = e.target as SVGElement;
          const id = target.id || target.closest('path')?.id;
          if (id && subRegionMap[id]) onSubRegionClick(id, subRegionMap[id]);
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />

      <div className="absolute left-1/2 top-[calc(50%+1.5rem)] z-30 w-full max-w-[450px] h-[80%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        {checkMarkers.map((marker) => (
          <div
            key={marker.id}
            className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 text-white shadow-lg ring-4 ring-white flex items-center justify-center text-base font-black"
            style={{ left: marker.x, top: marker.y }}
          >
            ✓
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg border border-gray-100 pointer-events-none z-20">
        <p className="text-xs font-bold text-gray-700 mb-3">외국인 방문자수</p>
        <div className="flex items-stretch gap-3">
          <div
            className="w-4 h-36 rounded-full border border-slate-200"
            style={{ background: HEATMAP_GRADIENT }}
          />
          <div className="flex h-36 flex-col justify-between text-[11px] font-semibold text-gray-600">
            <span>{formatVisitorsInMan(colorScaleMax)}</span>
            <span>0명</span>
          </div>
        </div>
      </div>
    </div>
  );
}
