import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronLeft, MessageCircle, Send, Copy, Check, Loader2, AlertCircle, Trash2 } from "lucide-react";
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

export default function ChatPage() {
  const location = useLocation();
  const initial = (location.state as { customerId?: string } | null)?.customerId ?? null;
  const [selected, setSelected] = useState<string | null>(initial);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pauseActionBusy, setPauseActionBusy] = useState(false);
  const [confirmingDeleteConvo, setConfirmingDeleteConvo] = useState(false);
  const [deletingConvo, setDeletingConvo] = useState(false);
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

  // Giai đoạn 7.2 — bấm "+30 phút"/"Bật lại AI ngay"/"Tạm dừng AI" ngay trong
  // hội thoại đang mở, không cần đợi gửi tin mới. Mutate-in-place rồi
  // bumpDataVersion(), giống cách app này luôn ghi dữ liệu cục bộ (xem
  // [[fkm-studio-data-write-path]]) — server là nguồn xác nhận qua response.
  const setAiPause = async (minutes: number) => {
    if (!customer || pauseActionBusy) return;
    setPauseActionBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/customers/${customer.id}/ai-pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes }),
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
                  <Avatar name={c.name} src={c.avatar} size={44} />
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
        <Avatar name={customer?.name ?? "?"} src={customer?.avatar} size={36} />
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

      {customer?.aiPausedUntil && customer.aiPausedUntil > now ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-warning-soft px-3 py-2 mb-2 shrink-0">
          <p className="text-[11px] text-warning font-medium">
            AI đang tạm dừng trả lời khách này — còn ~{Math.max(1, Math.ceil((customer.aiPausedUntil - now) / 60000))} phút
          </p>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => setAiPause(Math.max(1, Math.ceil((customer.aiPausedUntil! - now) / 60000)) + 30)}
              disabled={pauseActionBusy}
              className="text-[10px] font-semibold rounded-full bg-surface px-2.5 py-1 tap-scale disabled:opacity-50"
            >
              +30 phút
            </button>
            <button
              onClick={() => setAiPause(0)}
              disabled={pauseActionBusy}
              className="text-[10px] font-semibold rounded-full bg-brand-blue text-white px-2.5 py-1 tap-scale disabled:opacity-50"
            >
              Bật lại AI ngay
            </button>
          </div>
        </div>
      ) : (
        customer && (
          <button
            onClick={() => setAiPause(30)}
            disabled={pauseActionBusy}
            className="text-[10px] font-medium text-muted underline mb-2 shrink-0 self-start disabled:opacity-50"
          >
            Tạm dừng AI 30 phút cho khách này
          </button>
        )
      )}

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pb-3">
        {thread.map((m) => (
          <div key={m.id} className={`flex ${m.fromCustomer ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[13px] ${
                m.fromCustomer ? "bg-surface-soft text-ink rounded-bl-md" : "bg-brand-blue text-white rounded-br-md"
              }`}
            >
              {m.text}
              <div className={`flex items-center gap-1.5 text-[9px] mt-1 ${m.fromCustomer ? "text-muted" : "text-white/70"}`}>
                {m.aiGenerated && (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 font-semibold tracking-wide">AI</span>
                )}
                {timeAgoVi(m.time)}
              </div>
            </div>
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

      <div className="flex items-end gap-2 sticky bottom-0 bg-canvas pt-1">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Soạn tin nhắn hoặc chọn mẫu nhanh ở trên..."
          rows={2}
          className="flex-1 rounded-2xl border border-border-soft bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand-blue resize-none"
        />
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
