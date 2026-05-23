import { useMemo, useState, type ComponentType } from "react";
import { ArrowLeft, CircleDollarSign, Hotel, MapPinned, UsersRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildComparisonRows,
  comparisonMetricKeys,
  type CompareRegion,
  type MetricKey,
  normalizeMetric,
} from "../data/comparisonData";

const REGION_COLORS = ["#2563eb", "#10b981", "#f97316"];

const metricIcons: Record<MetricKey, ComponentType<{ className?: string }>> = {
  foreignVisitors: UsersRound,
  accommodationSpending: CircleDollarSign,
  accommodationBusinesses: Hotel,
  landPrice: MapPinned,
};

const scatterOptions: { key: MetricKey; label: string }[] = [
  { key: "foreignVisitors", label: "외국인 방문자 수" },
  { key: "accommodationBusinesses", label: "숙박업소 수" },
  { key: "landPrice", label: "1㎡당 토지 거래가" },
  { key: "accommodationSpending", label: "숙박 소비액" },
];

function formatMetricValue(value: number | null, unit: string) {
  if (value == null) return "데이터 연결 전";
  if (unit === "만원") return `${value.toLocaleString()}만원`;
  if (unit === "천원") return `${Math.round(value).toLocaleString()}천원`;
  return `${Math.round(value).toLocaleString()}${unit}`;
}

