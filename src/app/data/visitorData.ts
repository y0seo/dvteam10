import visitorsCsvRaw from "../../data/visitors_2023_2025.csv?raw";

interface VisitorRow {
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

export function getProvinceVisitorTotals(startMonth: string, endMonth: string) {
  const totals: Record<string, number> = {};
  const seenProvinceMonths = new Set<string>();

  for (const row of visitorRows) {
    if (!isInMonthRange(row.month, startMonth, endMonth)) continue;

    const provinceId = provinceCsvNameToId[row.provinceName];
    if (!provinceId) continue;

    const key = `${row.month}|${row.provinceName}`;
    if (seenProvinceMonths.has(key)) continue;

    seenProvinceMonths.add(key);
    totals[provinceId] = (totals[provinceId] || 0) + row.provinceVisitors;
  }

  return totals;
}

export function getDistrictVisitorTotals(regionId: string, startMonth: string, endMonth: string) {
  const provinceName = provinceIdToCsvName[regionId];
  const totals: Record<string, number> = {};

  if (!provinceName) return totals;

  for (const row of visitorRows) {
    if (row.provinceName !== provinceName) continue;
    if (!isInMonthRange(row.month, startMonth, endMonth)) continue;

    totals[row.districtName] = (totals[row.districtName] || 0) + row.districtVisitors;
  }

  return totals;
}

export function getProvinceVisitorScaleMax() {
  const totals = getProvinceVisitorTotals("2023-01", "2025-12");
  return Math.max(...Object.values(totals), 1);
}

export function getDistrictVisitorScaleMax(regionId: string) {
  const totals = getDistrictVisitorTotals(regionId, "2023-01", "2025-12");
  return Math.max(...Object.values(totals), 1);
}
