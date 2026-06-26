import type { Message, ConversationThread, WeatherDay } from "@/types";
import { nextNumericId } from "@/lib/nextId";

/**
 * Phase 2 (xem [[fkm-studio-ai-chatbot-roadmap]]): mảng này giờ là dữ liệu
 * SỐNG, không còn chỉ là seed tĩnh — tin khách gửi qua Facebook (đồng bộ từ
 * backend, xem mergeRemoteMessages) và tin studio tự gửi đều được thêm vào
 * đây qua addMessage(). conversationThreads cũ (mảng tĩnh song song) đã bị bỏ
 * — vì giờ messages thay đổi liên tục, 1 mảng thread tách riêng sẽ nhanh bị
 * lệch dữ liệu; dùng getConversationThreads() để luôn tính lại đúng từ
 * messages hiện tại.
 */
export const messages: Message[] = [
  { id: "m1", customerId: "u6", channel: "facebook", fromCustomer: true, text: "Chị ơi cho em hỏi lịch chụp chiều nay còn slot không ạ?", time: "2026-06-25T08:12:00", read: false },
  { id: "m2", customerId: "u6", channel: "facebook", fromCustomer: false, text: "Dạ còn ạ, 15h chiều nay studio còn trống, chị đặt cọc giúp em nha", time: "2026-06-25T08:15:00", read: true },
  { id: "m3", customerId: "u4", channel: "facebook", fromCustomer: true, text: "Cho em xin link ảnh gốc của bé với ạ", time: "2026-06-25T07:40:00", read: false },
  { id: "m4", customerId: "u3", channel: "facebook", fromCustomer: true, text: "Em chọn ảnh xong rồi nè chị, gửi qua đây nha", time: "2026-06-24T20:05:00", read: true },
  { id: "m5", customerId: "u7", channel: "facebook", fromCustomer: true, text: "Mai mấy giờ em qua chụp được nhắc lại giúp em ạ", time: "2026-06-24T19:30:00", read: false },
];

export const messagesByCustomer = (customerId: string) =>
  messages.filter((m) => m.customerId === customerId).sort((a, b) => a.time.localeCompare(b.time));

/**
 * Tính danh sách hội thoại (1 dòng/khách, tin mới nhất + số tin chưa đọc) từ
 * `messages` hiện tại — gọi lại mỗi lần cần hiển thị (vd. trong useMemo ở
 * ChatPage/ConversationPreview) để luôn khớp dữ liệu mới nhất, không cache.
 */
export function getConversationThreads(): ConversationThread[] {
  const byCustomer = new Map<string, Message[]>();
  for (const m of messages) {
    const list = byCustomer.get(m.customerId) ?? [];
    list.push(m);
    byCustomer.set(m.customerId, list);
  }
  const threads: ConversationThread[] = [];
  for (const [customerId, list] of byCustomer) {
    const sorted = [...list].sort((a, b) => a.time.localeCompare(b.time));
    const lastMessage = sorted[sorted.length - 1];
    const unreadCount = sorted.filter((m) => m.fromCustomer && !m.read).length;
    threads.push({ customerId, lastMessage, unreadCount });
  }
  return threads.sort((a, b) => b.lastMessage.time.localeCompare(a.lastMessage.time));
}

/** Thêm 1 tin nhắn mới (khách gửi vào hoặc studio/AI gửi ra) vào dữ liệu app. */
export function addMessage(input: Omit<Message, "id">): Message {
  const seq = nextNumericId("m", messages);
  const message: Message = { ...input, id: `m${seq}` };
  messages.push(message);
  return message;
}

/** Đánh dấu đã đọc toàn bộ tin của 1 khách — gọi khi studio mở thread đó. */
export function markThreadRead(customerId: string): void {
  for (const m of messages) {
    if (m.customerId === customerId && m.fromCustomer) m.read = true;
  }
}

/**
 * Hợp nhất tin nhắn lấy về từ backend (poll GET /api/messages, xem ChatPage)
 * vào mảng `messages` cục bộ — dedupe theo id vì backend trả TOÀN BỘ tin mỗi
 * lần, không phải chỉ tin mới. Trả về true nếu có tin mới được thêm (để gọi
 * bumpDataVersion() đúng lúc, tránh re-render/lưu lại vô ích khi không đổi gì).
 */
export function mergeRemoteMessages(remote: Message[]): boolean {
  const existingIds = new Set(messages.map((m) => m.id));
  let added = false;
  for (const m of remote) {
    if (existingIds.has(m.id)) continue;
    messages.push(m);
    existingIds.add(m.id);
    added = true;
  }
  return added;
}

export const weatherForecast: WeatherDay[] = [
  { date: "2026-06-25", icon: "cloud", tempLow: 27, tempHigh: 32, rainChance: 20 },
  { date: "2026-06-26", icon: "rain", tempLow: 26, tempHigh: 30, rainChance: 65 },
  { date: "2026-06-27", icon: "sun", tempLow: 28, tempHigh: 34, rainChance: 5 },
  { date: "2026-06-28", icon: "sun", tempLow: 28, tempHigh: 33, rainChance: 10 },
];
