import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronLeft, MessageCircle, Send, Copy, Check, Loader2, AlertCircle, Trash2, ImagePlus, Bot, Power } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  getConversationThreads,
  customerById,
  messages as allMessages,
  markThreadRead,
  mergeRemoteMessages,
  mergeRemoteCustomers,
  ordersByCustomer,
  conceptById,
  removeConversation,
} from "@/data";
import { timeAgoVi, formatDateShort } from "@/lib/format";
import { describeOpenWindows, getSuggestedHours, formatHourSuggestionsReply } from "@/lib/suggestionEngine";
import { useAppState } from "@/lib/appState";
import { BACKEND_URL } from "@/lib/persistence";
import { fileToThumbnailDataUrl } from "@/lib/imageThumb";
import { customerAvatarSrc } from "@/lib/avatar";
import type { Message } from "@/types";

const templates = [
  { key: "schedule", label: "Nhắc lịch" },
  { key: "deposit", label: "Nhắc cọc" },
  { key: "select", label: "Nhắc chọn ảnh" },
  { key: "suggest", label: "Gợi ý lịch" },
];

function buildTemplate(
  key: string,
  customerName: string,
  conceptName?: string,
  date?: string,
  time?: string,
  conceptId?: string,
  peopleCount?: number,
) {
  switch (key) {
    case "schedule":
      return `Chào ${customerName}, FKM Studio nhắc lịch chụp ${conceptName ?? ""} của bạn vào ${time ?? ""} ngày ${date ?? ""}. Bạn nhớ đến đúng giờ giúp studio nha!`;
    case "deposit":
      return `Chào ${customerName}, bạn vui lòng đặt cọc giữ lịch chụp ${conceptName ?? ""} giúp studio nha, cảm ơn bạn!`;
    case "select":
      return `Chào ${customerName}, ảnh buổi chụp ${conceptName ?? ""} của bạn đã sẵn sàng để chọn, bạn vào link đã gửi để chọn ảnh giúp studio nha!`;
    case "suggest": {
      // Demo engine gợi ý: nếu đã biết ngày + concept cụ thể của khách thì tính
      // luôn các ca giờ phù hợp trong ngày đó; nếu chưa, chỉ mô tả khung mở bán
      // mặc định (đúng luồng hội thoại 2 bước trong thiết kế).
      if (date && conceptId) {
        const hours = getSuggestedHours(conceptId, date, peopleCount ?? 1);
        return `Chào ${customerName}, ngày ${formatDateShort(date)} (${conceptName ?? ""}): ${formatHourSuggestionsReply(hours)}`;
      }
      return `Chào ${customerName}, studio hiện mở lịch nhận khách: ${describeOpenWindows()}. Bạn cho studio biết ngày bạn muốn đến để xếp giờ đẹp giúp bạn nha!`;
    }
    default:
      return "";
  }
}

// Khoảng poll tin nhắn mới từ backend (Phase 2) — 5s đủ nhanh để cảm giác
// "real-time" khi đang mở màn Chat, không quá dày để tốn pin/băng thông.
const POLL_INTERVAL_MS = 5000;

// Nếu aiPausedUntil còn xa hơn mốc này (~100 năm) thì coi là "tạm dừng vĩnh
// viễn" (server đặt PERMANENT_PAUSE_UNTIL = năm ~275760), hiển thị khác với
// tạm dừng có hạn giờ.
const PERMANENT_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 365 * 100;

/** Số phút từ bây giờ tới cuối ngày hôm nay (23:59) — cho lựa chọn "Hết hôm nay". */
function minutesUntilEndOfDay(): number {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 60_000));
}

