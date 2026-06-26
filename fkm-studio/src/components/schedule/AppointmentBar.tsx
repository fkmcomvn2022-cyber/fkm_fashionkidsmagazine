import { Phone, Wallet, UserCheck, Clock3, AlertTriangle } from "lucide-react";
import { StatusPill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { customerById, conceptById } from "@/data";
import { formatVND, orderStatusMeta } from "@/lib/format";
import { minutesToLabel, type TimelineEntry } from "@/lib/scheduling";
import type { Order } from "@/types";

interface AppointmentBarProps {
  entry: TimelineEntry;
  onOpen: (order: Order) => void;
  onCollect: (order: Order) => void;
  onCheckIn: (order: Order) => void;
}

export function AppointmentBar({ entry, onOpen, onCollect, onCheckIn }: AppointmentBarProps) {
  const order = entry.order;
  const customer = customerById(order.customerId);
  const concept = conceptById(order.conceptId);
  const meta = orderStatusMeta[order.status];

  return (
    <div
      className="rounded-3xl bg-surface border border-border-soft shadow-soft overflow-hidden tap-scale"
      style={{ borderLeft: `4px solid ${meta.color}` }}
    >
      <button onClick={() => onOpen(order)} className="w-full text-left px-3.5 pt-3 pb-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar name={customer?.name ?? "?"} size={38} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink truncate">{customer?.name}</span>
              <span className="text-[12px] font-semibold text-ink-soft shrink-0">Đến {order.time}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: concept?.color }} />
              <span className="text-[11px] text-muted truncate">{concept?.name} · {order.people.length} người</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-[10.5px] text-muted">
              <Clock3 size={11} className="shrink-0" />
              <span>
                Trang điểm {minutesToLabel(entry.makeupStart)}–{minutesToLabel(entry.makeupEnd)} · Chụp{" "}
                {minutesToLabel(entry.shootStart)}–{minutesToLabel(entry.shootEnd)}
              </span>
            </div>
            {entry.isDelayed && (
              <div className="flex items-center gap-1 mt-1 text-[10.5px] text-warning font-medium">
                <AlertTriangle size={11} className="shrink-0" />
                <span>
                  {entry.waitMin > 0
                    ? `Trễ ${entry.waitMin} phút so với giờ hẹn (bàn trang điểm còn bận)`
                    : `Chờ thêm ${entry.queueMin} phút (set chụp còn bận)`}
                </span>
              </div>
            )}
          </div>
        </div>
      </button>

      <div className="flex items-center justify-between px-3.5 pb-3">
        <StatusPill status={order.status} />
        <div className="flex items-center gap-1.5">
          <a
            href={`tel:${customer?.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="w-8 h-8 rounded-full bg-surface-soft flex items-center justify-center text-ink-soft tap-scale"
            aria-label="Liên lạc"
          >
            <Phone size={14} />
          </a>
          <button
            onClick={() => onCollect(order)}
            disabled={order.remaining <= 0}
            className="w-8 h-8 rounded-full bg-warning-soft text-warning flex items-center justify-center tap-scale disabled:opacity-30"
            aria-label="Thu tiền"
            title={order.remaining > 0 ? `Thu ${formatVND(order.remaining)}` : "Đã thanh toán đủ"}
          >
            <Wallet size={14} />
          </button>
          <button
            onClick={() => onCheckIn(order)}
            className="w-8 h-8 rounded-full bg-success-soft text-success flex items-center justify-center tap-scale"
            aria-label="Điểm danh"
          >
            <UserCheck size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
