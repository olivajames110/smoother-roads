import { useState } from "react";
import { CONFIG } from "../lib/config";
import { useStore } from "../lib/store";
import type { Area } from "../lib/types";
import { Icon } from "./Icon";
import { Photos } from "./Photos";
import { PoiList, ROUTE, STAR } from "./Pois";

type Tab = "photos" | "place" | "route";

// Photos, places to visit and routes to drive, as tabs in one section
export function Media({ area: a }: { area: Area }) {
  const admin = useStore((s) => s.admin);
  const photos = (a.photos ?? []).filter((p) => p.approved).length;
  const places = (a.pois ?? []).filter((p) => p.kind === "place" && p.approved).length;
  const routes = (a.pois ?? []).filter((p) => p.kind === "route" && p.approved).length;
  const showPhotos = CONFIG.photos && (photos > 0 || admin);
  const [tab, setTab] = useState<Tab>(showPhotos && photos > 0 ? "photos" : "place");
  const current: Tab = tab === "photos" && !showPhotos ? "place" : tab;

  const tabBtn = (key: Tab, icon: string | null, label: string, n: number) => (
    <button
      key={key}
      role="tab"
      aria-selected={current === key}
      className={current === key ? "on" : ""}
      onClick={() => setTab(key)}
    >
      {icon ? <Icon d={icon} size={13} weight={2.2} /> : <Icon name="img" size={13} weight={2.2} />}
      {label} <span className="n">{n}</span>
    </button>
  );

  return (
    <div className="media-sec">
      <div className="poi-tabs" role="tablist">
        {showPhotos && tabBtn("photos", null, "Photos", photos)}
        {tabBtn("place", STAR, "Places", places)}
        {tabBtn("route", ROUTE, "Routes", routes)}
      </div>
      {current === "photos" ? <Photos area={a} bare /> : <PoiList key={current} area={a} kind={current} />}
    </div>
  );
}
