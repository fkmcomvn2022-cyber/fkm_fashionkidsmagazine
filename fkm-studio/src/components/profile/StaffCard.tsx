import { useState } from "react";
import { Phone, Wallet, Pencil, MessageCircle, MessageSquare, Link2, PowerOff, Power, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { formatVND } from "@/lib/format";
import { openStaffChannel } from "@/lib/messaging";
import type { Staff, StaffContactChannel } from "@/types";

const channelMeta: Record<StaffContactChannel, { label: string; icon: typeof Phone }> = {
  call: { label: "Gọi điện", icon: Phone },
  zalo: { label: "Zalo", icon: MessageCircle },
  sms: { label: "SMS", icon: MessageSquare },
  facebook: { label: "Facebook", icon: Link2 },
};

const roleColor: Record<string, { color: string; bg: string }> = {
  Photo: { color: "#4f6df5", bg: "#e8edff" },
  Makeup: { color: "#ef5fa7", bg: "#ffe6f2" },
  Stylist: { color: "#9b5cf6", bg: "#efe7ff" },
  Retoucher: { color: "#ff9447", bg: "#fff1e2" },
  CSKH: { color: "#1fb27a", bg: "#e3f8ee" },
};

export function StaffCard({
  staff,
  onPay,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  staff: Staff;
  onPay: (s: Staff) => void;
  onEdit?: (s: Staff) => void;
  onToggleStatus?: (s: Staff) => void;
  onDelete?: (s: Staff) => void;
}) {
  const rc = roleColor[staff.role];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // "Liên lạc" mở thẳng kênh mặc định của nhân sự; nếu kênh đó không liên lạc
  // được, bấm mũi tên nhỏ để hiện các kênh còn lại làm phương án dự phòng
  // (theo đúng mô tả của user: bấm nút mặc định trước, không được mới chọn
  // kênh khác — xem [[fkm-studio-staff-profile]]).
  const otherChannels = (Object.keys(channelMeta) as StaffContactChannel[]).filter((c) => c !== staff.defaultContactChannel);

  const handleDeleteClick = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    onDelete?.(staff);
  };

  return (
    <div className={`rounded-3xl bg-surface border border-border-soft shadow-soft p-3.5 ${!staff.active ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2.5">
        <Avatar name={staff.name} size={42} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-ink truncate">{staff.name}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge color={rc.color} bg={rc.bg}>{staff.role}</Badge>
            {!staff.active && <Badge color="#94a3b8" bg="#f1f5f9">Ngừng hoạt động</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="rounded-xl bg-success-soft px-2.5 py-1.5">
          <p className="text-[10px] text-success/70">Đã thanh toán</p>
          <p className="text-[12px] font-semibold text-success">{formatVND(staff.paidThisMonth)}</p>
        </div>
        <div className="rounded-xl bg-danger-soft px-2.5 py-1.5">
          <p className="text-[10px] text-danger/70">Còn nợ</p>
          <p className="text-[12px] font-semibold text-danger">{formatVND(staff.owedThisMonth)}</p>
        </div>
      </div>

      <p className="text-[10px] text-muted mt-2">{staff.payType} · {formatVND(staff.rate)}</p>

      <div className="flex gap-1.5 mt-3 relative">
        <button
          onClick={() => openStaffChannel(staff, staff.defaultContactChannel, "")}
          className="flex-1 flex items-center justify-center gap-1 rounded-l-2xl bg-surface-soft text-ink-soft text-xs font-medium py-2 tap-scale"
        >
          <Phone size={12} /> Liên lạc
        </button>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="w-7 flex items-center justify-center rounded-r-2xl bg-surface-soft text-ink-soft text-xs tap-scale -ml-1.5 border-l border-border-soft"
          aria-label="Chọn kênh liên lạc khác"
        >
          ▾
        </button>
        {pickerOpen && (
          <div className="absolute left-0 bottom-full mb-1.5 z-10 rounded-2xl border border-border-soft bg-surface shadow-soft p-1.5 flex flex-col gap-0.5 min-w-[140px]">
            <p className="text-[10px] text-muted px-2 pt-0.5 pb-1">Kênh khác nếu không liên lạc được:</p>
            {otherChannels.map((c) => {
              const Icon = channelMeta[c].icon;
              return (
                <button
                  key={c}
                  onClick={() => {
                    openStaffChannel(staff, c, "");
                    setPickerOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-ink-soft hover:bg-surface-soft tap-scale"
                >
                  <Icon size={12} /> {channelMeta[c].label}
                </button>
              );
            })}
          </div>
        )}
        <button
          onClick={() => onEdit?.(staff)}
          className="w-9 h-9 flex items-center justify-center rounded-2xl bg-surface-soft text-ink-soft tap-scale shrink-0"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onPay(staff)}
          disabled={staff.owedThisMonth <= 0}
          className="flex-1 flex items-center justify-center gap-1 rounded-2xl bg-brand-blue text-white text-xs font-medium py-2 tap-scale disabled:opacity-40"
        >
          <Wallet size={12} /> Thanh toán
        </button>
      </div>

      {/* Trước đây không có cách ẩn/xóa nhân sự khỏi danh sách — giờ thêm 2 nút
          này, theo đúng pattern Ngừng hoạt động/Xóa đã dùng ở ConceptCard. */}
      <div className="flex gap-1.5 mt-1.5">
        <button
          onClick={() => onToggleStatus?.(staff)}
          className="flex-1 flex items-center justify-center gap-1 rounded-2xl bg-surface-soft text-ink-soft text-xs font-medium py-1.5 tap-scale"
        >
          {staff.active ? <PowerOff size={12} /> : <Power size={12} />}
          {staff.active ? "Ngừng hoạt động" : "Mở lại hoạt động"}
        </button>
        <button
          onClick={handleDeleteClick}
          className={`flex items-center justify-center gap-1 rounded-2xl text-xs font-medium py-1.5 px-2.5 tap-scale ${confirmingDelete ? "bg-danger text-white" : "bg-danger-soft text-danger"}`}
        >
          <Trash2 size={12} /> {confirmingDelete ? "Bấm lại để xóa" : "Xóa"}
        </button>
      </div>
    </div>
  );
}
