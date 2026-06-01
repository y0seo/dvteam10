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
  
  // 1. 원본 Z-score (MainPage의 동적 가중치 연산을 위한 핵심 재료)
  visitorZ: number;
  spendingZ: number;
  accommodationZ: number;
  landPriceZ: number;

  // 2. 개별 지표의 0~100점 환산 점수 (툴팁 등 UI 표기용)
  visitorT: number;      
  spendingT: number;     
  accommodationT: number; 
  landPriceT: number;     
  
  // 3. 최종 입지기회도 (MainPage에서 실시간 계산하여 덮어씌움)
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

// Z-score를 0~100 백분위 점수(T점수)로 변환하는 범용 함수
export function zToPercentileScore(z: number): number {
  if (typeof z !== 'number' || isNaN(z)) return 50.0; 
  const percentile = 1 / (1 + Math.exp(-1.702 * z));
  return Math.round(percentile * 1000) / 10;
}

function toOpportunityDatum(row: Record<string, string>): OpportunityDatum {
  const visitorZ = parseNumber(row.visitorZ);
  const spendingZ = parseNumber(row.spendingZ);
  const accommodationZ = parseNumber(row.accommodationZ);
  const landPriceZ = parseNumber(row.landPriceZ);

  return {
    provinceId: row.provinceId,
    provinceName: row.provinceName,
    districtName: row.districtName || undefined,
    visitorTotal: parseNumber(row.visitorTotal),
    spendingTotal: parseNumber(row.spendingTotal),
    accommodationTotal: parseNumber(row.accommodationTotal),
    landPriceTotal: parseNumber(row.landPriceTotal),
    
    // 원본 데이터 그대로 패스
    visitorZ,
    spendingZ,
    accommodationZ,
    landPriceZ,
    
    // 개별 지표 퍼센트 변환 (부정 지표 부호 반전)
    visitorT: zToPercentileScore(visitorZ),
    spendingT: zToPercentileScore(spendingZ),
    accommodationT: zToPercentileScore(-accommodationZ), 
    landPriceT: zToPercentileScore(-landPriceZ),         
    
    // 💡 더 이상 여기서 합산 연산을 하지 않음! (MainPage에서 덮어씌울 초기값 0 세팅)
    opportunityScore: 0,
    
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