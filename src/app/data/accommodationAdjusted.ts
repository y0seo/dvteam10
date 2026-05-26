import accommodationAdjustedCsvRaw from "../../data/accomodation_adjusted.csv?raw";
import { provinceIdToCsvName } from "./visitorData";

export type AccommodationAdjustedDatum = {
  name: string;
  value: number;
};

type AccommodationAdjustedRow = {
  province: string;
  district: string;
  values: AccommodationAdjustedDatum[];
};

const CATEGORY_COLUMNS = ["호텔·콘도형", "생활숙박형", "여관·여인숙형", "기타"] as const;

const stripBom = (value: string) => (value.charCodeAt(0) === 0xfeff ? value.slice(1) : value);
const parseNumber = (value: string | undefined) => Number(value?.replace(/,/g, "").trim()) || 0;

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
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
}

const accommodationAdjustedRows: AccommodationAdjustedRow[] = stripBom(accommodationAdjustedCsvRaw)
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const cols = parseCsvRow(line);
    return {
      province: cols[0],
      district: cols[1],
      values: CATEGORY_COLUMNS.map((name, index) => ({
        name,
        value: parseNumber(cols[index + 2]),
      })),
    };
  });

export function getAccommodationAdjustedData(
  provinceId: string,
  districtName: string | null,
): AccommodationAdjustedDatum[] {
  const provinceName = provinceIdToCsvName[provinceId];
  if (!provinceName || !districtName) return [];

  const row = accommodationAdjustedRows.find(
    (item) => item.province === provinceName && item.district === districtName,
  );

  return row ? row.values.filter((item) => item.value > 0) : [];
}
