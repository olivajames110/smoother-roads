import { useEffect, useRef, useState } from "react";
import { setNoPhotogrammetry, setRegionHidden, setStatus, signOut } from "../lib/comments";
import { REASONS, STATUS } from "../lib/icons";
import { deleteRequest } from "../lib/requests";
import { useStore } from "../lib/store";
import type { Area, Reason, Status } from "../lib/types";
import { Icon } from "./Icon";

// Admin options for one area, behind the ⋮ button next to Close
export function AdminMenu({ area: a }: { area: Area }) {
  const adminAction = useStore((s) => s.adminAction);
  const closePanel = useStore((s) => s.closePanel);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const run = (job: () => Promise<unknown>, done: string) => {
    setOpen(false);
    adminAction(job, done);
  };

  return (
    <div className="admin-menu" ref={box}>
      <button
        className={"ibtn" + (open ? " active" : "")}
        title="Admin options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="more" size={18} />
      </button>
      {open && (
        <div className="pop" role="menu">
          <div className="pop-label">Status</div>
          {(["requested", "progress", "released"] as Status[]).map((s) => (
            <button
              key={s}
              role="menuitemradio"
              aria-checked={a.status === s}
              className="pop-item"
              onClick={() => run(() => setStatus(a.id, s), `Marked ${STATUS[s].label.toLowerCase()}`)}
            >
              <span className="sdot" style={{ background: STATUS[s].color }} />
              {STATUS[s].label}
              {a.status === s && <Icon name="check" size={15} weight={2.4} />}
            </button>
          ))}
          <div className="pop-label">Unable, because</div>
          {(Object.keys(REASONS) as Reason[]).map((r) => {
            const on = a.status === "unable" && (a.reason ?? "tried") === r;
            return (
              <button
                key={r}
                role="menuitemradio"
                aria-checked={on}
                className="pop-item"
                onClick={() => run(() => setStatus(a.id, "unable", r), `Marked unable: ${REASONS[r].label.toLowerCase()}`)}
              >
                <span
                  className="sdot"
                  style={{ background: `linear-gradient(90deg, ${STATUS.unable.color} 50%, ${REASONS[r].color} 50%)` }}
                />
                {REASONS[r].label}
                {on && <Icon name="check" size={15} weight={2.4} />}
              </button>
            );
          })}
          <div className="pop-sep" />
          <button
            role="menuitemcheckbox"
            aria-checked={!!a.noPhotogrammetry}
            className="pop-item"
            onClick={() =>
              run(
                () => setNoPhotogrammetry(a.id, !a.noPhotogrammetry),
                a.noPhotogrammetry ? "Marked as a photogrammetry zone" : "Marked as not a photogrammetry zone",
              )
            }
          >
            <span className="no-pg">
              <Icon name="alert" size={15} />
            </span>
            Not a photogrammetry zone
            {a.noPhotogrammetry && <Icon name="check" size={15} weight={2.4} />}
          </button>
          <button
            role="menuitem"
            className="pop-item"
            onClick={() =>
              run(() => setRegionHidden(a.id, !a.hidden), a.hidden ? "Shown on the site" : "Hidden from visitors")
            }
          >
            <Icon name={a.hidden ? "eye" : "eyeOff"} size={15} />
            {a.hidden ? "Show on site" : "Hide from site"}
          </button>
          {a.request && (
            <button
              role="menuitem"
              className="pop-item danger"
              onClick={() => {
                if (!window.confirm(`Delete "${a.name}" for good? Its votes and comments stop showing too.`)) return;
                closePanel();
                run(() => deleteRequest(a.id), "Request deleted");
              }}
            >
              <Icon name="trash" size={15} />
              Delete request
            </button>
          )}
          <div className="pop-sep" />
          <button role="menuitem" className="pop-item" onClick={() => run(signOut, "Signed out")}>
            <Icon name="logout" size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
