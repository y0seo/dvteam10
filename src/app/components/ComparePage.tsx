import { useEffect, useMemo, useState, type ComponentType } from "react";
import { ArrowDownWideNarrow, CircleDollarSign, Hotel, MapPinned, UsersRound } from "lucide-react";
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
  getNationwidePercentile,
  getPeerPercentile,
  getPeerScope,
  getPeerScopeLabel,
  type MetricKey,
} from "../data/comparisonData";

const REGION_COLORS = ["#2563eb", "#10b981", "#f97316"];

type ComparePageProps = {
  regionsOverride?: CompareRegion[];
  embedded?: boolean;
  onClose?: () => void;
};

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

const metricFallbackLabels = Object.fromEntries(
  scatterOptions.map((option) => [option.key, option.label]),
) as Record<MetricKey, string>;

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

export function ComparePage({ regionsOverride, embedded = false, onClose }: ComparePageProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const regions = (regionsOverride || (location.state as { regions?: CompareRegion[] } | null)?.regions || []).slice(0, 3);
  const shouldSlideIn = Boolean((location.state as { slideIn?: boolean } | null)?.slideIn);
  const [isVisible, setIsVisible] = useState(embedded || !shouldSlideIn);
  const [isExiting, setIsExiting] = useState(false);
  const [xMetric, setXMetric] = useState<MetricKey>("landPrice");
  const [yMetric, setYMetric] = useState<MetricKey>("accommodationBusinesses");
  const [sortMetrics, setSortMetrics] = useState<Partial<Record<MetricKey, boolean>>>({});

  useEffect(() => {
    if (embedded || !shouldSlideIn) return;
    const frame = window.requestAnimationFrame(() => setIsVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [embedded, shouldSlideIn]);

  const comparisonRows = useMemo(() => buildComparisonRows(regions), [regions]);

  const peerScope = useMemo(() => getPeerScope(regions), [regions]);

  const nationwideRadarData = useMemo(
    () =>
      comparisonMetricKeys.map((key) => {
        const row: Record<string, number | string> = {
          metric: comparisonRows[0]?.metrics[key].shortLabel || key,
        };
        comparisonRows.forEach((item, index) => {
          row[`region${index}`] = getNationwidePercentile(key, item.metrics[key].value);
        });
        return row;
      }),
    [comparisonRows],
  );

  const peerRadarData = useMemo(() => {
    if (!peerScope) return [];
    return comparisonMetricKeys.map((key) => {
      const row: Record<string, number | string> = {
        metric: comparisonRows[0]?.metrics[key].shortLabel || key,
      };
      comparisonRows.forEach((item, index) => {
        row[`region${index}`] = getPeerPercentile(key, item.metrics[key].value, peerScope);
      });
      return row;
    });
  }, [comparisonRows, peerScope]);

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
  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }

    setIsExiting(true);
    window.setTimeout(() => navigate("/"), 520);
  };

  return (
    <div
      className={`relative min-h-screen bg-gray-100 p-6 text-gray-900 ${
        embedded
          ? "min-h-full"
          : `transition-transform duration-500 ease-out ${
              isExiting ? "translate-x-full" : isVisible ? "translate-x-0" : "translate-x-full"
            }`
      }`}
    >
      <button
        onClick={handleClose}
        className="fixed left-0 top-1/2 -translate-y-1/2 group h-16 w-7 bg-white/95 shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-y border-r border-gray-200 hover:border-blue-500 z-50"
        aria-label="메인페이지로 돌아가기"
      >
        <span className="w-0 h-0 border-y-[9px] border-y-transparent border-l-[13px] border-l-blue-600 transition-transform group-hover:translate-x-0.5" />
      </button>

      <main className="max-w-[1440px] mx-auto min-h-[calc(100vh-3rem)] flex flex-col gap-4">
        <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
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
            const isSortedDescending = Boolean(sortMetrics[key]);
            const metricRows = isSortedDescending
              ? [...comparisonRows].sort((a, b) => {
                  const valueA = a.metrics[key].value ?? Number.NEGATIVE_INFINITY;
                  const valueB = b.metrics[key].value ?? Number.NEGATIVE_INFINITY;
                  return valueB - valueA;
                })
              : comparisonRows;

            return (
              <div key={key} className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-sm font-bold text-gray-800">
                    {firstMetric?.label || metricFallbackLabels[key]}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setSortMetrics((prev) => ({
                          ...prev,
                          [key]: !prev[key],
                        }))
                      }
                      className={`h-7 px-2 rounded-lg border text-[10px] font-bold transition-colors flex items-center gap-1 ${
                        isSortedDescending
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600"
                      }`}
                      aria-pressed={isSortedDescending}
                      title={isSortedDescending ? "정렬 해제" : "내림차순 정렬"}
                    >
                      <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                      내림차순
                    </button>
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="space-y-2">
                  {comparisonRows.length > 0 ? (
                    metricRows.map((row) => {
                      const metric = row.metrics[key];
                      const colorIndex = comparisonRows.findIndex(
                        (item) => item.region.id === row.region.id && item.region.provinceId === row.region.provinceId,
                      );
                      const regionColor = REGION_COLORS[Math.max(colorIndex, 0)];
                      return (
                        <div key={row.region.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold truncate" style={{ color: regionColor }}>
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

        <section className="grid grid-cols-[1.5fr_0.8fr] gap-4 min-h-[360px]">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <h3 className="text-sm font-bold text-gray-800 shrink-0">정규화 레이더 비교</h3>
                {hasRegions && (
                  <div className="flex items-center gap-3 shrink-0">
                    {comparisonRows.map((row, index) => (
                      <div key={row.region.id} className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{ background: REGION_COLORS[index] }}
                        />
                        <span
                          className="text-[11px] font-bold"
                          style={{ color: REGION_COLORS[index] }}
                        >
                          {row.region.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded shrink-0">
                Percentile rank
              </span>
            </div>
            <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">
              <div className="flex flex-col min-h-0">
                <p className="text-[11px] font-bold text-gray-500 mb-1">전국 대비</p>
                <div className="flex-1 min-h-0">
                  {hasRegions ? (
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
                  ) : (
                    <EmptyChartMessage text="선택된 지역이 없어 레이더 차트를 표시할 수 없습니다." />
                  )}
                </div>
              </div>
              <div className="flex flex-col min-h-0">
                <p className="text-[11px] font-bold text-gray-500 mb-1">{getPeerScopeLabel(peerScope)}</p>
                <div className="flex-1 min-h-0">
                  {hasRegions && peerScope ? (
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
                    <EmptyChartMessage
                      text={
                        hasRegions
                          ? "선택된 지역들이 서로 다른 권역에 있어 권역 내 비교를 표시할 수 없습니다."
                          : "선택된 지역이 없어 레이더 차트를 표시할 수 없습니다."
                      }
                    />
                  )}
                </div>
              </div>
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
                      <Scatter
                        key={point.name}
                        name={point.name}
                        data={[point]}
                        fill={point.color}
                        shape={(props) => <ScatterMetricShape {...props} metricKey={yMetric} />}
                      />
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

type ScatterMetricShapeProps = {
  cx?: number;
  cy?: number;
  fill?: string;
  payload?: { color?: string };
  metricKey: MetricKey;
};

function ScatterMetricShape({ cx = 0, cy = 0, fill = "#2563eb", payload, metricKey }: ScatterMetricShapeProps) {
  const color = payload?.color || fill;
  const strokeColor = "#ffffff";

  if (metricKey === "foreignVisitors") {
    return (
      <g transform={`translate(${cx - 12}, ${cy - 12})`}>
        <circle cx="8" cy="8" r="4.2" fill={color} stroke={strokeColor} strokeWidth="1.7" />
        <circle cx="16" cy="8" r="4.2" fill={color} stroke={strokeColor} strokeWidth="1.7" opacity="0.85" />
        <path
          d="M3.5 20c.8-4 3.1-6.2 6.5-6.2s5.7 2.2 6.5 6.2"
          fill={color}
          stroke={strokeColor}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M10.5 20c.7-3.5 2.8-5.5 5.7-5.5 2.7 0 4.5 1.8 5.3 5.5"
          fill={color}
          stroke={strokeColor}
          strokeWidth="1.7"
          strokeLinejoin="round"
          opacity="0.85"
        />
      </g>
    );
  }

  if (metricKey === "accommodationSpending") {
    return (
      <g transform={`translate(${cx - 12}, ${cy - 12})`}>
        <circle cx="12" cy="12" r="10" fill={color} stroke={strokeColor} strokeWidth="2" />
        <path
          d="M12 5.5v13M8.3 9c.5-1.3 1.8-2.1 3.6-2.1 2 0 3.4.9 3.4 2.4 0 1.7-1.7 2.2-3.5 2.7-1.9.5-3.6 1.1-3.6 2.9 0 1.6 1.5 2.6 3.7 2.6 2 0 3.5-.8 4-2.2"
          fill="none"
          stroke={strokeColor}
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </g>
    );
  }

  if (metricKey === "landPrice") {
    return (
      <g transform={`translate(${cx - 12}, ${cy - 14})`}>
        <path
          d="M12 27S4 17.4 4 10.7C4 5.8 7.6 2 12 2s8 3.8 8 8.7C20 17.4 12 27 12 27Z"
          fill={color}
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="10.5" r="3.2" fill={strokeColor} />
      </g>
    );
  }

  return (
    <g transform={`translate(${cx - 12}, ${cy - 12})`}>
      <path
        d="M5 21V8.2L12 3l7 5.2V21H5Z"
        fill={color}
        stroke={strokeColor}
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M9 21v-6h6v6M8 10h2.5M13.5 10H16M8 13h2.5M13.5 13H16" stroke={strokeColor} strokeLinecap="round" strokeWidth="1.7" />
    </g>
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
