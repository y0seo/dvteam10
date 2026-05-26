import { createBrowserRouter } from "react-router";
import { MainPage } from "./components/MainPage";
import { YearCalendarPage } from "./components/YearCalendarPage";
import { MonthCalendarPage } from "./components/MonthCalendarPage";
import { DateDetailPage } from "./components/DateDetailPage";
import { ComparePage } from "./components/ComparePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainPage,
  },
  {
    path: "/compare",
    Component: ComparePage,
  },
]);
