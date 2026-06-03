import { useMemo, useState } from "react";
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

const REGION_COLORS = ["#2563eb", "#10b981", "#f97316"];

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

type InlineComparePanelProps = {
  regions: CompareRegion[];
  weightMap: Record<string, number>;
  onClose: () => void;
};

export function InlineComparePanel({ regions, onClose }: InlineComparePanelProps) {
  const [isNationalitySplit, setIsNationalitySplit] = useState(false);
  const [selectedNationality, setSelectedNationality] = useState<string | null>(null);
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

  const { natCountries, natRegions, nationalityBars, maxNationalityUnits } = useMemo(() => {
    const perRegion = comparisonRows.map((row) => {
      const csvProvince =
        provinceIdToCsvName[row.region.provinceId] || row.region.provinceName;
      const map = new Map<string, number>();
      for (const item of getDistrictNationalities(csvProvince, row.region.name, 40)) {
        if (item.country === "기타") continue;
        map.set(item.country, item.percentage);
      }
      const visitorCount = row.monthlyVisitors
        .filter((item) => item.month.startsWith("2025-"))
        .reduce((sum, item) => sum + item.visitors, 0);
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

    const nationalityBars = perRegion.map(({ region, visitors, map }) => {
      const countries = natCountries.map((country) => {
        const percentage = map.get(country) ?? 0;
        const count = visitors * (percentage / 100);
        return {
          country,
          percentage,
          count,
          units: Math.round(count / 1000),
        };
      });

      return {
        region,
        totalUnits: countries.reduce((sum, item) => sum + item.units, 0),
        countries,
      };
    });

    const maxNationalityUnits = Math.max(...nationalityBars.map((bar) => bar.totalUnits), 1);

    return {
      natCountries,
      natRegions: perRegion.map((p) => p.region),
      nationalityBars,
      maxNationalityUnits,
    };
  }, [comparisonRows]);

  const visibleNatCountries = selectedNationality
    ? natCountries.filter((country) => country === selectedNationality)
    : natCountries;

  const maxVisibleNationalityUnits = Math.max(
    ...nationalityBars.map((bar) =>
      bar.countries
        .filter((item) => visibleNatCountries.includes(item.country))
        .reduce((sum, item) => sum + item.units, 0),
    ),
    1,
  );

  const unitSizePx =
    maxVisibleNationalityUnits > 900 ? 3 : maxVisibleNationalityUnits > 450 ? 4 : 5;

  const unitGridStyle = {
    gridTemplateColumns: `repeat(25, ${unitSizePx}px)`,
    gridAutoRows: `${unitSizePx}px`,
  };

  const renderNationalityUnitRows = (
    segments: { units: number; color: string; keyPrefix: string }[],
  ) => {
    const units = segments.flatMap((segment) =>
      Array.from({ length: segment.units }).map((_, index) => ({
        key: `${segment.keyPrefix}-${index}`,
        color: segment.color,
      })),
    );
    const rows = Array.from({ length: Math.ceil(units.length / 25) }, (_, rowIndex) =>
      units.slice(rowIndex * 25, rowIndex * 25 + 25),
    );

    return (
      <div className="flex flex-col-reverse items-center gap-[1px]">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="grid justify-center gap-[1px]"
            style={unitGridStyle}
          >
            {row.map((unit) => (
              <span
                key={unit.key}
                className="rounded-[1px]"
                style={{
                  width: unitSizePx,
                  height: unitSizePx,
                  background: unit.color,
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.28)",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

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

      {/* 하단: 외국인 국적 구성 — 지역별 top3 국적 유닛 스택바 */}
      <div className="flex-[1.85] min-h-0 flex flex-col px-4 pt-2.5 pb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-[13px] font-bold text-gray-700">외국인 국적 구성 비교</p>
            <span className="text-[10px] font-semibold text-gray-400">
              x축: 지역 · y축: 2025년 관광객 수 · 유닛 1개 = 1천명
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsNationalitySplit((value) => !value)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black transition-colors ${
              isNationalitySplit
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {isNationalitySplit ? "스택 보기" : "국적별 분리"}
          </button>
        </div>
        {natCountries.length > 0 ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {natCountries.map((country) => (
                <button
                  key={country}
                  type="button"
                  onClick={() =>
                    setSelectedNationality((current) => (current === country ? null : country))
                  }
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-black transition-colors ${
                    selectedNationality === country
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span className="w-2 h-2 rounded-sm" style={{ background: countryColor(country) }} />
                  {country}
                </button>
              ))}
              {selectedNationality && (
                <button
                  type="button"
                  onClick={() => setSelectedNationality(null)}
                  className="rounded-md px-2 py-1 text-[10px] font-black text-gray-400 hover:bg-gray-100"
                >
                  전체
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-[36px_repeat(3,minmax(0,1fr))] gap-2 pt-2 pb-1">
              <div className="relative h-full border-r border-gray-200">
                {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                  <span
                    key={ratio}
                    className="absolute right-1 text-[9px] font-bold text-gray-300 tabular-nums"
                    style={{
                      ...(ratio === 1
                        ? { top: 0 }
                        : ratio === 0
                          ? { bottom: 0 }
                          : { bottom: `${ratio * 100}%`, transform: "translateY(50%)" }),
                    }}
                  >
                    {Math.round((maxVisibleNationalityUnits * ratio) || maxNationalityUnits * ratio)}
                  </span>
                ))}
              </div>

              {nationalityBars.map((bar, regionIndex) => {
                const visibleItems = bar.countries.filter((item) =>
                  visibleNatCountries.includes(item.country),
                );
                const visibleTotalUnits = visibleItems.reduce((sum, item) => sum + item.units, 0);
                const stackedHeight = `${Math.max(
                  3,
                  (visibleTotalUnits / maxVisibleNationalityUnits) * 100,
                )}%`;

                return (
                  <div
                    key={`${bar.region.provinceId}-${bar.region.id}`}
                    className="min-w-0 flex flex-col items-center justify-end gap-1"
                  >
                    <div className="flex-1 min-h-0 w-full flex items-end justify-center gap-1.5 px-1">
                      {isNationalitySplit ? (
                        visibleItems.map((item) => {
                          const splitHeight = `${Math.max(
                            3,
                            (item.units / maxVisibleNationalityUnits) * 100,
                          )}%`;
                          return (
                            <div
                              key={item.country}
                              className="h-full min-w-0 flex flex-col items-center justify-end gap-0.5"
                            >
                              <div
                                className="w-32 max-w-full overflow-hidden flex items-end justify-center p-[2px]"
                                style={{ height: splitHeight }}
                                title={`${bar.region.name} ${item.country}: ${compactNumber(item.count)}명`}
                              >
                                {renderNationalityUnitRows([
                                  {
                                    units: item.units,
                                    color: countryColor(item.country),
                                    keyPrefix: `${bar.region.id}-${item.country}`,
                                  },
                                ])}
                              </div>
                              <span className="text-[8px] font-black text-gray-400 truncate max-w-[36px]">
                                {item.country}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div
                          className="w-36 max-w-full overflow-hidden flex items-end justify-center p-[2px]"
                          style={{ height: stackedHeight }}
                          title={`${bar.region.name}: ${visibleTotalUnits.toLocaleString()}천명`}
                        >
                          {renderNationalityUnitRows(
                            visibleItems.map((item) => ({
                              units: item.units,
                              color: countryColor(item.country),
                              keyPrefix: `${bar.region.id}-${item.country}`,
                            })),
                          )}
                        </div>
                      )}
                    </div>
                    <div className="w-full text-center">
                      <p
                        className="text-[11px] font-black truncate"
                        style={{ color: REGION_COLORS[regionIndex] }}
                      >
                        {natRegions[regionIndex]?.name || bar.region.name}
                      </p>
                      <p className="text-[9px] font-bold text-gray-400 tabular-nums">
                        {visibleTotalUnits.toLocaleString()}천명
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
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
