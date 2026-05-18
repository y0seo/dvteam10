import { useState, useMemo, useEffect, useRef } from "react";

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

// Color Intensity 
const getHeatmapColor = (value: number, min: number, max: number): string => {
  if (min === max) return `rgba(37, 99, 235, 0.5)`;
  const normalized = (value - min) / (max - min || 1);
  const opacity = 0.15 + normalized * 0.85;
  return `rgba(255, 99, 91, ${opacity})`;
};

interface DetailRegionMapProps {
  regionId: string;
  onBack: () => void;
  dateSeed: number;
  onSubRegionClick: (subId: string, subName: string) => void; 
  selectedSubRegion: string | null;
}

export function DetailRegionMap({ regionId, onBack, dateSeed, onSubRegionClick, selectedSubRegion }: DetailRegionMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [subRegionMap, setSubRegionMap] = useState<Record<string, string>>({});

  const svgContent = useMemo(() => {
    const raw = regionSvgMap[regionId] || "";
    return raw.replace(/width="[0-9.]+"/g, 'width="100%"').replace(/height="[0-9.]+"/g, 'height="100%"');
  }, [regionId]);

  useEffect(() => {
    if (mapContainerRef.current && svgContent) {
      const paths = Array.from(mapContainerRef.current.querySelectorAll("path"));
      const mapping: Record<string, string> = {};
      paths.forEach(p => {
        if (p.id) mapping[p.id] = p.getAttribute("name") || p.getAttribute("title") || p.id;
      });
      setSubRegionMap(mapping);
    }
  }, [svgContent]);

  const subRegionIds = useMemo(() => Object.keys(subRegionMap), [subRegionMap]);

  const subRegionData = useMemo(() => {
    const data: Record<string, number> = {};
    subRegionIds.forEach((id, i) => {
      const idNum = parseInt(id) || i;
      data[id] = Math.floor((Math.sin(dateSeed + idNum * 0.5) + 1) * 5000) + 500;
    });
    return data;
  }, [subRegionIds, dateSeed]);

  const minV = useMemo(() => (subRegionIds.length ? Math.min(...Object.values(subRegionData)) : 0), [subRegionData]);
  const maxV = useMemo(() => (subRegionIds.length ? Math.max(...Object.values(subRegionData)) : 1), [subRegionData]);

  const dynamicStyles = useMemo(() => {
    let styles = "";
    subRegionIds.forEach((id) => {
      const visitors = subRegionData[id] || 0;
      const heatmapColor = getHeatmapColor(visitors, minV, maxV);
      const isSelected = selectedSubRegion === id;

      styles += `
        svg [id="${id}"] {
          fill: ${heatmapColor} !important;
          stroke: ${isSelected ? "#1e3a8a" : "#ffffff"} !important;
          stroke-width: ${isSelected ? "3px" : "0.5px"} !important;
          transition: fill 0.3s ease;
          cursor: pointer;
        }
        svg [id="${id}"]:hover {
          stroke: #1e3a8a !important;
          stroke-width: 2px !important;
        }
      `;
    });
    return styles;
  }, [subRegionData, selectedSubRegion, minV, maxV]);

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

      {/* 범례 */}
      <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg border border-gray-100 pointer-events-none z-20">
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