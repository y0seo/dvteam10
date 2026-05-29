import accommodationCsvRaw from "../../data/accommodation_status.csv?raw";
import lodgingSpendingCsvRaw from "../../data/lodging_spending.csv?raw";
import realEstateCsvRaw from "../../data/real_estate_price.csv?raw";
import {
  getAllDistrictVisitorTotals,
  getRegionMonthlyVisitorTrend,
  getRegionVisitorTotal,
  provinceCsvNameToId,
  provinceIdToCsvName,
} from "./visitorData";

export type CompareRegion = {
  id: string;
  name: string;
  provinceId: string;
  provinceName: string;
};

export type MetricKey =
  | "foreignVisitors"
  | "accommodationSpending"
  | "accommodationBusinesses"
  | "landPrice";

export type ComparisonMetric = {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  value: number | null;
  isPlaceholder?: boolean;
};

export type RegionComparisonRow = {
  region: CompareRegion;
  metrics: Record<MetricKey, ComparisonMetric>;
  monthlyVisitors: { month: string; visitors: number }[];
};

const METRIC_LABELS: Record<MetricKey, Omit<ComparisonMetric, "key" | "value">> = {
  foreignVisitors: { label: "외국인 방문자 수", shortLabel: "방문자", unit: "명" },
  accommodationSpending: {
    label: "숙박 소비액",
    shortLabel: "소비액",
    unit: "천원",
  },
  accommodationBusinesses: { label: "숙박업소 수", shortLabel: "숙박업소", unit: "개" },
  landPrice: { label: "1㎡당 토지 거래가", shortLabel: "토지 거래가", unit: "만원" },
};

const stripBom = (value: string) => (value.charCodeAt(0) === 0xfeff ? value.slice(1) : value);

function parseCsv(rawText: string): string[][] {
  return stripBom(rawText)
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }

      result.push(current.trim());
      return result;
    });
}

const parseNumber = (value: string | undefined) =>
  Number(value?.replace(/,/g, "").trim()) || 0;

const accommodationRows = parseCsv(accommodationCsvRaw).map((cols) => ({
  province: cols[0],
  district: cols[1],
  total: cols.slice(2, 9).reduce((sum, value) => sum + parseNumber(value), 0),
}));

const landPriceRows = parseCsv(realEstateCsvRaw).map((cols) => ({
  province: cols[0],
  district: cols[1],
  price: parseNumber(cols[2]),
}));

const lodgingSpendingRows = parseCsv(lodgingSpendingCsvRaw).map((cols) => ({
  year: cols[0],
  province: cols[1],
  district: cols[2],
  spending: parseNumber(cols[4]),
}));

function getProvinceMetric<T extends { province: string; district: string }>(
  rows: T[],
  provinceName: string,
) {
  return rows.filter((row) => row.province === provinceName && row.district !== "-");
}

function getAccommodationBusinesses(provinceId: string, districtName: string | null) {
  const provinceName = provinceIdToCsvName[provinceId];
  if (!provinceName) return null;

  if (districtName) {
    return (
      accommodationRows.find(
        (row) => row.province === provinceName && row.district === districtName,
      )?.total ?? null
    );
  }

  const rows = getProvinceMetric(accommodationRows, provinceName);
  if (rows.length === 0) return null;
  return rows.reduce((sum, row) => sum + row.total, 0);
}

function getLandPrice(provinceId: string, districtName: string | null) {
  const provinceName = provinceIdToCsvName[provinceId];
  if (!provinceName) return null;

  if (districtName) {
    return (
      landPriceRows.find((row) => row.province === provinceName && row.district === districtName)
        ?.price ?? null
    );
  }

  const rows = getProvinceMetric(landPriceRows, provinceName).filter((row) => row.price > 0);
  if (rows.length === 0) return null;
  return Math.round((rows.reduce((sum, row) => sum + row.price, 0) / rows.length) * 10) / 10;
}

function getAccommodationSpending(provinceId: string, districtName: string | null) {
  const provinceName = provinceIdToCsvName[provinceId];
  if (!provinceName) return null;

  const match = lodgingSpendingRows.find(
    (row) =>
      row.year === "2025" &&
      row.province === provinceName &&
      (districtName ? row.district === districtName : row.district === ""),
  );

  return match?.spending ?? null;
}

function createMetric(key: MetricKey, value: number | null): ComparisonMetric {
  return {
    key,
    ...METRIC_LABELS[key],
    value,
  };
}

export function buildComparisonRows(regions: CompareRegion[]): RegionComparisonRow[] {
  return regions.slice(0, 3).map((region) => {
    const districtName = region.id === region.provinceId ? null : region.name;

    return {
      region,
      metrics: {
        foreignVisitors: createMetric(
          "foreignVisitors",
          getRegionVisitorTotal(region.provinceId, districtName),
        ),
        accommodationSpending: createMetric(
          "accommodationSpending",
          getAccommodationSpending(region.provinceId, districtName),
        ),
        accommodationBusinesses: createMetric(
          "accommodationBusinesses",
          getAccommodationBusinesses(region.provinceId, districtName),
        ),
        landPrice: createMetric("landPrice", getLandPrice(region.provinceId, districtName)),
      },
      monthlyVisitors: getRegionMonthlyVisitorTrend(region.provinceId, districtName),
    };
  });
}

