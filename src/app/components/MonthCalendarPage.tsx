import { useNavigate, useParams } from "react-router";
import { Map, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const monthsKo = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const provinces = [{ id: "seoul", name: "서울" }, { id: "incheon", name: "인천" }, { id: "gyeonggi", name: "경기" }, { id: "busan", name: "부산" }, { id: "jeju", name: "제주" }];
const dummyDistricts: Record<string, string[]> = { seoul: ["종로구", "강남구", "송파구"], gyeonggi: ["수원시", "성남시"], busan: ["해운대구", "수영구"] };

//  Color Intensity 
const getHeatmapColor = (value: number, min: number, max: number) => {
  const normalized = (value - min) / (max - min || 1);
  const opacity = 0.15 + normalized * 0.85;
  return `rgba(255, 99, 91, ${opacity})`;
};

export function MonthCalendarPage() {
  const navigate = useNavigate();
  const { year, month } = useParams();
  
  const [currentYear, setCurrentYear] = useState(Number(year));
  const [currentMonth, setCurrentMonth] = useState(Number(month) - 1);
  const [selProvince, setSelProvince] = useState("seoul");
  const [selDistrict, setSelDistrict] = useState("전체");

  const [dragStart, setDragStart] = useState<number | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) { setCurrentYear(p => p - 1); setCurrentMonth(11); } 
    else { setCurrentMonth(p => p - 1); }
    setSelectedRange(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentYear(p => p + 1); setCurrentMonth(0); } 
    else { setCurrentMonth(p => p + 1); }
    setSelectedRange(null);
  };

  const dailyData = useMemo(() => {
    const seed = currentYear * 100 + currentMonth + selProvince.length;
    return Array.from({ length: daysInMonth }, (_, i) => Math.floor((Math.sin(seed + i) + 1) * 3000) + 1000);
  }, [currentYear, currentMonth, selProvince, selDistrict, daysInMonth]);

  const minD = Math.min(...dailyData);
  const maxD = Math.max(...dailyData);

  const avgVisitors = useMemo(() => {
    if (!selectedRange) return null;
    const range = dailyData.slice(selectedRange.start - 1, selectedRange.end);
    return range.reduce((a, b) => a + b, 0) / range.length;
  }, [selectedRange, dailyData]);

  const yearlyTrend = useMemo(() => {
    const seed = selProvince.length + currentYear;
    return monthsKo.map((m, i) => ({ month: m, visitors: Math.floor((Math.sin(seed + i) + 1) * 1500) + 2000 }));
  }, [selProvince, currentYear]);

  const countryData = useMemo(() => {
    const seed = (selectedRange?.start || 1) + selProvince.length;
    return ["중국", "일본", "미국", "대만", "베트남"].map((c, i) => ({ name: c, value: Math.floor((Math.sin(seed + i) + 1) * 2000) + 500 })).sort((a, b) => b.value - a.value);
  }, [selectedRange, selProvince]);

  const handleMouseDown = (d: number) => { setDragStart(d); setSelectedRange({ start: d, end: d }); };
  const handleMouseEnter = (d: number) => {
    if (dragStart !== null) setSelectedRange({ start: Math.min(dragStart, d), end: Math.max(dragStart, d) });
  };

  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const d = i - firstDay + 1;
    return (d >= 1 && d <= daysInMonth) ? d : null;
  });

  return (
    <div className="w-full h-screen bg-gray-50 p-6 flex flex-col overflow-hidden" onMouseUp={() => setDragStart(null)}>
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/calendar")} className="p-2 hover:bg-gray-100 rounded-full font-bold text-blue-600 transition-colors">
            ← 연간보기
          </button>
          <div className="h-8 w-[1px] bg-gray-200 mx-2" />
          <div className="flex items-center gap-3">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={24} className="text-gray-600" /></button>
            <h1 className="text-2xl font-black text-gray-800 min-w-[150px] text-center">{currentYear}년 {monthsKo[currentMonth]}</h1>
            <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight size={24} className="text-gray-600" /></button>
          </div>
        </div>

        <div className="flex gap-2">
          <select value={selProvince} onChange={(e) => {setSelProvince(e.target.value); setSelDistrict("전체");}} className="bg-gray-100 border-none text-sm rounded-lg px-4 py-2 font-bold outline-none focus:ring-2 ring-blue-300">
            {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={selDistrict} onChange={(e) => setSelDistrict(e.target.value)} className="bg-gray-100 border-none text-sm rounded-lg px-4 py-2 font-bold outline-none focus:ring-2 ring-blue-300">
            <option value="전체">전체 구역</option>
            {dummyDistricts[selProvince]?.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className={`bg-white rounded-2xl shadow-lg p-6 flex flex-col transition-all ${selectedRange ? 'w-[50%]' : 'w-full max-w-4xl mx-auto'}`}>
          <div className="grid grid-cols-7 gap-2 mb-2 shrink-0">
            {["일", "월", "화", "수", "목", "금", "토"].map(d => <div key={d} className="text-center font-bold text-gray-400">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2 flex-1 min-h-0">
            {calendarDays.map((day, index) => {
              const visitors = day ? dailyData[day - 1] : 0;
              const bgColor = day ? getHeatmapColor(visitors, minD, maxD) : "transparent";
              const isSelected = day !== null && selectedRange && day >= selectedRange.start && day <= selectedRange.end;
              
              // 명도 판별: 어두우면 글씨 반전
              const isDark = day && (visitors - minD) / (maxD - minD || 1) > 0.45;

              return (
                <div
                  key={index}
                  onMouseDown={() => day && handleMouseDown(day)}
                  onMouseEnter={() => day && handleMouseEnter(day)}
                  className={`relative flex flex-col items-center justify-center rounded-xl transition-all ${day ? "cursor-pointer" : "opacity-0 pointer-events-none"}
                    ${isSelected ? "ring-4 ring-black z-10 shadow-lg scale-[1.02]" : "border border-transparent hover:scale-105"}
                  `}
                  style={{ backgroundColor: bgColor }}
                >
                  <span className={`text-xl font-black ${isDark ? "text-white" : "text-gray-800"}`}>{day}</span>
                  {day && <span className={`text-[10px] font-bold mt-1 ${isDark ? "text-white/80" : "text-gray-500"}`}>{visitors.toLocaleString()}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {selectedRange && (
          <div className="w-[50%] flex flex-col gap-4">
            <div className="flex-1 bg-white rounded-2xl shadow-lg p-5 border border-gray-200 flex flex-col min-h-[250px]">
              <h3 className="text-sm font-bold text-gray-800 mb-2">연간 트렌드 및 선택 기간 평균</h3>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyTrend} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="month" style={{ fontSize: "11px" }} />
                    <YAxis style={{ fontSize: "11px" }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="visitors" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                    {avgVisitors && (
                      <ReferenceLine y={avgVisitors} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" label={{ value: `선택 평균: ${Math.round(avgVisitors)}`, fill: '#ef4444', position: 'top', fontSize: 11, fontWeight: 'bold' }} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="flex-1 bg-white rounded-2xl shadow-lg p-5 border border-gray-200 flex flex-col min-h-[250px]">
              <h3 className="text-sm font-bold text-gray-800 mb-2">주요 방문객 국적 (선택 기간 기준)</h3>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countryData} layout="vertical" margin={{ top: 10, left: -10, right: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" style={{ fontSize: "11px" }} />
                    <YAxis type="category" dataKey="name" width={60} style={{ fontSize: "11px", fontWeight: "bold" }} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} animationDuration={300} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      <button onClick={() => navigate("/")} className="fixed left-6 bottom-6 w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-gray-200 hover:border-blue-500 z-50 transition-transform active:scale-95">
        <Map className="w-6 h-6 text-gray-700" />
      </button>
    </div>
  );
}