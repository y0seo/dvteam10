import realEstateCsvRaw from "../../data/real_estate_price.csv?raw";
import accommodationCsvRaw from "../../data/accommodation_status.csv?raw";
import { provinceIdToCsvName } from "./nationality"; // 기존 시도 매핑 딕셔너리 재사용

export interface ScatterDataItem {
  id: string;        // 시군구 이름 또는 시도 ID (기존 지도 key와 매핑용)
  name: string;      // 화면에 표시할 지역 이름 (툴팁용)
  price: number;     // X축: 1m²당 평균거래금액(만원)
  accommodation: number; // Y축: 총 숙박업소 수
}

function parseCsv(rawText: string): string[][] {
  const lines = rawText.trim().split(/\r?\n/);
  return lines.slice(1).map(line => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

// 1. 부동산 데이터 로드 및 파싱
const realEstateRows = parseCsv(realEstateCsvRaw).map(cols => ({
  province: cols[0],
  district: cols[1],
  price: Number(cols[2]?.replace(/,/g, "")) || 0
}));

// 2. 숙박업소 데이터 로드 및 파싱 (여러 숙박 형태의 총합을 계산)
const accommodationRows = parseCsv(accommodationCsvRaw).map(cols => {
  // 인덱스 2번부터 8번까지가 각종 숙박업소 수 열입니다.
  let totalSum = 0;
  for (let i = 2; i <= 8; i++) {
    totalSum += Number(cols[i]?.replace(/,/g, "")) || 0;
  }
  return {
    province: cols[0],
    district: cols[1],
    totalAccommodation: totalSum
  };
});

/**
 * 지도의 선택 상태에 따라 산점도(Scatter Plot)에 뿌려줄 데이터를 반환하는 함수
 * @param currentViewLevel 'national' 또는 'seoul' 등 시도 ID
 * @param selectedSubRegion 선택된 시군구명 (텍스트 또는 ID)
 */
export function getScatterData(
  currentViewLevel: string,
  selectedSubRegion: string | null
): ScatterDataItem[] {
  
  // 전국 단위 보기일 때 -> 각 '시도(Province)'별 평균 지가와 총 숙박업소 수 계산
  if (currentViewLevel === "national") {
    const provinceSummary: Record<string, { priceSum: number; priceCount: number; accSum: number; id: string }> = {};

    // 시도 매핑 역추적용 딕셔너리 생성 (CSV명 -> ID)
    const csvNameToId = Object.fromEntries(
      Object.entries(provinceIdToCsvName).map(([id, name]) => [name, id])
    );

    // 전국 모드일 때는 기초지자체가 없거나 '-'인 데이터 위주로 매핑하거나 시도 평균을 냅니다.
    // 여기서는 각 시도 내부 시군구들의 '평균 가격'과 '숙박업소 총합'으로 요약합니다.
    Object.entries(provinceIdToCsvName).forEach(([id, name]) => {
      // 해당 시도에 속한 시군구들 필터링
      const prices = realEstateRows.filter(r => r.province === name && r.district !== "-");
      const accs = accommodationRows.filter(r => r.province === name && r.district !== "-");

      const avgPrice = prices.length > 0 ? prices.reduce((sum, r) => sum + r.price, 0) / prices.length : 0;
      const totalAcc = accs.reduce((sum, r) => sum + r.totalAccommodation, 0);

      if (avgPrice > 0 || totalAcc > 0) {
        provinceSummary[name] = {
          id: id,
          priceSum: avgPrice,
          priceCount: 1,
          accSum: totalAcc
        };
      }
    });

    return Object.entries(provinceSummary).map(([name, data]) => ({
      id: data.id,
      name: name,
      price: Math.round(data.priceSum),
      accommodation: data.accSum
    }));
  }

  // 특정 시도(예: 서울) 안으로 들어왔을 때 -> 해당 시도 내 '시군구(District)' 단위 점들을 나열
  const targetProvinceName = provinceIdToCsvName[currentViewLevel];
  if (!targetProvinceName) return [];

  // 특정 시도 내의 시군구 목록 추출
  const districtPrices = realEstateRows.filter(r => r.province === targetProvinceName && r.district !== "-");
  
  return districtPrices.map(p => {
    const matchAcc = accommodationRows.find(
      a => a.province === targetProvinceName && a.district === p.district
    );
    return {
      id: p.district, // 시군구 이름을 ID로 활용하여 지도 클릭 이벤트와 대조
      name: p.district,
      price: p.price,
      accommodation: matchAcc ? matchAcc.totalAccommodation : 0
    };
  });
}