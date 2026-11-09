import { useMemo, type ReactNode } from "react";
import { CONFIG } from "../lib/config";
import { fmtN, norm } from "../lib/format";
import { STATUS, STATUS_NOTE } from "../lib/icons";
import { SORTS, useStore } from "../lib/store";
import type { Area, GroupBy, Status } from "../lib/types";
import { useVisible } from "../lib/useVisible";
import { HoverTip } from "./HoverTip";
import { Icon } from "./Icon";

interface Group {
  key: string;
  label: string;
  lead?: ReactNode;
  items: Area[];
}

const STATUS_ORDER: Status[] = ["requested", "progress", "released", "unable", "alternative"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const byName = (a: Area, b: Area) => a.name.localeCompare(b.name);
const byRegion = (a: Area, b: Area) => a.region.localeCompare(b.region) || byName(a, b);

function buildGroups(list: Area[], group: GroupBy): Group[] {
  if (group === "country") {
    const countries = [...new Set(list.map((a) => a.country))].sort((a, b) => a.localeCompare(b));
    return countries.map((c) => ({
      key: c,
      label: c,
      items: list.filter((a) => a.country === c).sort(byRegion),
    }));
  }
  if (group === "az") {
    const sorted = [...list].sort(byName);
    const letter = (a: Area) => {
      const l = norm(a.name)[0]?.toUpperCase() ?? "#";
      return LETTERS.includes(l) ? l : "#";
    };
    return [...new Set(sorted.map(letter))].map((l) => ({
      key: l,
      label: l,
      items: sorted.filter((a) => letter(a) === l),
    }));
  }
  const ranked = [...list].sort(CONFIG.votes ? SORTS.votes : byName);
  return STATUS_ORDER.filter((s) => list.some((a) => a.status === s)).map((s) => ({
    key: s,
    label: STATUS[s].label,
    lead: <span className="sdot" style={{ background: STATUS[s].color }} />,
    items: ranked.filter((a) => a.status === s),
  }));
}

function AreaItem({ area: a }: { area: Area }) {
  const selected = useStore((s) => s.selectedId === a.id);
  const hovered = useStore((s) => s.hoveredId === a.id);
  const openDetail = useStore((s) => s.openDetail);
  const patch = useStore((s) => s.patch);
  const status = STATUS[a.status];

  return (
    <button
      className={"item" + (selected ? " sel" : "") + (hovered ? " hl" : "") + (a.hidden ? " off" : "")}
      onClick={() => openDetail(a.id)}
      onMouseEnter={() => patch({ hoveredId: a.id })}
      onMouseLeave={() => patch({ hoveredId: null })}
    >
      <HoverTip
        className="sdot item-dot"
        label={status.label}
        tip={STATUS_NOTE[a.status] ?? status.label}
        place="above"
        style={{ background: status.color }}
      />
      <div className="item-main">
        <div className="item-head">
          <div className="item-title">{a.name}</div>
          {a.noPhotogrammetry && (
            <HoverTip
              className="no-pg"
              place="right"
              label="Not a photogrammetry zone, so final results may not be very noticeable"
              tip={
                <>
                  <strong>Not a photogrammetry zone</strong>
                  Final results may not be very noticeable.
                </>
              }
            >
              <Icon name="alert" size={13} />
            </HoverTip>
          )}
        </div>
        <div className="item-sub">
          <span className="item-place">{a.region.split(",")[0]}</span>
          {CONFIG.database && a.comments.length > 0 && (
            <span>
              <Icon name="cmt" size={12} />
              {a.comments.length}
            </span>
          )}
        </div>
      </div>
      {CONFIG.votes && (
        <div className={"votes-pill" + (a.voted ? " on" : "")}>
          <Icon name="up" size={13} weight={2} />
          {fmtN(a.votes)}
        </div>
      )}
    </button>
  );
}

export function AreaList() {
  const group = useStore((s) => s.group);
  const collapsed = useStore((s) => s.collapsed);
  const patch = useStore((s) => s.patch);
  const toggleGroup = useStore((s) => s.toggleGroup);
  const loaded = useStore((s) => s.loaded);
  const list = useVisible(true);

  const flat = group === "votes" || group === "new";
  const groups = useMemo(() => (flat ? [] : buildGroups(list, group)), [flat, list, group]);
  const items = useMemo(
    () => (flat ? [...list].sort(SORTS[group === "new" ? "new" : "votes"]) : []),
    [flat, list, group],
  );

  return (
    <>
      <div className="list-head">
        <label className="title-sel" title="Change how the list is grouped">
          <select
            aria-label="Group list by"
            value={group}
            onChange={(e) => patch({ group: e.target.value as GroupBy })}
          >
            <option value="country">Countries</option>
            <option value="az">A–Z</option>
            {CONFIG.votes && <option value="votes">Top voted</option>}
            <option value="new">Newest</option>
            <option value="status">By status</option>
          </select>
          <Icon d='<path d="m6 9 6 6 6-6"/>' size={16} weight={2.4} />
        </label>
        <span className="n">{list.length}</span>
      </div>

      {group === "az" && (
        <div className="az-bar">
          {LETTERS.map((l) => (
            <button
              key={l}
              disabled={!groups.some((g) => g.key === l)}
              onClick={() => document.getElementById("g-az-" + l)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 && (
        <div className="empty">{loaded ? "No areas match. Try another search, or request this area." : "Loading…"}</div>
      )}

      {flat && items.map((a) => <AreaItem key={a.id} area={a} />)}

      {groups.map((g) => {
        const id = `${group}:${g.key}`;
        const shut = collapsed.has(id);
        return (
          <div key={id} className="grp-wrap">
            <button
              id={`g-${group}-${g.key}`}
              className={"grp-h" + (shut ? " collapsed" : "")}
              aria-expanded={!shut}
              onClick={() => toggleGroup(id)}
            >
              {g.lead}
              <span className="gl">{g.label}</span>
              <span className="chev">
                <Icon d='<path d="m6 9 6 6 6-6"/>' size={13} weight={2.4} />
              </span>
            </button>
            {!shut && (
              <div className="grp-items">
                {g.items.map((a) => (
                  <AreaItem key={a.id} area={a} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
