import { createBrowserRouter } from "react-router";
import { MainPage } from "./components/MainPage";
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
