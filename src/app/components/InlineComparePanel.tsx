import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildComparisonRows,
  getNationwideRadarScore,
  getPeerRadarScore,
  getPeerScope,
  getPeerScopeLabel,
  radarMetricKeys,
  type CompareRegion,
} from "../data/comparisonData";
import { getDistrictNationalities } from "../data/nationality";
import { provinceIdToCsvName } from "../data/visitorData";

const REGION_COLORS = ["#0f766e", "#facc15", "#111827"];

// 국적별 색상 (국가 식별용 카테고리 팔레트, 미등록 국가는 회색 폴백)
const COUNTRY_COLORS: Record<string, string> = {
  중국: "#E63946",
  일본: "#F4A261",
  미국: "#2A6FDB",
  대만: "#2A9D8F",
  홍콩: "#9B5DE5",
  베트남: "#06D6A0",
  태국: "#EF476F",
  몽골: "#FFC300",
  싱가포르: "#118AB2",
  필리핀: "#00BBF9",
  말레이시아: "#8AB17D",
  인도네시아: "#FB8500",
  러시아: "#7209B7",
  영국: "#3A0CA3",
  프랑스: "#4361EE",
  독일: "#495057",
  캐나다: "#D62828",
  호주: "#4CC9F0",
  인도: "#E85D04",
};
const FALLBACK_COUNTRY_COLOR = "#94A3B8";
const countryColor = (name: string) => COUNTRY_COLORS[name] || FALLBACK_COUNTRY_COLOR;
const VISITORS_PER_FLOW_UNIT = 1000;
const FLOW_VIEWBOX = { width: 760, height: 260 };

const getFlowDuration = (unitIndex: number, countryIndex: number) =>
  (4.2 + (unitIndex % 6) * 0.28 + countryIndex * 0.22) / 0.4;

const getFlowBegin = (unitIndex: number, countryIndex: number, regionIndex: number) =>
  countryIndex * 0.42 + regionIndex * 0.3 + unitIndex * 0.24;

function getFlowArrivalTime(unitIndex: number, countryIndex: number, regionIndex: number) {
  return getFlowBegin(unitIndex, countryIndex, regionIndex) + getFlowDuration(unitIndex, countryIndex);
}

type NationalityFlowRegion = {
  region: CompareRegion;
  regionIndex: number;
  count: number;
  units: number;
};

type NationalityFlowCountry = {
  country: string;
  total: number;
  units: number;
  flows: NationalityFlowRegion[];
};

