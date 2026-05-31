import opportunityDetailCsvRaw from "../../data/opportunity_detail.csv?raw";
import opportunityMainCsvRaw from "../../data/opportunity_main.csv?raw";

export type OpportunityDatum = {
  provinceId: string;
  provinceName: string;
  districtName?: string;
  visitorTotal: number;
  spendingTotal: number;
  accommodationTotal: number;
  landPriceTotal: number;
  visitorT: number;       // 0~100점 
  spendingT: number;      // 0~100점 
  accommodationT: number; // 0~100점 
  landPriceT: number;     // 0~100점 
  opportunityScore: number; // 0~100점
  intensity: number;
};

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function parseCsv(rawText: string): Record<string, string>[] {
  const lines = stripBom(rawText).trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? ""]));
  });
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

const parseNumber = (value: string | undefined) => Number(value?.replace(/,/g, "").trim()) || 0;

// ▼ Z-score를 0~100 백분위 점수(T점수)로 변환
function zToPercentileScore(z: number): number {
  if (typeof z !== 'number' || isNaN(z)) return 50.0; 
  const percentile = 1 / (1 + Math.exp(-1.702 * z));
  return Math.round(percentile*1000) / 10;
}

function toOpportunityDatum(row: Record<string, string>): OpportunityDatum {
  return {
    provinceId: row.provinceId,
    provinceName: row.provinceName,
    districtName: row.districtName || undefined,
    visitorTotal: parseNumber(row.visitorTotal),
    spendingTotal: parseNumber(row.spendingTotal),
    accommodationTotal: parseNumber(row.accommodationTotal),
    landPriceTotal: parseNumber(row.landPriceTotal),
    
    //변환
    visitorT: zToPercentileScore(parseNumber(row.visitorZ)),
    spendingT: zToPercentileScore(parseNumber(row.spendingZ)),
    accommodationT: zToPercentileScore(parseNumber(row.accommodationZ)),
    landPriceT: zToPercentileScore(parseNumber(row.landPriceZ)),
   
    opportunityScore: zToPercentileScore(parseNumber(row.opportunityScore)),
    
    intensity: parseNumber(row.intensity),
  };
}

const mainOpportunityByProvince = Object.fromEntries(
  parseCsv(opportunityMainCsvRaw).map((row) => {
    const datum = toOpportunityDatum(row);
    return [datum.provinceId, datum];
  }),
) as Record<string, OpportunityDatum>;

const detailOpportunityByProvince = parseCsv(opportunityDetailCsvRaw).reduce(
  (acc, row) => {
    const datum = toOpportunityDatum(row);
    if (!datum.districtName) return acc;
    acc[datum.provinceId] = acc[datum.provinceId] || {};
    acc[datum.provinceId][datum.districtName] = datum;
    return acc;
  },
  {} as Record<string, Record<string, OpportunityDatum>>,
);

export function getMainOpportunityScores() {
  return mainOpportunityByProvince;
}

export function getDetailOpportunityScores(regionId: string) {
  return detailOpportunityByProvince[regionId] || {};
}