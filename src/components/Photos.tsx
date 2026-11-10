import { useRef, useState } from "react";
import { approvePhoto, confirmDelete, deletePhoto } from "../lib/photos";
import { useStore } from "../lib/store";
import type { Area, AreaPhoto } from "../lib/types";
import { Icon } from "./Icon";

const PREVIEW = 7; // Cover plus six thumbnails; the last one says how many more


function Tile({
  photo,
  index,
  cover,
  more,
  pending,
  drag,
}: {
  photo: AreaPhoto;
  index: number;
  cover?: boolean;
  more?: number;
  pending?: boolean;
  drag?: { from: number | null; over: number | null; start: (i: number) => void; enter: (i: number) => void; drop: (i: number) => void; end: () => void };
}) {
  const patch = useStore((s) => s.patch);
  const adminAction = useStore((s) => s.adminAction);
  const areaId = useStore((s) => s.selectedId) ?? "";
  const open = () => patch({ gallery: { areaId, index, pending: !!pending } });

  return (
    <div
      className={
        "photo" +
        (cover ? " cover" : "") +
        (drag?.from === index ? " dragging" : "") +
        (drag && drag.over === index && drag.from !== index ? " over" : "")
      }
      role="button"
      tabIndex={0}
      title={drag ? "Drag to reorder" : `Photo by ${photo.author}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        open();
      }}
      draggable={!!drag}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index)); // Firefox only drags with data set
        drag?.start(index);
      }}
      onDragOver={(e) => {
        if (!drag || drag.from === null) return;
        e.preventDefault();
        drag.enter(index);
      }}
      onDrop={(e) => {
        e.preventDefault();
        drag?.drop(index);
      }}
      onDragEnd={() => drag?.end()}
    >
      <img src={photo.url} alt={`Photo by ${photo.author}`} loading="lazy" draggable={false} />
      {more ? <div className="photo-more">+{more}</div> : null}
      {cover && drag && <span className="photo-label">Cover</span>}
      {pending && <span className="photo-label">by {photo.author}</span>}
      {(drag || pending) && (
        <div className={"photo-tools" + (pending ? " show" : "")}>
          {pending && (
            <button
              className="photo-tool ok"
              title="Approve"
              onClick={(e) => {
                e.stopPropagation();
                adminAction(() => approvePhoto(photo.id), "Photo approved");
              }}
            >
              <Icon name="check" size={15} weight={2.6} />
            </button>
          )}
          <button
            className="photo-tool del"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              if (confirmDelete()) adminAction(() => deletePhoto(photo), "Photo deleted");
            }}
          >
            <Icon name="trash" size={14} weight={2.2} />
          </button>
        </div>
      )}
    </div>
  );
}

export function Photos({ area: a }: { area: Area }) {
  const admin = useStore((s) => s.admin);
  const uploading = useStore((s) => s.uploading);
  const uploadPhotos = useStore((s) => s.uploadPhotos);
  const movePhoto = useStore((s) => s.movePhoto);
  const file = useRef<HTMLInputElement>(null);
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const photos = a.photos ?? [];
  const shown = photos.filter((p) => p.approved);
  const waiting = admin ? photos.filter((p) => !p.approved) : [];
  // The admin sees every photo to reorder them; visitors see a preview and open the rest full screen
  const visible = admin ? shown : shown.slice(0, PREVIEW);
  const extra = shown.length - visible.length;

  const drag = admin
    ? {
        from,
        over,
        start: (i: number) => setFrom(i),
        enter: (i: number) => setOver(i),
        drop: (i: number) => {
          if (from !== null) movePhoto(a.id, from, i);
          setFrom(null);
          setOver(null);
        },
        end: () => {
          setFrom(null);
          setOver(null);
        },
      }
    : undefined;

  // Only the admin adds photos; visitors see the section once there's something in it
  if (!admin && shown.length === 0) return null;

  return (
    <div className="photos-sec">
      <h3 className="sec-t">
        Photos {shown.length > 0 && <span>{shown.length}</span>}
      </h3>

      {shown.length > 0 ? (
        <div className="photos">
          {visible.map((p, i) => (
            <Tile
              key={p.id}
              photo={p}
              index={i}
              cover={i === 0}
              more={i === visible.length - 1 && extra > 0 ? extra : undefined}
              drag={drag}
            />
          ))}
        </div>
      ) : (
        <div className="photos-empty">
          <Icon name="img" size={20} />
          <span>No photos yet. Only you can see this section until you add one.</span>
        </div>
      )}
      {admin && shown.length > 1 && <p className="photo-note">Drag photos to reorder. The first one is the cover.</p>}

      {waiting.length > 0 && (
        <>
          <div className="photos-wait">
            <Icon name="alert" size={14} weight={2.2} />
            Waiting for approval <span>{waiting.length}</span>
          </div>
          <div className="photos">
            {waiting.map((p, i) => (
              <Tile key={p.id} photo={p} index={i} pending />
            ))}
          </div>
        </>
      )}

      {admin && (
        <div className="photo-add">
          <button className="btn sm" disabled={!!uploading} onClick={() => file.current?.click()}>
            <Icon name="img" size={15} />
            {uploading
              ? uploading.total > 1
                ? `Uploading ${Math.min(uploading.done + 1, uploading.total)} of ${uploading.total}…`
                : "Uploading…"
              : "Add photos"}
          </button>
          <input
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              uploadPhotos(Array.from(e.target.files ?? []).slice(0, 10));
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}
