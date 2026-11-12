import { CONFIG } from "../lib/config";
import { useMemo } from "react";
import { fmtDate, fmtN } from "../lib/format";
import { coverageShort, issueCount } from "../lib/geo";
import { CATS, P, STATUS, statusLabel } from "../lib/icons";
import { SORTS, useStore } from "../lib/store";
import type { SortBy } from "../lib/types";
import { useVisible } from "../lib/useVisible";
import { Icon } from "./Icon";
import { SearchInput } from "./SearchInput";

function Kpi({ icon, label, value }: { icon: keyof typeof P; label: string; value: number }) {
  return (
    <div className="kpi">
      <div className="tile tile-accent">
        <Icon name={icon} size={20} />
      </div>
      <div>
        <div className="k">{label}</div>
        <div className="v">{fmtN(value)}</div>
      </div>
    </div>
  );
}

export function Leaderboard() {
  const view = useStore((s) => s.view);
  const areas = useStore((s) => s.areas);
  const sort = useStore((s) => s.sort);
  const patch = useStore((s) => s.patch);
  const openDetail = useStore((s) => s.openDetail);
  const toggleVote = useStore((s) => s.toggleVote);
  const list = useVisible(false);
  const rows = useMemo(() => [...list].sort(SORTS[sort]), [list, sort]);

  const count = (s: string) => areas.filter((a) => a.status === s).length;

  return (
    <section className={"view list-view" + (view === "list" ? "" : " hidden")}>
      <div className="list-inner">
        <div className="hero">
          <div>
            <h1>Most wanted <em>roads</em></h1>
            <p>Vote for the areas you want smoothed next. Top requests get built first.</p>
          </div>
        </div>
        <div className="kpis">
          <Kpi icon="layers" label="Area requests" value={areas.length} />
          <Kpi icon="flame" label="Community votes" value={areas.reduce((n, a) => n + a.votes, 0)} />
          <Kpi icon="hammer" label="In progress" value={count("progress")} />
          <Kpi icon="road" label="Released" value={count("released")} />
        </div>
        <div className="lv-tools">
          <SearchInput placeholder="Search areas…" />
          <select
            className="input"
            aria-label="Sort areas"
            style={{ marginLeft: "auto" }}
            value={sort}
            onChange={(e) => patch({ sort: e.target.value as SortBy })}
          >
            <option value="votes">Most votes</option>
            <option value="new">Newest</option>
            <option value="old">Oldest</option>
            {CONFIG.database && <option value="issues">Most issues</option>}
          </select>
        </div>
        <div className="tcard">
          <table>
            <thead>
              <tr>
                <th className="rank">#</th>
                <th>Area</th>
                <th className="col-air">Airport</th>
                <th className="col-cov">Area</th>
                <th className="col-status">Status</th>
                {CONFIG.database && <th className="col-cmt">Feedback</th>}
                <th className="col-date">Submitted</th>
                <th className="col-votes" style={{ textAlign: "right" }}>Votes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => {
                const issues = issueCount(a);
                const medal = sort === "votes" && i < 3 ? ` r${i + 1}` : "";
                return (
                  <tr key={a.id} onClick={() => openDetail(a.id)}>
                    <td className={"rank" + medal}>{i + 1}</td>
                    <td>
                      <div className="a-cell">
                        <div className="tile" style={{ background: STATUS[a.status].tint, color: STATUS[a.status].ink }}>
                          <Icon d={CATS[a.cat].icon} size={16} weight={2.2} />
                        </div>
                        <div>
                          <div className="t-name">{a.name}</div>
                          <div className="t-sub">{a.region}</div>
                        </div>
                      </div>
                    </td>
                    <td className="col-air mono mut">{a.icao || "—"}</td>
                    <td className="col-cov mono mut">{coverageShort(a.shape)}</td>
                    <td className="col-status"><span className={"badge s-" + a.status}>{statusLabel(a)}</span></td>
                    {CONFIG.database && <td className="col-cmt mono">
                      {issues > 0 ? (
                        <span className="issue-n">
                          <Icon name="alert" size={13} />
                          {issues}
                        </span>
                      ) : (
                        <span className="mut">{a.comments.length}</span>
                      )}
                    </td>}
                    <td className="col-date mut">{fmtDate(a.date)}</td>
                    <td className="col-votes" style={{ textAlign: "right" }}>
                      <button
                        className={"vote" + (a.voted ? " on" : "")}
                        aria-pressed={a.voted}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVote(a.id);
                        }}
                      >
                        <Icon name="up" size={14} weight={2} />
                        {fmtN(a.votes)}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty">No areas match your search.</div>}
        </div>
      </div>
    </section>
  );
}
