import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import App from "./App";
import { Analytics } from "@vercel/analytics/react";

// テーマ（dark=参加者 / light=運営）は App.jsx が役割に応じて切り替える
document.body.classList.add("theme-expo-dark");

ReactDOM.createRoot(document.getElementById("root")).render(
  <>
    <Analytics />
    <App />
  </>
);