/** Mô tả thời gian còn lại dạng "X phút" / "X giờ Y phút". */
function remainingLabel(ms: number): string {
  const totalMin = Math.max(1, Math.ceil(ms / 60_000));
  if (totalMin < 60) return `${totalMin} phút`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

// Nhãn ngắn gọn (tiếng Việt) cho dòng "AI gọi function gì" hiển thị mờ dưới
// mỗi tin AI — chỉ để chủ studio nhìn, không gửi cho khách.
const AI_FN_LABEL: Record<string, string> = {
  lookup_order: "tra đơn",
  tag_customer: "gắn nhãn khách",
  escalate_to_staff: "báo nhân viên",
  check_available_slots: "kiểm tra lịch trống",
  create_order_from_chat: "tạo đơn",
  send_concept_photos: "gửi ảnh mẫu",
  upsell_order: "thêm dịch vụ",
  reschedule_order: "đổi lịch",
  cancel_order: "huỷ đơn",
};
const AI_PROVIDER_LABEL: Record<string, string> = { gemini: "Gemini", openai: "OpenAI", deepseek: "DeepSeek" };

export default function ChatPage() {
  const location = useLocation();
  const initial = (location.state as { customerId?: string } | null)?.customerId ?? null;
  const [selected, setSelected] = useState<string | null>(initial);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pauseActionBusy, setPauseActionBusy] = useState(false);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [confirmingDeleteConvo, setConfirmingDeleteConvo] = useState(false);
  const [deletingConvo, setDeletingConvo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Giai đoạn 7.2 — chỉ để tính lại "còn bao nhiêu phút" hiển thị, tick mỗi
  // 30s là đủ mượt, không cần chính xác từng giây cho 1 banner trạng thái.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const { dataVersion, bumpDataVersion } = useAppState();
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const customer = selected ? customerById(selected) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion buộc tính lại khi có tin mới (poll/gửi) làm thay đổi `messages`
  const conversationThreads = useMemo(() => getConversationThreads(), [dataVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tương tự, allMessages là 1 mảng mutate-in-place
  const thread = useMemo(
    () => (selected ? allMessages.filter((m) => m.customerId === selected).sort((a, b) => a.time.localeCompare(b.time)) : []),
    [selected, dataVersion],
  );
  const latestOrder = selected ? ordersByCustomer(selected).sort((a, b) => b.date.localeCompare(a.date))[0] : null;
  const concept = latestOrder ? conceptById(latestOrder.conceptId) : undefined;

  // Poll backend liên tục lấy tin nhắn + khách mới (khách Facebook nhắn lần
  // đầu, webhook tạo trực tiếp ở backend — xem mergeRemoteCustomers) — chạy cả
  // khi đang ở màn danh sách hội thoại lẫn khi đang mở 1 thread cụ thể.
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/chat-sync`);
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { messages?: Message[]; customers?: Parameters<typeof mergeRemoteCustomers>[0] };
        const addedCustomers = mergeRemoteCustomers(json.customers ?? []);
        const addedMessages = mergeRemoteMessages(json.messages ?? []);
        if (!cancelled && (addedCustomers || addedMessages)) {
          if (selectedRef.current) markThreadRead(selectedRef.current);
          bumpDataVersion();
        }
      } catch {
        // Backend chưa chạy/mất mạng — bỏ qua lần này, thử lại ở lượt poll kế tiếp.
      }
    };
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cần lập 1 lần khi mount, bumpDataVersion ổn định (useCallback)
  }, []);

  // Mở 1 thread -> đánh dấu đã đọc ngay (giống Messenger thật).
  useEffect(() => {
    if (!selected) return;
    const hadUnread = allMessages.some((m) => m.customerId === selected && m.fromCustomer && !m.read);
    if (hadUnread) {
      markThreadRead(selected);
      bumpDataVersion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy lại khi đổi thread, không phải mỗi lần dataVersion đổi
  }, [selected]);

  const applyTemplate = (key: string) => {
    if (!customer) return;
    setDraft(
      buildTemplate(
        key,
        customer.name,
        concept?.name,
        latestOrder?.date,
        latestOrder?.time,
        latestOrder?.conceptId,
        latestOrder?.people.length,
      ),
    );
  };

  const copyDraft = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable in sandbox — no-op fallback
    }
  };

  // Gửi thật qua Facebook Messenger (Phase 2) — chỉ khả dụng khi khách có
  // facebookId (đã từng nhắn Facebook vào, hoặc studio tự gán). Backend tự
  // ghi tin vào state mirror sau khi Facebook xác nhận gửi thành công, nên
  // KHÔNG addMessage() lạc quan ở đây — chờ lượt poll kế tiếp lấy về đúng id
  // thật từ backend, tránh trùng/lệch id giữa 2 nguồn đánh số độc lập.
  const handleSend = async () => {
    if (!customer || !draft.trim() || sending) return;
    if (!customer.facebookId) {
      setSendError("Khách này chưa có liên hệ Facebook — dùng nút sao chép để gửi qua Zalo/SMS.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/messages/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id, text: draft.trim() }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setSendError(
          json.error === "missing_page_access_token"
            ? "Server chưa cấu hình Page Access Token Facebook."
            : "Gửi thất bại — thử lại hoặc dùng nút sao chép.",
        );
        return;
      }
      setDraft("");
      // Lấy ngay tin vừa gửi về cho hiển thị liền, không chờ lượt poll 5s sau.
      const syncRes = await fetch(`${BACKEND_URL}/api/chat-sync`);
      if (syncRes.ok) {
        const syncJson = (await syncRes.json()) as { messages?: Message[]; customers?: Parameters<typeof mergeRemoteCustomers>[0] };
        mergeRemoteCustomers(syncJson.customers ?? []);
        mergeRemoteMessages(syncJson.messages ?? []);
      }
      bumpDataVersion();
    } catch {
      setSendError("Không kết nối được tới server — kiểm tra mạng hoặc thử lại.");
    } finally {
      setSending(false);
    }
  };

  // Nút "Gửi ảnh"/kéo-thả ảnh vào khung chat — upload lên Google Drive
  // (server/src/googleDrive.ts) rồi gửi thật qua Facebook Send API (mở rộng
  // /api/messages/send nhận thêm imageUrl). Giống handleSend: KHÔNG
  // addMessage() lạc quan, chờ sync lại từ backend để lấy đúng id thật.
  const handleSendImage = async (file: File) => {
    if (!customer || uploadingImage) return;
    if (!customer.facebookId) {
      setSendError("Khách này chưa có liên hệ Facebook — chưa gửi ảnh trực tiếp được.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setSendError("Chỉ gửi được file ảnh.");
      return;
    }
    setUploadingImage(true);
    setSendError(null);
    try {
      // Tạo ảnh thu nhỏ để hiện lại trong hội thoại (ảnh GỐC vẫn gửi nguyên cho
      // khách). Lỗi tạo thumbnail thì vẫn gửi, chỉ là không có ảnh xem lại.
      let thumb = "";
      try {
        thumb = await fileToThumbnailDataUrl(file);
      } catch {
        /* bỏ qua */
      }
      const form = new FormData();
      form.append("image", file);
      form.append("customerId", customer.id);
      if (thumb) form.append("thumb", thumb);
      const res = await fetch(`${BACKEND_URL}/api/messages/send-image`, { method: "POST", body: form });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setSendError(
          json.error === "missing_page_access_token"
            ? "Server chưa cấu hình Page Access Token Facebook."
            : json.error === "no_facebook_id"
              ? "Khách này chưa có liên hệ Facebook — chưa gửi ảnh được."
              : "Gửi ảnh thất bại — thử lại.",
        );
        return;
      }
      const syncRes = await fetch(`${BACKEND_URL}/api/chat-sync`);
      if (syncRes.ok) {
        const syncJson = (await syncRes.json()) as { messages?: Message[]; customers?: Parameters<typeof mergeRemoteCustomers>[0] };
        mergeRemoteCustomers(syncJson.customers ?? []);
        mergeRemoteMessages(syncJson.messages ?? []);
      }
      bumpDataVersion();
    } catch {
      setSendError("Gửi ảnh thất bại — kiểm tra mạng hoặc thử lại.");
    } finally {
      setUploadingImage(false);
    }
  };

  // Giai đoạn 7.2 — bấm "+30 phút"/"Bật lại AI ngay"/"Tạm dừng AI" ngay trong
  // hội thoại đang mở, không cần đợi gửi tin mới. Mutate-in-place rồi
  // bumpDataVersion(), giống cách app này luôn ghi dữ liệu cục bộ (xem
  // [[fkm-studio-data-write-path]]) — server là nguồn xác nhận qua response.
  // Bật/tắt bot cho RIÊNG khách đang mở. payload: { minutes } (0 = bật lại
  // ngay, >0 = tạm dừng N phút) hoặc { permanent: true } = tắt vĩnh viễn tới
  // khi bật lại tay. Mutate-in-place rồi bumpDataVersion (xem [[fkm-studio-data-write-path]]).
  const setBotPause = async (payload: { minutes?: number; permanent?: boolean }) => {
    if (!customer || pauseActionBusy) return;
    setPauseActionBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/customers/${customer.id}/ai-pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = (await res.json()) as { ok: boolean; aiPausedUntil: number | null };
        if (json.ok) {
          customer.aiPausedUntil = json.aiPausedUntil ?? undefined;
          bumpDataVersion();
        }
      }
    } catch {
      // Không phải hành động quan trọng phải báo lỗi to — thử lại được ngay bằng cách bấm lại nút.
    } finally {
      setPauseActionBusy(false);
    }
  };

  // Xoá hội thoại — chỉ xoá tin nhắn (giữ khách hàng/đơn hàng), gọi backend
  // trước (xem comment ở server/src/index.ts vì sao cần route riêng) rồi mới
  // xoá local + quay về danh sách hội thoại.
  const handleDeleteConversation = async () => {
    if (!selected) return;
    if (!confirmingDeleteConvo) {
      setConfirmingDeleteConvo(true);
      return;
    }
    setDeletingConvo(true);
    try {
      await fetch(`${BACKEND_URL}/api/messages/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selected }),
      });
    } catch {
      // Backend mất mạng — vẫn xoá local, lần sau backend còn tin cũ thì poll
      // lại sẽ hiện lại; người dùng có thể bấm xoá lại lúc có mạng.
    }
    removeConversation(selected);
    bumpDataVersion();
    setConfirmingDeleteConvo(false);
    setDeletingConvo(false);
    setSelected(null);
  };

  if (!selected) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-[16px] font-bold text-ink px-0.5">Hội thoại</h2>
        <div className="flex flex-col gap-2">
          {conversationThreads.map((t) => {
            const c = customerById(t.customerId);
            if (!c) return null;
            return (
              <button
                key={t.customerId}
                onClick={() => setSelected(t.customerId)}
                className="flex items-center gap-3 rounded-3xl bg-surface border border-border-soft shadow-soft p-3 text-left tap-scale"
              >
                <div className="relative">
                  <Avatar name={c.name} src={customerAvatarSrc(c)} size={44} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#1877F2] flex items-center justify-center border-2 border-surface">
                    <MessageCircle size={9} className="text-white" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink truncate">{c.name}</span>
                    <span className="text-[10px] text-muted shrink-0 ml-2">{timeAgoVi(t.lastMessage.time)}</span>
                  </div>
                  <p className="text-[12px] text-muted truncate mt-0.5">
                    {t.lastMessage.fromCustomer ? "" : "Bạn: "}{t.lastMessage.text}
                  </p>
                  {c.needsHumanHelp && (
                    <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-danger-soft text-danger text-[10px] font-semibold px-2 py-0.5">
                      <AlertCircle size={10} /> Cần hỗ trợ
                    </span>
                  )}
                </div>
                {t.unreadCount > 0 && <span className="w-2.5 h-2.5 rounded-full bg-danger shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <div className="flex items-center gap-2.5 mb-3">
        <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full bg-surface border border-border-soft flex items-center justify-center tap-scale">
          <ChevronLeft size={16} />
        </button>
        <Avatar name={customer?.name ?? "?"} src={customer ? customerAvatarSrc(customer) : undefined} size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-ink">{customer?.name}</p>
          <p className="text-[11px] text-muted">qua Facebook Messenger</p>
        </div>
        {customer?.needsHumanHelp && (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft text-danger text-[10px] font-semibold px-2 py-1 shrink-0">
            <AlertCircle size={11} /> Cần hỗ trợ
          </span>
        )}
        <button
          onClick={handleDeleteConversation}
          disabled={deletingConvo}
          className={`w-8 h-8 rounded-full flex items-center justify-center tap-scale shrink-0 disabled:opacity-50 ${
            confirmingDeleteConvo ? "bg-danger-soft text-danger" : "bg-surface-soft text-ink-soft"
          }`}
          title="Xoá hội thoại"
        >
          {deletingConvo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
      {confirmingDeleteConvo && (
        <p className="text-[11px] text-danger mb-2 shrink-0">
          Bấm lại nút thùng rác để xác nhận xoá toàn bộ tin nhắn với khách này (giữ nguyên thông tin khách/đơn). Không thể hoàn tác.
          <button onClick={() => setConfirmingDeleteConvo(false)} className="underline ml-1.5">Huỷ</button>
        </p>
      )}

      {customer && (() => {
        const until = customer.aiPausedUntil;
        const paused = typeof until === "number" && until > now;
        const permanent = paused && until - now > PERMANENT_THRESHOLD_MS;
        return (
          <div className="mb-2 shrink-0">
            <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${paused ? "bg-warning-soft" : "bg-success-soft"}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <Bot size={14} className={paused ? "text-warning shrink-0" : "text-success shrink-0"} />
                <p className={`text-[11px] font-medium truncate ${paused ? "text-warning" : "text-success"}`}>
                  {paused
                    ? permanent
                      ? "Bot đang TẮT cho khách này (vĩnh viễn)"
                      : `Bot tạm dừng — còn ${remainingLabel(until - now)}`
                    : "Bot đang BẬT — tự trả lời khách này"}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {paused ? (
                  <>
                    {!permanent && (
                      <button
                        onClick={() => setBotPause({ minutes: Math.ceil((until - now) / 60000) + 30 })}
                        disabled={pauseActionBusy}
                        className="text-[10px] font-semibold rounded-full bg-surface px-2.5 py-1 tap-scale disabled:opacity-50"
                      >
                        +30 phút
                      </button>
                    )}
                    <button
                      onClick={() => { setBotPause({ minutes: 0 }); setShowPauseMenu(false); }}
                      disabled={pauseActionBusy}
                      className="text-[10px] font-semibold rounded-full bg-brand-blue text-white px-2.5 py-1 tap-scale disabled:opacity-50 flex items-center gap-1"
                    >
                      <Power size={11} /> Bật lại
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowPauseMenu((v) => !v)}
                    disabled={pauseActionBusy}
                    className="text-[10px] font-semibold rounded-full bg-surface px-2.5 py-1 tap-scale disabled:opacity-50"
                  >
                    Tắt bot ▾
                  </button>
                )}
              </div>
            </div>

            {showPauseMenu && !paused && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {[
                  { label: "30 phút", minutes: 30 },
                  { label: "1 giờ", minutes: 60 },
                  { label: "3 giờ", minutes: 180 },
                  { label: "Hết hôm nay", minutes: minutesUntilEndOfDay() },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => { setBotPause({ minutes: opt.minutes }); setShowPauseMenu(false); }}
                    disabled={pauseActionBusy}
                    className="text-[10px] font-medium rounded-full bg-surface-soft text-ink-soft px-2.5 py-1 tap-scale disabled:opacity-50"
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  onClick={() => { setBotPause({ permanent: true }); setShowPauseMenu(false); }}
                  disabled={pauseActionBusy}
                  className="text-[10px] font-semibold rounded-full bg-danger-soft text-danger px-2.5 py-1 tap-scale disabled:opacity-50"
                >
                  Vĩnh viễn
                </button>
              </div>
            )}
          </div>
        );
      })()}

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pb-3">
        {thread.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.fromCustomer ? "items-start" : "items-end"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[13px] ${
                m.fromCustomer ? "bg-surface-soft text-ink rounded-bl-md" : "bg-brand-blue text-white rounded-br-md"
              }`}
            >
              {m.imageUrl && (
                <img
                  src={m.imageUrl}
                  alt="Ảnh đã gửi"
                  className="rounded-xl max-w-full max-h-60 object-cover mb-1"
                  loading="lazy"
                />
              )}
              {m.text}
              <div className={`flex items-center gap-1.5 text-[9px] mt-1 ${m.fromCustomer ? "text-muted" : "text-white/70"}`}>
                {m.aiGenerated && (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 font-semibold tracking-wide">AI</span>
                )}
                {timeAgoVi(m.time)}
              </div>
            </div>
            {/* Dòng mờ "AI nào trả lời / gọi function gì" — chỉ chủ studio thấy,
                không phải nội dung tin gửi khách. */}
            {m.aiGenerated && m.aiMeta && (
              <span className="text-[9px] italic text-muted/70 mt-0.5 px-1 max-w-[80%] text-right">
                {AI_PROVIDER_LABEL[m.aiMeta.provider ?? ""] ?? m.aiMeta.provider ?? "AI"}
                {m.aiMeta.functions && m.aiMeta.functions.length > 0
                  ? ` · gọi: ${m.aiMeta.functions.map((f) => AI_FN_LABEL[f] ?? f).join(", ")}`
                  : ""}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 mb-2 overflow-x-auto no-scrollbar">
        {templates.map((t) => (
          <button
            key={t.key}
            onClick={() => applyTemplate(t.key)}
            className="shrink-0 text-[11px] font-medium bg-brand-blue-soft text-brand-blue rounded-full px-3 py-1.5 tap-scale"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className={`flex items-end gap-2 sticky bottom-0 bg-canvas pt-1 rounded-2xl ${dragOver ? "ring-2 ring-brand-blue ring-offset-2 ring-offset-canvas" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleSendImage(file);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleSendImage(file);
            e.target.value = "";
          }}
        />
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Soạn tin nhắn, kéo-thả ảnh vào đây, hoặc chọn mẫu nhanh ở trên..."
          rows={2}
          className="flex-1 rounded-2xl border border-border-soft bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand-blue resize-none"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
          className="w-10 h-10 rounded-full bg-surface-soft text-ink-soft flex items-center justify-center tap-scale shrink-0 disabled:opacity-50"
          title="Gửi ảnh"
        >
          {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
        </button>
        <button
          onClick={copyDraft}
          className="w-10 h-10 rounded-full bg-surface-soft text-ink-soft flex items-center justify-center tap-scale shrink-0"
          title="Sao chép để gửi qua Zalo/SMS"
        >
          {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
        </button>
        <button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="w-10 h-10 rounded-full bg-brand-blue text-white flex items-center justify-center tap-scale shrink-0 disabled:opacity-50"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      {sendError && <p className="text-[11px] text-danger text-center mt-1.5">{sendError}</p>}
      <p className="text-[10px] text-muted text-center mt-1.5">
        Không gửi được qua Messenger? Bấm sao chép để dán sang Zalo hoặc SMS.
      </p>
    </div>
  );
}
