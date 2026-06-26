import { ChevronRight } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar } from "@/components/ui/Avatar";
import { customerById, conceptById } from "@/data";
import type { Order } from "@/types";

interface GroupOrdersSheetProps {
  orders: Order[] | null;
  onClose: () => void;
  onOpenOrder: (order: Order) => void;
  /** Tuỳ chỉnh tiêu đề sheet — mặc định "N khách trong nhóm này" (dùng khi mở
   * từ ô lịch mini gộp nhóm). Các nơi khác (vd. bấm vào 1 ô thống kê ở
   * DaySummary) truyền tiêu đề riêng, vd. "6 ca có trẻ em". */
  title?: string;
}

/**
 * Sheet liệt kê danh sách đơn dùng chung cho nhiều nơi: ô lịch mini gộp nhóm
 * (WeekCalendar) VÀ các ô thống kê/banner ở DaySummary (xem
 * [[fkm-studio-scheduling-model]]) — bấm vào 1 dòng để xem chi tiết đơn.
 */
export function GroupOrdersSheet({ orders, onClose, onOpenOrder, title }: GroupOrdersSheetProps) {
  if (!orders) return null;

  return (
    <Sheet open={!!orders} onClose={onClose} title={title ?? `${orders.length} khách trong nhóm này`}>
      <div className="flex flex-col gap-2">
        {orders
          .slice()
          .sort((a, b) => a.time.localeCompare(b.time))
          .map((order) => {
            const customer = customerById(order.customerId);
            const concept = conceptById(order.conceptId);
            return (
              <button
                key={order.id}
                onClick={() => onOpenOrder(order)}
                className="flex items-center gap-3 rounded-2xl border border-border-soft p-3 text-left tap-scale hover:bg-surface-soft"
              >
                <Avatar name={customer?.name ?? "?"} size={38} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">{customer?.name}</p>
                  <p className="text-[11px] text-muted flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: concept?.color }} />
                    {concept?.name} · {order.time} · {order.people.length} người
                  </p>
                </div>
                <ChevronRight size={16} className="text-muted shrink-0" />
              </button>
            );
          })}
      </div>
    </Sheet>
  );
}
