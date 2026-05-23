import { useMemo } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getScatterData } from "../data/infrastructureData";
import { HEATMAP_PALETTE } from "../data/heatmapPalette";

// MainPage에서 넘겨받을 데이터(Props)의 타입 정의
interface InfrastructureScatterPlotProps {
  currentViewLevel: string;
  selectedRegion: string;
  selectedSubRegion: string | null;
  regionsInfo: { id: string; name: string }[];
}

export function InfrastructureScatterPlot({
  currentViewLevel,
  selectedRegion,
  selectedSubRegion,
  regionsInfo,
}: InfrastructureScatterPlotProps) {
  
  // 지도의 클릭 상태에 반응하여 데이터 가공 함수 호출
  const scatterData = useMemo(() => {
    return getScatterData(currentViewLevel, selectedSubRegion);
  }, [currentViewLevel, selectedSubRegion]);

  // 상단 칩에 보여줄 현재 지역명 타이틀 계산
  const currentRegionLabel = useMemo(() => {
    if (currentViewLevel === "national") return "전국 시·도 기준";
    const match = regionsInfo.find((r) => r.id === currentViewLevel);
    return `${match?.name || ""} 시·군·구 기준`;
  }, [currentViewLevel, regionsInfo]);

  return (
    <div className="w-full h-[32%] bg-white rounded-2xl shadow-lg border border-gray-200/80 p-5 flex flex-col min-h-0">
      {/* 타이틀 영역 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-gray-800">지역별 지가 대비 숙박 인프라 현황 분석</h3>
          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
            {currentRegionLabel}
          </span>
        </div>
        <p className="text-[11px] text-gray-400">
          * 지도를 클릭하거나 요소를 선택하면 해당 점이 하이라이트됩니다.
        </p>
      </div>

      {/* 차트 영역 */}
      <div className="flex-1 w-full min-h-0 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 30, bottom: 15, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            
            <XAxis 
              type="number" 
              dataKey="price" 
              name="평균 지가" 
              unit="만원" 
              tickFormatter={(v) => v.toLocaleString()}
              style={{ fontSize: "10px", fill: "#64748b" }}
            />
            
            <YAxis 
              type="number" 
              dataKey="accommodation" 
              name="숙박업소 수" 
              unit="개" 
              style={{ fontSize: "10px", fill: "#64748b" }}
            />
            
            <Tooltip 
              cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px' }}
              formatter={(value, name) => [value.toLocaleString() + (name === '평균 지가' ? ' 만원' : ' 개'), name]}
            />
            
            <Scatter data={scatterData} shape="circle">
              {scatterData.map((entry, index) => {
                // 전국 단위 보기와 시군구 보기 단위에 맞는 하이라이트 조건 판별
                const isSelected = 
                  currentViewLevel === "national" 
                    ? selectedRegion === entry.id 
                    : selectedSubRegion === entry.id;

                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isSelected ? "#ea580c" : HEATMAP_PALETTE[4]}
                    stroke={isSelected ? "#ffffff" : "none"}
                    strokeWidth={isSelected ? 2 : 0}
                    opacity={currentViewLevel === "national" ? 1 : (selectedSubRegion && !isSelected ? 0.25 : 1)}
                    style={{ transition: "all 0.2s ease" }}
                  />
                );
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}