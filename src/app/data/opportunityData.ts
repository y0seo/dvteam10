import accommodationCsvRaw from "../../data/accommodation_status.csv?raw";
import spendingCsvRaw from "../../data/lodging_spending.csv?raw";
import realEstateCsvRaw from "../../data/real_estate_price.csv?raw";
import visitorsCsvRaw from "../../data/visitors_2023_2025.csv?raw";
import { provinceCsvNameToId } from "./visitorData";

export type ScoreMetrics = {
  visitor: number;
  spending: number;
  accommodation: number;
  price: number;
  growth: number;
};

export type OpportunityDatum = {
  provinceId: string;
  provinceName: string;
  districtName?: string;
  
  visitorTotal: number;
  spendingTotal: number;
  accommodationTotal: number;
  landPriceTotal: number;
  growthRate: number;

  raw: ScoreMetrics;
  nationalZ: ScoreMetrics; 
  nationalT: ScoreMetrics; 
  provincialZ: ScoreMetrics;
  provincialT: ScoreMetrics; 

  opportunityScore?: number; 
};

function stripBom(value: string) { return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value; }

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"' && line[i + 1] === '"') { current += '"'; i++; }
    else if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += line[i]; }
  }
  result.push(current); return result;
}

function parseCsv(rawText: string): Record<string, string>[] {
  const lines = stripBom(rawText).trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => Object.fromEntries(headers.map((h, i) => [h, parseCsvLine(line)[i] ?? ""])));
}

const parseNumber = (value: string | undefined) => Number(value?.replace(/,/g, "").trim()) || 0;

export function zToPercentileScore(z: number): number {
  if (isNaN(z)) return 50.0; 
  return Math.round((1 / (1 + Math.exp(-1.702 * z))) * 1000) / 10;
}

function toTScore(z: number, isNegativeIndicator: boolean = false) {
  return zToPercentileScore(isNegativeIndicator ? -z : z);
}

function getZScoreStats(values: number[]) {
  if (values.length === 0) return { mean: 0, std: 1 };
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const std = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length) || 1;
  return { mean, std };
}

const accRows = parseCsv(accommodationCsvRaw);
const spendRows = parseCsv(spendingCsvRaw);
const priceRows = parseCsv(realEstateCsvRaw);
const visRows = parseCsv(visitorsCsvRaw);

const distAcc: Record<string, number> = {}; const provAcc: Record<string, number> = {};
accRows.forEach(row => {
  const prov = row['광역지자체명']; const dist = row['기초지자체'];
  if (!prov || !dist) return;
  let sum = 0;
  Object.entries(row).forEach(([k, v]) => { if (k !== '광역지자체명' && k !== '기초지자체') sum += parseNumber(v); });
  distAcc[`${prov}-${dist}`] = (distAcc[`${prov}-${dist}`] || 0) + sum;
  provAcc[prov] = (provAcc[prov] || 0) + sum;
});

const distSpend: Record<string, number> = {}; const provSpend: Record<string, number> = {};
spendRows.forEach(row => {
  const prov = row['광역시도']; const dist = row['시군구'];
  if (!prov || prov === '전국') return;
  const val = parseNumber(row['숙박업_소비지출액(천원)']);
  if (!dist) provSpend[prov] = val;
  else distSpend[`${prov}-${dist}`] = (distSpend[`${prov}-${dist}`] || 0) + val;
});

const distPriceSum: Record<string, { s: number, c: number }> = {}; const provPriceSum: Record<string, { s: number, c: number }> = {};
priceRows.forEach(row => {
  const prov = row['광역지자체명']; const dist = row['기초지자체'];
  if (!prov || !dist) return;
  const val = parseNumber(row['1m2당_평균거래금액(만원)']);
  if (!distPriceSum[`${prov}-${dist}`]) distPriceSum[`${prov}-${dist}`] = { s: 0, c: 0 };
  distPriceSum[`${prov}-${dist}`].s += val; distPriceSum[`${prov}-${dist}`].c += 1;
  if (!provPriceSum[prov]) provPriceSum[prov] = { s: 0, c: 0 };
  provPriceSum[prov].s += val; provPriceSum[prov].c += 1;
});
const distPrice: Record<string, number> = {}; Object.keys(distPriceSum).forEach(k => distPrice[k] = distPriceSum[k].s / distPriceSum[k].c);
const provPrice: Record<string, number> = {}; Object.keys(provPriceSum).forEach(k => provPrice[k] = provPriceSum[k].s / provPriceSum[k].c);

const distVis: Record<string, { y24: number, y25: number }> = {}; const provVis: Record<string, { y24: number, y25: number }> = {};
const processedProvMonths = new Set<string>();

visRows.forEach(row => {
  const prov = row['광역지자체명']; const dist = row['기초지자체명']; const date = row['년월'];
  if (!prov || !dist || !date) return;
  const year = date.split('-')[0];
  const dVis = parseNumber(row['기초지자체 방문자 수']); const pVis = parseNumber(row['광역지자체 방문자 수']);
  const dKey = `${prov}-${dist}`;
  if (!distVis[dKey]) distVis[dKey] = { y24: 0, y25: 0 };
  if (year === '2024') distVis[dKey].y24 += dVis;
  if (year === '2025') distVis[dKey].y25 += dVis;
  
  const pKey = `${prov}-${date}`;
  if (!processedProvMonths.has(pKey)) {
    processedProvMonths.add(pKey);
    if (!provVis[prov]) provVis[prov] = { y24: 0, y25: 0 };
    if (year === '2024') provVis[prov].y24 += pVis;
    if (year === '2025') provVis[prov].y25 += pVis;
  }
});

