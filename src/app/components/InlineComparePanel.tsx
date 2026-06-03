import { Fragment, useMemo } from "react";
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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 흰색 배경 위에 alpha로 합성한 셀 색의 휘도로 글자색(흰/검) 결정
function cellTextColor(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  const cr = r * alpha + 255 * (1 - alpha);
  const cg = g * alpha + 255 * (1 - alpha);
  const cb = b * alpha + 255 * (1 - alpha);
  const luminance = (0.299 * cr + 0.587 * cg + 0.114 * cb) / 255;
  return luminance > 0.62 ? "#1f2937" : "#ffffff";
}

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

  // ── 국적 비교: 전체 합산 상위 4개국(행) × 3지역(열) 히트맵 ──────────────────
  // 국적별로 어느 지역에 많이 왔는지 가로로 바로 비교 가능하도록 국가를 행으로 고정
  const { natCountries, natRegions, natShares, nationalityMax } = useMemo(() => {
    const perRegion = comparisonRows.map((row) => {
      const csvProvince =
        provinceIdToCsvName[row.region.provinceId] || row.region.provinceName;
      const map = new Map<string, number>();
      for (const item of getDistrictNationalities(csvProvince, row.region.name, 40)) {
        if (item.country === "기타") continue;
        map.set(item.country, item.percentage);
      }
      return { region: row.region, map };
    });

    // 세 지역 비율 합산 기준 상위 4개국 (지역 공통 국가 집합)
    const totals = new Map<string, number>();
    for (const { map } of perRegion) {
      for (const [country, pct] of map) {
        totals.set(country, (totals.get(country) || 0) + pct);
      }
    }
    const natCountries = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([country]) => country);

    // natShares[국가][지역] = 비율(%) (해당 지역 데이터 없으면 0)
    const natShares = natCountries.map((country) =>
      perRegion.map(({ map }) => map.get(country) ?? 0),
    );
    const nationalityMax = Math.max(...natShares.flat(), 1);

    return {
      natCountries,
      natRegions: perRegion.map((p) => p.region),
      natShares,
      nationalityMax,
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
      <div className="flex-[1.05] min-h-0 grid grid-cols-2 gap-2 px-4 pt-3 pb-2 border-b border-gray-100">
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
      <div className="flex-[0.85] min-h-0 flex flex-col px-4 pt-2.5 pb-1.5 border-b border-gray-100">
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

      {/* 하단: 외국인 국적 구성 — 상위 4개국(행) × 3지역(열) 히트맵 */}
      <div className="flex-[1.4] min-h-0 flex flex-col px-4 pt-2.5 pb-3">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[13px] font-bold text-gray-700">외국인 국적 구성 비교</p>
          <span className="text-[10px] font-semibold text-gray-400">시군구 · 상위 4개국 × 지역별 방문 비중</span>
        </div>
        {natCountries.length > 0 ? (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* 헤더 행: 지역명 */}
            <div
              className="grid gap-1.5 mb-1.5"
              style={{ gridTemplateColumns: "62px repeat(3, minmax(0, 1fr))" }}
            >
              <div />
              {natRegions.map((region, ri) => (
                <div
                  key={`${region.provinceId}-${region.id}`}
                  className="flex items-center justify-center gap-1 px-1"
                >
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: REGION_COLORS[ri] }} />
                  <span className="text-[11px] font-black truncate" style={{ color: REGION_COLORS[ri] }}>
                    {region.name}
                  </span>
                </div>
              ))}
            </div>
            {/* 국가 행들: 각 셀 = 국가색 + 비율 강도 */}
            <div
              className="flex-1 min-h-0 grid gap-1.5"
              style={{
                gridTemplateColumns: "62px repeat(3, minmax(0, 1fr))",
                gridTemplateRows: `repeat(${natCountries.length}, minmax(0, 1fr))`,
              }}
            >
              {natCountries.map((country, ci) => {
                const base = countryColor(country);
                return (
                  <Fragment key={country}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: base }} />
                      <span className="text-[12px] font-black truncate" style={{ color: base }}>
                        {country}
                      </span>
                    </div>
                    {natShares[ci].map((pct, ri) => {
                      const hasData = pct > 0;
                      const t = pct / nationalityMax;
                      const alpha = hasData ? 0.16 + 0.84 * t : 0;
                      return (
                        <div
                          key={`${country}-${ri}`}
                          className="rounded-lg flex items-center justify-center text-[13px] font-black tabular-nums"
                          style={{
                            background: hasData ? hexToRgba(base, alpha) : "#f8fafc",
                            color: hasData ? cellTextColor(base, alpha) : "#cbd5e1",
                            border: hasData ? "none" : "1px dashed #e5e7eb",
                          }}
                        >
                          {hasData ? `${pct.toFixed(1)}%` : "—"}
                        </div>
                      );
                    })}
                  </Fragment>
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
