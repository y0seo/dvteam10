import { createBrowserRouter } from "react-router";
import { MainPage } from "./components/MainPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainPage,
  },
]);
