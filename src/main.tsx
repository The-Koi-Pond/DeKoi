import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRoot } from "./app";
import "./shared/ui/pond-tokens.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
