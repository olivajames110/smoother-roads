import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./styles.css";
import { App } from "./App";
import { Admin } from "./components/Admin";

// The vote page (components/NextVote.tsx, ?vote) is switched off for now
const page = new URLSearchParams(location.search);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {page.has("admin") ? <Admin /> : <App />}
  </StrictMode>,
);
