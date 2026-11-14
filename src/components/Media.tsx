import { useState } from "react";
import { CONFIG } from "../lib/config";
import { useStore } from "../lib/store";
import type { Area } from "../lib/types";
import { Icon } from "./Icon";
import { Photos } from "./Photos";
import { PoiList, ROUTE, STAR } from "./Pois";

export type MediaTab = "photos" | "place" | "route";
type Tab = MediaTab;

// Photos, places to visit and routes to drive, as tabs in one section
// preview: the same section as a picture (the what's new note): tabs switch, nothing else is clickable
export function Media({ area: a, preview, start }: { area: Area; preview?: boolean; start?: MediaTab }) {
  const admin = useStore((s) => s.admin) && !preview;
  const photos = (a.photos ?? []).filter((p) => p.approved).length;
  const places = (a.pois ?? []).filter((p) => p.kind === "place" && p.approved).length;
  const routes = (a.pois ?? []).filter((p) => p.kind === "route" && p.approved).length;
  const showPhotos = CONFIG.photos && (photos > 0 || admin);
  const [tab, setTab] = useState<Tab>(start ?? (showPhotos && photos > 0 ? "photos" : "place"));
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
    <div className={"media-sec" + (preview ? " preview" : "")}>
      <div className="poi-tabs" role="tablist">
        {showPhotos && tabBtn("photos", null, "Photos", photos)}
        {tabBtn("place", STAR, "Places", places)}
        {tabBtn("route", ROUTE, "Routes", routes)}
      </div>
      <div className="media-body" inert={preview}>
        {current === "photos" ? <Photos area={a} bare /> : <PoiList key={current} area={a} kind={current} preview={preview} />}
      </div>
    </div>
  );
}
