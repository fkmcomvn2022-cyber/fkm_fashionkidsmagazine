import { useState } from "react";
import { Copy, Pencil, PowerOff, Clock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatVND } from "@/lib/format";
import type { Concept } from "@/types";

const statusMeta = {
  active: { label: "Đang hoạt động", color: "#1fb27a", bg: "#e3f8ee" },
  paused: { label: "Tạm dừng", color: "#f5a524", bg: "#fef3dc" },
  closed: { label: "Đã đóng", color: "#f0476b", bg: "#fde6ea" },
};

export function ConceptCard({
  concept,
  onEdit,
  onDuplicate,
  onTogglePower,
  onDelete,
}: {
  concept: Concept;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onTogglePower?: () => void;
  onDelete?: () => void;
}) {
  const meta = statusMeta[concept.status];
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDeleteClick = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    onDelete?.();
  };
  return (
    <div className="rounded-3xl bg-surface border border-border-soft shadow-soft overflow-hidden">
      <div className="h-2" style={{ background: concept.color }} />
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-[14px] font-semibold text-ink">{concept.name}</h4>
            <p className="text-[11px] text-muted mt-0.5">{concept.category}</p>
          </div>
          <Badge color={meta.color} bg={meta.bg}>{meta.label}</Badge>
        </div>

        <p className="text-[12px] text-ink-soft mt-2 line-clamp-2">{concept.shortDesc}</p>

        <div className="flex items-center gap-3 mt-2.5 text-[11px] text-muted">
          <span className="font-semibold text-ink">{formatVND(concept.priceFrom)}</span>
          <span className="flex items-center gap-1"><Clock size={11} /> {concept.durationMin} phút</span>
        </div>

        <div className="flex gap-1.5 mt-3">
          <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1 rounded-2xl bg-surface-soft text-ink-soft text-xs font-medium py-2 tap-scale">
            <Pencil size={12} /> Sửa
          </button>
          <button onClick={onDuplicate} className="flex-1 flex items-center justify-center gap-1 rounded-2xl bg-surface-soft text-ink-soft text-xs font-medium py-2 tap-scale">
            <Copy size={12} /> Nhân bản
          </button>
          <button onClick={onTogglePower} className="w-9 h-9 flex items-center justify-center rounded-2xl bg-danger-soft text-danger tap-scale shrink-0">
            <PowerOff size={13} />
          </button>
          <button
            onClick={handleDeleteClick}
            className={`w-9 h-9 flex items-center justify-center rounded-2xl tap-scale shrink-0 ${confirmingDelete ? "bg-danger text-white" : "bg-danger-soft text-danger"}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
        {confirmingDelete && (
          <p className="text-[11px] text-danger mt-1.5">Bấm lại để xóa thật concept này — không thể hoàn tác.</p>
        )}
      </div>
    </div>
  );
}
