import visitorsCsvRaw from "../../data/visitors_2023_2025.csv?raw";

export interface VisitorRow {
  month: string;
  provinceName: string;
  districtName: string;
  provinceVisitors: number;
  districtVisitors: number;
}

export const provinceIdToCsvName: Record<string, string> = {
  seoul: "서울특별시",
  incheon: "인천광역시",
  gyeonggi: "경기도",
  gangwon: "강원특별자치도",
  chungbuk: "충청북도",
  chungnam: "충청남도",
  sejong: "세종특별자치시",
  daejeon: "대전광역시",
  jeonbuk: "전북특별자치도",
  jeonnam: "전라남도",
  gwangju: "광주광역시",
  gyeongbuk: "경상북도",
  daegu: "대구광역시",
  gyeongnam: "경상남도",
  ulsan: "울산광역시",
  busan: "부산광역시",
  jeju: "제주특별자치도",
};

const provinceCsvNameToId = Object.fromEntries(
  Object.entries(provinceIdToCsvName).map(([id, name]) => [name, id]),
) as Record<string, string>;

const parseNumber = (value: string) => Number(value.replace(/,/g, "").trim()) || 0;

const visitorRows: VisitorRow[] = visitorsCsvRaw
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const [month, provinceName, districtName, provinceVisitors, districtVisitors] = line.split(",");
    return {
      month: month.trim(),
      provinceName: provinceName.trim(),
      districtName: districtName.trim(),
      provinceVisitors: parseNumber(provinceVisitors),
      districtVisitors: parseNumber(districtVisitors),
    };
  });

const isInMonthRange = (month: string, startMonth: string, endMonth: string) =>
  month >= startMonth && month <= endMonth;

const getMonthNumber = (month: string) => Number(month.slice(5, 7));

const averageTotals = (sums: Record<string, number>, counts: Record<string, number>) =>
  Object.fromEntries(
    Object.entries(sums).map(([key, sum]) => [key, Math.round(sum / Math.max(counts[key] || 1, 1))]),
  );

export function getProvinceVisitorTotals(selectedMonth: number): Record<string, number>;
export function getProvinceVisitorTotals(startMonth: string, endMonth: string): Record<string, number>;
export function getProvinceVisitorTotals(monthOrStart: number | string, endMonth = "2025-12") {
  const totals: Record<string, number> = {};

  if (typeof monthOrStart === "number") {
    const counts: Record<string, number> = {};
    const seenProvinceMonths = new Set<string>();

    for (const row of visitorRows) {
      if (getMonthNumber(row.month) !== monthOrStart) continue;

      const provinceId = provinceCsvNameToId[row.provinceName];
      if (!provinceId) continue;

      const key = `${row.month}|${row.provinceName}`;
      if (seenProvinceMonths.has(key)) continue;

      seenProvinceMonths.add(key);
      totals[provinceId] = (totals[provinceId] || 0) + row.provinceVisitors;
      counts[provinceId] = (counts[provinceId] || 0) + 1;
    }

    return averageTotals(totals, counts);
  }

  const seenProvinceMonths = new Set<string>();
  for (const row of visitorRows) {
    if (!isInMonthRange(row.month, monthOrStart, endMonth)) continue;

    const provinceId = provinceCsvNameToId[row.provinceName];
    if (!provinceId) continue;

    const key = `${row.month}|${row.provinceName}`;
    if (seenProvinceMonths.has(key)) continue;

    seenProvinceMonths.add(key);
    totals[provinceId] = (totals[provinceId] || 0) + row.provinceVisitors;
  }

  return totals;
}

export function getDistrictVisitorTotals(regionId: string, selectedMonth: number): Record<string, number>;
export function getDistrictVisitorTotals(regionId: string, startMonth: string, endMonth: string): Record<string, number>;
export function getDistrictVisitorTotals(regionId: string, monthOrStart: number | string, endMonth = "2025-12") {
  const provinceName = provinceIdToCsvName[regionId];
  const totals: Record<string, number> = {};

  if (!provinceName) return totals;

  if (typeof monthOrStart === "number") {
    const counts: Record<string, number> = {};

    for (const row of visitorRows) {
      if (row.provinceName !== provinceName) continue;
      if (getMonthNumber(row.month) !== monthOrStart) continue;

      totals[row.districtName] = (totals[row.districtName] || 0) + row.districtVisitors;
      counts[row.districtName] = (counts[row.districtName] || 0) + 1;
    }

    return averageTotals(totals, counts);
  }

  for (const row of visitorRows) {
    if (row.provinceName !== provinceName) continue;
    if (!isInMonthRange(row.month, monthOrStart, endMonth)) continue;

    totals[row.districtName] = (totals[row.districtName] || 0) + row.districtVisitors;
  }

  return totals;
}

export function getRegionVisitorTotal(
  provinceId: string,
  districtName: string | null,
  startMonth = "2023-01",
  endMonth = "2025-12",
) {
  const provinceName = provinceIdToCsvName[provinceId];
  if (!provinceName) return 0;

  if (districtName) {
    return visitorRows.reduce((sum, row) => {
      if (row.provinceName !== provinceName || row.districtName !== districtName) return sum;
      if (!isInMonthRange(row.month, startMonth, endMonth)) return sum;
      return sum + row.districtVisitors;
    }, 0);
  }

  const seenMonths = new Set<string>();
  return visitorRows.reduce((sum, row) => {
    if (row.provinceName !== provinceName) return sum;
    if (!isInMonthRange(row.month, startMonth, endMonth)) return sum;
    if (seenMonths.has(row.month)) return sum;
    seenMonths.add(row.month);
    return sum + row.provinceVisitors;
  }, 0);
}

export function getRegionMonthlyVisitorTrend(
  provinceId: string,
  districtName: string | null,
  startMonth = "2023-01",
  endMonth = "2025-12",
) {
  const provinceName = provinceIdToCsvName[provinceId];
  if (!provinceName) return [];

  const totals: Record<string, number> = {};
  const seenProvinceMonths = new Set<string>();

  for (const row of visitorRows) {
    if (row.provinceName !== provinceName) continue;
    if (!isInMonthRange(row.month, startMonth, endMonth)) continue;

    if (districtName) {
      if (row.districtName !== districtName) continue;
      totals[row.month] = (totals[row.month] || 0) + row.districtVisitors;
    } else {
      const key = `${row.month}|${row.provinceName}`;
      if (seenProvinceMonths.has(key)) continue;
      seenProvinceMonths.add(key);
      totals[row.month] = (totals[row.month] || 0) + row.provinceVisitors;
    }
  }

  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, visitors]) => ({ month, visitors }));
}

export function getProvinceVisitorScaleMax() {
  const monthlyMaxes = Array.from({ length: 12 }, (_, index) =>
    Math.max(...Object.values(getProvinceVisitorTotals(index + 1)), 1),
  );
  return Math.max(...monthlyMaxes, 1);
}

export function getDistrictVisitorScaleMax(regionId: string) {
  const monthlyMaxes = Array.from({ length: 12 }, (_, index) =>
    Math.max(...Object.values(getDistrictVisitorTotals(regionId, index + 1)), 1),
  );
  return Math.max(...monthlyMaxes, 1);
}
