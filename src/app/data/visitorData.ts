import visitorsCsvRaw from "../../data/visitors_2023_2025.csv?raw";

export interface VisitorRow {
  month: string;
  provinceName: string;
  districtName: string;
  provinceVisitors: number;
  districtVisitors: number;
}

export const provinceIdToCsvName: Record<string, string> = {
  seoul: "서울특별시", incheon: "인천광역시", gyeonggi: "경기도",
  gangwon: "강원특별자치도", chungbuk: "충청북도", chungnam: "충청남도",
  sejong: "세종특별자치시", daejeon: "대전광역시", jeonbuk: "전북특별자치도",
  jeonnam: "전라남도", gwangju: "광주광역시", gyeongbuk: "경상북도",
  daegu: "대구광역시", gyeongnam: "경상남도", ulsan: "울산광역시",
  busan: "부산광역시", jeju: "제주특별자치도",
};

export const provinceCsvNameToId = Object.fromEntries(
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

const averageTotals = (sums: Record<string, number>, counts: Record<string, number>) =>
  Object.fromEntries(
    Object.entries(sums).map(([key, sum]) => [key, Math.round(sum / Math.max(counts[key] || 1, 1))]),
  );

// [1] 방문객 규모 (전체 평균) 계산
export function getProvinceVisitorTotals(startMonth = "2023-01", endMonth = "2025-12") {
  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};
  const seenProvinceMonths = new Set<string>();

  for (const row of visitorRows) {
    if (!isInMonthRange(row.month, startMonth, endMonth)) continue;
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

export function getDistrictVisitorTotals(regionId: string, startMonth = "2023-01", endMonth = "2025-12") {
  const provinceName = provinceIdToCsvName[regionId];
  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};

  if (!provinceName) return totals;

  for (const row of visitorRows) {
    if (row.provinceName !== provinceName) continue;
    if (!isInMonthRange(row.month, startMonth, endMonth)) continue;

    totals[row.districtName] = (totals[row.districtName] || 0) + row.districtVisitors;
    counts[row.districtName] = (counts[row.districtName] || 0) + 1;
  }
  return averageTotals(totals, counts);
}

// [2] 관광객 YoY 증감률 (2024년 대비 2025년)
let cachedProvinceGrowthRates: Record<string, number> | null = null;
export function getProvinceVisitorGrowthRates(): Record<string, number> {
  if (cachedProvinceGrowthRates) return cachedProvinceGrowthRates;

  const sums24: Record<string, number> = {};
  const sums25: Record<string, number> = {};
  const seen24 = new Set<string>();
  const seen25 = new Set<string>();

  for (const row of visitorRows) {
    const provinceId = provinceCsvNameToId[row.provinceName];
    if (!provinceId) continue;

    const key = `${row.month}|${row.provinceName}`;
    if (row.month.startsWith("2024-") && !seen24.has(key)) {
      seen24.add(key);
      sums24[provinceId] = (sums24[provinceId] || 0) + row.provinceVisitors;
    } else if (row.month.startsWith("2025-") && !seen25.has(key)) {
      seen25.add(key);
      sums25[provinceId] = (sums25[provinceId] || 0) + row.provinceVisitors;
    }
  }

  const result: Record<string, number> = {};
  for (const provinceId of Object.keys(provinceIdToCsvName)) {
    const prev = sums24[provinceId] || 0;
    const curr = sums25[provinceId] || 0;
    result[provinceId] = prev === 0 ? (curr > 0 ? 1.0 : 0) : (curr - prev) / prev;
  }

  cachedProvinceGrowthRates = result;
  return result;
}

const cachedDistrictGrowthRates: Record<string, Record<string, number>> = {};
export function getDistrictVisitorGrowthRates(regionId: string): Record<string, number> {
  if (cachedDistrictGrowthRates[regionId]) return cachedDistrictGrowthRates[regionId];

  const provinceName = provinceIdToCsvName[regionId];
  if (!provinceName) return {};

  const sums24: Record<string, number> = {};
  const sums25: Record<string, number> = {};

  for (const row of visitorRows) {
    if (row.provinceName !== provinceName) continue;
    
    if (row.month.startsWith("2024-")) {
      sums24[row.districtName] = (sums24[row.districtName] || 0) + row.districtVisitors;
    } else if (row.month.startsWith("2025-")) {
      sums25[row.districtName] = (sums25[row.districtName] || 0) + row.districtVisitors;
    }
  }

  const result: Record<string, number> = {};
  const allDistricts = new Set([...Object.keys(sums24), ...Object.keys(sums25)]);
  
  for (const district of allDistricts) {
    const prev = sums24[district] || 0;
    const curr = sums25[district] || 0;
    result[district] = prev === 0 ? (curr > 0 ? 1.0 : 0) : (curr - prev) / prev;
  }

  cachedDistrictGrowthRates[regionId] = result;
  return result;
}

// [3] 기타 유틸 함수들
export function getRegionVisitorTotal(provinceId: string, districtName: string | null, startMonth = "2023-01", endMonth = "2025-12") {
  const provinceName = provinceIdToCsvName[provinceId];
  if (!provinceName) return 0;

  let sum = 0; let count = 0;
  if (districtName) {
    for (const row of visitorRows) {
      if (row.provinceName === provinceName && row.districtName === districtName && isInMonthRange(row.month, startMonth, endMonth)) {
        sum += row.districtVisitors; count++;
      }
    }
  } else {
    const seenMonths = new Set<string>();
    for (const row of visitorRows) {
      if (row.provinceName === provinceName && isInMonthRange(row.month, startMonth, endMonth)) {
        if (!seenMonths.has(row.month)) {
          seenMonths.add(row.month);
          sum += row.provinceVisitors; count++;
        }
      }
    }
  }
  return count === 0 ? 0 : Math.round(sum / count);
}

export function getRegionMonthlyVisitorTrend(provinceId: string, districtName: string | null, startMonth = "2023-01", endMonth = "2025-12") {
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

export function getAllDistrictVisitorTotals(startMonth = "2023-01", endMonth = "2025-12") {
  const totalsMap = new Map<string, { provinceName: string; districtName: string; sum: number; count: number }>();
  
  for (const row of visitorRows) {
    if (!row.districtName) continue;
    if (!isInMonthRange(row.month, startMonth, endMonth)) continue;
    
    const key = `${row.provinceName}|${row.districtName}`;
    const existing = totalsMap.get(key);
    
    if (existing) {
      existing.sum += row.districtVisitors;
      existing.count += 1;
    } else {
      totalsMap.set(key, { provinceName: row.provinceName, districtName: row.districtName, sum: row.districtVisitors, count: 1 });
    }
  }
  
  return Array.from(totalsMap.values())
    .map((row) => ({ provinceName: row.provinceName, districtName: row.districtName, total: Math.round(row.sum / row.count) }))
    .filter((row) => row.total > 0);
}

export function getProvinceVisitorScaleMax() { return Math.max(...Object.values(getProvinceVisitorTotals()), 1); }
export function getDistrictVisitorScaleMax(regionId: string) { return Math.max(...Object.values(getDistrictVisitorTotals(regionId)), 1); }