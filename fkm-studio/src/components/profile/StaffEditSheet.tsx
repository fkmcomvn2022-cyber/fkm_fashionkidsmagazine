import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { updateStaff } from "@/data";
import { banks } from "@/data/banks";
import { useAppState } from "@/lib/appState";
import type { PayType, Staff, StaffContactChannel, StaffRole } from "@/types";

const inputClass =
  "w-full rounded-2xl border border-border-soft bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-blue";

const roles: StaffRole[] = ["Photo", "Makeup", "Stylist", "Retoucher", "CSKH"];
const payTypes: PayType[] = ["Theo ca", "Theo giờ", "Theo ngày", "Theo tháng"];
const channelLabels: Record<StaffContactChannel, string> = { call: "Gọi điện", zalo: "Zalo", sms: "SMS", facebook: "Facebook" };
const channels: StaffContactChannel[] = ["call", "zalo", "sms", "facebook"];

interface StaffEditSheetProps {
  staff: Staff | null;
  onClose: () => void;
}

/** Sheet sửa thông tin liên lạc (SĐT/Zalo) + STK nhận lương của 1 nhân sự đã
 * có — trước đây chỉ tạo được lúc thêm mới, không có chỗ bổ sung/sửa lại. */
export function StaffEditSheet({ staff, onClose }: StaffEditSheetProps) {
  const { bumpDataVersion, triggerRefresh } = useAppState();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [zalo, setZalo] = useState("");
  const [facebookLink, setFacebookLink] = useState("");
  const [role, setRole] = useState<StaffRole>("Photo");
  const [payType, setPayType] = useState<PayType>("Theo ca");
  const [rate, setRate] = useState(0);
  const [bankBin, setBankBin] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [defaultContactChannel, setDefaultContactChannel] = useState<StaffContactChannel>("call");

  useEffect(() => {
    if (staff) {
      setName(staff.name);
      setPhone(staff.phone);
      setZalo(staff.zalo ?? "");
      setFacebookLink(staff.facebookLink ?? "");
      setRole(staff.role);
      setPayType(staff.payType);
      setRate(staff.rate);
      setBankBin(staff.bankBin);
      setAccountNumber(staff.accountNumber);
      setAccountName(staff.accountName);
      setDefaultContactChannel(staff.defaultContactChannel);
    }
  }, [staff]);

  if (!staff) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateStaff(staff.id, {
      name: name.trim() || staff.name,
      phone: phone.trim(),
      zalo: zalo.trim(),
      facebookLink: facebookLink.trim(),
      role,
      payType,
      rate,
      bankBin,
      accountNumber: accountNumber.trim(),
      accountName: accountName.trim(),
      defaultContactChannel,
    });
    bumpDataVersion();
    triggerRefresh();
    onClose();
  };

  return (
    <Sheet open={!!staff} onClose={onClose} title={`Sửa nhân sự · ${staff.name}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field label="Họ tên">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Số điện thoại">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" />
          </Field>
          <Field label="Zalo (nếu khác SĐT)">
            <input className={inputClass} value={zalo} onChange={(e) => setZalo(e.target.value)} placeholder="Để trống = dùng SĐT" />
          </Field>
        </div>

        <Field label="Link inbox Facebook Messenger">
          <input className={inputClass} value={facebookLink} onChange={(e) => setFacebookLink(e.target.value)} placeholder="Dán link m.me/... hoặc link inbox của em" />
        </Field>
        <p className="text-[11px] text-muted -mt-2">Bấm "Liên lạc" chọn kênh Facebook sẽ mở thẳng đúng link này — dán tay link inbox/m.me của em đó vào đây.</p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Vai trò">
            <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Hình thức lương">
            <select className={inputClass} value={payType} onChange={(e) => setPayType(e.target.value as PayType)}>
              {payTypes.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Mức lương">
          <input type="number" className={inputClass} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
        </Field>

        <Field label="Kênh liên lạc mặc định">
          <select className={inputClass} value={defaultContactChannel} onChange={(e) => setDefaultContactChannel(e.target.value as StaffContactChannel)}>
            {channels.map((c) => (
              <option key={c} value={c}>{channelLabels[c]}</option>
            ))}
          </select>
        </Field>
        <p className="text-[11px] text-muted -mt-2">Dùng khi bấm "Nhắc lịch làm việc" ở Việc nổi bật — bấm 1 cái là mở thẳng kênh này. Nút "Liên lạc" trên thẻ vẫn cho chọn kênh khác nếu kênh này không liên lạc được.</p>

        <div className="h-px bg-border-soft my-0.5" />

        <p className="text-xs font-medium text-ink-soft -mb-1.5">STK nhận lương</p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngân hàng">
            <select className={inputClass} value={bankBin} onChange={(e) => setBankBin(e.target.value)}>
              <option value="">— Chọn ngân hàng —</option>
              {banks.map((b) => (
                <option key={b.bin} value={b.bin}>{b.shortName}</option>
              ))}
            </select>
          </Field>
          <Field label="Số tài khoản">
            <input className={inputClass} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          </Field>
        </div>

        <Field label="Tên chủ tài khoản">
          <input className={inputClass} value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Gõ có dấu cũng được" />
        </Field>

        <Button type="submit" className="w-full mt-1">Lưu thay đổi</Button>
      </form>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
