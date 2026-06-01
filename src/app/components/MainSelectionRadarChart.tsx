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
  buildComparisonRows,
  comparisonMetricKeys,
  getNationwidePercentile,
  getPeerPercentile,
  getPeerScope,
  getPeerScopeLabel,
  type CompareRegion,
} from "../data/comparisonData";

const REGION_COLORS = ["#2563eb", "#10b981", "#f97316"];

function renderAngleAxisTick(props: { x: number; y: number; payload: { value: string }; textAnchor?: string }) {
  const { x, y, payload, textAnchor } = props;
  let dy = 0;
  if (payload.value === "방문자") dy = -8;
  else if (payload.value === "숙박업소") dy = 8;

  return (
    <text x={x} y={y + dy} textAnchor={textAnchor} fontSize={11} fontWeight={700} fill="#374151">
      {payload.value}
    </text>
  );
}

type MainSelectionRadarChartProps = {
  selectedRegions: CompareRegion[];
};

export function MainSelectionRadarChart({ selectedRegions }: MainSelectionRadarChartProps) {
  const comparisonRows = useMemo(
    () => buildComparisonRows(selectedRegions),
    [selectedRegions],
  );
  const peerScope = useMemo(() => getPeerScope(selectedRegions), [selectedRegions]);

  const nationwideRadarData = useMemo(
    () =>
      comparisonMetricKeys.map((key) => ({
        metric: comparisonRows[0]?.metrics[key].shortLabel || key,
        ...Object.fromEntries(
          comparisonRows.map((row, index) => [
            `region${index}`,
            getNationwidePercentile(key, row.metrics[key].value),
          ]),
        ),
      })),
    [comparisonRows],
  );

  const peerRadarData = useMemo(() => {
    if (!peerScope) return [];
    return comparisonMetricKeys.map((key) => ({
      metric: comparisonRows[0]?.metrics[key].shortLabel || key,
      ...Object.fromEntries(
        comparisonRows.map((row, index) => [
          `region${index}`,
          getPeerPercentile(key, row.metrics[key].value, peerScope),
        ]),
      ),
    }));
  }, [comparisonRows, peerScope]);

  return (
    <div className="h-full min-h-0 bg-white rounded-xl shadow-lg border border-gray-200 p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-800">정규화 레이더 비교</h3>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-[11px] font-semibold">
            {comparisonRows.map((row, index) => (
              <span key={row.region.id} className="flex items-center gap-1">
                {index > 0 && <span className="text-gray-400">vs</span>}
                <span style={{ color: REGION_COLORS[index] }}>{row.region.name}</span>
              </span>
            ))}
          </div>
        </div>
        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded shrink-0">
          Percentile rank
        </span>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">
        <div className="flex flex-col min-h-0">
          <p className="text-[11px] font-bold text-gray-500 mb-1">전국 대비</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={nationwideRadarData} outerRadius="68%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="metric" tick={renderAngleAxisTick} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                {comparisonRows.map((row, index) => (
                  <Radar
                    key={row.region.id}
                    dataKey={`region${index}`}
                    name={row.region.name}
                    stroke={REGION_COLORS[index]}
                    fill={REGION_COLORS[index]}
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                ))}
                <Tooltip
                  contentStyle={{ borderRadius: "10px", border: "none", fontSize: "11px" }}
                  formatter={(value: number, name: string) => [`${value}점`, name]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex flex-col min-h-0">
          <p className="text-[11px] font-bold text-gray-500 mb-1">
            {getPeerScopeLabel(peerScope)}
          </p>
          <div className="flex-1 min-h-0">
            {peerScope ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={peerRadarData} outerRadius="68%">
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="metric" tick={renderAngleAxisTick} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  {comparisonRows.map((row, index) => (
                    <Radar
                      key={row.region.id}
                      dataKey={`region${index}`}
                      name={row.region.name}
                      stroke={REGION_COLORS[index]}
                      fill={REGION_COLORS[index]}
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                  ))}
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "none", fontSize: "11px" }}
                    formatter={(value: number, name: string) => [`${value}점`, name]}
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
