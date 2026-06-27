import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Check, AlertCircle, Copy, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/ui/Card";
import { fetchFbConfig, saveFbConfig, type MaskedFbConfig } from "@/lib/fbConfig";
import { BACKEND_URL } from "@/lib/persistence";

const WEBHOOK_URL = `${BACKEND_URL}/webhook/facebook`;

/**
 * Cấu hình kết nối Facebook Messenger nhập trực tiếp trong app — thay cho
 * cách cũ phải vào Render Dashboard đặt biến môi trường (xem
 * server/src/fbConfig.ts + README.md cũ). Theo yêu cầu của anh (2026-06-28):
 * "Xây ô nhập ngay trong app". Cùng pattern bảo mật với
 * ProviderSettingsPanel ở AiSettingsPage.tsx — gọi trực tiếp /api/fb-config,
 * KHÔNG đi qua state mirror công khai.
 */
export default function FacebookSettingsPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<MaskedFbConfig | null>(null);
  const [verifyTokenDraft, setVerifyTokenDraft] = useState("");
  const [pageIdDraft, setPageIdDraft] = useState("");
  const [appSecretDraft, setAppSecretDraft] = useState("");
  const [pageAccessTokenDraft, setPageAccessTokenDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const load = () => {
    fetchFbConfig()
      .then((c) => {
        setConfig(c);
        setVerifyTokenDraft(c.verifyToken);
        setPageIdDraft(c.pageId);
        setError(null);
      })
      .catch(() => setError("Chưa kết nối được tới server — kiểm tra lại backend đang chạy chưa."));
  };

  useEffect(load, []);

  const handleCopyWebhookUrl = () => {
    navigator.clipboard?.writeText(WEBHOOK_URL).catch(() => {});
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 1500);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await saveFbConfig({
        verifyToken: verifyTokenDraft,
        pageId: pageIdDraft,
        ...(appSecretDraft.trim() ? { appSecret: appSecretDraft.trim() } : {}),
        ...(pageAccessTokenDraft.trim() ? { pageAccessToken: pageAccessTokenDraft.trim() } : {}),
      });
      setConfig(updated);
      setAppSecretDraft("");
      setPageAccessTokenDraft(""); // xoá draft bí mật khỏi state UI ngay sau khi lưu
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch {
      setError("Không lưu được — kiểm tra lại kết nối server rồi thử lại.");
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
        <h2 className="text-[16px] font-bold text-ink">Kết nối Facebook Messenger</h2>
      </div>

      <Panel
        title="Bước 1 — Khai báo Webhook trên Meta for Developers"
        subtitle="Vào App của anh > Messenger > Cài đặt Messenger > Webhooks > Thêm Callback URL, dán đúng 2 ô dưới đây."
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-xl border border-border-soft bg-surface px-3 py-2">
              <p className="text-[10px] text-muted">Callback URL</p>
              <p className="text-[12px] text-ink truncate">{WEBHOOK_URL}</p>
            </div>
            <button onClick={handleCopyWebhookUrl} className="w-9 h-9 rounded-xl bg-surface-soft flex items-center justify-center shrink-0 tap-scale">
              {urlCopied ? <Check size={15} className="text-success" /> : <Copy size={15} className="text-muted" />}
            </button>
          </div>
          <p className="text-[11px] text-muted px-0.5">Verify Token dán vào Meta phải đúng với ô "Verify Token" ở Bước 2 dưới đây.</p>
        </div>
      </Panel>

      <Panel
        title="Bước 2 — Thông tin kết nối"
        subtitle="App Secret/Page Access Token là bí mật — ô để trống nghĩa là giữ nguyên giá trị đã lưu, không bị xoá."
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
              <label className="text-[11px] font-medium text-ink-soft px-0.5">Verify Token</label>
              <input
                value={verifyTokenDraft}
                onChange={(e) => setVerifyTokenDraft(e.target.value)}
                placeholder="Tự đặt 1 chuỗi bất kỳ, vd. fkm_xac_minh_2026"
                className="w-full rounded-xl border border-border-soft bg-surface px-2.5 py-2 text-[12px] text-ink outline-none focus:border-brand-blue"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-ink-soft px-0.5">App Secret</label>
              <input
                type="password"
                value={appSecretDraft}
                onChange={(e) => setAppSecretDraft(e.target.value)}
                placeholder={config.hasAppSecret ? `Đã lưu ${config.maskedAppSecret} — gõ để đổi` : "App for Developers > App > Cài đặt > Cơ bản"}
                className="w-full rounded-xl border border-border-soft bg-surface px-2.5 py-2 text-[12px] text-ink outline-none focus:border-brand-blue"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-ink-soft px-0.5">Page Access Token</label>
              <input
                type="password"
                value={pageAccessTokenDraft}
                onChange={(e) => setPageAccessTokenDraft(e.target.value)}
                placeholder={config.hasPageAccessToken ? `Đã lưu ${config.maskedPageAccessToken} — gõ để đổi` : "Messenger > Cài đặt Messenger > Page Access Token"}
                className="w-full rounded-xl border border-border-soft bg-surface px-2.5 py-2 text-[12px] text-ink outline-none focus:border-brand-blue"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-ink-soft px-0.5">Page ID</label>
              <input
                value={pageIdDraft}
                onChange={(e) => setPageIdDraft(e.target.value)}
                placeholder="Để studio tự đối chiếu đúng Trang — chưa bắt buộc cho việc gửi/nhận tin"
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
        Đã đặt biến môi trường FB_VERIFY_TOKEN/FB_APP_SECRET/FB_PAGE_ACCESS_TOKEN trên Render trước đây? Vẫn dùng được như mặc định — chỉ cần nhập ở đây khi muốn đổi mà không vào lại Render.
      </p>
    </div>
  );
}
