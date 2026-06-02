import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  getPeerScope,
  getPeerScopeLabel,
  type CompareRegion,
} from "../data/comparisonData";
import { getDetailOpportunityScores, type ScoreMetrics } from "../data/opportunityData";

const REGION_COLORS = ["#2563eb", "#10b981", "#f97316"];


function renderAngleAxisTick(props: { x: number; y: number; cx: number; cy: number; payload: { value: string }; textAnchor?: string }) {
  const { x, y, cx, cy, payload, textAnchor } = props;
  let dy = 0;
  if (y < cy - 20) dy = -6;
  else if (y > cy + 20) dy = 12;
  else dy = 4;

  return (
    <text x={x} y={y + dy} textAnchor={textAnchor} fontSize={10} fontWeight={700} fill="#374151">
      {payload.value}
    </text>
  );
}

type MainSelectionRadarChartProps = {
  selectedRegions: CompareRegion[];
};

export function MainSelectionRadarChart({ selectedRegions }: MainSelectionRadarChartProps) {
  const peerScope = useMemo(() => getPeerScope(selectedRegions), [selectedRegions]);

  
  const radarAxes = useMemo(() => [
    { key: "visitor", label: "관광객 규모" },
    { key: "growth", label: "관광객 증감률" },
    { key: "spending", label: "숙박 소비액" },
    { key: "accommodation", label: "경쟁 여유도" },
    { key: "price", label: "부지 저렴성" },
  ], []);

  const nationwideRadarData = useMemo(() => {
    return radarAxes.map((axis) => {
      const rowData: any = { metric: axis.label };
      selectedRegions.forEach((region, index) => {
        const datum = getDetailOpportunityScores(region.provinceId)[region.name];
        
        rowData[`region${index}`] = datum ? datum.nationalT[axis.key as keyof ScoreMetrics] : 0;
      });
      return rowData;
    });
  }, [radarAxes, selectedRegions]);

  
  const peerRadarData = useMemo(() => {
    if (!peerScope) return [];
    
    return radarAxes.map((axis) => {
      const rowData: any = { metric: axis.label };
      selectedRegions.forEach((region, index) => {
        const datum = getDetailOpportunityScores(region.provinceId)[region.name];
        
        rowData[`region${index}`] = datum ? datum.provincialT[axis.key as keyof ScoreMetrics] : 0;
      });
      return rowData;
    });
  }, [radarAxes, selectedRegions, peerScope]);

  return (
    <div className="h-full min-h-0 bg-white rounded-xl shadow-lg border border-gray-200 p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-800">정규화 레이더 비교</h3>
            <span className="text-[9px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
              면적이 넓을수록 투자 유리
            </span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-[11px] font-semibold">
            {selectedRegions.map((region, index) => (
              <span key={region.id} className="flex items-center gap-1">
                {index > 0 && <span className="text-gray-400">vs</span>}
                <span style={{ color: REGION_COLORS[index] }}>{region.name}</span>
              </span>
            ))}
          </div>
        </div>
        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded shrink-0">
          T-Score (0~100)
        </span>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">
        {/* 전국 차트 렌더링 */}
        <div className="flex flex-col min-h-0">
          <p className="text-[11px] font-bold text-gray-500 mb-1">전국 대비 (절대 입지)</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={nationwideRadarData} outerRadius="68%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="metric" tick={renderAngleAxisTick} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                {selectedRegions.map((region, index) => (
                  <Radar
                    key={region.id}
                    dataKey={`region${index}`}
                    name={region.name}
                    stroke={REGION_COLORS[index]}
                    fill={REGION_COLORS[index]}
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                ))}
                <Tooltip
                  contentStyle={{ borderRadius: "10px", border: "none", fontSize: "11px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  formatter={(value: number, name: string) => [`${Math.round(value)}점`, name]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* 권역(도내) 차트 렌더링 */}
        <div className="flex flex-col min-h-0">
          <p className="text-[11px] font-bold text-gray-500 mb-1">
            {getPeerScopeLabel(peerScope)} (상대 입지)
          </p>
          <div className="flex-1 min-h-0">
            {peerScope ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={peerRadarData} outerRadius="68%">
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="metric" tick={renderAngleAxisTick} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  {selectedRegions.map((region, index) => (
                    <Radar
                      key={region.id}
                      dataKey={`region${index}`}
                      name={region.name}
                      stroke={REGION_COLORS[index]}
                      fill={REGION_COLORS[index]}
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                  ))}
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "none", fontSize: "11px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    formatter={(value: number, name: string) => [`${Math.round(value)}점`, name]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full min-h-[150px] rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-sm font-bold text-gray-400 text-center leading-6 px-6">
                선택된 지역들이 서로 다른 권역에 있어 권역 내 비교를 표시할 수 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}