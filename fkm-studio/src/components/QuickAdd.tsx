import { useEffect, useState } from "react";
import { Plus, FileText, Sparkles, UserPlus, ChevronRight } from "lucide-react";
import { useAppState } from "@/lib/appState";
import { Sheet } from "@/components/ui/Sheet";
import { QuickOrderForm } from "@/components/QuickOrderForm";
import { QuickConceptForm } from "@/components/QuickConceptForm";
import { QuickStaffForm } from "@/components/QuickStaffForm";

type QuickKind = "order" | "concept" | "staff" | null;

const options = [
  { kind: "order" as const, label: "Tạo đơn hàng", desc: "Lên lịch chụp mới cho khách", icon: FileText, color: "#4f6df5", bg: "#e8edff" },
  { kind: "concept" as const, label: "Tạo concept", desc: "Thêm gói sản phẩm chụp ảnh mới", icon: Sparkles, color: "#9b5cf6", bg: "#efe7ff" },
  { kind: "staff" as const, label: "Tạo nhân sự", desc: "Thêm Photo / Makeup / Stylist mới", icon: UserPlus, color: "#ff9447", bg: "#fff1e2" },
];

export function QuickAdd() {
  const { quickAddOpen, setQuickAddOpen, quickAddPrefill, clearQuickAddPrefill } = useAppState();
  const [active, setActive] = useState<QuickKind>(null);

  // Bấm vào 1 ô trống trên thẻ lịch mini -> mở sẵn thẳng form "Tạo đơn hàng",
  // bỏ qua màn chọn loại (order/concept/staff), với ngày/giờ điền sẵn.
  useEffect(() => {
    if (quickAddOpen && quickAddPrefill) setActive("order");
  }, [quickAddOpen, quickAddPrefill]);

  const close = () => {
    setQuickAddOpen(false);
    setActive(null);
    clearQuickAddPrefill();
  };

  return (
    <>
      <button
        onClick={() => setQuickAddOpen(true)}
        className="fixed z-40 right-5 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] w-14 h-14 rounded-full bg-brand-blue text-white shadow-float flex items-center justify-center tap-scale"
        aria-label="Thêm nhanh"
      >
        <Plus size={26} />
      </button>

      <Sheet open={quickAddOpen} onClose={close} title={active ? options.find((o) => o.kind === active)?.label : "Thêm nhanh"}>
        {!active && (
          <div className="flex flex-col gap-2.5">
            {options.map((o) => {
              const Icon = o.icon;
              return (
                <button
                  key={o.kind}
                  onClick={() => setActive(o.kind)}
                  className="flex items-center gap-3 rounded-3xl border border-border-soft p-3.5 text-left tap-scale hover:bg-surface-soft"
                >
                  <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: o.bg, color: o.color }}>
                    <Icon size={20} />
                  </span>
                  <span className="flex-1">
                    <div className="text-sm font-semibold text-ink">{o.label}</div>
                    <div className="text-xs text-muted">{o.desc}</div>
                  </span>
                  <ChevronRight size={16} className="text-muted" />
                </button>
              );
            })}
          </div>
        )}

        {active === "order" && (
          <QuickOrderForm onDone={close} defaultDate={quickAddPrefill?.date} defaultTime={quickAddPrefill?.time} />
        )}
        {active === "concept" && <QuickConceptForm onDone={close} />}
        {active === "staff" && <QuickStaffForm onDone={close} />}
      </Sheet>
    </>
  );
}

