import realEstateCsvRaw from "../../data/real_estate_price.csv?raw";
import accommodationCsvRaw from "../../data/accommodation_status.csv?raw";
import { provinceIdToCsvName } from "./visitorData";

export interface ScatterDataItem {
  id: string;
  name: string;
  price: number;
  accommodation: number;
}

function parseCsv(rawText: string): string[][] {
  const lines = rawText.trim().split(/\r?\n/);

  return lines.slice(1).map((line) => {
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
  });
}

const realEstateRows = parseCsv(realEstateCsvRaw).map((cols) => ({
  province: cols[0],
  district: cols[1],
  price: Number(cols[2]?.replace(/,/g, "")) || 0,
}));

const accommodationRows = parseCsv(accommodationCsvRaw).map((cols) => {
  let totalAccommodation = 0;
  for (let i = 2; i <= 8; i += 1) {
    totalAccommodation += Number(cols[i]?.replace(/,/g, "")) || 0;
  }

  return {
    province: cols[0],
    district: cols[1],
    totalAccommodation,
  };
});

export function getScatterData(currentViewLevel: string): ScatterDataItem[] {
  if (currentViewLevel === "national") {
    return Object.entries(provinceIdToCsvName)
      .map(([id, provinceName]) => {
        const prices = realEstateRows.filter(
          (row) => row.province === provinceName && row.district !== "-",
        );
        const accommodations = accommodationRows.filter(
          (row) => row.province === provinceName && row.district !== "-",
        );

        const averagePrice =
          prices.length > 0
            ? prices.reduce((sum, row) => sum + row.price, 0) / prices.length
            : 0;
        const totalAccommodation = accommodations.reduce(
          (sum, row) => sum + row.totalAccommodation,
          0,
        );

        return {
          id,
          name: provinceName,
          price: Math.round(averagePrice),
          accommodation: totalAccommodation,
        };
      })
      .filter((row) => row.price > 0 || row.accommodation > 0);
  }

  const provinceName = provinceIdToCsvName[currentViewLevel];
  if (!provinceName) return [];

  return realEstateRows
    .filter((row) => row.province === provinceName && row.district !== "-")
    .map((priceRow) => {
      const accommodationRow = accommodationRows.find(
        (row) => row.province === provinceName && row.district === priceRow.district,
      );

      return {
        id: priceRow.district,
        name: priceRow.district,
        price: priceRow.price,
        accommodation: accommodationRow?.totalAccommodation ?? 0,
      };
    });
}
