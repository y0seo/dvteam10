import nationalityCsvRaw from "../../data/nationality.csv?raw";

interface NationalityRow {
  provinceName: string;
  districtName: string;
  country: string;
  percentage: number;
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
const parseNumber = (value: string) => Number(value?.replace(/,/g, "").trim()) || 0;

const nationalityRows: NationalityRow[] = nationalityCsvRaw
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const cols = line.split(",");

    return {
      provinceName: cols[0]?.trim(),
      districtName: cols[1]?.trim(),
      country: cols[2]?.trim(),
      percentage: parseNumber(cols[3]),
    };
  });

export function getCountryPercentagesByRegion(
  targetId: string,
  baseRegionId: string,
  districtName: string | null,
) {
  const provinceName = provinceIdToCsvName[baseRegionId] || "서울특별시";

  const totals: Record<string, number> = {};

  const isSubRegion =
    districtName !== null &&
    districtName !== undefined &&
    districtName !== "";
  
  let grandTotal = 0;

  for (const row of nationalityRows) {
    if (row.provinceName !== provinceName) continue;
    if (isSubRegion && row.districtName !== districtName) continue;

    totals[row.country] = (totals[row.country] || 0) + row.percentage;
    grandTotal += row.percentage;
  }

  
  if (Object.keys(totals).length === 0 || grandTotal === 0) {
    return [
      { name: "데이터 없음", value: 0 }
    ];
  }

  return Object.entries(totals)
    .map(([name, sumPercentage]) => {
      const normalizedPercentage = (sumPercentage / grandTotal) * 100;
      return {
        name,
        percentage: Number(normalizedPercentage.toFixed(1)), 
      };
    })
    .sort((a, b) => b.percentage - a.percentage) // 내림차순 정렬
    .slice(0, 10);
}