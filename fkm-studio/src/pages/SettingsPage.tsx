import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, Bot, Wallet, Bell, BellRing, Smartphone, ChevronRight, LogOut, Clock, CalendarClock, Wand2, Workflow, Globe, Copy, Check, HardDrive, FlaskConical } from "lucide-react";
import { Panel } from "@/components/ui/Card";
import { breakWindowSettings, setBreakWindowSettings, type BreakWindowSetting } from "@/lib/scheduling";
import { vietQRSettings, setVietQRSettings, isVietQRConfigured, type VietQRSettings } from "@/lib/payments";
import { reminderSettings, setReminderSettings, type ReminderSettings } from "@/lib/reminders";
import { aiAutoReplySettings, setAiAutoReplySettings } from "@/lib/aiReply";
import { getPushState, subscribeToPush, unsubscribeFromPush, sendTestNotification, type PushSupportState } from "@/lib/push";
import { VietQRImage } from "@/components/VietQRImage";
import { banks } from "@/data/banks";
import { useAppState } from "@/lib/appState";
import { isNativePlatform } from "@/lib/platform";
import { BACKEND_URL } from "@/lib/persistence";
import { fetchFbConfig } from "@/lib/fbConfig";
import { fetchDriveConfig } from "@/lib/driveConfig";

