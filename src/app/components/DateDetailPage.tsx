import { useNavigate, useParams, useLocation } from "react-router";
import { ChevronLeft, Calendar } from "lucide-react";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function DateDetailPage() {
  const navigate = useNavigate();
  const { year, month } = useParams<{ year: string; month: string }>();
  const location = useLocation();
  const { startDate, endDate } = location.state || { startDate: 1, endDate: 1 };

  const monthIndex = Number(month) - 1;
  const monthName = months[monthIndex];

  const mockEvents = [
    { title: "Meeting with Team", time: "10:00 AM", type: "work" },
    { title: "Project Review", time: "2:00 PM", type: "work" },
    { title: "Client Presentation", time: "4:30 PM", type: "important" },
    { title: "Dinner Plans", time: "7:00 PM", type: "personal" },
  ];

  return (
    <div className="w-full min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="flex items-center mb-8">
        <button
          onClick={() => navigate(`/calendar/${year}/${month}`)}
          className="mr-4 p-2 hover:bg-gray-200 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-4xl font-bold text-gray-800">
          {monthName} {startDate}
          {startDate !== endDate && ` - ${endDate}`}, {year}
        </h1>
      </div>

      {/* Details Content */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Date Range Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center mb-4">
            <Calendar className="w-6 h-6 mr-3 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-800">
              선택된 기간
            </h2>
          </div>
          <p className="text-gray-600">
            {monthName} {startDate}일부터 {endDate}일까지 총 {endDate - startDate + 1}일간의 일정
          </p>
        </div>

        {/* Events List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">일정 목록</h3>
          <div className="space-y-4">
            {mockEvents.map((event, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-l-4 ${
                  event.type === "important"
                    ? "bg-red-50 border-red-500"
                    : event.type === "work"
                    ? "bg-blue-50 border-blue-500"
                    : "bg-green-50 border-green-500"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-800">{event.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{event.time}</p>
                  </div>
                  <span
                    className={`text-xs px-3 py-1 rounded-full ${
                      event.type === "important"
                        ? "bg-red-200 text-red-800"
                        : event.type === "work"
                        ? "bg-blue-200 text-blue-800"
                        : "bg-green-200 text-green-800"
                    }`}
                  >
                    {event.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {mockEvents.filter((e) => e.type === "work").length}
            </div>
            <div className="text-sm text-gray-600 mt-2">업무 일정</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl font-bold text-red-600">
              {mockEvents.filter((e) => e.type === "important").length}
            </div>
            <div className="text-sm text-gray-600 mt-2">중요 일정</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl font-bold text-green-600">
              {mockEvents.filter((e) => e.type === "personal").length}
            </div>
            <div className="text-sm text-gray-600 mt-2">개인 일정</div>
          </div>
        </div>
      </div>
    </div>
  );
}
