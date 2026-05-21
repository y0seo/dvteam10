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
    path: "/calendar",
    Component: YearCalendarPage,
  },
  {
    path: "/calendar/:year/:month",
    Component: MonthCalendarPage,
  },
  {
    path: "/calendar/:year/:month/details",
    Component: DateDetailPage,
  },
  {
    path: "/compare",
    Component: ComparePage,
  },
]);
