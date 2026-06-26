import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { VietQRImage } from "@/components/VietQRImage";
import { formatVND } from "@/lib/format";
import type { Order } from "@/types";
import { customerById, recordPayment } from "@/data";
import { useAppState } from "@/lib/appState";
import { CheckCircle2 } from "lucide-react";

interface CollectPaymentSheetProps {
  order: Order | null;
  onClose: () => void;
}

export function CollectPaymentSheet({ order, onClose }: CollectPaymentSheetProps) {
  const [amount, setAmount] = useState(order?.remaining ?? 0);
  const [confirmed, setConfirmed] = useState(false);
  const customer = order ? customerById(order.customerId) : undefined;
  const { bumpDataVersion, triggerRefresh } = useAppState();

  if (!order) return null;

  const handleConfirm = () => {
    // Ghi nhận thật vào đơn — trước đây nút này chỉ đổi UI, không lưu gì cả.
    recordPayment(order.id, amount);
    bumpDataVersion();
    triggerRefresh();
    setConfirmed(true);
  };

  return (
    <Sheet open={!!order} onClose={() => { setConfirmed(false); onClose(); }} title="Thu tiền VietQR">
      {!confirmed ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-surface-soft p-3 text-sm">
            <div className="flex justify-between text-ink-soft">
              <span>Khách hàng</span>
              <span className="font-medium text-ink">{customer?.name}</span>
            </div>
            <div className="flex justify-between text-ink-soft mt-1">
              <span>Còn lại</span>
              <span className="font-medium text-ink">{formatVND(order.remaining)}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-ink-soft mb-1.5 block">Số tiền thu</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full rounded-2xl border border-border-soft bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-blue"
            />
          </div>

          <div className="flex flex-col items-center gap-2 py-2">
            <VietQRImage amount={amount} addInfo={`${order.code} ${customer?.name ?? ""}`.trim()} />
            <p className="text-[12px] text-muted">VietQR · {formatVND(amount)}</p>
          </div>

          <Button onClick={handleConfirm} className="w-full">Xác nhận đã thu tiền</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle2 size={48} className="text-success" />
          <p className="text-sm font-semibold text-ink">Đã ghi nhận thanh toán</p>
          <p className="text-xs text-muted text-center">{formatVND(amount)} từ {customer?.name}</p>
          <Button onClick={() => { setConfirmed(false); onClose(); }} className="w-full mt-2">Xong</Button>
        </div>
      )}
    </Sheet>
  );
}