export const comparisonMetricKeys: MetricKey[] = [
  "foreignVisitors",
  "accommodationSpending",
  "accommodationBusinesses",
  "landPrice",
];

// --- 정규화: 전국 시군구 분포 기반 percentile rank ---

export type RegionGroup =
  | "metropolitan"
  | "gangwon"
  | "chungcheong"
  | "honam"
  | "yeongnam"
  | "jeju";

const provinceIdToGroup: Record<string, RegionGroup> = {
  seoul: "metropolitan",
  incheon: "metropolitan",
  gyeonggi: "metropolitan",
  gangwon: "gangwon",
  chungbuk: "chungcheong",
  chungnam: "chungcheong",
  sejong: "chungcheong",
  daejeon: "chungcheong",
  jeonbuk: "honam",
  jeonnam: "honam",
  gwangju: "honam",
  busan: "yeongnam",
  daegu: "yeongnam",
  ulsan: "yeongnam",
  gyeongbuk: "yeongnam",
  gyeongnam: "yeongnam",
  jeju: "jeju",
};

const regionGroupLabel: Record<RegionGroup, string> = {
  metropolitan: "수도권",
  gangwon: "강원",
  chungcheong: "충청",
  honam: "호남",
  yeongnam: "영남",
  jeju: "제주",
};

type DistrictMetricRow = { provinceName: string; district: string; value: number };

const distributionCache: Partial<Record<MetricKey, DistrictMetricRow[]>> = {};

function buildMetricDistribution(metric: MetricKey): DistrictMetricRow[] {
  switch (metric) {
    case "foreignVisitors":
      return getAllDistrictVisitorTotals().map((row) => ({
        provinceName: row.provinceName,
        district: row.districtName,
        value: row.total,
      }));
    case "accommodationBusinesses":
      return accommodationRows
        .filter((row) => row.district && row.district !== "-" && row.total > 0)
        .map((row) => ({ provinceName: row.province, district: row.district, value: row.total }));
    case "landPrice":
      return landPriceRows
        .filter((row) => row.district && row.district !== "-" && row.price > 0)
        .map((row) => ({ provinceName: row.province, district: row.district, value: row.price }));
    case "accommodationSpending":
      return lodgingSpendingRows
        .filter((row) => row.year === "2025" && row.district && row.spending > 0)
        .map((row) => ({
          provinceName: row.province,
          district: row.district,
          value: row.spending,
        }));
  }
}

function getDistribution(metric: MetricKey): DistrictMetricRow[] {
  if (!distributionCache[metric]) {
    distributionCache[metric] = buildMetricDistribution(metric);
  }
  return distributionCache[metric]!;
}

function percentileRank(value: number | null, values: number[]): number {
  if (value == null || values.length === 0) return 0;
  let below = 0;
  let equal = 0;
  for (const v of values) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return Math.round(((below + 0.5 * equal) / values.length) * 100);
}

export function getNationwidePercentile(metric: MetricKey, value: number | null): number {
  if (value == null) return 0;
  return percentileRank(
    value,
    getDistribution(metric).map((row) => row.value),
  );
}

export type PeerScope =
  | { type: "province"; provinceName: string }
  | { type: "group"; group: RegionGroup };

export function getPeerScope(regions: CompareRegion[]): PeerScope | null {
  if (regions.length === 0) return null;
  const provinceNames = regions
    .map((r) => provinceIdToCsvName[r.provinceId])
    .filter((p): p is string => Boolean(p));
  if (provinceNames.length === 0) return null;

  const allSameProvince = provinceNames.every((p) => p === provinceNames[0]);
  if (allSameProvince) {
    return { type: "province", provinceName: provinceNames[0] };
  }

  const groups = regions
    .map((r) => provinceIdToGroup[r.provinceId])
    .filter((g): g is RegionGroup => Boolean(g));
  if (groups.length === 0) return null;

  const allSameGroup = groups.every((g) => g === groups[0]);
  if (allSameGroup) {
    return { type: "group", group: groups[0] };
  }
  return null;
}

export function getPeerScopeLabel(scope: PeerScope | null): string {
  if (!scope) return "권역 비교 불가";
  if (scope.type === "province") return `${scope.provinceName} 내`;
  return `${regionGroupLabel[scope.group]} 권역 내`;
}

export function getPeerPercentile(
  metric: MetricKey,
  value: number | null,
  scope: PeerScope,
): number {
  if (value == null) return 0;
  const distribution = getDistribution(metric);
  const peerValues =
    scope.type === "province"
      ? distribution
          .filter((row) => row.provinceName === scope.provinceName)
          .map((row) => row.value)
      : distribution
          .filter((row) => {
            const provinceId = provinceCsvNameToId[row.provinceName];
            return provinceId && provinceIdToGroup[provinceId] === scope.group;
          })
          .map((row) => row.value);
  return percentileRank(value, peerValues);
}
