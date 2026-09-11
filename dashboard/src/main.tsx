import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Tooltip } from "@base-ui/react/tooltip";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Tooltip.Provider delay={280} closeDelay={80}>
      <App />
    </Tooltip.Provider>
  </StrictMode>,
);
