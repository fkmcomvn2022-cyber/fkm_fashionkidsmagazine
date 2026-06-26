import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAppState } from "@/lib/appState";
import { concepts } from "@/data";
import { formatVND } from "@/lib/format";
import { orders } from "@/data";

export function ConceptBanner() {
  const { activeConceptId, setActiveConceptId } = useAppState();
  const [open, setOpen] = useState(false);
  const concept = concepts.find((c) => c.id === activeConceptId) ?? concepts[0];
  const ordersThisMonth = orders.filter((o) => o.conceptId === concept.id).length;
  const revenue = orders.filter((o) => o.conceptId === concept.id).reduce((s, o) => s + o.total, 0);

  return (
    <div
      className="relative rounded-3xl p-4 shadow-card overflow-hidden text-white"
      style={{ background: `linear-gradient(135deg, ${concept.color}, ${concept.color}cc)` }}
    >
      <div className="absolute -right-6 -bottom-8 w-32 h-32 rounded-full bg-white/10" />
      <div className="absolute -right-2 -top-10 w-20 h-20 rounded-full bg-white/10" />

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80 uppercase tracking-wide">
          <Sparkles size={12} />
          Concept điều hành
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-medium bg-white/20 rounded-full px-2.5 py-1 tap-scale"
        >
          Đổi
          <ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
      </div>

      <div className="relative z-10 mt-2">
        <h2 className="text-xl font-bold text-white">{concept.name}</h2>
        <p className="text-[12px] text-white/80 mt-0.5">{concept.shortDesc}</p>
      </div>

      <div className="relative z-10 flex items-center gap-4 mt-3 text-[12px]">
        <div>
          <div className="text-white/70 text-[10px]">Đơn hàng</div>
          <div className="font-semibold">{ordersThisMonth}</div>
        </div>
        <div className="w-px h-6 bg-white/25" />
        <div>
          <div className="text-white/70 text-[10px]">Doanh thu</div>
          <div className="font-semibold">{formatVND(revenue)}</div>
        </div>
        <div className="w-px h-6 bg-white/25" />
        <div>
          <div className="text-white/70 text-[10px]">Giá từ</div>
          <div className="font-semibold">{formatVND(concept.priceFrom)}</div>
        </div>
      </div>

      {open && (
        <div className="relative z-10 mt-3 flex flex-col gap-1.5 bg-white/15 rounded-2xl p-1.5">
          {concepts.filter((c) => c.status === "active").map((c) => (
            <button
              key={c.id}
              onClick={() => { setActiveConceptId(c.id); setOpen(false); }}
              className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[13px] font-medium text-white hover:bg-white/15 tap-scale"
            >
              <span className="w-2 h-2 rounded-full bg-white" style={{ opacity: c.id === concept.id ? 1 : 0.4 }} />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