const allDistKeys = new Set([...Object.keys(distAcc), ...Object.keys(distSpend), ...Object.keys(distPrice), ...Object.keys(distVis)]);
const detailRawData: any[] = [];
allDistKeys.forEach(dKey => {
  const sepIdx = dKey.indexOf('-');
  const provName = dKey.slice(0, sepIdx); const distName = dKey.slice(sepIdx + 1);
  const provId = provinceCsvNameToId[provName];
  if (!provId) return;
  const vData = distVis[dKey] || { y24: 0, y25: 0 };
  detailRawData.push({ provinceId: provId, provinceName: provName, districtName: distName, raw: { visitor: vData.y25, spending: distSpend[dKey] || 0, accommodation: distAcc[dKey] || 0, price: distPrice[dKey] || provPrice[provName] || 0, growth: vData.y24 > 0 ? (vData.y25 / vData.y24) - 1 : 0 } });
});

const mainRawData: any[] = [];
Object.entries(provinceCsvNameToId).forEach(([provName, provId]) => {
  const vData = provVis[provName] || { y24: 0, y25: 0 };
  mainRawData.push({ provinceId: provId, provinceName: provName, raw: { visitor: vData.y25, spending: provSpend[provName] || 0, accommodation: provAcc[provName] || 0, price: provPrice[provName] || 0, growth: vData.y24 > 0 ? (vData.y25 / vData.y24) - 1 : 0 } });
});

const getStatsMap = (data: any[]) => ({ visitor: getZScoreStats(data.map(d => d.raw.visitor)), spending: getZScoreStats(data.map(d => d.raw.spending)), accommodation: getZScoreStats(data.map(d => d.raw.accommodation)), price: getZScoreStats(data.map(d => d.raw.price)), growth: getZScoreStats(data.map(d => d.raw.growth)) });
const mainStats = getStatsMap(mainRawData);
const detailNatStats = getStatsMap(detailRawData);
const provGroups: Record<string, any[]> = {};
detailRawData.forEach(d => { if (!provGroups[d.provinceId]) provGroups[d.provinceId] = []; provGroups[d.provinceId].push(d); });
const provStatsMap: Record<string, any> = {};
Object.keys(provGroups).forEach(pId => provStatsMap[pId] = getStatsMap(provGroups[pId]));

const mainOpportunityByProvince = Object.fromEntries(mainRawData.map(d => {
  const z: ScoreMetrics = { visitor: (d.raw.visitor - mainStats.visitor.mean) / mainStats.visitor.std, spending: (d.raw.spending - mainStats.spending.mean) / mainStats.spending.std, accommodation: (d.raw.accommodation - mainStats.accommodation.mean) / mainStats.accommodation.std, price: (d.raw.price - mainStats.price.mean) / mainStats.price.std, growth: (d.raw.growth - mainStats.growth.mean) / mainStats.growth.std };
  const t: ScoreMetrics = { visitor: toTScore(z.visitor), spending: toTScore(z.spending), growth: toTScore(z.growth), accommodation: toTScore(z.accommodation, true), price: toTScore(z.price, true) };
  return [d.provinceId, { ...d, visitorTotal: d.raw.visitor, spendingTotal: d.raw.spending, accommodationTotal: d.raw.accommodation, landPriceTotal: d.raw.price, growthRate: d.raw.growth, nationalZ: z, nationalT: t, provincialZ: z, provincialT: t, opportunityScore: 0 }];
})) as Record<string, OpportunityDatum>;

const detailOpportunityByProvince = detailRawData.reduce((acc, d) => {
  const pStats = provStatsMap[d.provinceId];
  const natZ: ScoreMetrics = { visitor: (d.raw.visitor - detailNatStats.visitor.mean) / detailNatStats.visitor.std, spending: (d.raw.spending - detailNatStats.spending.mean) / detailNatStats.spending.std, accommodation: (d.raw.accommodation - detailNatStats.accommodation.mean) / detailNatStats.accommodation.std, price: (d.raw.price - detailNatStats.price.mean) / detailNatStats.price.std, growth: (d.raw.growth - detailNatStats.growth.mean) / detailNatStats.growth.std };
  const natT: ScoreMetrics = { visitor: toTScore(natZ.visitor), spending: toTScore(natZ.spending), growth: toTScore(natZ.growth), accommodation: toTScore(natZ.accommodation, true), price: toTScore(natZ.price, true) };
  const provZ: ScoreMetrics = { visitor: (d.raw.visitor - pStats.visitor.mean) / pStats.visitor.std, spending: (d.raw.spending - pStats.spending.mean) / pStats.spending.std, accommodation: (d.raw.accommodation - pStats.accommodation.mean) / pStats.accommodation.std, price: (d.raw.price - pStats.price.mean) / pStats.price.std, growth: (d.raw.growth - pStats.growth.mean) / pStats.growth.std };
  const provT: ScoreMetrics = { visitor: toTScore(provZ.visitor), spending: toTScore(provZ.spending), growth: toTScore(provZ.growth), accommodation: toTScore(provZ.accommodation, true), price: toTScore(provZ.price, true) };
  acc[d.provinceId] = acc[d.provinceId] || {};
  acc[d.provinceId][d.districtName!] = { ...d, visitorTotal: d.raw.visitor, spendingTotal: d.raw.spending, accommodationTotal: d.raw.accommodation, landPriceTotal: d.raw.price, growthRate: d.raw.growth, nationalZ: natZ, nationalT: natT, provincialZ: provZ, provincialT: provT, opportunityScore: 0 };
  return acc;
}, {} as Record<string, Record<string, OpportunityDatum>>);

export function getMainOpportunityScores() { return mainOpportunityByProvince; }
export function getDetailOpportunityScores(regionId: string) { return detailOpportunityByProvince[regionId] || {}; }