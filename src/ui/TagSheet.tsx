import { useEffect } from "react";
import type { Tag } from "../domain/types";
import { inkFor } from "./ink";

function lengthLabel(minutes: number): string {
  return `${String(minutes).padStart(2, "0")}:00`;
}

export function TagSheet({
  tags,
  selectedId,
  onSelect,
  onClose,
}: {
  tags: Tag[];
  selectedId: string;
  onSelect: (tagId: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="overlay" data-overlay-open onPointerDown={onClose}>
      <div
        className="tag-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Тег"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="tag-list" role="group" aria-label="Тег">
          {tags.map((tag) => {
            const pressed = tag.id === selectedId;
            const ink = inkFor(tag.color);
            return (
              <button
                key={tag.id}
                type="button"
                className="tag-pill"
                aria-pressed={pressed}
                style={pressed ? { background: tag.color, color: ink } : undefined}
                onClick={() => onSelect(tag.id)}
              >
                <span
                  className="tag-dot"
                  style={{
                    background: pressed
                      ? ink === "#14161c"
                        ? "rgba(20, 22, 28, 0.18)"
                        : "rgba(255, 255, 255, 0.45)"
                      : tag.color,
                  }}
                />
                <span className="tag-pill-name">{tag.name}</span>
                <span className="tag-pill-time">{lengthLabel(tag.focusMinutes)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