function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${(value / 10_000).toFixed(1)}만`;
  return Math.round(value).toLocaleString();
}

function renderAngleAxisTick(props: {
  x: number;
  y: number;
  payload: { value: string };
  textAnchor?: string;
}) {
  const { x, y, payload, textAnchor } = props;
  let dy = 0;
  if (payload.value === "방문자") dy = -8;
  else if (payload.value === "성장세" || payload.value === "블루오션도") dy = 8;
  return (
    <text x={x} y={y + dy} textAnchor={textAnchor} fontSize={10} fontWeight={700} fill="#374151">
      {payload.value}
    </text>
  );
}

function AnimatedFlowCount({
  count,
  units,
  countryIndex,
  regionIndex,
  x,
  y,
  color,
}: {
  count: number;
  units: number;
  countryIndex: number;
  regionIndex: number;
  x: number;
  y: number;
  color: string;
}) {
  const [displayCount, setDisplayCount] = useState(0);

  useEffect(() => {
    setDisplayCount(0);
    if (count <= 0 || units <= 0) return;

    const startedAt = performance.now();
    const intervalId = window.setInterval(() => {
      const elapsedSeconds = (performance.now() - startedAt) / 1000;
      let arrivedUnits = 0;

      for (let unitIndex = 0; unitIndex < units; unitIndex += 1) {
        if (getFlowArrivalTime(unitIndex, countryIndex, regionIndex) <= elapsedSeconds) {
          arrivedUnits += 1;
        }
      }

      const nextCount =
        arrivedUnits >= units ? count : Math.min(count, arrivedUnits * VISITORS_PER_FLOW_UNIT);
      setDisplayCount(nextCount);

      if (arrivedUnits >= units) {
        window.clearInterval(intervalId);
      }
    }, 120);

    return () => window.clearInterval(intervalId);
  }, [count, units, countryIndex, regionIndex]);

  return (
    <text x={x} y={y} fontSize="12" fontWeight="900" fill={color} textAnchor="middle">
      {compactNumber(displayCount)}
    </text>
  );
}

type InlineComparePanelProps = {
  regions: CompareRegion[];
  weightMap: Record<string, number>;
  onClose: () => void;
};

export function InlineComparePanel({ regions, onClose }: InlineComparePanelProps) {
  const comparisonRows = useMemo(() => buildComparisonRows(regions), [regions]);
  const peerScope = useMemo(() => getPeerScope(regions), [regions]);

  const nationwideRadarData = useMemo(
    () =>
      radarMetricKeys.map((key) => ({
        metric: comparisonRows[0]?.metrics[key].shortLabel || key,
        ...Object.fromEntries(
          comparisonRows.map((row, index) => [
            `region${index}`,
            getNationwideRadarScore(key, row.metrics[key].value),
          ]),
        ),
      })),
    [comparisonRows],
  );

  const peerRadarData = useMemo(() => {
    if (!peerScope) return [];
    return radarMetricKeys.map((key) => ({
      metric: comparisonRows[0]?.metrics[key].shortLabel || key,
      ...Object.fromEntries(
        comparisonRows.map((row, index) => [
          `region${index}`,
          getPeerRadarScore(key, row.metrics[key].value, peerScope),
        ]),
      ),
    }));
  }, [comparisonRows, peerScope]);

  const visitorTrendData = useMemo(() => {
    const months = [
      ...new Set(comparisonRows.flatMap((row) => row.monthlyVisitors.map((item) => item.month))),
    ].sort();

    return months.map((month) => {
      const point: Record<string, string | number | null> = {
        month,
        monthLabel: month.replace("-", "."),
      };

      comparisonRows.forEach((row, index) => {
        point[`region${index}`] =
          row.monthlyVisitors.find((item) => item.month === month)?.visitors ?? null;
      });

      return point;
    });
  }, [comparisonRows]);

  const hasVisitorTrendData = visitorTrendData.some((point) =>
    comparisonRows.some((_, index) => typeof point[`region${index}`] === "number"),
  );

  const { natCountries, natRegions, nationalityFlows, regionNationalityTotals } = useMemo(() => {
    const perRegion = comparisonRows.map((row) => {
      const csvProvince =
        provinceIdToCsvName[row.region.provinceId] || row.region.provinceName;
      const map = new Map<string, number>();
      for (const item of getDistrictNationalities(csvProvince, row.region.name, 40)) {
        if (item.country === "기타") continue;
        map.set(item.country, item.percentage);
      }
      const visitors2025 = row.monthlyVisitors.filter((item) => item.month.startsWith("2025-"));
      const visitorCount =
        visitors2025.reduce((sum, item) => sum + item.visitors, 0) /
        Math.max(visitors2025.length, 1);
      return {
        region: row.region,
        visitors: visitorCount,
        map,
      };
    });

    const totals = new Map<string, number>();
    for (const { map, visitors } of perRegion) {
      for (const [country, pct] of map) {
        totals.set(country, (totals.get(country) || 0) + visitors * (pct / 100));
      }
    }
    const natCountries = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([country]) => country);

    const countryTotals = natCountries.map((country) => ({
      country,
      total: totals.get(country) || 0,
    }));

    const nationalityFlows: NationalityFlowCountry[] = countryTotals.map(({ country, total }) => {
      const flows = perRegion
        .map(({ region, visitors, map }, regionIndex) => {
          const count = visitors * ((map.get(country) ?? 0) / 100);
          return {
            region,
            regionIndex,
            count,
            units: Math.ceil(count / VISITORS_PER_FLOW_UNIT),
          };
        })
        .filter((flow) => flow.count > 0 && flow.units > 0);

      return {
        country,
        total,
        units: flows.reduce((sum, flow) => sum + flow.units, 0),
        flows,
      };
    });

    const regionNationalityTotals = perRegion.map(({ visitors, map }) =>
      natCountries.reduce((sum, country) => sum + visitors * ((map.get(country) ?? 0) / 100), 0),
    );

    return {
      natCountries,
      natRegions: perRegion.map((p) => p.region),
      nationalityFlows,
      regionNationalityTotals,
    };
  }, [comparisonRows]);

  return (
    <div className="h-full w-full bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-sm font-black text-gray-800 shrink-0">지역 비교 분석</h3>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-bold">
            {comparisonRows.map((row, index) => (
              <span key={`${row.region.provinceId}-${row.region.id}`} className="flex items-center gap-1">
                {index > 0 && <span className="text-gray-300">vs</span>}
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: REGION_COLORS[index] }} />
                <span style={{ color: REGION_COLORS[index] }}>{row.region.name}</span>
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="비교 패널 닫기"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 상단: 레이더 (전국 대비 / 권역 내) */}
      <div className="flex-[0.95] min-h-0 grid grid-cols-2 gap-2 px-4 pt-3 pb-2 border-b border-gray-100">
        <div className="flex flex-col min-h-0">
          <p className="text-[11px] font-bold text-gray-500 mb-0.5 px-1">전국 대비</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={nationwideRadarData} outerRadius="60%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="metric" tick={renderAngleAxisTick} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                {comparisonRows.map((row, index) => (
                  <Radar
                    key={`${row.region.provinceId}-${row.region.id}`}
                    dataKey={`region${index}`}
                    name={row.region.name}
                    stroke={REGION_COLORS[index]}
                    fill={REGION_COLORS[index]}
                    fillOpacity={0.18}
                    strokeWidth={2}
                    animationBegin={0}
                    animationDuration={800}
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
          <p className="text-[11px] font-bold text-gray-500 mb-0.5 px-1">{getPeerScopeLabel(peerScope)}</p>
          <div className="flex-1 min-h-0">
            {peerScope ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={peerRadarData} outerRadius="60%">
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="metric" tick={renderAngleAxisTick} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                  {comparisonRows.map((row, index) => (
                    <Radar
                      key={`${row.region.provinceId}-${row.region.id}`}
                      dataKey={`region${index}`}
                      name={row.region.name}
                      stroke={REGION_COLORS[index]}
                      fill={REGION_COLORS[index]}
                      fillOpacity={0.18}
                      strokeWidth={2}
                      animationBegin={0}
                      animationDuration={800}
                    />
                  ))}
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "none", fontSize: "11px" }}
                    formatter={(value: number, name: string) => [`${value}점`, name]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full min-h-[110px] rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[11px] font-bold text-gray-400 text-center leading-5 px-4">
                서로 다른 권역이라
                <br />
                권역 내 비교를 표시할 수 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 중단: 방문자 수 라인차트 */}
      <div className="flex-[0.78] min-h-0 flex flex-col px-4 pt-2.5 pb-1.5 border-b border-gray-100">
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-[12px] font-bold text-gray-700">시간대별 방문자수</p>
          <span className="text-[10px] font-semibold text-gray-400">
            현재 연결 데이터: 2023-2025 월별 방문자 수
          </span>
        </div>
        <div className="flex-1 min-h-0">
          {hasVisitorTrendData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visitorTrendData} margin={{ top: 6, right: 14, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                  interval={5}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => compactNumber(value)}
                />
                <Tooltip
                  contentStyle={{ borderRadius: "10px", border: "none", fontSize: "11px" }}
                  labelFormatter={(label) => `${label}`}
                  formatter={(value: number | string, name: string) => [
                    typeof value === "number" ? `${compactNumber(value)}명` : value,
                    name,
                  ]}
                />
                {comparisonRows.map((row, index) => (
                  <Line
                    key={`${row.region.provinceId}-${row.region.id}`}
                    type="monotone"
                    dataKey={`region${index}`}
                    name={row.region.name}
                    stroke={REGION_COLORS[index]}
                    strokeWidth={2.4}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[11px] font-bold text-gray-400">
              방문자 수 흐름 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 하단: 외국인 국적 구성 - top3 국적에서 선택 지역으로 흐르는 유닛 플로우 */}
      <div className="flex-[1.85] min-h-0 flex flex-col px-4 pt-2.5 pb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-[13px] font-bold text-gray-700">외국인 국적 구성 비교</p>
            <span className="text-[10px] font-semibold text-gray-400">
              왼쪽: 선택 지역 전체 top3 국적 · 오른쪽: 장바구니 지역 · 유닛 1개 = 2025년 1천명
            </span>
          </div>
          <span className="shrink-0 rounded-md bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-500">
            unit flow
          </span>
        </div>
        {natCountries.length > 0 ? (
          <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50/60">
            <svg
              className="h-full w-full"
              viewBox={`0 0 ${FLOW_VIEWBOX.width} ${FLOW_VIEWBOX.height}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Top3 국적 관광객이 선택 지역으로 흐르는 유닛 플로우 차트"
            >
              <defs>
                <filter id="flowSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodColor="#111827" floodOpacity="0.16" />
                </filter>
              </defs>

              <rect x="0" y="0" width={FLOW_VIEWBOX.width} height={FLOW_VIEWBOX.height} fill="#f9fafb" />
              <g opacity="0.58">
                {[80, 160, 240].map((x) => (
                  <line key={`grid-x-${x}`} x1={x + 120} y1="18" x2={x + 120} y2="242" stroke="#e5e7eb" strokeWidth="1" />
                ))}
              </g>

              {nationalityFlows.map((countryFlow, countryIndex) => {
                const countryY = 48 + countryIndex * 78;
                return (
                  <g key={`source-${countryFlow.country}`}>
                    <rect x="18" y={countryY - 21} width="98" height="42" rx="6" fill="#ffffff" stroke="#e5e7eb" />
                    <rect x="24" y={countryY - 8} width="12" height="12" rx="2" fill={countryColor(countryFlow.country)} />
                    <text x="40" y={countryY - 3} fontSize="12" fontWeight="800" fill="#374151">
                      {countryFlow.country}
                    </text>
                    <text x="40" y={countryY + 12} fontSize="9" fontWeight="700" fill="#9ca3af">
                      {compactNumber(countryFlow.total)}명
                    </text>
                  </g>
                );
              })}

              {nationalityFlows.map((countryFlow, countryIndex) => (
                <g key={`count-header-${countryFlow.country}`}>
                  <text
                    x={616 + countryIndex * 48}
                    y="23"
                    fontSize="9"
                    fontWeight="900"
                    fill="#4b5563"
                    textAnchor="middle"
                  >
                    {countryFlow.country}
                  </text>
                </g>
              ))}

              {natRegions.map((region, regionIndex) => {
                const regionY = 48 + regionIndex * 78;
                const countryCounts = nationalityFlows.map((countryFlow) => {
                  const flow = countryFlow.flows.find((item) => item.regionIndex === regionIndex);
                  return {
                    country: countryFlow.country,
                    color: countryColor(countryFlow.country),
                    count: flow?.count ?? 0,
                    units: flow?.units ?? 0,
                  };
                });
                return (
                  <g key={`target-${region.provinceId}-${region.id}`}>
                    <rect x="500" y={regionY - 23} width="86" height="46" rx="6" fill="#ffffff" stroke="#e5e7eb" />
                    <rect x="506" y={regionY - 11} width="4" height="22" rx="2" fill={REGION_COLORS[regionIndex % REGION_COLORS.length]} />
                    <text x="516" y={regionY - 4} fontSize="11" fontWeight="900" fill="#374151">
                      {region.name}
                    </text>
                    <text x="516" y={regionY + 12} fontSize="9" fontWeight="700" fill="#9ca3af">
                      {compactNumber(regionNationalityTotals[regionIndex] || 0)}명
                    </text>
                    {countryCounts.map((item, countryIndex) => (
                      <AnimatedFlowCount
                        key={`${region.id}-${item.country}`}
                        count={item.count}
                        units={item.units}
                        countryIndex={countryIndex}
                        regionIndex={regionIndex}
                        x={616 + countryIndex * 48}
                        y={regionY + 5}
                        color={item.color}
                      />
                    ))}
                  </g>
                );
              })}

              {nationalityFlows.flatMap((countryFlow, countryIndex) =>
                countryFlow.flows.map((flow) => {
                  const countryY = 48 + countryIndex * 78;
                  const regionY = 48 + flow.regionIndex * 78;
                  const pathId = `nat-flow-${countryIndex}-${flow.regionIndex}`;
                  const color = countryColor(countryFlow.country);
                  const thickness = Math.max(2, Math.min(13, 2 + flow.units * 0.28));

                  return (
                    <g key={pathId}>
                      <path
                        id={pathId}
                        d={`M 118 ${countryY} C 220 ${countryY}, 388 ${regionY}, 498 ${regionY}`}
                        fill="none"
                        stroke={color}
                        strokeOpacity="0.22"
                        strokeWidth={thickness}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                }),
              )}

              {nationalityFlows.flatMap((countryFlow, countryIndex) =>
                countryFlow.flows.flatMap((flow) => {
                  const color = countryColor(countryFlow.country);
                  const pathId = `nat-flow-${countryIndex}-${flow.regionIndex}`;
                  return Array.from({ length: flow.units }).map((_, unitIndex) => {
                    const lane = (unitIndex % 7) - 3;
                    const size = unitIndex % 5 === 0 ? 5.2 : 4.4;
                    const duration = getFlowDuration(unitIndex, countryIndex);
                    const begin = getFlowBegin(unitIndex, countryIndex, flow.regionIndex);
                    return (
                      <rect
                        key={`${pathId}-unit-${unitIndex}`}
                        x={-size / 2}
                        y={lane - size / 2}
                        width={size}
                        height={size}
                        rx="1.1"
                        fill={color}
                        filter="url(#flowSoftShadow)"
                        opacity="0"
                      >
                        <animate
                          attributeName="opacity"
                          values="0;0.92;0.92;0"
                          keyTimes="0;0.04;0.96;1"
                          dur={`${duration}s`}
                          begin={`${begin}s`}
                          fill="freeze"
                        />
                        <animateMotion dur={`${duration}s`} begin={`${begin}s`} repeatCount="1" rotate="0" fill="freeze">
                          <mpath href={`#${pathId}`} />
                        </animateMotion>
                      </rect>
                    );
                  });
                }),
              )}

            </svg>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center text-[11px] font-semibold text-gray-300">
            국적 데이터가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
