import { useNavigate } from "react-router-dom";
import { Wallet, Database, Settings, Bot, ChevronRight } from "lucide-react";

const items = [
  { to: "/assistant", icon: Bot, label: "Trợ lý AI nội bộ", desc: "Hỏi nhanh doanh thu, lịch, nhân sự, khách hàng", color: "#2bb673", bg: "#e3f7ec" },
  { to: "/finance", icon: Wallet, label: "Trung tâm Tài chính", desc: "Doanh thu, chi phí, lợi nhuận theo concept", color: "#4f6df5", bg: "#e8edff" },
  { to: "/data-center", icon: Database, label: "Trung tâm Dữ liệu", desc: "Quản lý database, Google Drive, backup", color: "#9b5cf6", bg: "#efe7ff" },
  { to: "/settings", icon: Settings, label: "Thiết lập", desc: "Messenger, AI, Thanh toán, Hệ thống", color: "#ff9447", bg: "#fff1e2" },
];

export default function MorePage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[16px] font-bold text-ink px-0.5">Thêm</h2>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.to}
            onClick={() => navigate(item.to)}
            className="flex items-center gap-3 rounded-3xl bg-surface border border-border-soft shadow-soft p-4 text-left tap-scale"
          >
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: item.bg, color: item.color }}>
              <Icon size={20} />
            </span>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-ink">{item.label}</p>
              <p className="text-[12px] text-muted mt-0.5">{item.desc}</p>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>
        );
      })}
    </div>
  );
}