const PUSH_STATE_DESC: Record<PushSupportState, string> = {
  unsupported: "Trình duyệt này không hỗ trợ thông báo đẩy",
  denied: "Bị chặn quyền — vào cài đặt trình duyệt để bật lại",
  subscribed: "Đã bật — nhận được dù tắt app",
  unsubscribed: "Chưa bật",
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-11 h-6 rounded-full p-0.5 transition-colors ${checked ? "bg-brand-blue" : "bg-surface-soft"}`}
    >
      <span className={`block w-5 h-5 rounded-full bg-white shadow-soft transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function Row({ icon, label, desc, right }: { icon: React.ReactNode; label: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-9 h-9 rounded-xl bg-surface-soft text-ink-soft flex items-center justify-center shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        {desc && <p className="text-[11px] text-muted mt-0.5">{desc}</p>}
      </div>
      {right ?? <ChevronRight size={15} className="text-muted shrink-0" />}
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  // Trước đây là 1 boolean local tự bấm, KHÔNG phản ánh thật có Page Access
  // Token đang dùng hay không (anh có thể bấm "đã kết nối" dù chưa cấu hình
  // gì). Giờ đọc thật từ /api/fb-config (xem fbConfig.ts) — null = đang tải.
  const [fbConnected, setFbConnected] = useState<boolean | null>(null);
  useEffect(() => {
    fetchFbConfig()
      .then((c) => setFbConnected(c.hasPageAccessToken))
      .catch(() => setFbConnected(false));
  }, []);
  // Tương tự fbConnected — đọc thật từ /api/drive-config (xem driveConfig.ts)
  // để biết đã dán Service Account Key chưa, không suy đoán.
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);
  useEffect(() => {
    fetchDriveConfig()
      .then((c) => setDriveConnected(c.hasServiceAccountKey))
      .catch(() => setDriveConnected(false));
  }, []);
  // Giai đoạn 3 — cờ này được mirror lên backend (xem persistAll trong
  // persistence.ts); server (server/src/index.ts) đọc lại đúng cờ này mỗi
  // lần có tin khách nhắn vào để quyết định có tự trả lời hay không.
  const [aiAuto, setAiAuto] = useState(aiAutoReplySettings.enabled);
  const [pushState, setPushState] = useState<PushSupportState>("unsubscribed");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [breaks, setBreaks] = useState<BreakWindowSetting[]>(breakWindowSettings);
  const [qr, setQr] = useState<VietQRSettings>(vietQRSettings);
  const [reminders, setReminders] = useState<ReminderSettings>(reminderSettings);
  const [backendUrlCopied, setBackendUrlCopied] = useState(false);
  const { bumpDataVersion, isDemo, toggleDemo } = useAppState();

  const handleCopyBackendUrl = () => {
    navigator.clipboard?.writeText(BACKEND_URL).catch(() => {});
    setBackendUrlCopied(true);
    setTimeout(() => setBackendUrlCopied(false), 1500);
  };

  // Đọc trạng thái thông báo đẩy thật (đã đăng ký service worker + subscribe
  // chưa) ngay khi vào màn Thiết lập — không suy đoán từ 1 biến local nữa.
  useEffect(() => {
    getPushState().then(setPushState);
  }, []);

  const handleTogglePush = async () => {
    if (pushState === "unsupported" || pushState === "denied" || pushBusy) return;
    setPushBusy(true);
    setPushMessage(null);
    if (pushState === "subscribed") {
      await unsubscribeFromPush();
      setPushState("unsubscribed");
    } else {
      const result = await subscribeToPush();
      if (result.ok) {
        setPushState("subscribed");
      } else {
        setPushState(await getPushState());
        setPushMessage(
          result.reason === "permission_denied"
            ? "Bạn đã từ chối quyền thông báo của trình duyệt."
            : "Không bật được — kiểm tra backend (server/) đã chạy chưa."
        );
      }
    }
    setPushBusy(false);
  };

  const handleTestNotification = async () => {
    setPushBusy(true);
    const result = await sendTestNotification();
    setPushMessage(
      result.ok
        ? result.sent && result.sent > 0
          ? `Đã gửi thông báo thử tới ${result.sent} thiết bị.`
          : "Backend đã nhận yêu cầu nhưng chưa có thiết bị nào đăng ký."
        : "Không gửi được — kiểm tra backend (server/) đã chạy chưa."
    );
    setPushBusy(false);
  };

  const updateBreak = (id: string, patch: Partial<BreakWindowSetting>) => {
    const next = breaks.map((w) => (w.id === id ? { ...w, ...patch } : w));
    setBreaks(next);
    setBreakWindowSettings(next);
    bumpDataVersion(); // gợi ý giờ/lịch mini phải tính lại ngay theo giờ nghỉ mới
  };

  const updateQr = (patch: Partial<VietQRSettings>) => {
    const next = { ...qr, ...patch };
    setQr(next);
    setVietQRSettings(next); // áp dụng ngay cho mọi mã QR thu tiền trong app (CollectPaymentSheet...)
    bumpDataVersion(); // lưu lại vào trình duyệt ngay (xem persistence.ts)
  };

  const updateReminders = (patch: Partial<ReminderSettings>) => {
    const next = { ...reminders, ...patch };
    setReminders(next);
    setReminderSettings(next); // áp dụng ngay cho "Nhắc lịch" ở Việc nổi bật
    bumpDataVersion();
  };

  const handleToggleAiAuto = () => {
    const next = !aiAuto;
    setAiAuto(next);
    setAiAutoReplySettings({ ...aiAutoReplySettings, enabled: next }); // giữ nguyên customPrompt/functions đã cấu hình, chỉ đổi cờ bật/tắt
    bumpDataVersion(); // mirror lên backend ngay — server đọc cờ này ở webhook tiếp theo
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <button onClick={() => navigate("/more")} className="w-8 h-8 rounded-full bg-surface border border-border-soft flex items-center justify-center tap-scale">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-[16px] font-bold text-ink">Thiết lập</h2>
      </div>

      <Panel title="Chế độ Demo" subtitle="BẬT để hiện dữ liệu mẫu (xem thử/giới thiệu); TẮT để chỉ làm việc với dữ liệu thật. Mặc định là TẮT — dùng thật hằng ngày.">
        <Row
          icon={<FlaskConical size={16} />}
          label="Hiện dữ liệu mẫu (demo)"
          desc={isDemo ? "Đang BẬT — đang hiện cả dữ liệu mẫu" : "Đang TẮT — chỉ hiện dữ liệu thật"}
          right={<Toggle checked={isDemo} onChange={toggleDemo} />}
        />
      </Panel>

      <Panel title="Kết nối">
        <div className="flex flex-col divide-y divide-border-soft">
          {isNativePlatform() ? (
            <Row
              icon={<MessageCircle size={16} />}
              label="Facebook Messenger"
              desc={fbConnected === null ? "Đang kiểm tra..." : fbConnected ? "Đã có Page Access Token" : "Chưa cấu hình"}
              right={<span className="text-[11px] text-muted">{fbConnected ? "Đã kết nối" : "Chưa kết nối"}</span>}
            />
          ) : (
            <button onClick={() => navigate("/settings/facebook")} className="w-full text-left">
              <Row
                icon={<MessageCircle size={16} />}
                label="Facebook Messenger"
                desc={
                  fbConnected === null
                    ? "Đang kiểm tra..."
                    : fbConnected
                      ? "Đã có Page Access Token — bấm để xem/đổi"
                      : "Chưa cấu hình — bấm để nhập Page Access Token/App Secret"
                }
              />
            </button>
          )}
          <Row
            icon={<Bot size={16} />}
            label="AI tự động trả lời khách"
            desc={aiAuto ? "Đang tự trả lời tin Facebook bằng AI (Gemini)" : "Đang tắt — anh tự trả lời khách"}
            right={<Toggle checked={aiAuto} onChange={handleToggleAiAuto} />}
          />
          {!isNativePlatform() && (
            <>
              <button onClick={() => navigate("/settings/ai")} className="w-full text-left">
                <Row
                  icon={<Wand2 size={16} />}
                  label="Tuỳ chỉnh AI (prompt + function)"
                  desc="Hướng dẫn thêm + chọn nghiệp vụ AI được tự gọi khi trả lời"
                />
              </button>
              <button onClick={() => navigate("/settings/automation")} className="w-full text-left">
                <Row
                  icon={<Workflow size={16} />}
                  label="Automation"
                  desc="Luật tự động: nhắc cọc, nhắc lịch, nhắc chọn ảnh cho khách Facebook"
                />
              </button>
              <button onClick={() => navigate("/settings/drive")} className="w-full text-left">
                <Row
                  icon={<HardDrive size={16} />}
                  label="Google Drive"
                  desc={
                    driveConnected === null
                      ? "Đang kiểm tra..."
                      : driveConnected
                        ? "Đã kết nối — bấm để xem/đổi"
                        : "Chưa cấu hình — bấm để nhập Service Account Key/Folder ID"
                  }
                />
              </button>
            </>
          )}
        </div>
      </Panel>

      <Panel
        title="Trợ lý AI nội bộ"
        subtitle="Trợ lý riêng cho anh/chị (khác AI trả lời khách): chat hoặc đọc bằng giọng nói để tạo đơn nhanh, hỏi doanh thu/lịch. Mẹo: bật chế độ DEMO (nút góc trên) để thử tạo đơn an toàn trước khi dùng thật."
      >
        <button onClick={() => navigate("/assistant")} className="w-full text-left">
          <Row
            icon={<Bot size={16} />}
            label="Mở Trợ lý AI nội bộ"
            desc="Tạo đơn bằng chat/giọng nói · hỏi số liệu, lịch, đơn còn nợ"
          />
        </button>
      </Panel>

      <Panel title="Thanh toán" subtitle="Tài khoản nhận tiền dùng cho mọi mã QR thu cọc/thu tiền trong app — đổi được, không gắn cứng vào 1 studio">
        <div className="flex flex-col gap-3 py-1">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-surface-soft text-ink-soft flex items-center justify-center shrink-0">
              <Wallet size={16} />
            </span>
            <div className="flex-1 grid grid-cols-2 gap-2">
              <select
                value={qr.bankBin}
                onChange={(e) => updateQr({ bankBin: e.target.value })}
                className="rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-[12px] text-ink outline-none focus:border-brand-blue"
              >
                <option value="">— Chọn ngân hàng —</option>
                {banks.map((b) => (
                  <option key={b.bin} value={b.bin}>{b.shortName}</option>
                ))}
              </select>
              <input
                value={qr.accountNumber}
                onChange={(e) => updateQr({ accountNumber: e.target.value })}
                placeholder="Số tài khoản"
                className="rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-[12px] text-ink outline-none focus:border-brand-blue"
              />
            </div>
          </div>
          <input
            value={qr.accountName}
            onChange={(e) => updateQr({ accountName: e.target.value })}
            placeholder="Tên chủ tài khoản (gõ có dấu cũng được, tự chuyển thành không dấu)"
            className="ml-12 rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-[12px] text-ink outline-none focus:border-brand-blue"
          />
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <VietQRImage size={140} addInfo="Xem truoc" />
            <p className="text-[11px] text-muted">
              {isVietQRConfigured(qr) ? "Mã QR thật — quét chuyển tiền được" : "Điền đủ ngân hàng + số tài khoản + tên chủ tài khoản để ra mã QR thật"}
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Giờ nghỉ ekip" subtitle="Áp dụng khi app gợi ý giờ nhận khách mới — tắt thì coi như không có, không né/cảnh báo gì nữa">
        <div className="flex flex-col divide-y divide-border-soft">
          {breaks.map((w) => (
            <div key={w.id} className="flex items-center gap-3 py-2.5">
              <span className="w-9 h-9 rounded-xl bg-surface-soft text-ink-soft flex items-center justify-center shrink-0">
                <Clock size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink">{w.label}</p>
                {w.enabled ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="time"
                      value={w.start}
                      onChange={(e) => updateBreak(w.id, { start: e.target.value })}
                      className="rounded-lg border border-border-soft bg-surface px-1.5 py-0.5 text-[11px] text-ink-soft outline-none focus:border-brand-blue"
                    />
                    <span className="text-[11px] text-muted">–</span>
                    <input
                      type="time"
                      value={w.end}
                      onChange={(e) => updateBreak(w.id, { end: e.target.value })}
                      className="rounded-lg border border-border-soft bg-surface px-1.5 py-0.5 text-[11px] text-ink-soft outline-none focus:border-brand-blue"
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-muted mt-0.5">Đã tắt — không né giờ này khi gợi ý</p>
                )}
              </div>
              <Toggle checked={w.enabled} onChange={() => updateBreak(w.id, { enabled: !w.enabled })} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Nhắc lịch hẹn" subtitle="Áp dụng cho 'Nhắc lịch' ở Việc nổi bật — gửi vào buổi tối, trước ngày hẹn mấy ngày">
        <div className="flex items-center gap-3 py-2.5">
          <span className="w-9 h-9 rounded-xl bg-surface-soft text-ink-soft flex items-center justify-center shrink-0">
            <CalendarClock size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-ink">Nhắc trước</p>
            <p className="text-[11px] text-muted mt-0.5">Số ngày trước lịch hẹn để gửi nhắc khách</p>
          </div>
          <select
            value={reminders.scheduleReminderDaysBefore}
            onChange={(e) => updateReminders({ scheduleReminderDaysBefore: Number(e.target.value) })}
            className="rounded-lg border border-border-soft bg-surface px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-brand-blue"
          >
            <option value={1}>1 ngày</option>
            <option value={2}>2 ngày</option>
          </select>
        </div>
      </Panel>

      <Panel title="Hệ thống" subtitle={pushMessage ?? undefined}>
        <div className="flex flex-col divide-y divide-border-soft">
          <Row
            icon={<Bell size={16} />}
            label="Thông báo đẩy"
            desc={PUSH_STATE_DESC[pushState]}
            right={
              pushState === "unsupported" || pushState === "denied" ? (
                <span className="text-[11px] text-muted">{pushState === "denied" ? "Bị chặn" : "Không hỗ trợ"}</span>
              ) : (
                <Toggle checked={pushState === "subscribed"} onChange={handleTogglePush} />
              )
            }
          />
          {pushState === "subscribed" && (
            <button
              onClick={handleTestNotification}
              disabled={pushBusy}
              className="flex items-center gap-3 py-2.5 text-left disabled:opacity-50"
            >
              <span className="w-9 h-9 rounded-xl bg-surface-soft text-ink-soft flex items-center justify-center shrink-0">
                <BellRing size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink">Gửi thử thông báo</p>
                <p className="text-[11px] text-muted mt-0.5">Xác nhận đường ống thông báo đang hoạt động</p>
              </div>
              <ChevronRight size={15} className="text-muted shrink-0" />
            </button>
          )}
          <Row icon={<Smartphone size={16} />} label="Phiên bản ứng dụng" desc="FKM Studio v2.0.0 (Web App)" right={<span className="text-[11px] text-muted">Mới nhất</span>} />
          <button
            onClick={handleCopyBackendUrl}
            className="flex items-center gap-3 py-2.5 text-left"
          >
            <span className="w-9 h-9 rounded-xl bg-surface-soft text-ink-soft flex items-center justify-center shrink-0">
              <Globe size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-ink">Server kết nối (Render)</p>
              <p className="text-[11px] text-muted mt-0.5 truncate">{BACKEND_URL}</p>
            </div>
            {backendUrlCopied ? (
              <Check size={15} className="text-success shrink-0" />
            ) : (
              <Copy size={15} className="text-muted shrink-0" />
            )}
          </button>
        </div>
      </Panel>

      <button className="flex items-center justify-center gap-2 rounded-3xl border border-danger/20 bg-danger-soft text-danger text-sm font-semibold py-3 tap-scale">
        <LogOut size={15} /> Đăng xuất
      </button>
    </div>
  );
}
