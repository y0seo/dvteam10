import { useNavigate } from "react-router";
import { Map, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

const monthsKo = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

const provinces = [
  { id: "seoul", name: "서울" }, { id: "incheon", name: "인천" },
  { id: "gyeonggi", name: "경기" }, { id: "busan", name: "부산" }, { id: "jeju", name: "제주" }
];
const dummyDistricts: Record<string, string[]> = {
  seoul: ["종로구", "강남구", "송파구"], gyeonggi: ["수원시", "성남시"], busan: ["해운대구", "수영구"],
};

//  Color Intensity 
const getHeatmapColor = (value: number, min: number, max: number) => {
  const normalized = (value - min) / (max - min || 1);
  const opacity = 0.15 + normalized * 0.85; 
  return `rgba(255, 99, 91, ${opacity})`;
};

export function YearCalendarPage() {
  const navigate = useNavigate();
  const [currentYear, setCurrentYear] = useState(2024);
  const [selProvince, setSelProvince] = useState("seoul");
  const [selDistrict, setSelDistrict] = useState("전체");

  const monthVisitorData = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const seed = currentYear * 10 + index * 2 + selProvince.length + selDistrict.length;
      return Math.floor((Math.sin(seed) + 1) * 20000) + 20000;
    });
  }, [currentYear, selProvince, selDistrict]);

  const minV = Math.min(...monthVisitorData);
  const maxV = Math.max(...monthVisitorData);

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-2 bg-white p-3 rounded-2xl shadow-sm border border-gray-200 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button onClick={() => setCurrentYear(y => y - 1)} className="p-1 hover:bg-white rounded-md shadow-sm"><ChevronLeft size={16}/></button>
            <span className="px-3 font-bold text-lg">{currentYear}년</span>
            <button onClick={() => setCurrentYear(y => y + 1)} className="p-1 hover:bg-white rounded-md shadow-sm"><ChevronRight size={16}/></button>
          </div>
          <div className="flex gap-2">
            <select value={selProvince} onChange={(e) => {setSelProvince(e.target.value); setSelDistrict("전체");}} className="bg-gray-50 border border-gray-300 text-xs rounded-lg px-2 py-1 font-bold outline-none">
              {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={selDistrict} onChange={(e) => setSelDistrict(e.target.value)} className="bg-gray-50 border border-gray-300 text-xs rounded-lg px-2 py-1 font-bold outline-none">
              <option value="전체">전체 구역</option>
              {dummyDistricts[selProvince]?.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-bold text-gray-600">
          <span>밀집도:</span>
          <div className="flex items-center gap-1"><div className="w-4 h-4 rounded-sm" style={{ backgroundColor: "rgba(255, 99, 91, 0.2)" }}/>적음</div>
          <div className="flex items-center gap-1"><div className="w-4 h-4 rounded-sm" style={{ backgroundColor: "rgba(255, 99, 91, 0.6)" }}/>보통</div>
          <div className="flex items-center gap-1"><div className="w-4 h-4 rounded-sm" style={{ backgroundColor: "rgba(255, 99, 91, 1)" }}/>많음</div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-4 grid-rows-3 gap-2 min-h-0">
        {monthsKo.map((m, i) => {
          const visitors = monthVisitorData[i];
          const bgColor = getHeatmapColor(visitors, minV, maxV);
          
          // 명도 판별: 어두우면 흰색 글씨, 밝으면 어두운 글씨
          const isDark = (visitors - minV) / (maxV - minV || 1) > 0.45;
          const firstDay = new Date(currentYear, i, 1).getDay();
          
          return (
            <div 
              key={m} 
              onClick={() => navigate(`/calendar/${currentYear}/${i + 1}`)}
              className="border border-transparent hover:border-blue-600 rounded-xl p-2 shadow-sm transition-all cursor-pointer flex flex-col justify-between"
              style={{ backgroundColor: bgColor }}
            >
              <div className="flex justify-between items-center mb-0.5 px-1">
                <span className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-800"}`}>{m}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? "bg-white/20 text-white" : "bg-white/70 text-gray-700"}`}>
                  {visitors.toLocaleString()}
                </span>
              </div>
              
              <div className="flex-1 flex items-center justify-center min-h-0">
                <div className="grid grid-cols-7 gap-0.5 w-full max-w-[130px]">
                  {["일", "월", "화", "수", "목", "금", "토"].map(d => (
                    <div key={d} className={`text-[9px] text-center font-bold mb-0.5 ${isDark ? "text-white/70" : "text-gray-500"}`}>{d}</div>
                  ))}
                  {Array.from({ length: 35 }, (_, idx) => {
                    const day = idx - firstDay + 1;
                    const isValid = day >= 1 && day <= new Date(currentYear, i + 1, 0).getDate();
                    return (
                      <div key={idx} className={`h-[14px] flex items-center justify-center text-[8px] rounded-sm font-bold ${isValid ? (isDark ? "bg-white/30 text-white" : "bg-white/60 text-gray-700") : ""}`}>
                        {isValid ? day : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={() => navigate("/")} className="fixed left-8 bottom-8 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-gray-200 hover:border-blue-500 z-50">
        <Map className="w-5 h-5 text-gray-700" />
      </button>
    </div>
  );
}