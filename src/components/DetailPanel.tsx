import { useRef, type ReactNode } from "react";
import { setHidden } from "../lib/comments";
import { CONFIG } from "../lib/config";
import { ago, fmtDate, fmtN, hue, initials } from "../lib/format";
import { centerOf, coverage, coverageShort } from "../lib/geo";
import { CATS, STATUS, STATUS_NOTE } from "../lib/icons";
import { useStore } from "../lib/store";
import type { Area, AreaComment, CommentType } from "../lib/types";
import { AdminMenu } from "./AdminMenu";
import { Icon } from "./Icon";

const COMMENT_TYPES: Record<CommentType, string> = { feedback: "Feedback", issue: "Issue", question: "Question" };

const URL_RE = /https?:\/\/[^\s<>"]+/g;

// Only for admin comments: the database sets dev, so visitors can't make their links clickable
function withLinks(text: string) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,!?;:)\]'"]+$/, "");
    parts.push(text.slice(last, m.index));
    parts.push(
      <a key={m.index} href={url} target="_blank" rel="noopener">
        {url}
      </a>,
    );
    last = m.index + url.length;
  }
  parts.push(text.slice(last));
  return parts;
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
  const posting = useStore((s) => s.posting);
  const replyingTo = useStore((s) => s.areas.find((a) => a.id === s.selectedId)?.comments.find((c) => c.id === s.comment.replyTo));
  const file = useRef<HTMLInputElement>(null);

  const attach = (f?: File) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setComment({ image: String(reader.result) });
    reader.readAsDataURL(f);
  };

  return (
    <div className="compose">
      <div className="chips">
        {(Object.keys(COMMENT_TYPES) as CommentType[]).map((t) => (
          <button
            key={t}
            className={"chip" + (comment.type === t ? " on" : "") + (t === "issue" ? " issue" : "")}
            onClick={() => setComment({ type: t })}
          >
            {COMMENT_TYPES[t]}
          </button>
        ))}
      </div>
      <input
        className="input"
        placeholder="Your name (optional)"
        aria-label="Your name"
        maxLength={40}
        value={commenter}
        onChange={(e) => patch({ commenter: e.target.value })}
      />
      <textarea
        placeholder={comment.type === "issue" ? "What's wrong, and where?" : "Share your thoughts…"}
        maxLength={2000}
        aria-label="Comment"
        value={comment.text}
        onChange={(e) => setComment({ text: e.target.value })}
      />
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
        {comment.pin && (
          <div className="pinchip">
            <Icon name="pin" size={14} />
            Spot pinned to this comment
            <button className="xbtn" title="Remove location" onClick={() => setComment({ pin: null })}>
              <Icon name="x" size={11} weight={3} />
            </button>
          </div>
        )}
      </div>
      <div className="compose-row">
        <span className="spacer" />
        {CONFIG.screenshots && (
          <button className="ibtn" title="Attach a screenshot" onClick={() => file.current?.click()}>
            <Icon name="img" size={18} />
          </button>
        )}
        <button
          className={"btn sm" + (pinMode ? " voted" : "")}
          aria-pressed={pinMode}
          title="Attach a map location to this comment"
          onClick={() => patch({ pinMode: !pinMode })}
        >
          <Icon name="pin" size={16} />
          {pinMode ? "Now click the map" : comment.pin ? "Move pin" : "Pin a spot on the map"}
        </button>
        <button className="btn cyan sm" disabled={!comment.text.trim() || posting} onClick={postComment}>
          {posting ? "Posting…" : "Post"}
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

export function DetailPanel({ area: a }: { area: Area }) {
  const closePanel = useStore((s) => s.closePanel);
  const toggleVote = useStore((s) => s.toggleVote);
  const zoomTo = useStore((s) => s.zoomTo);
  const admin = useStore((s) => s.admin);
  const status = STATUS[a.status];
  const voted = CONFIG.votes && a.voted;

  const feedback = (
    <>
      <h3 className="sec-t">
        Feedback <span>{a.comments.length}</span>
      </h3>
      {a.comments.length === 0 ? (
        <div className="empty">No feedback yet. Be the first.</div>
      ) : (
        <div className="cmts">
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
        {STATUS_NOTE[a.status] && (
          <div className="status-note" style={{ background: status.tint, color: status.ink }}>
            {STATUS_NOTE[a.status]}
          </div>
        )}
        <div className="stats">
          <div className="stat">
            <div className="k">Coverage</div>
            <div className="v">{coverageShort(a.shape)}</div>
          </div>
          {CONFIG.votes && (
            <div className="stat">
              <div className="k">Votes</div>
              <div className="v">{fmtN(a.votes)}</div>
            </div>
          )}
        </div>

        <div className="actions">
          <span className="tip" data-tip={CONFIG.votes ? undefined : "Coming soon"}>
            <button
              className={"btn" + (voted ? " voted" : " cyan")}
              disabled={!CONFIG.votes}
              onClick={() => toggleVote(a.id)}
            >
              <Icon name="up" size={15} weight={2} />
              {voted ? "Upvoted" : "Upvote"}
            </button>
          </span>
          <button className="btn" onClick={() => zoomTo(a)}>
            <Icon name="target" size={15} />
            Zoom to area
          </button>
        </div>

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

        {a.notes && (
          <>
            <h3 className="sec-t">Request notes</h3>
            <div className="notes">{a.notes}</div>
          </>
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
        <Compose />
      ) : (
        <div className="soon">
          <div className="soon-content" inert>
            <div className="soon-list">{feedback}</div>
            <Compose />
          </div>
          <div className="soon-cover">Coming soon</div>
        </div>
      )}
    </>
  );
}
