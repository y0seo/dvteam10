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
  visitorZ: number;
  spendingZ: number;
  accommodationZ: number;
  landPriceZ: number;
  opportunityScore: number;
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

function toOpportunityDatum(row: Record<string, string>): OpportunityDatum {
  return {
    provinceId: row.provinceId,
    provinceName: row.provinceName,
    districtName: row.districtName || undefined,
    visitorTotal: parseNumber(row.visitorTotal),
    spendingTotal: parseNumber(row.spendingTotal),
    accommodationTotal: parseNumber(row.accommodationTotal),
    landPriceTotal: parseNumber(row.landPriceTotal),
    visitorZ: parseNumber(row.visitorZ),
    spendingZ: parseNumber(row.spendingZ),
    accommodationZ: parseNumber(row.accommodationZ),
    landPriceZ: parseNumber(row.landPriceZ),
    opportunityScore: parseNumber(row.opportunityScore),
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
