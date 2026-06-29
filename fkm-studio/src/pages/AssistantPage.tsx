import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Send, Loader2, Sparkles, Mic, MicOff } from "lucide-react";
import { BACKEND_URL } from "@/lib/persistence";
import { useAppState } from "@/lib/appState";
import { createOrderFromAi, type AiOrderArgs } from "@/lib/aiCreateOrder";

/**
 * Giai đoạn 8 (xem [[fkm-studio-ai-chatbot-roadmap]]) — trợ lý AI NỘI BỘ, chủ
 * studio tự chat trong app để hỏi nhanh về doanh thu/lịch/nhân sự/khách hàng
 * (xem server/src/assistant.ts cho bộ hàm tra cứu thật phía sau). KHÁC hẳn
 * ChatPage (đó là chat VỚI KHÁCH qua Facebook) — màn này chỉ chat với AI,
 * không liên quan gì tới khách hàng/Facebook, nên không cần polling/sync
 * customer/message như ChatPage. Lịch sử chat chỉ giữ trong state của trang
 * (mất khi rời màn) — không lưu lại, vì đây là hỏi-đáp nhanh, không phải dữ
 * liệu nghiệp vụ cần giữ lâu dài.
 */
interface AssistantMessage {
  fromOwner: boolean;
  text: string;
}

const SUGGESTIONS = [
  "Tạo đơn cho chị Lan, concept Thu Mơ, 9h sáng mai, 1 bé",
  "Doanh thu tuần này bao nhiêu?",
  "Lịch sắp tới 7 ngày có gì?",
  "Đơn nào còn nợ tiền?",
];

// Web Speech API chưa nằm sẵn trong type mặc định của TS — khai báo tối thiểu.
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function AssistantPage() {
  const navigate = useNavigate();
  const { bumpDataVersion } = useAppState();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechSupported = typeof window !== "undefined" && getSpeechRecognitionCtor() !== null;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  // Dọn nhận diện giọng nói khi rời màn.
  useEffect(() => () => recognitionRef.current?.stop(), []);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const nextHistory = [...messages, { fromOwner: true, text: trimmed }];
    setMessages(nextHistory);
    setDraft("");
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: nextHistory }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        reply?: string;
        error?: string;
        action?: { type: string; args?: AiOrderArgs };
      };
      if (!json.ok || !json.reply) {
        setError(
          json.error === "no_reply"
            ? "Server chưa cấu hình GEMINI_API_KEY, hoặc AI không trả lời được — thử lại sau."
            : "Không kết nối được tới trợ lý — thử lại sau.",
        );
        return;
      }
      // AI muốn tạo đơn -> thực thi ngay phía client (tự lưu), rồi báo kết quả
      // thật (mã đơn) thay cho câu chung chung của AI.
      if (json.action?.type === "create_order" && json.action.args) {
        const outcome = createOrderFromAi(json.action.args);
        if (outcome.ok) bumpDataVersion();
        setMessages([...nextHistory, { fromOwner: false, text: outcome.message }]);
        return;
      }
      setMessages([...nextHistory, { fromOwner: false, text: json.reply }]);
    } catch {
      setError("Không kết nối được tới server — kiểm tra mạng hoặc thử lại.");
    } finally {
      setSending(false);
    }
  };

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Thiết bị/trình duyệt này chưa hỗ trợ nhập giọng nói. Anh/chị gõ chữ giúp em nha.");
      return;
    }
    const recog = new Ctor();
    recognitionRef.current = recog;
    recog.lang = "vi-VN";
    recog.interimResults = false;
    recog.continuous = false;
    recog.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setDraft(transcript);
        // Đọc xong tự gửi luôn cho nhanh (theo yêu cầu: đọc -> AI tự thêm).
        void send(transcript);
      }
    };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);
    setError(null);
    setListening(true);
    recog.start();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <div className="flex items-center gap-2.5 mb-3">
        <button onClick={() => navigate("/more")} className="w-8 h-8 rounded-full bg-surface border border-border-soft flex items-center justify-center tap-scale">
          <ArrowLeft size={16} />
        </button>
        <span className="w-9 h-9 rounded-2xl bg-brand-blue-soft text-brand-blue flex items-center justify-center shrink-0">
          <Bot size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-ink">Trợ lý AI nội bộ</p>
          <p className="text-[11px] text-muted">Hỏi số liệu, hoặc bảo em tạo đơn (gõ/đọc mic) — tự lưu</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pb-3">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="rounded-2xl bg-surface-soft text-ink-soft px-3.5 py-2.5 text-[13px] flex items-start gap-2">
              <Sparkles size={14} className="text-brand-blue shrink-0 mt-0.5" />
              <span>Em là trợ lý AI nội bộ. Anh/chị có thể hỏi em về doanh thu, lịch, đơn còn nợ, nhân sự, khách hàng — hoặc bảo em <b>tạo đơn</b> (gõ hoặc bấm mic đọc), em tự tạo và lưu luôn nha.</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[11px] font-medium bg-brand-blue-soft text-brand-blue rounded-full px-3 py-1.5 tap-scale"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.fromOwner ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] whitespace-pre-wrap ${
                m.fromOwner ? "bg-brand-blue text-white rounded-br-md" : "bg-surface-soft text-ink rounded-bl-md"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-surface-soft text-muted px-3.5 py-2 text-[13px] flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" /> Đang tra cứu...
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {error && <p className="text-[11px] text-danger text-center mb-1.5">{error}</p>}

      <div className="flex items-end gap-2 sticky bottom-0 bg-canvas pt-1">
        {speechSupported && (
          <button
            onClick={toggleMic}
            disabled={sending}
            aria-label={listening ? "Dừng nghe" : "Đọc bằng giọng nói"}
            className={`w-10 h-10 rounded-full flex items-center justify-center tap-scale shrink-0 disabled:opacity-50 ${
              listening ? "bg-danger text-white animate-pulse" : "bg-surface-soft text-ink-soft"
            }`}
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          placeholder={listening ? "Đang nghe... anh/chị nói đi" : "Hỏi trợ lý AI, hoặc đọc lệnh tạo đơn..."}
          rows={1}
          className="flex-1 rounded-2xl border border-border-soft bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand-blue resize-none"
        />
        <button
          onClick={() => send(draft)}
          disabled={sending || !draft.trim()}
          className="w-10 h-10 rounded-full bg-brand-blue text-white flex items-center justify-center tap-scale shrink-0 disabled:opacity-50"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
