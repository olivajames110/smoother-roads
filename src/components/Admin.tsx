import { useEffect, useState } from "react";
import {
  addComment,
  amAdmin,
  setHidden,
  setNoPhotogrammetry,
  setRegionHidden,
  setStatus,
  signIn,
  signOut,
} from "../lib/comments";
import { loadAreas } from "../lib/data";
import { ago } from "../lib/format";
import { STATUS } from "../lib/icons";
import type { Area, AreaComment, Status } from "../lib/types";
import { withLinks } from "./LinkedText";

function Reply({ area, to, onDone }: { area: Area; to: string; onDone: () => void }) {
  const [text, setText] = useState("");
  return (
    <div className="admin-reply">
      <input className="input" placeholder="Reply as DEV" value={text} onChange={(e) => setText(e.target.value)} />
      <button
        className="btn sm cyan"
        disabled={!text.trim()}
        onClick={async () => {
          await addComment(area.id, "Jim", "feedback", text.trim(), null, to);
          setText("");
          onDone();
        }}
      >
        Reply
      </button>
    </div>
  );
}

export function Admin() {
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const ok = await amAdmin();
    setAdmin(ok);
    if (ok) setAreas(await loadAreas(true));
    setReady(true);
    return ok;
  };

  useEffect(() => {
    refresh();
  }, []);

  const run = (job: Promise<unknown>) =>
    job.then(refresh).catch((e: Error) => setError(e.message || "That didn't work"));

  if (!ready) return <div className="admin">Loading…</div>;

  if (!admin) {
    return (
      <form
        className="admin admin-login"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          signIn(email, password)
            .then(refresh)
            .then((ok) => {
              if (!ok) setError("Signed in, but this account isn't an admin.");
            })
            .catch((e: Error) => setError(e.message || "Couldn't sign in"))
            .finally(() => setBusy(false));
        }}
      >
        <h1>Admin</h1>
        <input
          className="input"
          type="email"
          placeholder="Email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn cyan" disabled={!email || !password || busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error && <p className="admin-err">{error}</p>}
      </form>
    );
  }

  const thread = areas
    .flatMap((a) => a.comments.map((c): [Area, AreaComment] => [a, c]))
    .sort((x, y) => y[1].date - x[1].date);

  return (
    <div className="admin">
      <div className="admin-top">
        <h1>Admin</h1>
        <a className="link" href={import.meta.env.BASE_URL}>
          View site
        </a>
        <button className="btn sm" onClick={() => run(signOut())}>
          Sign out
        </button>
      </div>
      {error && <p className="admin-err">{error}</p>}

      <h2>Comments ({thread.length})</h2>
      {thread.length === 0 && <p className="mut">Nothing yet.</p>}
      {thread.map(([a, c]) => (
        <div key={c.id} className={"admin-row" + (c.hidden ? " off" : "")}>
          <div className="admin-meta">
            <strong>{c.author}</strong>
            {c.dev && <span className="dev">DEV</span>}
            <span className={"tag t-" + c.type}>{c.type}</span>
            <span className="mut">
              {a.name} · {ago(c.date)}
              {c.pin ? ` · ${c.pin[0].toFixed(5)}, ${c.pin[1].toFixed(5)}` : ""}
            </span>
            <span className="spacer" />
            <button className="btn sm" onClick={() => run(setHidden(c.id, !c.hidden))}>
              {c.hidden ? "Show" : "Hide"}
            </button>
          </div>
          <p>{c.dev ? withLinks(c.text) : c.text}</p>
          <Reply area={a} to={c.id} onDone={refresh} />
        </div>
      ))}

      <h2>Regions</h2>
      {areas
        .filter((a) => !a.local)
        .map((a) => (
          <div key={a.id} className={"admin-status" + (a.hidden ? " off" : "")}>
            <span>
              {a.name}
              {a.hidden && " (hidden)"}
            </span>
            <select
              className="input"
              aria-label={"Status of " + a.name}
              value={a.status}
              onChange={(e) => run(setStatus(a.id, e.target.value as Status))}
            >
              {(Object.keys(STATUS) as Status[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </select>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={!!a.noPhotogrammetry}
                onChange={() => run(setNoPhotogrammetry(a.id, !a.noPhotogrammetry))}
              />
              Not photogrammetry
            </label>
            <button className="btn sm" onClick={() => run(setRegionHidden(a.id, !a.hidden))}>
              {a.hidden ? "Show" : "Hide"}
            </button>
          </div>
        ))}
    </div>
  );
}
