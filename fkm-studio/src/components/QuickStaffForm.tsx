import { useState, type FormEvent } from "react";
import { useAppState } from "@/lib/appState";
import { Button } from "@/components/ui/Button";
import { createStaff } from "@/data";
import type { PayType, StaffRole } from "@/types";

const inputClass = "w-full rounded-2xl border border-border-soft bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-blue";

function FieldLabel({ children }: { children: string }) {
  return <label className="text-xs font-medium text-ink-soft mb-1.5 block">{children}</label>;
}

const roles: StaffRole[] = ["Photo", "Makeup", "Stylist", "Retoucher", "CSKH"];
const payTypes: PayType[] = ["Theo ca", "Theo giờ", "Theo ngày", "Theo tháng"];

export function QuickStaffForm({ onDone }: { onDone: () => void }) {
  const { bumpDataVersion, triggerRefresh } = useAppState();
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("Photo");
  const [payType, setPayType] = useState<PayType>("Theo ca");
  const [phone, setPhone] = useState("");
  const [rate, setRate] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Vui lòng nhập họ tên.");
      return;
    }
    createStaff({ name, role, payType, phone, rate: rate === "" ? undefined : rate });
    bumpDataVersion();
    triggerRefresh();
    onDone();
  };

  return (
    <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
      {error && <div className="rounded-2xl bg-danger-soft text-danger text-xs font-medium px-3 py-2">{error}</div>}
      <div>
        <FieldLabel>Họ tên</FieldLabel>
        <input className={inputClass} placeholder="Tên nhân sự" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Vai trò</FieldLabel>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
            {roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Hình thức lương</FieldLabel>
          <select className={inputClass} value={payType} onChange={(e) => setPayType(e.target.value as PayType)}>
            {payTypes.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Số điện thoại</FieldLabel>
          <input className={inputClass} placeholder="09xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Mức lương (mặc định 0)</FieldLabel>
          <input type="number" className={inputClass} placeholder="0" value={rate} onChange={(e) => setRate(e.target.value ? Number(e.target.value) : "")} />
        </div>
      </div>
      <Button type="submit" className="w-full mt-1">Tạo nhân sự</Button>
    </form>
  );
}
