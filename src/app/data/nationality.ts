import countryRatioCsvRaw from "../../data/country_ratio.csv?raw";
import nationalityCsvRaw from "../../data/nationality.csv?raw";
import { provinceIdToCsvName } from "./visitorData";

interface CountryRatioRow {
  regionName: string;
  month: string;
  ratios: Record<string, number>;
}

const parseNumber = (value: string) => Number(value?.replace(/,/g, "").trim()) || 0;
const getMonthNumber = (month: string) => Number(month.slice(5, 7));

const lines = countryRatioCsvRaw.trim().split(/\r?\n/);
const header = lines[0].split(",").map((col) => col.trim());
const countryNames = header.slice(2);

const countryRatioRows: CountryRatioRow[] = lines.slice(1).map((line) => {
  const cols = line.split(",");
  const ratios: Record<string, number> = {};

  countryNames.forEach((country, index) => {
    ratios[country] = parseNumber(cols[index + 2]);
  });

  return {
    regionName: cols[0]?.trim(),
    month: cols[1]?.trim(),
    ratios,
  };
});

const getAverageRatiosByRegion = (regionName: string, selectedMonth: number) => {
  const totals: Record<string, number> = {};
  let rowCount = 0;

  for (const row of countryRatioRows) {
    if (row.regionName !== regionName) continue;
    if (getMonthNumber(row.month) !== selectedMonth) continue;

    rowCount += 1;
    for (const country of countryNames) {
      totals[country] = (totals[country] || 0) + row.ratios[country];
    }
  }

  return { totals, rowCount };
};

export function getCountryPercentagesByRegion(
  targetId: string,
  baseRegionId: string,
  districtName: string | null,
  selectedMonth: number,
) {
  const provinceName = provinceIdToCsvName[baseRegionId] || "서울특별시";
  const requestedRegionName = districtName || provinceName;
  const requested = getAverageRatiosByRegion(requestedRegionName, selectedMonth);
  const fallback = districtName ? getAverageRatiosByRegion(provinceName, selectedMonth) : requested;
  const { totals, rowCount } = requested.rowCount > 0 ? requested : fallback;

  if (rowCount === 0) {
    return [{ name: "데이터 없음", percentage: 0 }];
  }

  return Object.entries(totals)
    .map(([name, sumPercentage]) => ({
      name,
      percentage: Number((sumPercentage / rowCount).toFixed(1)),
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 10);
}

// ── 시군구 단위 국적 구성 (nationality.csv) ──────────────────────────────
export interface DistrictNationality {
  country: string;
  percentage: number;
}

// provinceName|districtName → [{country, percentage}] (비율 내림차순)
const districtNationalityMap: Record<string, DistrictNationality[]> = (() => {
  const map: Record<string, DistrictNationality[]> = {};
  const rows = nationalityCsvRaw.trim().split(/\r?\n/).slice(1);
  for (const line of rows) {
    const cols = line.split(",");
    const province = cols[0]?.trim();
    const district = cols[1]?.trim();
    const country = cols[2]?.trim();
    if (!province || !district || !country) continue;
    const key = `${province}|${district}`;
    (map[key] ||= []).push({ country, percentage: parseNumber(cols[3]) });
  }
  Object.values(map).forEach((arr) => arr.sort((a, b) => b.percentage - a.percentage));
  return map;
})();

/**
 * 시군구 단위 외국인 국적 구성 비율(내림차순). 데이터 없으면 빈 배열 반환.
 * @param topN 상위 N개 (기본 8)
 */
export function getDistrictNationalities(
  provinceName: string,
  districtName: string,
  topN = 8,
): DistrictNationality[] {
  const list = districtNationalityMap[`${provinceName}|${districtName}`] || [];
  return list.slice(0, topN);
}