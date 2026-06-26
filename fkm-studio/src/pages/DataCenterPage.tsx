import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Database, FolderCheck, History, Download, Check, RefreshCcw, HardDrive, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { orders, customers, concepts, staff } from "@/data";
import { hasPersistedData, persistAll, resetToSampleData } from "@/lib/persistence";
import { useAppState } from "@/lib/appState";

const databases = [
  { id: "db1", name: "FKM_Production_2026", active: true, lastSync: "2 phút trước" },
  { id: "db2", name: "FKM_Demo_Sandbox", active: false, lastSync: "1 ngày trước" },
];

const driveFolders = [
  { name: "Database", status: "Đã kết nối" },
  { name: "Backup", status: "Đã kết nối" },
  { name: "Ảnh khách", status: "Đã kết nối" },
];

const backups = [
  { id: "b1", time: "25/06/2026 06:00", size: "12.4 MB", type: "Tự động" },
  { id: "b2", time: "24/06/2026 06:00", size: "12.1 MB", type: "Tự động" },
  { id: "b3", time: "23/06/2026 14:32", size: "11.9 MB", type: "Thủ công" },
];

export default function DataCenterPage() {
  const navigate = useNavigate();
  const [activeDb, setActiveDb] = useState("db1");
  const [autoBackup, setAutoBackup] = useState(true);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const { dataVersion } = useAppState();

  const handleSaveNow = () => {
    persistAll();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleReset = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    resetToSampleData();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <button onClick={() => navigate("/more")} className="w-8 h-8 rounded-full bg-surface border border-border-soft flex items-center justify-center tap-scale">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-[16px] font-bold text-ink">Trung tâm Dữ liệu</h2>
      </div>

      <Panel
        title="Lưu trữ trên thiết bị này"
        subtitle="Dữ liệu thật (đơn hàng, khách, concept, nhân sự...) được lưu ngay trên trình duyệt này, tự động sau mỗi lần thêm/sửa — không mất khi tải lại trang."
        key={dataVersion}
      >
        <div className="flex items-center gap-3 py-1">
          <span className="w-9 h-9 rounded-xl bg-surface-soft text-ink-soft flex items-center justify-center shrink-0">
            <HardDrive size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-ink">
              {hasPersistedData() ? "Đã có dữ liệu lưu trên thiết bị này" : "Chưa lưu lần nào — đang dùng dữ liệu mẫu"}
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              {orders.length} đơn hàng · {customers.length} khách · {concepts.length} concept · {staff.length} nhân sự
            </p>
          </div>
        </div>
        <p className="text-[11px] text-muted mt-1">
          Lưu ý: đây là lưu trên RIÊNG trình duyệt/máy này. Đổi máy khác, dùng trình duyệt ẩn danh, hoặc xoá dữ liệu trình duyệt sẽ không thấy lại dữ liệu này.
        </p>
        <div className="flex gap-2 mt-3">
          <Button variant="soft" size="sm" icon={<RefreshCcw size={13} />} className="flex-1" onClick={handleSaveNow}>
            {savedNotice ? "Đã lưu!" : "Lưu ngay"}
          </Button>
          <Button
            variant={confirmingReset ? "danger" : "ghost"}
            size="sm"
            icon={<Trash2 size={13} />}
            className="flex-1"
            onClick={handleReset}
          >
            {confirmingReset ? "Bấm lại để xác nhận xoá" : "Xoá dữ liệu, dùng lại dữ liệu mẫu"}
          </Button>
        </div>
        {confirmingReset && (
          <p className="text-[11px] text-danger mt-2">
            Sẽ xoá toàn bộ dữ liệu đã lưu trên thiết bị này và tải lại trang. Không thể hoàn tác.
          </p>
        )}
      </Panel>

      <Panel title="Database" subtitle="Khu vực này đang là bản minh hoạ, chưa kết nối database thật">
        <div className="flex flex-col gap-2">
          {databases.map((db) => (
            <button
              key={db.id}
              onClick={() => setActiveDb(db.id)}
              className="flex items-center gap-3 rounded-2xl border border-border-soft p-3 text-left tap-scale"
            >
              <span className="w-9 h-9 rounded-xl bg-brand-blue-soft text-brand-blue flex items-center justify-center shrink-0">
                <Database size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-ink truncate">{db.name}</p>
                <p className="text-[11px] text-muted mt-0.5">Đồng bộ {db.lastSync}</p>
              </div>
              {activeDb === db.id && (
                <span className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center shrink-0">
                  <Check size={13} />
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="soft" size="sm" className="flex-1">Tạo database mới</Button>
          <Button variant="ghost" size="sm" className="flex-1">Đổi tên</Button>
        </div>
      </Panel>

      <Panel title="Google Drive" subtitle="Bản minh hoạ — chưa kết nối Google Drive thật, ảnh/dữ liệu chưa được đồng bộ lên đây">
        <div className="flex flex-col gap-2">
          {driveFolders.map((f) => (
            <div key={f.name} className="flex items-center justify-between rounded-2xl border border-border-soft px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <FolderCheck size={16} className="text-success" />
                <span className="text-[13px] font-medium text-ink">{f.name}</span>
              </div>
              <span className="text-[11px] font-medium text-success">{f.status}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Sao lưu (Backup)"
        subtitle={autoBackup ? "Bản minh hoạ — backup thật hiện chỉ là lưu trên trình duyệt ở mục phía trên" : "Backup tự động đang tắt"}
        action={
          <button
            onClick={() => setAutoBackup((v) => !v)}
            className={`text-[11px] font-semibold rounded-full px-2.5 py-1 ${autoBackup ? "bg-success-soft text-success" : "bg-surface-soft text-muted"}`}
          >
            {autoBackup ? "Đang bật" : "Đang tắt"}
          </button>
        }
      >
        <Button variant="primary" size="sm" icon={<RefreshCcw size={13} />} className="w-full mb-3">
          Tạo backup thủ công ngay
        </Button>
        <div className="flex flex-col gap-2">
          {backups.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-2xl border border-border-soft px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <History size={15} className="text-muted" />
                <div>
                  <p className="text-[12px] font-medium text-ink">{b.time}</p>
                  <p className="text-[10px] text-muted">{b.type} · {b.size}</p>
                </div>
              </div>
              <button className="w-7 h-7 rounded-full bg-surface-soft flex items-center justify-center tap-scale">
                <Download size={12} />
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
