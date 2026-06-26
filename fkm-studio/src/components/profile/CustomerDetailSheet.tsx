import { Phone, Folder, Image, ImageDown, Images, MessageCircle } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/Badge";
import { formatVND, formatDateShort } from "@/lib/format";
import { ordersByCustomer, conceptById } from "@/data";
import type { Customer } from "@/types";

export function CustomerDetailSheet({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  if (!customer) return null;
  const history = ordersByCustomer(customer.id).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Sheet open={!!customer} onClose={onClose} title="Hồ sơ khách hàng">
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <Avatar name={customer.name} size={72} />
          {customer.tag && (
            <span className="text-[10px] font-semibold bg-brand-blue-soft text-brand-blue rounded-full px-2.5 py-1">{customer.tag}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[16px] font-bold text-ink">{customer.name}</h3>
          <p className="text-[13px] text-muted mt-0.5">{customer.phone}</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Stat label="Tổng đơn" value={String(customer.totalOrders)} />
            <Stat label="Tổng chi tiêu" value={formatVND(customer.totalSpent)} />
          </div>
          {customer.lastVisit && <p className="text-[11px] text-muted mt-2">Chụp gần nhất: {formatDateShort(customer.lastVisit)}/2026</p>}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <a href={`tel:${customer.phone}`} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-brand-blue text-white text-sm font-medium py-2.5 tap-scale">
          <Phone size={14} /> Gọi
        </a>
        <button className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-surface-soft text-ink-soft text-sm font-medium py-2.5 tap-scale">
          <MessageCircle size={14} /> Nhắn tin
        </button>
      </div>

      {customer.notes && (
        <div className="mt-4 rounded-2xl bg-surface-soft p-3 text-xs text-ink-soft">{customer.notes}</div>
      )}

      <p className="text-xs font-semibold text-ink-soft mt-5 mb-2">Lịch sử đơn hàng</p>
      <div className="flex flex-col gap-2.5">
        {history.map((order) => {
          const concept = conceptById(order.conceptId);
          return (
            <div key={order.id} className="rounded-2xl border border-border-soft p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: concept?.color }} />
                  <span className="text-[13px] font-semibold text-ink">{concept?.name}</span>
                </div>
                <StatusPill status={order.status} />
              </div>
              <p className="text-[11px] text-muted mt-1">{formatDateShort(order.date)}/2026 · {order.time} · {formatVND(order.total)}</p>
              {order.photoLinks && (
                <div className="flex gap-1.5 mt-2">
                  {[
                    { url: order.photoLinks.folder, icon: Folder, label: "Folder" },
                    { url: order.photoLinks.raw, icon: Images, label: "Gốc" },
                    { url: order.photoLinks.selected, icon: Image, label: "Chọn" },
                    { url: order.photoLinks.final, icon: ImageDown, label: "Final" },
                  ].map(({ url, icon: Icon, label }) =>
                    url ? (
                      <a key={label} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-medium text-brand-blue bg-brand-blue-soft rounded-full px-2 py-1">
                        <Icon size={11} /> {label}
                      </a>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          );
        })}
        {history.length === 0 && <p className="text-xs text-muted">Chưa có đơn hàng nào</p>}
      </div>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-soft px-2.5 py-1.5">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="text-[13px] font-semibold text-ink">{value}</p>
    </div>
  );
}