function formatAxis(value: number) {
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString()}만`;
  return value.toLocaleString();
}

export function ComparePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const regions = ((location.state as { regions?: CompareRegion[] } | null)?.regions || []).slice(0, 3);
  const [xMetric, setXMetric] = useState<MetricKey>("landPrice");
  const [yMetric, setYMetric] = useState<MetricKey>("accommodationBusinesses");

  const comparisonRows = useMemo(() => buildComparisonRows(regions), [regions]);

  const radarData = useMemo(
    () =>
      comparisonMetricKeys.map((key) => {
        const values = comparisonRows.map((row) => row.metrics[key].value);
        const row: Record<string, number | string> = {
          metric: comparisonRows[0]?.metrics[key].shortLabel || key,
        };

        comparisonRows.forEach((item, index) => {
          row[`region${index}`] = normalizeMetric(item.metrics[key].value, values);
        });

        return row;
      }),
    [comparisonRows],
  );

  const scatterData = useMemo(
    () =>
      comparisonRows
        .map((row, index) => ({
          name: row.region.name,
          provinceName: row.region.provinceName,
          x: row.metrics[xMetric].value,
          y: row.metrics[yMetric].value,
          color: REGION_COLORS[index],
        }))
        .filter((row): row is typeof row & { x: number; y: number } => row.x != null && row.y != null),
    [comparisonRows, xMetric, yMetric],
  );

  const monthlyLineData = useMemo(() => {
    const monthSet = new Set<string>();
    comparisonRows.forEach((row) => row.monthlyVisitors.forEach((item) => monthSet.add(item.month)));

    return Array.from(monthSet)
      .sort()
      .map((month) => {
        const lineRow: Record<string, number | string> = { month };
        comparisonRows.forEach((row, index) => {
          lineRow[`region${index}`] =
            row.monthlyVisitors.find((item) => item.month === month)?.visitors || 0;
        });
        return lineRow;
      });
  }, [comparisonRows]);

  const hasRegions = comparisonRows.length > 0;
  const scatterPlaceholder = scatterData.length === 0;

  return (
    <div className="relative min-h-screen bg-gray-100 p-6 text-gray-900">
      <button
        onClick={() => navigate("/")}
        className="fixed left-8 bottom-8 w-14 h-14 bg-white rounded-full shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-2 border-gray-200 hover:border-blue-500 z-50"
        aria-label="메인페이지로 돌아가기"
      >
        <ArrowLeft className="w-7 h-7 text-blue-600" />
      </button>

      <main className="max-w-[1440px] mx-auto min-h-[calc(100vh-3rem)] flex flex-col gap-4">
        <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-5 mb-5">
            <div>
              <p className="text-sm font-bold text-blue-600 mb-1">지역 비교</p>
              <h1 className="text-2xl font-black tracking-tight">선택 지역 비교 대시보드</h1>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
              {regions.length}/3 선택
            </span>
          </div>

          {hasRegions ? (
            <div className="grid grid-cols-3 gap-4">
              {comparisonRows.map((row, index) => (
                <div
                  key={`${row.region.provinceId}-${row.region.id}`}
                  className="rounded-xl border bg-gray-50 p-4 shadow-sm"
                  style={{ borderColor: `${REGION_COLORS[index]}55` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold mb-1" style={{ color: REGION_COLORS[index] }}>
                        비교 지역 {index + 1}
                      </p>
                      <h2 className="text-xl font-black truncate">{row.region.name}</h2>
                      <p className="text-sm font-semibold text-gray-500 mt-1">{row.region.provinceName}</p>
                    </div>
                    <div
                      className="w-9 h-9 rounded-full text-white flex items-center justify-center text-sm font-black shrink-0"
                      style={{ background: REGION_COLORS[index] }}
                    >
                      {index + 1}
                    </div>
                  </div>
                </div>
              ))}
              {Array.from({ length: 3 - comparisonRows.length }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 flex items-center justify-center text-sm font-semibold text-gray-400"
                >
                  추가 선택 가능
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <p className="text-sm font-bold text-gray-600">아직 선택된 지역이 없습니다.</p>
              <p className="text-xs text-gray-400 mt-2">
                메인 지도에서 비교 장바구니를 켠 뒤 최대 3개 지역을 선택해 주세요.
              </p>
            </div>
          )}
        </section>

        <section className="grid grid-cols-4 gap-4">
          {comparisonMetricKeys.map((key) => {
            const Icon = metricIcons[key];
            const firstMetric = comparisonRows[0]?.metrics[key];
            return (
              <div key={key} className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-800">{firstMetric?.label || key}</h3>
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="space-y-2">
                  {comparisonRows.length > 0 ? (
                    comparisonRows.map((row, index) => {
                      const metric = row.metrics[key];
                      return (
                        <div key={row.region.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold truncate" style={{ color: REGION_COLORS[index] }}>
                            {row.region.name}
                          </span>
                          <span
                            className={`font-semibold tabular-nums ${
                              metric.value == null ? "text-gray-400" : "text-gray-800"
                            }`}
                          >
                            {formatMetricValue(metric.value, metric.unit)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs font-semibold text-gray-400">비교할 지역을 선택하면 표시됩니다.</p>
                  )}
                </div>
                {key === "accommodationSpending" && (
                  <p className="text-[10px] text-gray-400 font-semibold mt-3">
                    2025년 숙박업 소비지출액 기준
                  </p>
                )}
              </div>
            );
          })}
        </section>

        <section className="grid grid-cols-[0.9fr_1.1fr] gap-4 flex-1 min-h-[360px]">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">정규화 레이더 비교</h3>
              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                0-100 스케일
              </span>
            </div>
            <div className="flex-1 min-h-0">
              {hasRegions ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="72%">
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fontWeight: 700 }} />
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
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "10px", border: "none", fontSize: "11px" }}
                      formatter={(value: number) => [`${value}점`, "정규화 값"]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartMessage text="선택된 지역이 없어 레이더 차트를 표시할 수 없습니다." />
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-bold text-gray-800">변수 선택 산점도</h3>
              <div className="flex items-center gap-2 text-xs">
                <MetricSelect label="X" value={xMetric} onChange={setXMetric} />
                <MetricSelect label="Y" value={yMetric} onChange={setYMetric} />
              </div>
            </div>
            <div className="flex-1 min-h-0 relative">
              {hasRegions && !scatterPlaceholder ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 12, right: 24, bottom: 16, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name={comparisonRows[0].metrics[xMetric].label}
                      tickFormatter={formatAxis}
                      style={{ fontSize: "10px", fill: "#64748b" }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name={comparisonRows[0].metrics[yMetric].label}
                      tickFormatter={formatAxis}
                      style={{ fontSize: "10px", fill: "#64748b" }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3", stroke: "#cbd5e1" }}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                        fontSize: "11px",
                      }}
                      formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                    />
                    {scatterData.map((point) => (
                      <Scatter key={point.name} name={point.name} data={[point]} fill={point.color} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: "11px", fontWeight: 700 }} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartMessage
                  text={
                    hasRegions
                      ? "선택한 변수 중 연결되지 않은 데이터가 있어 산점도를 표시할 수 없습니다."
                      : "비교할 지역을 선택하면 산점도를 표시합니다."
                  }
                />
              )}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 h-[300px] flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">월별 외국인 방문 추이</h3>
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">
              2023-2025
            </span>
          </div>
          <div className="flex-1 min-h-0">
            {monthlyLineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyLineData} margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} minTickGap={20} />
                  <YAxis tickFormatter={formatAxis} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "none", fontSize: "11px" }}
                    formatter={(value: number) => [`${value.toLocaleString()}명`, "방문자 수"]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                  {comparisonRows.map((row, index) => (
                    <Line
                      key={row.region.id}
                      type="monotone"
                      dataKey={`region${index}`}
                      name={row.region.name}
                      stroke={REGION_COLORS[index]}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartMessage text="2023-2025 월별 방문자 데이터가 연결되면 표시됩니다." />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MetricKey;
  onChange: (value: MetricKey) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 font-bold text-gray-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as MetricKey)}
        className="h-8 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs font-bold text-gray-800 outline-none focus:border-blue-500"
      >
        {scatterOptions.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyChartMessage({ text }: { text: string }) {
  return (
    <div className="h-full min-h-[180px] rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-sm font-semibold text-gray-400 text-center px-6">
      {text}
    </div>
  );
}
