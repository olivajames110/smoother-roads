import { useEffect, useRef, useState } from "react";
import { setHidden, setNotes, setRegionHidden } from "../lib/comments";
import { CONFIG } from "../lib/config";
import { areaRow } from "../lib/data";
import { ago, fmtDate, fmtN, hue, initials } from "../lib/format";
import { centerOf, coverage, coverageMi2, coverageShort } from "../lib/geo";
import { CATS, REASONS, STATUS, statusNote } from "../lib/icons";
import { useStore } from "../lib/store";
import type { Area, AreaComment, CommentType } from "../lib/types";
import { AdminMenu } from "./AdminMenu";
import { HoverTip } from "./HoverTip";
import { Icon } from "./Icon";
import { formatNotes, withLinks } from "./LinkedText";
import { Photos } from "./Photos";

const COMMENT_TYPES: Record<CommentType, string> = {
  feedback: "Feedback",
  issue: "Issue",
  improve: "Improve",
  question: "Question",
};
// What the text box asks for, per type
const PROMPTS: Record<CommentType, { label: string; hint: string }> = {
  feedback: { label: "Comment", hint: "Share your thoughts…" },
  issue: { label: "Issue", hint: "What's wrong, and where?" },
  improve: { label: "Improvement", hint: "Which roads or spot should be smoother?" },
  question: { label: "Question", hint: "Share your thoughts…" },
};

// Admin: the area's notes, editable in place (saved to the database, shown to everyone)
function NotesEditor({ area: a }: { area: Area }) {
  const adminAction = useStore((s) => s.adminAction);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(a.notes);
  const [saving, setSaving] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  const start = () => {
    setText(a.notes);
    setEditing(true);
  };

  // Wraps the selected text in ** (bold) or __ (underline), or takes it off again
  const wrap = (mark: string) => {
    const el = box.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = text.slice(s, e);
    const on = text.slice(s - mark.length, s) === mark && text.slice(e, e + mark.length) === mark;
    const next = on
      ? text.slice(0, s - mark.length) + sel + text.slice(e + mark.length)
      : text.slice(0, s) + mark + (sel || "text") + mark + text.slice(e);
    setText(next);
    const from = on ? s - mark.length : s + mark.length;
    const to = from + (sel || (on ? "" : "text")).length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(from, to);
    });
  };
  const save = async () => {
    setSaving(true);
    await adminAction(() => setNotes(a.id, text.trim()), "Notes saved");
    setSaving(false);
    setEditing(false);
  };

  return (
    <>
      <h3 className="sec-t">
        Notes
        {!editing && (
          <button className="link-btn" onClick={start}>
            <Icon d='<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>' size={13} weight={2.2} />
            {a.notes ? "Edit" : "Add notes"}
          </button>
        )}
      </h3>
      {editing ? (
        <div className="notes-edit">
          <div className="fmt-bar">
            <button type="button" title="Bold (Ctrl+B)" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap("**")}>
              <b>B</b>
            </button>
            <button type="button" title="Underline (Ctrl+U)" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap("__")}>
              <u>U</u>
            </button>
            <span className="fmt-hint">**bold** · __underline__ · new lines are kept</span>
          </div>
          <textarea
            ref={box}
            value={text}
            rows={6}
            autoFocus
            placeholder="Notes everyone sees on this area"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              const mod = e.ctrlKey || e.metaKey;
              if (e.key === "Escape") {
                e.stopPropagation();
                setEditing(false);
              } else if (e.key === "Enter" && mod) save();
              else if (mod && (e.key === "b" || e.key === "u")) {
                e.preventDefault();
                wrap(e.key === "b" ? "**" : "__");
              }
            }}
          />
          {text.trim() && (
            <div className="notes notes-preview">
              <span className="pv">Preview</span>
              {formatNotes(text.trim())}
            </div>
          )}
          <div className="notes-edit-btns">
            <span className="hint">Ctrl+Enter to save</span>
            <button className="btn sm" disabled={saving} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn sm fun" disabled={saving || text.trim() === a.notes.trim()} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : a.notes ? (
        <div className="notes">{a.notesAdmin ? formatNotes(a.notes) : a.notes}</div>
      ) : (
        <div className="notes empty-notes">No notes yet</div>
      )}
    </>
  );
}

