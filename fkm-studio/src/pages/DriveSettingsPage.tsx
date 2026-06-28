import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Check, AlertCircle, Copy, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/ui/Card";
import { fetchDriveConfig, saveDriveConfig, type MaskedDriveConfig } from "@/lib/driveConfig";

/**
 * Cấu hình kết nối Google Drive (Service Account key + Folder ID) nhập trực
 * tiếp trong app — cùng pattern bảo mật với FacebookSettingsPage.tsx (gọi
 * thẳng /api/drive-config, KHÔNG đi qua state mirror công khai). Theo yêu
 * cầu của anh (2026-06-28): dùng Service Account (1 lần setup duy nhất),
 * KHÔNG dùng OAuth tương tác — xem [[fkm-studio-drive-folder-per-customer]].
 */
export default function DriveSettingsPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<MaskedDriveConfig | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [folderIdDraft, setFolderIdDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const load = () => {
    fetchDriveConfig()
      .then((c) => {
        setConfig(c);
        setFolderIdDraft(c.folderId);
        setError(null);
      })
      .catch(() => setError("Chưa kết nối được tới server — kiểm tra lại backend đang chạy chưa."));
  };

  useEffect(load, []);

  const handleCopyEmail = () => {
    if (!config?.serviceAccountEmail) return;
    navigator.clipboard?.writeText(config.serviceAccountEmail).catch(() => {});
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 1500);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await saveDriveConfig({
        folderId: folderIdDraft,
        ...(keyDraft.trim() ? { serviceAccountKeyJson: keyDraft.trim() } : {}),
      });
      setConfig(updated);
      setKeyDraft(""); // xoá draft khỏi state UI ngay sau khi lưu — key thật chỉ nằm ở server
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch {
      setError("Không lưu được — kiểm tra lại kết nối server, hoặc key dán vào có phải đúng JSON không.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full bg-surface border border-border-soft flex items-center justify-center tap-scale">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-[16px] font-bold text-ink">Kết nối Google Drive</h2>
      </div>

      <Panel
        title="Dùng để làm gì?"
        subtitle="Lưu ảnh studio gửi cho khách (nút Gửi ảnh trong Hội thoại, kéo-thả vào Cổng chọn ảnh) — app tự tạo 1 folder riêng cho mỗi khách, ảnh tự nằm đúng folder của khách đó."
      >
        <p className="text-[11px] text-muted px-0.5">
          Dùng Drive thường (free 15GB) của anh — không cần mua Google Workspace, không cần đăng nhập lại định kỳ. Anh chỉ cần làm 4 bước dưới đây 1 LẦN DUY NHẤT.
        </p>
      </Panel>

      <Panel
        title="Bước 1 — Bật Google Drive API"
        subtitle="Trên Google Cloud Console (console.cloud.google.com)"
      >
        <ol className="text-[12px] text-ink-soft list-decimal pl-4 flex flex-col gap-1.5">
          <li>Tạo 1 project mới (hoặc chọn project có sẵn) ở góc trên bên trái.</li>
          <li>Vào menu "APIs &amp; Services" → "Library", tìm "Google Drive API" → bấm "Enable".</li>
        </ol>
      </Panel>

      <Panel
        title="Bước 2 — Tạo Service Account + tải key JSON"
        subtitle="Vẫn trong project vừa bật Drive API"
      >
        <ol className="text-[12px] text-ink-soft list-decimal pl-4 flex flex-col gap-1.5">
          <li>Vào "APIs &amp; Services" → "Credentials" → "Create Credentials" → chọn "Service Account".</li>
          <li>Đặt tên bất kỳ (vd "fkm-drive-upload") → bấm "Done" (không cần gán quyền/Role gì ở đây).</li>
          <li>Bấm vào service account vừa tạo → tab "Keys" → "Add Key" → "Create new key" → chọn JSON → tải file về.</li>
          <li>Mở file JSON đó bằng Notepad/TextEdit, copy nguyên văn toàn bộ nội dung, dán vào ô "Service Account Key" ở Bước 4 dưới đây.</li>
        </ol>
      </Panel>

      <Panel
        title="Bước 3 — Tạo folder Drive + chia sẻ cho Service Account"
        subtitle="Trên drive.google.com — Drive cá nhân của anh"
      >
        <ol className="text-[12px] text-ink-soft list-decimal pl-4 flex flex-col gap-1.5">
          <li>Tạo 1 folder mới, đặt tên bất kỳ (vd "Ảnh khách FKM") — đây là folder gốc, app sẽ tự tạo folder con riêng cho từng khách bên trong.</li>
          <li>
            Chuột phải vào folder → "Chia sẻ" → dán email Service Account (dạng <code>...@...iam.gserviceaccount.com</code>, lấy ở trường <code>client_email</code> trong file JSON
            {config?.hasServiceAccountKey && config.serviceAccountEmail ? (
              <>
                {" "}— anh đã lưu, email hiện tại là:{" "}
                <button onClick={handleCopyEmail} className="inline-flex items-center gap-1 text-brand-blue font-medium underline">
                  {config.serviceAccountEmail}
                  {emailCopied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                </button>
              </>
            ) : (
              " — chưa lưu key nên chưa có email để đối chiếu"
            )}
            ) → chọn quyền "Editor" (Người chỉnh sửa) → Gửi.
          </li>
          <li>
            Mở folder đó, copy ID folder từ thanh địa chỉ (phần sau <code>/folders/</code> trong URL <code>drive.google.com/drive/folders/&lt;ID&gt;</code>) → dán vào ô "Folder ID" ở Bước 4.
          </li>
        </ol>
      </Panel>

      <Panel
        title="Bước 4 — Dán vào app"
        subtitle="Key Service Account là bí mật — ô để trống nghĩa là giữ nguyên key đã lưu, không bị xoá."
        action={<ShieldCheck size={16} className="text-brand-blue" />}
      >
        {error && (
          <div className="flex items-center gap-1.5 rounded-xl bg-red-50 text-red-600 px-3 py-2 text-[11px] mb-3">
            <AlertCircle size={13} className="shrink-0" />
            {error}
          </div>
        )}
        {!config ? (
          <div className="flex items-center justify-center py-6 text-muted text-[12px] gap-2">
            <Loader2 size={14} className="animate-spin" /> Đang tải cấu hình...
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-ink-soft px-0.5">Service Account Key (dán nguyên văn file JSON)</label>
              <textarea
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                rows={4}
                placeholder={
                  config.hasServiceAccountKey
                    ? `Đã lưu — email: ${config.serviceAccountEmail || "?"} — gõ/dán đè để đổi key khác`
                    : `Dán nguyên văn nội dung file JSON tải ở Bước 2 (dạng { "type": "service_account", ... })`
                }
                className="w-full rounded-xl border border-border-soft bg-surface px-2.5 py-2 text-[11px] text-ink outline-none focus:border-brand-blue resize-none font-mono"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-ink-soft px-0.5">Folder ID</label>
              <input
                value={folderIdDraft}
                onChange={(e) => setFolderIdDraft(e.target.value)}
                placeholder="Copy từ URL folder Drive ở Bước 3, vd 1A2b3C4d5E6f..."
                className="w-full rounded-xl border border-border-soft bg-surface px-2.5 py-2 text-[12px] text-ink outline-none focus:border-brand-blue"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="self-end rounded-lg bg-brand-blue text-white text-[12px] font-medium px-4 py-2 tap-scale disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              {justSaved && <Check size={13} />}
              Lưu
            </button>
          </div>
        )}
      </Panel>

      <p className="text-[10px] text-muted text-center px-2">
        Đã đặt biến môi trường DRIVE_SERVICE_ACCOUNT_KEY/DRIVE_FOLDER_ID trên Render trước đây? Vẫn dùng được như mặc định — chỉ cần nhập ở đây khi muốn đổi mà không vào lại Render.
      </p>
    </div>
  );
}
