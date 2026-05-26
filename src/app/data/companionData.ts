import companionCsvRaw from "../../data/companion_2024_2025.csv?raw";

export const COMPANION_KEYS = [
  "친구",
  "직장동료",
  "배우자/파트너",
  "자녀",
  "그외 가족/친지",
  "부모님",
  "기타",
] as const;

export type CompanionKey = (typeof COMPANION_KEYS)[number];

export type CompanionDatum = {
  name: CompanionKey;
  value: number;
  rawValue: number;
};

export const COMPANION_COLORS: Record<CompanionKey, string> = {
  친구: "#3b82f6",
  직장동료: "#06b6d4",
  "배우자/파트너": "#10b981",
  자녀: "#f9a8d4",
  "그외 가족/친지": "#ec4899",
  부모님: "#be185d",
  기타: "#9ca3af",
};

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }

  out.push(cur);
  return out;
}

const stripBom = (value: string) => (value.charCodeAt(0) === 0xfeff ? value.slice(1) : value);

const lines = stripBom(companionCsvRaw)
  .split(/\r?\n/)
  .filter((line) => line.length > 0);

const yearHeader = parseCsvRow(lines[0]);
const subHeader = parseCsvRow(lines[1]);
const dataRows = lines.slice(2).map(parseCsvRow);

const parseValue = (value: string | undefined): number => {
  if (!value) return 0;
  const number = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : 0;
};

function findYearColumns(year: number): Partial<Record<CompanionKey, number>> {
  const columns: Partial<Record<CompanionKey, number>> = {};

  for (let i = 2; i < yearHeader.length; i += 1) {
    if (Number(yearHeader[i]) !== year) continue;
    const key = subHeader[i]?.trim() as CompanionKey | undefined;
    if (key && COMPANION_KEYS.includes(key) && columns[key] === undefined) {
      columns[key] = i;
    }
  }

  return columns;
}

export function getCompanionAverageByCountry(
  country: string,
  years: number[] = [2023, 2024],
): CompanionDatum[] {
  const row = dataRows.find(
    (item) => item[0]?.trim() === "국가" && item[1]?.trim() === country,
  );
  if (!row) return [];

  const totals = Object.fromEntries(COMPANION_KEYS.map((key) => [key, 0])) as Record<
    CompanionKey,
    number
  >;
  let yearCount = 0;

  for (const year of years) {
    const columns = findYearColumns(year);
    const hasAnyValue = COMPANION_KEYS.some((key) => {
      const index = columns[key];
      return index !== undefined && parseValue(row[index]) > 0;
    });
    if (!hasAnyValue) continue;

    yearCount += 1;
    for (const key of COMPANION_KEYS) {
      const index = columns[key];
      totals[key] += index !== undefined ? parseValue(row[index]) : 0;
    }
  }

  if (yearCount === 0) return [];

  const averaged = COMPANION_KEYS.map((key) => ({
    name: key,
    rawValue: totals[key] / yearCount,
  })).filter((item) => item.rawValue > 0);

  const sum = averaged.reduce((acc, item) => acc + item.rawValue, 0);
  if (sum <= 0) return [];

  return averaged.map((item) => ({
    ...item,
    value: Number(((item.rawValue / sum) * 100).toFixed(1)),
  }));
}
