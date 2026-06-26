import { useState } from "react";
import { CheckCircle2, Wallet } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { previewCrewSettlement, confirmCrewSettlement, staffForCrewRole, staffById, type SettlementPreview } from "@/data";
import { formatVND, addDays } from "@/lib/format";
import { useAppState } from "@/lib/appState";
import type { CrewSettlementRole } from "@/types";

const roles: CrewSettlementRole[] = ["Photo", "Makeup", "Stylist", "Retoucher"];

const inputClass =
  "w-full rounded-2xl border border-border-soft bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-blue";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sổ quyết toán công thợ — học theo `api_settleCrewPayment_impl` của bản Apps
 * Script (xem [[fkm-studio-apps-script-reference]]): chọn khoảng ngày + vai
 * trò + (tuỳ chọn) 1 nhân sự cụ thể, xem trước danh sách đơn + tổng tiền
 * công, rồi mới xác nhận ghi vào sổ (`crewSettlements`). Sau khi xác nhận,
 * các đơn được đánh dấu đã trả công vai trò này — không bị tính lại lần sau.
 */
export function CrewSettlementSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { bumpDataVersion, triggerRefresh } = useAppState();
  const [role, setRole] = useState<CrewSettlementRole>("Photo");
  const [staffId, setStaffId] = useState<string>("");
  const [fromDate, setFromDate] = useState(addDays(todayIso(), -30));
  const [toDate, setToDate] = useState(todayIso());
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [done, setDone] = useState<{ total: number } | null>(null);

  const close = () => {
    setPreview(null);
    setDone(null);
    onClose();
  };

  const handlePreview = () => {
    setPreview(
      previewCrewSettlement({
        role,
        staffId: staffId || undefined,
        fromDate,
        toDate,
      }),
    );
  };

  const handleConfirm = () => {
    if (!preview) return;
    const settlement = confirmCrewSettlement(preview);
    bumpDataVersion();
    triggerRefresh();
    setDone({ total: settlement.total });
    setPreview(null);
  };

  return (
    <Sheet open={open} onClose={close} title="Quyết toán công thợ">
      {done ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle2 size={48} className="text-success" />
          <p className="text-sm font-semibold text-ink">Đã quyết toán {formatVND(done.total)}</p>
          <Button onClick={close} className="w-full mt-2">Xong</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">Vai trò</span>
              <select
                className={inputClass}
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as CrewSettlementRole);
                  setStaffId("");
                  setPreview(null);
                }}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">Nhân sự</span>
              <select
                className={inputClass}
                value={staffId}
                onChange={(e) => {
                  setStaffId(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="">Tất cả ({role})</option>
                {staffForCrewRole(role).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">Từ ngày</span>
              <input
                type="date"
                className={inputClass}
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPreview(null);
                }}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">Đến ngày</span>
              <input
                type="date"
                className={inputClass}
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPreview(null);
                }}
              />
            </label>
          </div>

          {!preview ? (
            <Button onClick={handlePreview} className="w-full">Xem trước</Button>
          ) : (
            <>
              <div className="rounded-2xl bg-surface-soft p-3 flex flex-col gap-2 max-h-[260px] overflow-y-auto">
                {preview.candidates.length === 0 ? (
                  <p className="text-xs text-muted text-center py-3">Không có đơn nào phù hợp trong khoảng ngày này (hoặc đã quyết toán hết).</p>
                ) : (
                  preview.candidates.map((c) => {
                    const s = staffById(c.staffId);
                    return (
                      <div key={`${c.order.id}-${c.staffId}`} className="flex items-center justify-between text-[12px]">
                        <div>
                          <p className="font-medium text-ink">{c.order.code} · {c.order.date.slice(8, 10)}/{c.order.date.slice(5, 7)}</p>
                          <p className="text-muted">{s?.name ?? "—"}{c.dedupedSameDay ? " · cùng ngày, đã tính ở đơn khác" : ""}</p>
                        </div>
                        <span className={`font-semibold ${c.amount === 0 ? "text-muted" : "text-ink"}`}>{formatVND(c.amount)}</span>
                      </div>
                    );
                  })
                )}
                {preview.skippedMonthlyCount > 0 && (
                  <p className="text-[11px] text-muted pt-1 border-t border-border-soft">
                    Bỏ qua {preview.skippedMonthlyCount} đơn của nhân sự lương tháng (không tính theo đơn).
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-success-soft p-3 flex items-center justify-between">
                <span className="text-xs font-medium text-success/80">Tổng tiền công</span>
                <span className="text-[15px] font-bold text-success">{formatVND(preview.total)}</span>
              </div>

              <div className="flex gap-2.5">
                <button onClick={() => setPreview(null)} className="flex-1 rounded-2xl bg-surface-soft text-ink-soft text-sm font-medium py-2.5 tap-scale">
                  Sửa lại
                </button>
                <Button onClick={handleConfirm} disabled={preview.candidates.length === 0 || preview.total === 0} className="flex-1 flex items-center justify-center gap-1.5">
                  <Wallet size={14} /> Xác nhận
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
