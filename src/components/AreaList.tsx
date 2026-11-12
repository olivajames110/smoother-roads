import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CONFIG } from "../lib/config";
import { fmtN, norm } from "../lib/format";
import { STATUS, sideColor, statusLabel, statusNote } from "../lib/icons";
import { SORTS, useStore } from "../lib/store";
import type { Area, GroupBy, Status } from "../lib/types";
import { useVisible } from "../lib/useVisible";
import { HoverTip } from "./HoverTip";
import { Icon } from "./Icon";
import { StatusFilter } from "./Legend";

interface Group {
  key: string;
  label: string;
  lead?: ReactNode;
  items: Area[];
}

const STATUS_ORDER: Status[] = ["requested", "progress", "released", "unable"];
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
  const toggleVote = useStore((s) => s.toggleVote);
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
        label={statusLabel(a)}
        tip={statusNote(a) ? `${statusLabel(a)}: ${statusNote(a)}` : status.label}
        place="above"
        style={{ background: `linear-gradient(90deg, ${status.color} 50%, ${sideColor(a)} 50%)` }}
      />
      <div className="item-main">
        <div className="item-head">
          <div className="item-title">{a.name}</div>
          {a.hidden && (
            <span className="hid-tag" title="Hidden from visitors: only you can see it">
              <Icon name="eyeOff" size={12} weight={2.2} />
              Hidden
            </span>
          )}
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
        <span
          role="button"
          tabIndex={0}
          className={"votes-pill" + (a.voted ? " on" : "")}
          aria-pressed={a.voted}
          title={a.voted ? "Remove your upvote" : "Upvote"}
          onClick={(e) => {
            e.stopPropagation();
            toggleVote(a.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              toggleVote(a.id);
            }
          }}
        >
          <Icon name="up" size={13} weight={2} />
          {fmtN(a.votes)}
        </span>
      )}
    </button>
  );
}

// How the list is grouped or sorted: the title is the button, the choices drop down beneath it
const VIEWS: { key: GroupBy; label: string; icon: string; section: "Group" | "Sort" }[] = [
  { key: "country", label: "Countries", section: "Group",
    icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>' },
  { key: "az", label: "A–Z", section: "Group", icon: '<path d="M4 18 8 6l4 12M5.5 14h5M14 6h6l-6 12h6"/>' },
  { key: "status", label: "Status", section: "Group", icon: '<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/>' },
  { key: "votes", label: "Top voted", section: "Sort", icon: '<path d="M12 4 4 13h5v7h6v-7h5z"/>' },
  { key: "new", label: "Newest", section: "Sort", icon: '<path d="M12 5v14M6 13l6 6 6-6"/>' },
  { key: "old", label: "Oldest", section: "Sort", icon: '<path d="M12 19V5M6 11l6-6 6 6"/>' },
];

function ViewMenu({ group, count, onPick }: { group: GroupBy; count: number; onPick: (g: GroupBy) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = VIEWS.find((v) => v.key === group) ?? VIEWS[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const shown = VIEWS.filter((v) => v.key !== "votes" || CONFIG.votes);
  return (
    <div className="view-menu" ref={box}>
      <button
        className={"view-btn" + (open ? " open" : "")}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Group or sort the list"
        onClick={() => setOpen(!open)}
      >
        {current.label} <span className="vc">({count})</span>
        <Icon d='<path d="m6 9 6 6 6-6"/>' size={16} weight={2.4} />
      </button>
      {open && (
        <div className="pop view-pop" role="menu">
          {(["Group", "Sort"] as const).map((sec) => (
            <div key={sec}>
              {sec === "Sort" && <div className="pop-sep" />}
              <div className="pop-label">{sec === "Group" ? "Group by" : "Sort by"}</div>
              {shown
                .filter((v) => v.section === sec)
                .map((v) => (
                  <button
                    key={v.key}
                    role="menuitemradio"
                    aria-checked={v.key === group}
                    className={"pop-item" + (v.key === group ? " on" : "")}
                    onClick={() => {
                      onPick(v.key);
                      setOpen(false);
                    }}
                  >
                    <Icon d={v.icon} size={15} />
                    {v.label}
                    {v.key === group && <Icon name="check" size={15} weight={2.4} />}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AreaList() {
  const group = useStore((s) => s.group);
  const collapsed = useStore((s) => s.collapsed);
  const toggleGroup = useStore((s) => s.toggleGroup);
  const loaded = useStore((s) => s.loaded);
  const list = useVisible(true);
  const setGroups = useStore((s) => s.setGroups);
  const setGroup = useStore((s) => s.setGroup);
  const hiddenCount = useStore((s) => s.hidden.size);
  const flat = group === "votes" || group === "new" || group === "old";
  const groups = useMemo(() => (flat ? [] : buildGroups(list, group)), [flat, list, group]);
  const items = useMemo(
    () => (flat ? [...list].sort(SORTS[group as "votes" | "new" | "old"]) : []),
    [flat, list, group],
  );
  const groupIds = groups.map((g) => `${group}:${g.key}`);
  const anyOpen = groupIds.some((id) => !collapsed.has(id));

  return (
    <>
      <div className="list-head">
        <ViewMenu group={group} count={list.length} onPick={setGroup} />
        {groups.length > 1 && (
          <button className="fold-all" onClick={() => setGroups(groupIds, anyOpen)}>
            <Icon
              d={anyOpen ? '<path d="m7 20 5-5 5 5M7 4l5 5 5-5"/>' : '<path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>'}
              size={14}
              weight={2.2}
            />
            {anyOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>
      <StatusFilter />

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
        <div className="empty">{!loaded
            ? "Loading…"
            : hiddenCount
              ? "No areas match. Try another search, or loosen the filters above."
              : "No areas match. Try another search, or request this area."}</div>
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
              <span className="gl">
                {g.label} <span className="gn">({g.items.length})</span>
              </span>
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
