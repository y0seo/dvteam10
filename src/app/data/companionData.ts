import companionCsvRaw from "../../data/companion_2024_2025.csv?raw";

// 방 유형별로 그룹핑한 순서: 트윈(blue) → 더블(green) → 패밀리(pink 농도순) → 싱글(gray).
// Legend, stack, 호버 패널 모두 이 순서를 따름.
export const COMPANION_KEYS = [
  "친구",            // 트윈
  "직장동료",        // 트윈
  "배우자/파트너",   // 더블
  "자녀",            // 패밀리 (light)
  "그외 가족/친지",  // 패밀리 (mid)
  "부모님",          // 패밀리 (deep)
  "기타",            // 싱글
] as const;

export type CompanionKey = (typeof COMPANION_KEYS)[number];

export type CompanionByCountryRow = { country: string } & Record<CompanionKey, number> & {
  __raw: Record<CompanionKey, number>;
};

// 추천 방 유형(트윈=blue/더블=green/패밀리=pink/싱글=gray)에 색 체계 정렬.
// 한 카테고리가 어느 방으로 매핑되는지 색만으로 직관적으로 보임.
export const COMPANION_COLORS: Record<CompanionKey, string> = {
  // 트윈 (blue family)
  친구: "#3b82f6",            // blue-500
  직장동료: "#06b6d4",        // cyan-500
  // 더블 (green)
  "배우자/파트너": "#10b981", // emerald-500
  // 패밀리 (pink family — 옅음→진함, 자녀→가족→부모님)
  자녀: "#f9a8d4",            // pink-300
  "그외 가족/친지": "#ec4899", // pink-500
  부모님: "#be185d",          // pink-700
  // 싱글
  기타: "#9ca3af",            // gray-400
};

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
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

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

const lines = stripBom(companionCsvRaw)
  .split(/\r?\n/)
  .filter((line) => line.length > 0);

const yearHeader = parseCsvRow(lines[0]);
const subHeader = parseCsvRow(lines[1]);
const dataRows = lines.slice(2).map(parseCsvRow);

function findYearColumns(year: number): Partial<Record<CompanionKey, number>> {
  const map: Partial<Record<CompanionKey, number>> = {};
  for (let i = 2; i < yearHeader.length; i++) {
    if (Number(yearHeader[i]) !== year) continue;
    const key = subHeader[i]?.trim() as CompanionKey | undefined;
    if (!key) continue;
    if (COMPANION_KEYS.includes(key) && map[key] === undefined) {
      map[key] = i;
    }
  }
  return map;
}

const parseValue = (s: string | undefined): number => {
  if (!s) return 0;
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

const AVAILABLE_YEARS = (() => {
  const set = new Set<number>();
  for (let i = 2; i < yearHeader.length; i++) {
    const n = Number(yearHeader[i]);
    if (Number.isFinite(n) && n > 0) set.add(n);
  }
  return Array.from(set).sort((a, b) => b - a);
})();

const RECENT_YEARS = AVAILABLE_YEARS.filter((y) => y >= 2023);

export function getCompanionByCountry(year: number): CompanionByCountryRow[] {
  const cols = findYearColumns(year);
  return dataRows
    .filter((row) => row[0]?.trim() === "국가")
    .map((row) => {
      const country = row[1].trim();
      const raw = {} as Record<CompanionKey, number>;
      let sum = 0;
      for (const key of COMPANION_KEYS) {
        const idx = cols[key];
        const v = idx !== undefined ? parseValue(row[idx]) : 0;
        raw[key] = v;
        sum += v;
      }
      if (sum <= 0) return null;
      const obj = { country, __raw: raw } as CompanionByCountryRow;
      for (const key of COMPANION_KEYS) {
        obj[key] = (raw[key] / sum) * 100;
      }
      return obj;
    })
    .filter((r): r is CompanionByCountryRow => r !== null);
}

export function pickCompanionYear(endMonth: string): number {
  const endYear = Number(endMonth.slice(0, 4));
  if (!Number.isFinite(endYear)) return RECENT_YEARS[0] ?? AVAILABLE_YEARS[0] ?? 2024;
  const eligible = RECENT_YEARS.filter((y) => y <= endYear);
  return eligible[0] ?? RECENT_YEARS[RECENT_YEARS.length - 1] ?? AVAILABLE_YEARS[0] ?? 2024;
}
