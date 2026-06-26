import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { formatVND } from "@/lib/format";
import type { Staff } from "@/types";

export function StaffPaySheet({ staff, onClose }: { staff: Staff | null; onClose: () => void }) {
  const [amount, setAmount] = useState(staff?.owedThisMonth ?? 0);
  const [done, setDone] = useState(false);
  if (!staff) return null;

  return (
    <Sheet open={!!staff} onClose={() => { setDone(false); onClose(); }} title={`Thanh toán cho ${staff.name}`}>
      {!done ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-surface-soft p-3 text-sm flex justify-between">
            <span className="text-ink-soft">Còn nợ</span>
            <span className="font-semibold text-danger">{formatVND(staff.owedThisMonth)}</span>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft mb-1.5 block">Số tiền thanh toán</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full rounded-2xl border border-border-soft bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-blue"
            />
          </div>
          <Button onClick={() => setDone(true)} className="w-full">Xác nhận thanh toán</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle2 size={48} className="text-success" />
          <p className="text-sm font-semibold text-ink">Đã thanh toán {formatVND(amount)}</p>
          <Button onClick={() => { setDone(false); onClose(); }} className="w-full mt-2">Xong</Button>
        </div>
      )}
    </Sheet>
  );
}
