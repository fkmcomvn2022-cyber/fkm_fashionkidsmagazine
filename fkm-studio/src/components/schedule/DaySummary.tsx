import { Baby, User, Shirt, AlertCircle, ImageDown, Wallet, CheckCircle2, ChevronRight } from "lucide-react";
import { Panel } from "@/components/ui/Card";
import { ordersByDate, customerById } from "@/data";
import { formatVND } from "@/lib/format";
import type { Order } from "@/types";

interface DaySummaryProps {
  date: string;
  /** Trước đây các ô thống kê chỉ là CON SỐ tĩnh, không xem được danh sách
   * đứng sau nó — giờ bấm vào 1 ô sẽ gọi callback này, SchedulePage mở sheet
   * liệt kê đúng các đơn liên quan (tái dùng GroupOrdersSheet đã có). */
  onShowOrders: (orders: Order[], title: string) => void;
}

export function DaySummary({ date, onShowOrders }: DaySummaryProps) {
  const dayOrders = ordersByDate(date).filter((o) => o.status !== "cancelled");
  const kidOrders = dayOrders.filter((o) => o.people.some((p) => p.audience === "Trẻ em"));
  const adultOrders = dayOrders.filter((o) => o.people.some((p) => p.audience === "Người lớn"));
  const sizeOrders = dayOrders.filter((o) => o.people.some((p) => p.outfitSize));
  const sizes = Array.from(new Set(dayOrders.flatMap((o) => o.people).map((p) => p.outfitSize).filter(Boolean)));
  const missingStaff = dayOrders.filter((o) => !o.photoStaffId || !o.makeupStaffId);
  const editOrders = dayOrders.filter((o) => (o.photosToEdit ?? 0) > 0);
  const photosToEdit = editOrders.reduce((s, o) => s + (o.photosToEdit ?? 0), 0);
  const collectOrders = dayOrders.filter((o) => o.remaining > 0);
  const totalToCollect = collectOrders.reduce((s, o) => s + o.remaining, 0);
  const doneOrders = dayOrders.filter((o) => o.status === "completed" || o.status === "delivered");

  const kids = dayOrders.flatMap((o) => o.people).filter((p) => p.audience === "Trẻ em").length;
  const adults = dayOrders.flatMap((o) => o.people).filter((p) => p.audience === "Người lớn").length;

  return (
    <Panel title="Chuẩn bị trước ca & Tổng kết" subtitle={`${dayOrders.length} ca chụp trong ngày`}>
      <div className="grid grid-cols-2 gap-2.5">
        <Stat
          icon={Baby}
          label="Trẻ em"
          value={`${kids}`}
          color="#ef5fa7"
          bg="#ffe6f2"
          onClick={kidOrders.length ? () => onShowOrders(kidOrders, `${kids} trẻ em trong ${kidOrders.length} ca`) : undefined}
        />
        <Stat
          icon={User}
          label="Người lớn"
          value={`${adults}`}
          color="#4f6df5"
          bg="#e8edff"
          onClick={adultOrders.length ? () => onShowOrders(adultOrders, `${adults} người lớn trong ${adultOrders.length} ca`) : undefined}
        />
        <Stat
          icon={Shirt}
          label="Size đồ cần soạn"
          value={sizes.join(", ") || "—"}
          color="#9b5cf6"
          bg="#efe7ff"
          onClick={sizeOrders.length ? () => onShowOrders(sizeOrders, "Đơn cần soạn đồ theo size") : undefined}
        />
        <Stat
          icon={CheckCircle2}
          label="Đã hoàn thành"
          value={`${doneOrders.length}/${dayOrders.length}`}
          color="#1fb27a"
          bg="#e3f8ee"
          onClick={doneOrders.length ? () => onShowOrders(doneOrders, `${doneOrders.length} ca đã hoàn thành`) : undefined}
        />
        <Stat
          icon={Wallet}
          label="Cần thu"
          value={formatVND(totalToCollect)}
          color="#f5a524"
          bg="#fef3dc"
          onClick={collectOrders.length ? () => onShowOrders(collectOrders, `${collectOrders.length} đơn còn cần thu tiền`) : undefined}
        />
        <Stat
          icon={ImageDown}
          label="Ảnh cần sửa"
          value={`${photosToEdit}`}
          color="#ff9447"
          bg="#fff1e2"
          onClick={editOrders.length ? () => onShowOrders(editOrders, `${editOrders.length} đơn còn ảnh cần sửa`) : undefined}
        />
      </div>

      {missingStaff.length > 0 && (
        <div className="mt-3 rounded-2xl bg-danger-soft p-3">
          <div className="flex items-start gap-2 mb-1.5">
            <AlertCircle size={16} className="text-danger mt-0.5 shrink-0" />
            <p className="text-[12px] font-semibold text-danger">Thiếu nhân sự cho {missingStaff.length} ca</p>
          </div>
          {/* Trước đây chỉ là 1 dòng text gộp các giờ lại — giờ từng ca là 1
              dòng bấm được, mở thẳng chi tiết đơn để gán nhân sự ngay. */}
          <div className="flex flex-col gap-1">
            {missingStaff.map((o) => {
              const customer = customerById(o.customerId);
              const missing = [!o.photoStaffId && "Photo", !o.makeupStaffId && "Makeup"].filter(Boolean).join(", ");
              return (
                <button
                  key={o.id}
                  onClick={() => onShowOrders([o], `Ca ${o.time} thiếu ${missing}`)}
                  className="flex items-center justify-between gap-2 rounded-xl bg-surface/60 px-2.5 py-1.5 text-left tap-scale"
                >
                  <span className="text-[11px] text-danger">
                    {o.time} · {customer?.name ?? "?"} <span className="text-danger/80">(thiếu {missing})</span>
                  </span>
                  <ChevronRight size={13} className="text-danger/60 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
  bg,
  onClick,
}: {
  icon: typeof Baby;
  label: string;
  value: string;
  color: string;
  bg: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="rounded-2xl border border-border-soft p-2.5 flex items-center gap-2 text-left tap-scale disabled:opacity-60 disabled:cursor-default"
    >
      <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg, color }}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted truncate">{label}</p>
        <p className="text-[13px] font-semibold text-ink truncate">{value}</p>
      </div>
      {onClick && <ChevronRight size={13} className="text-muted shrink-0" />}
    </button>
  );
}
