export type Continent = "아시아" | "유럽" | "북미" | "남미" | "오세아니아" | "아프리카" | "기타";

export const CONTINENT_COLORS: Record<Continent, string> = {
  아시아: "#fb8734",     
  유럽: "#3b82f6",      
  북미: "#ef4444",       
  남미: "#10b981",       
  오세아니아: "#8b5cf6", 
  아프리카: "#eab308",   
  기타: "#9ca3af"       
};

export interface CountryMeta {
  continent: Continent;
  countryCode: string; 
}

export const COUNTRY_META: Record<string, CountryMeta> = {
  "대만": { continent: "아시아", countryCode: "tw" },
  "홍콩": { continent: "아시아", countryCode: "hk" },
  "태국": { continent: "아시아", countryCode: "th" },
  "인도네시아": { continent: "아시아", countryCode: "id" },
  "말레이시아": { continent: "아시아", countryCode: "my" },
  "베트남": { continent: "아시아", countryCode: "vn" },
  "싱가포르": { continent: "아시아", countryCode: "sg" },
  "중국": { continent: "아시아", countryCode: "cn" },
  "몽골": { continent: "아시아", countryCode: "mn" },
  "필리핀": { continent: "아시아", countryCode: "ph" },
  "일본": { continent: "아시아", countryCode: "jp" },
  "인도": { continent: "아시아", countryCode: "in" },
  "카자흐스탄": { continent: "아시아", countryCode: "kz" },
  "사우디아라비아": { continent: "아시아", countryCode: "sa" },
  "아랍에미리트": { continent: "아시아", countryCode: "ae" },
  "러시아": { continent: "유럽", countryCode: "ru" },
  "독일": { continent: "유럽", countryCode: "de" },
  "영국": { continent: "유럽", countryCode: "gb" },
  "프랑스": { continent: "유럽", countryCode: "fr" },
  "튀르키예": { continent: "유럽", countryCode: "tr" },
  "미국": { continent: "북미", countryCode: "us" },
  "캐나다": { continent: "북미", countryCode: "ca" },
  "멕시코": { continent: "북미", countryCode: "mx" },
  "호주": { continent: "오세아니아", countryCode: "au" },
  "기타": { continent: "기타", countryCode: "" }, 
};

export const getCountryMeta = (name: string): CountryMeta => {
  return COUNTRY_META[name] || { continent: "기타", countryCode: "" };
};