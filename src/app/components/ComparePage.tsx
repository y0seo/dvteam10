import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

type CompareRegion = {
  id: string;
  name: string;
  provinceId: string;
  provinceName: string;
};

export function ComparePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const regions = ((location.state as { regions?: CompareRegion[] } | null)?.regions || []).slice(0, 3);

  return (
    <div className="relative min-h-screen bg-gray-100 p-8">
      <button
        onClick={() => navigate("/")}
        className="fixed left-8 bottom-8 w-14 h-14 bg-white rounded-full shadow-lg hover:shadow-2xl transition-all flex items-center justify-center border-2 border-gray-200 hover:border-blue-500 z-50"
        aria-label="메인페이지로 돌아가기"
      >
        <ArrowLeft className="w-7 h-7 text-blue-600" />
      </button>

      <main className="max-w-6xl mx-auto h-[calc(100vh-4rem)] flex flex-col gap-6">
        <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <p className="text-sm font-bold text-blue-600 mb-1">지역 비교</p>
              <h1 className="text-2xl font-black text-gray-900">선택한 기초지자체</h1>
            </div>
            <span className="w-12 h-12 rounded-full border-2 border-blue-600 text-blue-600 flex items-center justify-center text-sm font-black tracking-tight">
              VS
            </span>
          </div>

          {regions.length > 0 ? (
            <div className={`grid gap-4 ${regions.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {regions.map((region, index) => (
                <div key={region.id} className="rounded-xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-blue-600 mb-2">비교 지역 {index + 1}</p>
                      <h2 className="text-xl font-black text-gray-900 truncate">{region.name}</h2>
                      <p className="text-sm font-semibold text-gray-500 mt-1">{region.provinceName}</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-white border border-blue-100 flex items-center justify-center text-blue-600 font-black shrink-0">
                      {index + 1}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <p className="text-sm font-semibold text-gray-500">아직 선택된 지역이 없습니다.</p>
            </div>
          )}
        </section>

        <section className="flex-1 bg-white rounded-2xl shadow-lg border border-gray-200" />
      </main>
    </div>
  );
}
