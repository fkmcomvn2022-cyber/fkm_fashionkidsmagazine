import { useEffect, useState } from "react";
import { Folder, Image, ImageDown, Images, Phone, Pencil, Ban, Link2, RefreshCw } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { StatusPill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { QuickOrderForm } from "@/components/QuickOrderForm";
import { formatVND, orderStatusMeta } from "@/lib/format";
import {
  customerById,
  conceptById,
  staffById,
  addonServices,
  setOrderStatus,
  cancelOrder,
  setOrderPhotoSelectionItems,
  recordPhotoSelectionResult,
} from "@/data";
import { useAppState } from "@/lib/appState";
import { BACKEND_URL } from "@/lib/persistence";
import type { Order, OrderStatus } from "@/types";

interface OrderDetailSheetProps {
  order: Order | null;
  onClose: () => void;
}

const linkItems = (links: Order["photoLinks"]) => [
  { key: "folder", label: "Folder ảnh", url: links?.folder, icon: Folder },
  { key: "raw", label: "Ảnh gốc", url: links?.raw, icon: Images },
  { key: "selected", label: "Ảnh chọn", url: links?.selected, icon: Image },
  { key: "final", label: "Ảnh final", url: links?.final, icon: ImageDown },
];

const allStatuses: OrderStatus[] = [
  "new", "deposited", "scheduled", "shooting", "shot", "selecting", "editing", "delivered", "completed", "cancelled",
];

export function OrderDetailSheet({ order, onClose }: OrderDetailSheetProps) {
  const { bumpDataVersion, triggerRefresh } = useAppState();
  const [editing, setEditing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [itemsText, setItemsText] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [selectionMsg, setSelectionMsg] = useState<string | null>(null);

  // Sheet không bị unmount khi đổi sang đơn khác (xem SchedulePage) — phải tự
  // đồng bộ lại state cục bộ theo order.id, không chỉ dựa vào useState lazy init.
  useEffect(() => {
    setItemsText((order?.photoSelection?.items ?? []).join("\n"));
    setSelectionMsg(null);
  }, [order?.id]);

  if (!order) return null;
  const customer = customerById(order.customerId);
  const concept = conceptById(order.conceptId);
  const cancelled = order.status === "cancelled";

  if (editing) {
    return (
      <Sheet open={!!order} onClose={() => setEditing(false)} title={`Sửa đơn ${order.code}`}>
        <QuickOrderForm editOrder={order} onDone={() => setEditing(false)} />
      </Sheet>
    );
  }

  const handleStatusChange = (status: OrderStatus) => {
    setOrderStatus(order.id, status);
    bumpDataVersion();
    triggerRefresh();
  };

  const handleCancel = () => {
    if (!confirmingCancel) {
      setConfirmingCancel(true);
      return;
    }
    cancelOrder(order.id);
    bumpDataVersion();
    triggerRefresh();
    setConfirmingCancel(false);
  };

  const selectionLink = `${window.location.origin}/chon-anh/${order.id}`;

  const handleSaveItems = () => {
    const items = itemsText.split("\n").map((s) => s.trim()).filter(Boolean);
    setOrderPhotoSelectionItems(order.id, items);
    bumpDataVersion();
    triggerRefresh();
    setSelectionMsg(`Đã lưu ${items.length} ảnh — copy link gửi khách chọn.`);
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(selectionLink).catch(() => {});
    setSelectionMsg("Đã copy link cổng chọn ảnh — dán vào chat gửi khách.");
  };

  // Backend chỉ nhận ghi (xem fkm-studio-ai-chatbot-roadmap) — khi khách chọn
  // xong qua cổng công khai, dữ liệu đó nằm ở backend, app studio phải tự kéo
  // về để hiển thị đúng tiến độ mới nhất khi mở lại chi tiết đơn.
  const handleSyncSelection = async () => {
    setSyncing(true);
    setSelectionMsg(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/orders/${order.id}/photo-selection`);
      if (!res.ok) {
        setSelectionMsg("Chưa lấy được trạng thái mới — kiểm tra backend đã chạy chưa.");
        return;
      }
      const data = (await res.json()) as { selectedUrls?: string[]; completedAt?: string };
      if (data.completedAt) {
        recordPhotoSelectionResult(order.id, data.selectedUrls ?? []);
        bumpDataVersion();
        triggerRefresh();
        setSelectionMsg(`Khách đã chọn ${data.selectedUrls?.length ?? 0} ảnh.`);
      } else {
        setSelectionMsg("Khách chưa xác nhận chọn xong.");
      }
    } catch {
      setSelectionMsg("Chưa lấy được trạng thái mới — kiểm tra backend đã chạy chưa.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Sheet open={!!order} onClose={onClose} title={order.code}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={customer?.name ?? "?"} size={44} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">{customer?.name}</p>
            <p className="text-xs text-muted">{customer?.phone}</p>
          </div>
          <StatusPill status={order.status} />
        </div>

        <div className="flex gap-2">
          <Button variant="soft" size="sm" icon={<Pencil size={13} />} className="flex-1" onClick={() => setEditing(true)} disabled={cancelled}>
            Sửa đơn
          </Button>
          <Button
            variant={confirmingCancel ? "danger" : "ghost"}
            size="sm"
            icon={<Ban size={13} />}
            className="flex-1"
            onClick={handleCancel}
            disabled={cancelled}
          >
            {cancelled ? "Đã huỷ" : confirmingCancel ? "Bấm lại để xác nhận" : "Hủy đơn"}
          </Button>
        </div>
        {confirmingCancel && (
          <p className="text-[11px] text-danger -mt-2">Sẽ chuyển đơn này sang trạng thái "Đã huỷ". Không thể hoàn tác.</p>
        )}

        <div>
          <p className="text-xs font-semibold text-ink-soft mb-1.5">Trạng thái đơn</p>
          <select
            value={order.status}
            onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
            className="w-full rounded-2xl border border-border-soft bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-blue"
          >
            {allStatuses.map((s) => (
              <option key={s} value={s}>{orderStatusMeta[s].label}</option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl bg-surface-soft p-3 text-sm flex flex-col gap-1.5">
          <Row label="Concept" value={concept?.name} dot={concept?.color} />
          <Row label="Ngày giờ" value={`${order.date} · ${order.time}`} />
          <Row label="Số người" value={String(order.people.length)} />
          <Row label="Tổng tiền" value={formatVND(order.total)} />
          <Row label="Đã cọc" value={formatVND(order.deposit)} />
          <Row label="Còn lại" value={formatVND(order.remaining)} highlight={order.remaining > 0} />
        </div>

        <div>
          <p className="text-xs font-semibold text-ink-soft mb-2">Người chụp</p>
          <div className="flex flex-col gap-2">
            {order.people.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl border border-border-soft px-3 py-2 text-xs">
                <span className="font-medium text-ink">{p.name}</span>
                <span className="text-muted">{p.audience} · {p.age ?? "—"} tuổi · Size {p.outfitSize ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>

        {order.addonServiceIds.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-soft mb-2">Dịch vụ thêm</p>
            <div className="flex flex-wrap gap-1.5">
              {order.addonServiceIds.map((id) => {
                const svc = addonServices.find((s) => s.id === id);
                if (!svc) return null;
                return (
                  <span key={id} className="text-[11px] bg-brand-blue-soft text-brand-blue rounded-full px-2.5 py-1 font-medium">
                    {svc.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-ink-soft mb-2">Nhân sự</p>
          <div className="flex flex-wrap gap-1.5">
            {[order.photoStaffId, order.makeupStaffId, order.stylistStaffId, order.retoucherId]
              .filter(Boolean)
              .map((id) => {
                const s = staffById(id!);
                if (!s) return null;
                return (
                  <span key={id} className="text-[11px] bg-surface-soft text-ink-soft rounded-full px-2.5 py-1 font-medium border border-border-soft">
                    {s.role}: {s.name}
                  </span>
                );
              })}
          </div>
        </div>

        {order.photoLinks && (
          <div>
            <p className="text-xs font-semibold text-ink-soft mb-2">Link ảnh</p>
            <div className="grid grid-cols-2 gap-2">
              {linkItems(order.photoLinks).map(({ key, label, url, icon: Icon }) => (
                <a
                  key={key}
                  href={url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-2xl border border-border-soft px-3 py-2 text-xs font-medium text-ink-soft tap-scale"
                  onClick={(e) => !url && e.preventDefault()}
                >
                  <Icon size={14} className={url ? "text-brand-blue" : "text-muted"} />
                  {label}
                </a>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-ink-soft mb-2">Cổng chọn ảnh cho khách</p>
          <div className="rounded-2xl border border-border-soft p-3 flex flex-col gap-2.5">
            <textarea
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              placeholder="Dán link từng ảnh, mỗi dòng 1 ảnh"
              rows={3}
              className="w-full rounded-xl border border-border-soft bg-surface-soft px-3 py-2 text-xs text-ink outline-none focus:border-brand-blue resize-none"
            />
            <div className="flex gap-2">
              <Button variant="soft" size="sm" className="flex-1" onClick={handleSaveItems}>
                Lưu danh sách ảnh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Link2 size={13} />}
                className="flex-1"
                onClick={handleCopyLink}
                disabled={(order.photoSelection?.items.length ?? 0) === 0}
              >
                Copy link cho khách
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-surface-soft px-3 py-2">
              <div className="text-xs">
                {order.photoSelection?.completedAt ? (
                  <span className="font-medium text-success">
                    Khách đã chọn {order.photoSelection.selectedUrls?.length ?? 0}/{order.photoSelection.items.length} ảnh
                  </span>
                ) : (
                  <span className="text-muted">Khách chưa xác nhận chọn xong</span>
                )}
              </div>
              <button
                onClick={handleSyncSelection}
                disabled={syncing}
                className="flex items-center gap-1 text-[11px] text-brand-blue font-medium disabled:opacity-50"
              >
                <RefreshCw size={12} className={syncing ? "animate-spin" : ""} /> Cập nhật
              </button>
            </div>
            {selectionMsg && <p className="text-[11px] text-muted">{selectionMsg}</p>}
          </div>
        </div>

        {customer?.phone && (
          <a
            href={`tel:${customer.phone}`}
            className="flex items-center justify-center gap-2 rounded-2xl bg-brand-blue text-white text-sm font-medium py-3 tap-scale"
          >
            <Phone size={15} /> Gọi cho khách
          </a>
        )}
      </div>
    </Sheet>
  );
}

function Row({ label, value, dot, highlight }: { label: string; value?: string; dot?: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className={`font-medium flex items-center gap-1.5 ${highlight ? "text-danger" : "text-ink"}`}>
        {dot && <span className="w-2 h-2 rounded-full" style={{ background: dot }} />}
        {value}
      </span>
    </div>
  );
}