// What the requester wrote when sending the request, shown first in Feedback like a comment
function RequestNote({ area: a }: { area: Area }) {
  const author = a.by === "Community" ? "Requester" : a.by;
  return (
    <div className="cmt">
      <div className="avatar" style={{ background: hue(author) }}>
        {initials(author)}
      </div>
      <div className="cmt-body">
        <div className="cmt-head">
          <strong>{author}</strong>
          <span className="tag t-request">Request</span>
          <span className="time">{ago(a.date)}</span>
        </div>
        <p className="pre">{a.requestNotes}</p>
      </div>
    </div>
  );
}

function Comment({ comment: c, parent }: { comment: AreaComment; parent?: AreaComment }) {
  const patch = useStore((s) => s.patch);
  const flyToPoint = useStore((s) => s.flyToPoint);
  const admin = useStore((s) => s.admin);
  const adminAction = useStore((s) => s.adminAction);
  const setComment = useStore((s) => s.setComment);
  return (
    <div className={"cmt" + (c.hidden ? " off" : "")}>
      <div className="avatar" style={{ background: hue(c.author) }}>
        {initials(c.author)}
      </div>
      <div className="cmt-body">
        <div className="cmt-head">
          <strong>{c.author}</strong>
          {c.dev && <span className="dev">DEV</span>}
          <span className={"tag t-" + c.type}>{COMMENT_TYPES[c.type]}</span>
          <span className="time">{ago(c.date)}</span>
          {c.hidden && <span className="tag t-hidden">Hidden</span>}
        </div>
        {parent && (
          <div className="cmt-reply">
            Replying to <strong>{parent.author}</strong>: {parent.text}
          </div>
        )}
        <p>{c.dev ? withLinks(c.text) : c.text}</p>
        {c.image && <img className="cmt-img" src={c.image} alt="Attached screenshot" onClick={() => patch({ lightbox: c.image })} />}
        {c.pin && (
          <button className="link" onClick={() => flyToPoint(c.pin!)}>
            <Icon name="pin" size={14} />
            View location on map
          </button>
        )}
        {admin && (
          <div className="cmt-admin">
            <button className="link" onClick={() => setComment({ replyTo: c.id })}>
              Reply
            </button>
            <button
              className="link"
              onClick={() => adminAction(() => setHidden(c.id, !c.hidden), c.hidden ? "Comment shown" : "Comment hidden")}
            >
              {c.hidden ? "Show" : "Hide"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Compose() {
  const comment = useStore((s) => s.comment);
  const pinMode = useStore((s) => s.pinMode);
  const setComment = useStore((s) => s.setComment);
  const patch = useStore((s) => s.patch);
  const postComment = useStore((s) => s.postComment);
  const commenter = useStore((s) => s.commenter);
  const admin = useStore((s) => s.admin);
  const posting = useStore((s) => s.posting);
  const replyingTo = useStore((s) => s.areas.find((a) => a.id === s.selectedId)?.comments.find((c) => c.id === s.comment.replyTo));
  const file = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);

  const attach = (f?: File) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setComment({ image: String(reader.result) });
    reader.readAsDataURL(f);
  };

  const expand = () => {
    setOpen(true);
    requestAnimationFrame(() => box.current?.focus());
  };

  // Folds the box away; anything typed stays for when it opens again
  const fold = () => {
    setOpen(false);
    patch({ pinMode: false });
  };

  const cancel = () => {
    fold();
    setComment({ text: "", pin: null, replyTo: null, image: null });
  };

  // Closes again once a comment is posted
  useEffect(() => {
    if (!posting && !comment.text) setOpen(false);
  }, [posting]);

  // An admin's Reply opens the box with the cursor in it
  useEffect(() => {
    if (comment.replyTo) expand();
  }, [comment.replyTo]);

  // "Report an issue" opens it too, scrolled into view
  // (only clicks after this box appeared: opening another area mustn't open it)
  const composeNonce = useStore((s) => s.composeNonce);
  const seenNonce = useRef(composeNonce);
  useEffect(() => {
    if (composeNonce === seenNonce.current) return;
    seenNonce.current = composeNonce;
    expand();
    requestAnimationFrame(() => box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }, [composeNonce]);

  // The type chips show folded too; picking one opens the box with that type
  const chips = (
    <div className="chips">
      {(Object.keys(COMMENT_TYPES) as CommentType[]).map((t) => (
        <button
          key={t}
          className={"chip" + (comment.type === t ? " on" : "") + (t === "issue" || t === "improve" ? " " + t : "")}
          onClick={() => {
            setComment({ type: t });
            if (!open) expand();
          }}
        >
          {COMMENT_TYPES[t]}
        </button>
      ))}
    </div>
  );

  if (!open) {
    return (
      <div className="compose collapsed">
        <div className="compose-top">{chips}</div>
        <button className={"compose-open" + (comment.text ? " draft" : "")} onClick={expand}>
          {comment.text || PROMPTS[comment.type].hint}
        </button>
      </div>
    );
  }

  return (
    <div className="compose">
      <div className="compose-top">
        {chips}
        <button className="ibtn compose-fold" title="Collapse" onClick={fold}>
          <Icon d='<path d="m6 9 6 6 6-6"/>' size={18} weight={2.2} />
        </button>
      </div>
      <label className="lbl" htmlFor="cmt-name">
        Name {!admin && <span className="opt">(optional)</span>}
      </label>
      <div className={"name-field" + (admin ? " dev-on" : "")}>
        <input
          id="cmt-name"
          className="input"
          placeholder={admin ? "Jim" : "Anonymous"}
          maxLength={40}
          value={commenter}
          onChange={(e) => patch({ commenter: e.target.value })}
        />
        {admin && (
          <span className="dev" title="You're posting as the dev">
            DEV
          </span>
        )}
      </div>
      <label className="lbl cmt-lbl" htmlFor="cmt-text">
        {PROMPTS[comment.type].label}
      </label>
      <textarea
        id="cmt-text"
        ref={box}
        placeholder={PROMPTS[comment.type].hint}
        maxLength={2000}
        value={comment.text}
        onChange={(e) => setComment({ text: e.target.value })}
      />
      <div className="loc-row">
        <button
          className={"loc-btn" + (pinMode ? " picking" : comment.pin ? " set" : "")}
          aria-pressed={pinMode}
          title={comment.pin ? "Click, then click the map to move the pin" : "Attach a map location to this comment"}
          onClick={() => patch({ pinMode: !pinMode })}
        >
          {pinMode ? <span className="loc-dot" /> : <Icon name="pin" size={15} />}
          {pinMode
            ? "Click a spot on the map…"
            : comment.pin
              ? `${comment.pin[0].toFixed(4)}, ${comment.pin[1].toFixed(4)}`
              : "Add map location"}
        </button>
        {(pinMode || comment.pin) && (
          <button
            className="loc-x"
            title={pinMode ? "Stop picking" : "Remove location"}
            onClick={() => (pinMode ? patch({ pinMode: false }) : setComment({ pin: null }))}
          >
            <Icon name="x" size={13} weight={2.6} />
          </button>
        )}
      </div>
      <div className="attach">
        {replyingTo && (
          <div className="pinchip">
            <Icon name="cmt" size={14} />
            Replying to {replyingTo.author}
            <button className="xbtn" title="Cancel reply" onClick={() => setComment({ replyTo: null })}>
              <Icon name="x" size={11} weight={3} />
            </button>
          </div>
        )}
        {comment.image && (
          <div className="thumb">
            <img src={comment.image} alt="Attachment preview" />
            <button className="xbtn" title="Remove image" onClick={() => setComment({ image: null })}>
              <Icon name="x" size={11} weight={3} />
            </button>
          </div>
        )}
      </div>
      <div className="compose-row">
        <button className="btn sm compose-cancel" onClick={cancel}>
          Cancel
        </button>
        <span className="spacer" />
        {CONFIG.screenshots && (
          <button className="ibtn" title="Attach a screenshot" onClick={() => file.current?.click()}>
            <Icon name="img" size={18} />
          </button>
        )}
        <button className="btn cyan sm" disabled={!comment.text.trim() || posting} onClick={postComment}>
          {posting ? "Posting…" : "Post " + COMMENT_TYPES[comment.type]}
        </button>
      </div>
      <p className="compose-note">
        Comments are public. To have something removed, email{" "}
        <a className="link" href={"mailto:" + CONFIG.contactEmail}>
          {CONFIG.contactEmail}
        </a>
        .
      </p>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          attach(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ProblemSpot({ area: a }: { area: Area }) {
  const spot = useStore((s) => s.spot);
  const spotNote = useStore((s) => s.spotNote);
  const pinMode = useStore((s) => s.pinMode);
  const patch = useStore((s) => s.patch);
  const submitSpot = useStore((s) => s.submitSpot);
  const flyToPoint = useStore((s) => s.flyToPoint);
  const spots = a.spots ?? [];

  return (
    <div className="spot">
      <h3 className="sec-t">
        Problem spots {spots.length > 0 && <span>{spots.length}</span>}
      </h3>
      <div className={"spot-note" + (a.noPhotogrammetry ? " warn" : "")}>
        {a.noPhotogrammetry
          ? "This isn't a photogrammetry zone, so improvements across the whole area are hard to achieve and may not be very noticeable. Marking specific rough spots helps most, since every road can't be checked by hand."
          : "Found a rough stretch of road? Mark the exact spot so it can be checked."}
      </div>
      {spots.length > 0 && (
        <div className="spot-list">
          {spots.map((s, i) => (
            <button key={i} className="spot-row" title="Show on map" onClick={() => flyToPoint(s.pin)}>
              <Icon name="pin" size={14} />
              <span className="grow">{s.note || "No details given"}</span>
              <span className="spot-date">{fmtDate(s.date)}</span>
            </button>
          ))}
        </div>
      )}
      {spot ? (
        <>
          <div className="pinchip">
            <Icon name="pin" size={14} />
            Spot marked
            <button className="xbtn" title="Remove spot" onClick={() => patch({ spot: null })}>
              <Icon name="x" size={11} weight={3} />
            </button>
          </div>
          <textarea
            placeholder="What's wrong here? (optional)"
            aria-label="Describe the problem"
            value={spotNote}
            onChange={(e) => patch({ spotNote: e.target.value })}
          />
          <div className="spot-send">
            <button className="btn cyan sm" onClick={submitSpot}>Send spot</button>
          </div>
        </>
      ) : (
        <button
          className={"btn sm spot-mark" + (pinMode ? " voted" : "")}
          onClick={() => patch({ pinMode: !pinMode })}
        >
          <Icon name="pin" size={14} />
          {pinMode ? "Click the map…" : "Select and mark a problem spot"}
        </button>
      )}
    </div>
  );
}

function Coords({ area: a }: { area: Area }) {
  const showToast = useStore((s) => s.showToast);
  const [lat, lon] = centerOf(a.shape);
  const text = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

  const copy = () =>
    navigator.clipboard.writeText(text).then(
      () => showToast("Coordinates copied"),
      () => showToast("Couldn't copy. Select the coordinates instead.", true),
    );

  return (
    <div className="coords">
      <span className="coords-t">{text}</span>
      <button className="btn sm" onClick={copy}>
        <Icon name="copy" size={14} />
        Copy
      </button>
    </div>
  );
}

function CopyRow({ area: a }: { area: Area }) {
  const showToast = useStore((s) => s.showToast);
  const copy = () =>
    navigator.clipboard.writeText(areaRow(a)).then(
      () => showToast("Area details copied"),
      () => showToast("Couldn't copy the details", true),
    );
  return (
    <button className="btn copy-row" title="Copy the place, coordinates, radius and notes as one spreadsheet row" onClick={copy}>
      <Icon name="copy" size={15} />
      Copy details
    </button>
  );
}

export function DetailPanel({ area: a }: { area: Area }) {
  const closePanel = useStore((s) => s.closePanel);
  const toggleVote = useStore((s) => s.toggleVote);
  const zoomTo = useStore((s) => s.zoomTo);
  const admin = useStore((s) => s.admin);
  const status = STATUS[a.status];
  const reason = REASONS[a.reason ?? "tried"];
  const voted = CONFIG.votes && a.voted;
  const setComment = useStore((s) => s.setComment);
  const patch = useStore((s) => s.patch);
  const adminAction = useStore((s) => s.adminAction);
  // Opens the comment box set to a type ("Issue", "Improve"), ready to describe it and mark the
  // spot on the map
  const openAs = (type: CommentType) => {
    setComment({ type });
    patch({ composeNonce: useStore.getState().composeNonce + 1 });
  };

  const feedback = (
    <>
      <h3 className="sec-t">
        Feedback <span>{a.comments.length + (a.requestNotes ? 1 : 0)}</span>
      </h3>
      {a.comments.length === 0 && !a.requestNotes ? (
        <div className="empty empty-box">No feedback yet. Be the first.</div>
      ) : (
        <div className="cmts">
          {a.requestNotes && <RequestNote area={a} />}
          {a.comments.map((c) => (
            <Comment key={c.id} comment={c} parent={a.comments.find((p) => p.id === c.replyTo)} />
          ))}
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="panel-head">
        <div className="tile" style={{ background: status.tint, color: status.ink }}>
          <Icon d={CATS[a.cat].icon} size={22} weight={2.2} />
        </div>
        <div className="grow">
          <div className="eyebrow">
            <span className={"badge s-" + a.status}>{status.label}</span>
            {a.status === "unable" && (
              <span className="badge" style={{ background: reason.tint, color: reason.ink }}>
                {reason.label}
              </span>
            )}
            <span className="badge cat-b">{CATS[a.cat].label}</span>
            {a.hidden && <span className="badge cat-b">Hidden</span>}
          </div>
          <h2>{a.name}</h2>
          <div className="sub">{[a.region, a.icao].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="head-btns">
          {admin && <AdminMenu area={a} />}
          <button className="ibtn" title="Close" onClick={closePanel}>
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>

      <div className={"panel-body" + (CONFIG.database ? "" : " short")}>
        {admin && a.hidden && (
          <div className="hid-banner">
            <Icon name="eyeOff" size={18} weight={2.2} />
            <div className="grow">
              <b>Hidden from visitors</b>
              <span>Only you can see this area while you're signed in.</span>
            </div>
            <button
              className="btn sm"
              onClick={() => adminAction(() => setRegionHidden(a.id, false), "Shown on the site")}
            >
              <Icon name="eye" size={14} />
              Show on site
            </button>
          </div>
        )}
        <div className="stats">
          <div className="stat">
            <div className="k">Area</div>
            <div className="v">
              <span style={{ whiteSpace: "nowrap" }}>{coverageMi2(a.shape)}</span>
              <span className="v2">{coverageShort(a.shape)}</span>
            </div>
          </div>
          {a.roadKm != null && (
            <div className="stat">
              <div className="k">Roads</div>
              <div className="v">
                <span style={{ whiteSpace: "nowrap" }}>{Math.round(a.roadKm * 0.621371).toLocaleString()} mi</span>
                <span className="v2">{Math.round(a.roadKm).toLocaleString()} km</span>
              </div>
            </div>
          )}
          {CONFIG.votes && (
            // The votes box is the upvote button: click to vote, click again to take it back
            <button
              className={"stat vote-stat" + (voted ? " on" : "")}
              aria-pressed={!!voted}
              title={voted ? "Remove your upvote" : "Upvote this area"}
              onClick={() => toggleVote(a.id)}
            >
              <div className="k">Votes</div>
              <div className="v">
                <Icon name="up" size={16} weight={2.2} />
                {fmtN(a.votes)}
              </div>
              <span className="v2">{voted ? "Upvoted" : "Click to upvote"}</span>
            </button>
          )}
        </div>

        {/* Why it's unable, right above the buttons that answer it (Report issue, Request improvement) */}
        {statusNote(a) && (
          <div
            className="status-note"
            style={{
              background: "noteTint" in reason ? reason.noteTint : reason.tint,
              color: "noteInk" in reason ? reason.noteInk : reason.ink,
            }}
          >
            {statusNote(a)}
          </div>
        )}

        <div className="actions">
          {CONFIG.database && (
            <HoverTip
              className="act-tip"
              place="below"
              tip={
                <>
                  <span className="tip-t">Report an issue</span>
                  <span className="tip-d">Something here is broken or worse than it should be.</span>
                  <span className="tip-e">e.g. a sudden bump, a hole, or a road floating above the ground</span>
                </>
              }
            >
              <button className="btn report-btn" onClick={() => openAs("issue")}>
                <Icon name="alert" size={15} />
                <span className="bl">Report issue</span>
              </button>
            </HoverTip>
          )}
          {CONFIG.database && (
            <HoverTip
              className="act-tip"
              place="below"
              tip={
                <>
                  <span className="tip-t">Request improvement</span>
                  <span className="tip-d">Ask for a road or spot here to be made smoother.</span>
                  <span className="tip-e">e.g. a street that's still too rough to drive</span>
                </>
              }
            >
              <button className="btn improve-btn" onClick={() => openAs("improve")}>
                <Icon d='<path d="M4 21 9 3M20 21 15 3M12 5v2.5M12 10.5V13M12 16v3"/>' size={15} weight={2.2} />
                <span className="bl">Request improvement</span>
              </button>
            </HoverTip>
          )}
          <HoverTip
            className="act-tip"
            place="below-end"
            tip={
              <>
                <span className="tip-t">Go to area</span>
                <span className="tip-d">Moves the map to show this whole area.</span>
              </>
            }
          >
            <button className="btn" onClick={() => zoomTo(a)}>
              <Icon name="target" size={15} />
              <span className="bl">Go to area</span>
            </button>
          </HoverTip>
        </div>
        {admin && (
          <div className="actions admin-row">
            <CopyRow area={a} />
          </div>
        )}

        {CONFIG.database && CONFIG.photos && <Photos area={a} />}

        {a.status === "released" && (
          <>
            <h3 className="sec-t">Get it</h3>
            <div className="notes">
              Download Smoother Roads and copy the{" "}
              {a.packageName ? <strong>{a.packageName}</strong> : "region's"} folder into your Community folder.
              {CONFIG.downloadUrl && (
                <div>
                  <a className="link" href={CONFIG.downloadUrl} target="_blank" rel="noopener">
                    Get the mod
                  </a>
                </div>
              )}
            </div>
          </>
        )}

        {admin ? (
          <NotesEditor key={a.id} area={a} />
        ) : (
          a.notes && (
            <>
              <h3 className="sec-t">Notes</h3>
              <div className="notes">{a.notesAdmin ? formatNotes(a.notes) : a.notes}</div>
            </>
          )
        )}
        {a.status !== "released" && (
          <>
            <h3 className="sec-t">Coordinates</h3>
            <Coords area={a} />
          </>
        )}
        <div className="by">
          {a.status === "released" ? "Added" : `Submitted by ${a.by}`} · {fmtDate(a.date)} · {coverage(a.shape)}
        </div>

        {CONFIG.database ? feedback : <ProblemSpot area={a} />}
      </div>

      {CONFIG.database ? (
        <Compose key={a.id} />
      ) : (
        <div className="soon">
          <div className="soon-content" inert>
            <div className="soon-list">{feedback}</div>
            <Compose key={a.id} />
          </div>
          <div className="soon-cover">Coming soon</div>
        </div>
      )}
    </>
  );
}
