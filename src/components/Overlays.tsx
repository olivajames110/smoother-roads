import { useEffect, useState } from "react";
import logoFull from "../assets/logo-full.png";
import { approvePhoto, confirmDelete, deletePhoto } from "../lib/photos";
import { useStore } from "../lib/store";
import { Icon } from "./Icon";

export function Lightbox() {
  const image = useStore((s) => s.lightbox);
  const patch = useStore((s) => s.patch);
  return (
    <div className={"lightbox" + (image ? " show" : "")} onClick={() => patch({ lightbox: null })}>
      {image && <img className={image === logoFull ? "lb-logo" : ""} src={image} alt="" />}
    </div>
  );
}

// Full-screen photo viewer: arrows, thumbnails, and for the admin approve, cover and delete
export function Gallery() {
  const gallery = useStore((s) => s.gallery);
  const area = useStore((s) => s.areas.find((a) => a.id === s.gallery?.areaId));
  const admin = useStore((s) => s.admin);
  const patch = useStore((s) => s.patch);
  const adminAction = useStore((s) => s.adminAction);
  const movePhoto = useStore((s) => s.movePhoto);

  const list = (area?.photos ?? []).filter((p) => p.approved !== gallery?.pending);
  const index = Math.min(gallery?.index ?? 0, list.length - 1);
  const photo = list[index];
  const open = !!gallery && !!photo;

  const close = () => patch({ gallery: null });
  const go = (step: number) =>
    gallery && list.length > 1 && patch({ gallery: { ...gallery, index: (index + step + list.length) % list.length } });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Deleting or approving the last photo in the list leaves nothing to show
  useEffect(() => {
    if (gallery && !photo) patch({ gallery: null });
  }, [gallery, photo, patch]);

  return (
    <div className={"gallery" + (open ? " show" : "")} onClick={close}>
      {open && (
        <>
          <div className="gal-top" onClick={(e) => e.stopPropagation()}>
            <span className="gal-count">
              {index + 1} / {list.length}
            </span>
            <span className="gal-by">
              {area!.name} · by {photo.author}
              {photo.dev && <span className="dev">DEV</span>}
            </span>
            <span className="grow" />
            {admin && !photo.approved && (
              <button className="gal-btn ok" onClick={() => adminAction(() => approvePhoto(photo.id), "Photo approved")}>
                <Icon name="check" size={14} weight={2.6} />
                Approve
              </button>
            )}
            {admin && photo.approved && index > 0 && (
              <button
                className="gal-btn"
                onClick={() => {
                  movePhoto(area!.id, index, 0);
                  patch({ gallery: { ...gallery!, index: 0 } });
                }}
              >
                Make cover
              </button>
            )}
            {admin && (
              <button
                className="gal-btn del"
                onClick={() => confirmDelete() && adminAction(() => deletePhoto(photo), "Photo deleted")}
              >
                <Icon name="trash" size={14} weight={2.2} />
                Delete
              </button>
            )}
            <button className="gal-x" title="Close" onClick={close}>
              <Icon name="x" size={20} />
            </button>
          </div>

          <div className="gal-main">
            <img src={photo.url} alt={`Photo by ${photo.author}`} onClick={(e) => e.stopPropagation()} />
            {list.length > 1 && (
              <>
                <button className="gal-nav prev" title="Previous" onClick={(e) => (e.stopPropagation(), go(-1))}>
                  <Icon name="chevL" size={22} weight={2.4} />
                </button>
                <button className="gal-nav next" title="Next" onClick={(e) => (e.stopPropagation(), go(1))}>
                  <Icon name="chevR" size={22} weight={2.4} />
                </button>
              </>
            )}
          </div>

          {list.length > 1 && (
            <div className="gal-strip" onClick={(e) => e.stopPropagation()}>
              {list.map((p, i) => (
                <img
                  key={p.id}
                  src={p.url}
                  alt=""
                  className={i === index ? "on" : ""}
                  onClick={() => patch({ gallery: { ...gallery!, index: i } })}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const failed = useStore((s) => s.toastFailed);
  const [text, setText] = useState("");
  useEffect(() => {
    if (toast) setText(toast);
  }, [toast]);
  return (
    <div className={"toast" + (toast ? " show" : "") + (failed ? " failed" : "")} role="status">
      <Icon name={failed ? "alert" : "check"} size={16} weight={failed ? 2.4 : 3} />
      {text}
    </div>
  );
}
