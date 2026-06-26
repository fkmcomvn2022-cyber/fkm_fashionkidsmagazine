import { useState } from "react";
import { Plus } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ConceptCard } from "@/components/product/ConceptCard";
import { ConceptEditSheet } from "@/components/product/ConceptEditSheet";
import { Badge } from "@/components/ui/Badge";
import { concepts, inventory, addonServices, conceptById, duplicateConcept, toggleConceptStatus, deleteConcept } from "@/data";
import { formatVND } from "@/lib/format";
import { useAppState } from "@/lib/appState";
import type { Concept } from "@/types";

type Tab = "concept" | "inventory" | "service";

const conditionMeta: Record<string, { color: string; bg: string }> = {
  "Tốt": { color: "#1fb27a", bg: "#e3f8ee" },
  "Cần giặt": { color: "#f5a524", bg: "#fef3dc" },
  "Hư hỏng": { color: "#f0476b", bg: "#fde6ea" },
  "Đang sửa": { color: "#4f6df5", bg: "#e8edff" },
};

export default function ProductPage() {
  const [tab, setTab] = useState<Tab>("concept");
  const [editingConcept, setEditingConcept] = useState<Concept | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { dataVersion, bumpDataVersion, triggerRefresh } = useAppState();

  const handleDeleteConcept = (id: string) => {
    const result = deleteConcept(id);
    if (!result.ok) {
      setDeleteError(result.reason ?? "Không thể xóa concept này.");
      return;
    }
    setDeleteError(null);
    bumpDataVersion();
    triggerRefresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <SegmentedControl
          options={[
            { value: "concept", label: "Concept" },
            { value: "inventory", label: "Kho đồ" },
            { value: "service", label: "Dịch vụ" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "concept" && (
        <div className="flex flex-col gap-3" key={dataVersion}>
          {deleteError && (
            <div className="rounded-2xl bg-danger-soft text-danger text-xs font-medium px-3 py-2.5">{deleteError}</div>
          )}
          {concepts.map((c) => (
            <ConceptCard
              key={c.id}
              concept={c}
              onEdit={() => setEditingConcept(c)}
              onDuplicate={() => {
                duplicateConcept(c.id);
                bumpDataVersion();
                triggerRefresh();
              }}
              onTogglePower={() => {
                toggleConceptStatus(c.id);
                bumpDataVersion();
                triggerRefresh();
              }}
              onDelete={() => handleDeleteConcept(c.id)}
            />
          ))}
          <AddButton label="Thêm concept mới" />
        </div>
      )}

      <ConceptEditSheet concept={editingConcept} onClose={() => setEditingConcept(null)} />

      {tab === "inventory" && (
        <div className="flex flex-col gap-2.5">
          {inventory.map((item) => {
            const concept = conceptById(item.conceptId);
            const cm = conditionMeta[item.condition];
            return (
              <div key={item.id} className="rounded-3xl bg-surface border border-border-soft shadow-soft p-3.5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: concept?.color }} />
                      <span className="text-[13px] font-semibold text-ink">{item.name}</span>
                    </div>
                    <p className="text-[11px] text-muted mt-0.5">{concept?.name} · Size {item.size}</p>
                  </div>
                  <Badge color={cm.color} bg={cm.bg}>{item.condition}</Badge>
                </div>
                <div className="flex items-center justify-between mt-2.5 text-[12px]">
                  <span className="text-ink-soft">Giá thuê <span className="font-semibold text-ink">{formatVND(item.rentalPrice)}</span></span>
                  <span className="text-ink-soft">Còn <span className="font-semibold text-ink">{item.quantity - item.inUse}</span>/{item.quantity}</span>
                </div>
              </div>
            );
          })}
          <AddButton label="Thêm món đồ mới" />
        </div>
      )}

      {tab === "service" && (
        <div className="flex flex-col gap-2.5">
          {addonServices.map((svc) => (
            <div key={svc.id} className="flex items-center justify-between rounded-3xl bg-surface border border-border-soft shadow-soft p-3.5">
              <div>
                <p className="text-[13px] font-semibold text-ink">{svc.name}</p>
                <p className="text-[11px] text-muted mt-0.5">{svc.category} · / {svc.unit}</p>
              </div>
              <span className="text-[13px] font-bold text-brand-blue">{formatVND(svc.price)}</span>
            </div>
          ))}
          <AddButton label="Thêm dịch vụ mới" />
        </div>
      )}
    </div>
  );
}

function AddButton({ label }: { label: string }) {
  return (
    <button className="flex items-center justify-center gap-1.5 rounded-3xl border border-dashed border-border-soft py-3 text-sm font-medium text-brand-blue tap-scale">
      <Plus size={15} /> {label}
    </button>
  );
}
