import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FolderCog,
  RefreshCcw,
  HardDrive,
  Trash2,
  Eraser,
  AlertCircle,
  CheckCircle2,
  Upload,
} from "lucide-react";
import { Panel } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { orders, customers, concepts, staff } from "@/data";
import {
  hasPersistedData,
  persistAll,
  resetToSampleData,
  wipeAllData,
  clearSampleData,
  countSampleData,
  downloadBackupFile,
  parseBackupFile,
  restoreSnapshot,
  countSnapshot,
  getAutoBackupSettings,
  setAutoBackupIntervalDays,
  type PersistedSnapshot,
} from "@/lib/persistence";
import { useAppState } from "@/lib/appState";
import { isNativePlatform } from "@/lib/platform";
import { fetchDriveConfig, type MaskedDriveConfig } from "@/lib/driveConfig";

const AUTO_BACKUP_OPTIONS: { days: number; label: string }[] = [
  { days: 0, label: "Tắt" },
  { days: 1, label: "Mỗi ngày" },
  { days: 7, label: "Mỗi tuần" },
  { days: 30, label: "Mỗi tháng" },
];

export default function DataCenterPage() {
  const navigate = useNavigate();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingClearSample, setConfirmingClearSample] = useState(false);
  const [confirmingWipe, setConfirmingWipe] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [backupNotice, setBackupNotice] = useState(false);
  const [driveConfig, setDriveConfig] = useState<MaskedDriveConfig | "loading" | "error">("loading");
  const [pendingImport, setPendingImport] = useState<Partial<PersistedSnapshot> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [autoBackup, setAutoBackup] = useState(getAutoBackupSettings());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { dataVersion } = useAppState();
  const sampleBreakdown = countSampleData();

  useEffect(() => {
    fetchDriveConfig()
      .then(setDriveConfig)
      .catch(() => setDriveConfig("error"));
  }, []);

  const handleSaveNow = () => {
    persistAll();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleDownloadBackup = () => {
    downloadBackupFile();
    setBackupNotice(true);
    setTimeout(() => setBackupNotice(false), 1800);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại đúng file đó lần sau nếu huỷ
    if (!file) return;
    const result = await parseBackupFile(file);
    if (!result.ok) {
      setImportError(result.error);
      setPendingImport(null);
      return;
    }
    setImportError(null);
    setPendingImport(result.snapshot);
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    restoreSnapshot(pendingImport); // tự tải lại trang sau khi ghi
  };

  const handleCancelImport = () => {
    setPendingImport(null);
    setImportError(null);
  };

  const handleSetAutoBackupDays = (days: number) => {
    setAutoBackupIntervalDays(days);
    setAutoBackup(getAutoBackupSettings());
  };

  const handleReset = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    resetToSampleData();
  };

  const handleClearSample = () => {
    if (!confirmingClearSample) {
      setConfirmingClearSample(true);
      return;
    }
    clearSampleData();
  };

  const handleWipe = () => {
    if (!confirmingWipe) {
      setConfirmingWipe(true);
      return;
    }
    wipeAllData();
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

        <div className="mt-3 pt-3 border-t border-border-soft">
          <Button
            variant={confirmingWipe ? "danger" : "ghost"}
            size="sm"
            icon={<Trash2 size={13} />}
            className="w-full"
            onClick={handleWipe}
          >
            {confirmingWipe ? "Bấm lại để XOÁ TRẮNG toàn bộ" : "Xoá TRẮNG toàn bộ (làm lại từ đầu)"}
          </Button>
          <p className="text-[11px] text-danger mt-2">
            {confirmingWipe
              ? "Xoá SẠCH mọi đơn/khách/concept/nhân sự/kho/tin nhắn (cả mẫu lẫn thật) trên thiết bị NÀY và trên server, để app về trắng hoàn toàn cho anh tự nhập lại. Cấu hình (giờ nghỉ, VietQR, AI...) được giữ. KHÔNG THỂ HOÀN TÁC — nên Tải file backup trước."
              : "Khác với 2 nút trên: đưa app về RỖNG hoàn toàn (không nạp lại mẫu, không giữ khách thật), xoá cả trên server để không tự đồng bộ về."}
          </p>
        </div>
      </Panel>

      {sampleBreakdown.length > 0 && (
        <Panel
          title="Dọn dữ liệu mẫu"
          subtitle="Xoá riêng các bản ghi mẫu (demo) có sẵn từ đầu — giữ lại mọi đơn/khách/concept/nhân sự thật anh đã tạo/sửa sau đó."
          key={`sample-${dataVersion}`}
        >
          <div className="flex flex-wrap gap-1.5 mb-3">
            {sampleBreakdown.map((row) => (
              <span key={row.label} className="text-[11px] font-medium bg-surface-soft text-ink-soft rounded-full px-2.5 py-1">
                {row.label}: {row.count}
              </span>
            ))}
          </div>
          <Button
            variant={confirmingClearSample ? "danger" : "soft"}
            size="sm"
            icon={<Eraser size={13} />}
            className="w-full"
            onClick={handleClearSample}
          >
            {confirmingClearSample ? "Bấm lại để xác nhận xoá dữ liệu mẫu" : "Xoá dữ liệu mẫu, giữ dữ liệu thật"}
          </Button>
          {confirmingClearSample && (
            <p className="text-[11px] text-danger mt-2">
              Sẽ xoá đúng các bản ghi mẫu ở trên (kể cả Concept/Nhân sự/Kho mẫu) và tải lại trang. Nếu có đơn thật đang
              dùng 1 concept/nhân sự mẫu, đơn đó sẽ mất tên hiển thị (không mất dữ liệu đơn). Không thể hoàn tác.
            </p>
          )}
        </Panel>
      )}

      <Panel
        title="Google Drive (ảnh khách)"
        subtitle="Trạng thái thật — nơi ảnh khách được upload lên khi tạo folder riêng theo khách"
      >
        {driveConfig === "loading" && <p className="text-[12px] text-muted">Đang kiểm tra...</p>}
        {driveConfig === "error" && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-border-soft p-3">
            <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" />
            <p className="text-[12px] text-ink-soft">
              Không gọi được server backend để kiểm tra. Server chưa chạy, hoặc máy này chưa kết nối được tới backend.
            </p>
          </div>
        )}
        {driveConfig !== "loading" && driveConfig !== "error" && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-border-soft p-3">
            {driveConfig.hasServiceAccountKey ? (
              <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-warning shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">
                {driveConfig.hasServiceAccountKey ? "Đã cấu hình Service Account" : "Chưa cấu hình Service Account"}
              </p>
              {driveConfig.hasServiceAccountKey ? (
                <p className="text-[11px] text-muted mt-0.5 break-all">
                  {driveConfig.serviceAccountEmail || "(không rõ email)"} · Folder: {driveConfig.folderId || "(chưa đặt folder gốc)"}
                </p>
              ) : (
                <p className="text-[11px] text-muted mt-0.5">
                  Upload ảnh khách sẽ lỗi cho tới khi dán Service Account key vào đây.
                </p>
              )}
            </div>
          </div>
        )}
        {!isNativePlatform() && (
          <Button
            variant="soft"
            size="sm"
            icon={<FolderCog size={13} />}
            className="w-full mt-3"
            onClick={() => navigate("/settings/drive")}
          >
            Mở Cấu hình Google Drive
          </Button>
        )}
      </Panel>

      <Panel
        title="Sao lưu (Backup)"
        subtitle="Xuất file .json chứa toàn bộ dữ liệu — anh tự lưu giữ (Drive, USB, máy khác...). Có thể tự tải theo lịch mỗi lần mở app."
      >
        <Button variant="primary" size="sm" icon={<RefreshCcw size={13} />} className="w-full" onClick={handleDownloadBackup}>
          {backupNotice ? "Đã tải file!" : "Tải file backup (.json) ngay"}
        </Button>

        <div className="mt-3">
          <p className="text-[12px] font-medium text-ink">Tự tải backup theo lịch</p>
          <div className="flex gap-1.5 mt-1.5">
            {AUTO_BACKUP_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => handleSetAutoBackupDays(opt.days)}
                className={`flex-1 text-[11px] font-medium rounded-xl py-1.5 tap-scale ${
                  autoBackup.intervalDays === opt.days
                    ? "bg-ink text-white"
                    : "bg-surface-soft text-ink-soft"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-1.5">
            {autoBackup.intervalDays === 0
              ? "Đang tắt — chỉ tải khi anh bấm nút trên."
              : `Tự kiểm tra mỗi lần mở app: nếu đã đủ ${autoBackup.intervalDays} ngày từ lần trước, tự tải file mới. ${
                  autoBackup.lastBackupAt
                    ? `Lần tự backup gần nhất: ${new Date(autoBackup.lastBackupAt).toLocaleString("vi-VN")}.`
                    : "Chưa tự backup lần nào."
                }`}
          </p>
          <p className="text-[10px] text-muted mt-1">
            Lưu ý: app web/PWA không chạy nền được lúc đã tắt hẳn — đây là kiểm tra mỗi lần mở app, không phải lịch chạy nền của hệ điều hành.
          </p>
        </div>

        <div className="mt-3 pt-3 border-t border-border-soft">
          <p className="text-[12px] font-medium text-ink">Nhập (khôi phục) từ file backup</p>
          <p className="text-[11px] text-muted mt-0.5 mb-2">
            Chọn 1 file .json đã tải ở trên (máy này hoặc máy khác) để ghi đè dữ liệu hiện tại.
          </p>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleFileSelected} className="hidden" />
          <Button
            variant="soft"
            size="sm"
            icon={<Upload size={13} />}
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            Chọn file backup (.json)
          </Button>
          {importError && (
            <div className="flex items-start gap-2 mt-2 rounded-2xl border border-border-soft p-2.5">
              <AlertCircle size={14} className="text-danger shrink-0 mt-0.5" />
              <p className="text-[11px] text-ink-soft">{importError}</p>
            </div>
          )}
          {pendingImport && (
            <div className="mt-2 rounded-2xl border border-border-soft p-3">
              <p className="text-[12px] font-medium text-ink mb-1.5">File này chứa:</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {countSnapshot(pendingImport).map((row) => (
                  <span key={row.label} className="text-[11px] font-medium bg-surface-soft text-ink-soft rounded-full px-2.5 py-1">
                    {row.label}: {row.count}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-danger mb-2">
                Xác nhận sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại trên thiết bị này bằng dữ liệu trong file rồi tải lại trang. Không thể hoàn tác.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1" onClick={handleCancelImport}>
                  Huỷ
                </Button>
                <Button variant="danger" size="sm" className="flex-1" onClick={handleConfirmImport}>
                  Xác nhận nhập, ghi đè
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
