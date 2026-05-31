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

// 1. 전국(시/도) 단위 방문객 전체 평균
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

// 2. 구체적 광역지자체 내 시/군/구 방문객 전체 평균
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

// 3. 특정 지역(시도 또는 시군구)의 단일 방문객 평균치
export function getRegionVisitorTotal(
  provinceId: string,
  districtName: string | null,
  startMonth = "2023-01",
  endMonth = "2025-12",
) {
  const provinceName = provinceIdToCsvName[provinceId];
  if (!provinceName) return 0;

  let sum = 0;
  let count = 0;

  if (districtName) {
    for (const row of visitorRows) {
      if (row.provinceName === provinceName && row.districtName === districtName && isInMonthRange(row.month, startMonth, endMonth)) {
        sum += row.districtVisitors;
        count++;
      }
    }
  } else {
    const seenMonths = new Set<string>();
    for (const row of visitorRows) {
      if (row.provinceName === provinceName && isInMonthRange(row.month, startMonth, endMonth)) {
        if (!seenMonths.has(row.month)) {
          seenMonths.add(row.month);
          sum += row.provinceVisitors;
          count++;
        }
      }
    }
  }

  return count === 0 ? 0 : Math.round(sum / count);
}

// 4. 특정 지역의 월별 트렌드 (차트용 유지)
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

// 5. 전국의 모든 시/군/구별 방문객 전체 평균 목록
export function getAllDistrictVisitorTotals(
  startMonth = "2023-01",
  endMonth = "2025-12",
): { provinceName: string; districtName: string; total: number }[] {
  const totalsMap = new Map<
    string,
    { provinceName: string; districtName: string; sum: number; count: number }
  >();
  
  for (const row of visitorRows) {
    if (!row.districtName) continue;
    if (!isInMonthRange(row.month, startMonth, endMonth)) continue;
    
    const key = `${row.provinceName}|${row.districtName}`;
    const existing = totalsMap.get(key);
    
    if (existing) {
      existing.sum += row.districtVisitors;
      existing.count += 1;
    } else {
      totalsMap.set(key, {
        provinceName: row.provinceName,
        districtName: row.districtName,
        sum: row.districtVisitors,
        count: 1,
      });
    }
  }
  
  return Array.from(totalsMap.values())
    .map((row) => ({
      provinceName: row.provinceName,
      districtName: row.districtName,
      total: Math.round(row.sum / row.count),
    }))
    .filter((row) => row.total > 0);
}

export function getProvinceVisitorScaleMax() {
  const totals = getProvinceVisitorTotals();
  return Math.max(...Object.values(totals), 1);
}

export function getDistrictVisitorScaleMax(regionId: string) {
  const totals = getDistrictVisitorTotals(regionId);
  return Math.max(...Object.values(totals), 1);
}