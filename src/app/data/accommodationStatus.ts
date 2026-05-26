import accommodationCsvRaw from "../../data/accommodation_status.csv?raw";
import { provinceIdToCsvName } from "./visitorData";

export type AccommodationStatusDatum = {
  name: string;
  value: number;
};

type AccommodationStatusRow = {
  province: string;
  district: string;
  values: AccommodationStatusDatum[];
};

const ACCOMMODATION_COLUMNS = [
  "관광호텔",
  "기타",
  "숙박업\n(생활)",
  "여관업",
  "여인숙업",
  "일반호텔",
] as const;

const stripBom = (value: string) => (value.charCodeAt(0) === 0xfeff ? value.slice(1) : value);
const parseNumber = (value: string | undefined) => Number(value?.replace(/,/g, "").trim()) || 0;

const accommodationStatusRows: AccommodationStatusRow[] = stripBom(accommodationCsvRaw)
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const cols = line.split(",").map((value) => value.trim());
    return {
      province: cols[0],
      district: cols[1],
      values: ACCOMMODATION_COLUMNS.map((name, index) => ({
        name,
        value:
          name === "기타"
            ? parseNumber(cols[index + 2]) + parseNumber(cols[8])
            : parseNumber(cols[index + 2]),
      })),
    };
  });

export function getAccommodationStatusData(
  provinceId: string,
  districtName: string | null,
): AccommodationStatusDatum[] {
  const provinceName = provinceIdToCsvName[provinceId];
  if (!provinceName || !districtName) return [];

  const row = accommodationStatusRows.find(
    (item) => item.province === provinceName && item.district === districtName,
  );

  return row ? [...row.values].sort((a, b) => b.value - a.value) : [];
}
