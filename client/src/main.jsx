import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import App from "./App";
import { Analytics } from "@vercel/analytics/react"

document.body.classList.add("theme-lava");

ReactDOM.createRoot(document.getElementById("root")).render(
  <>
    <Analytics />
    <App />
  </>
);
