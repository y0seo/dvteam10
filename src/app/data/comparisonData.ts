import accommodationCsvRaw from "../../data/accommodation_status.csv?raw";
import lodgingSpendingCsvRaw from "../../data/lodging_spending.csv?raw";
import realEstateCsvRaw from "../../data/real_estate_price.csv?raw";
import {
  getRegionMonthlyVisitorTrend,
  getRegionVisitorTotal,
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

export function normalizeMetric(value: number | null, values: (number | null)[]) {
  if (value == null) return 0;
  const validValues = values.filter((v): v is number => v != null);
  if (validValues.length === 0) return 0;

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  if (max === min) return 75;

  return Math.round(((value - min) / (max - min)) * 100);
}

export const comparisonMetricKeys: MetricKey[] = [
  "foreignVisitors",
  "accommodationSpending",
  "accommodationBusinesses",
  "landPrice",
];
