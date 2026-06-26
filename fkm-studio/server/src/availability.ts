/**
 * Giai đoạn 6 (xem [[fkm-studio-ai-chatbot-roadmap]]) — bản PORT ĐƠN GIẢN HOÁ
 * của src/lib/suggestionEngine.ts (frontend) cho hàm AI `check_available_slots`.
 * Engine gốc ở frontend chấm điểm rất chi tiết (cụm lịch, giờ đẹp, quá tải,
 * nhóm đông...) để gợi ý ca TỐT NHẤT cho nút "Gợi ý lịch" (người dùng thật bấm,
 * có thể xem nhiều lựa chọn rồi tự quyết). Ở đây AI chỉ cần biết NHỮNG GIỜ NÀO
 * CÒN TRỐNG để trả lời khách ngay trong chat — không cần thang điểm đầy đủ,
 * chỉ cần đúng dữ liệu thật (không bịa), nên port lại bản rút gọn, không kéo
 * theo lib/scheduling.ts (gắn với frontend, mô phỏng băng chuyền 2 trạm phức
 * tạp hơn nhiều). Nếu sau này thấy gợi ý quá thô, có thể nâng cấp port đầy đủ.
 */
import type { StateSnapshot } from "./store.js";
import type { OrderShape, ConceptShape } from "./chatOrders.js";

const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 18 * 60;
const STEP_MIN = 30;
const NICE_HOURS_MIN = new Set([8 * 60, 9 * 60, 13 * 60 + 30, 14 * 60]);

interface BookingWindow {
  weekday: number;
  label: string;
}

// Khớp DEFAULT_OPEN_WINDOWS ở src/lib/suggestionEngine.ts — chiều T6 + T7 + CN + sáng T2.
const DEFAULT_OPEN_WINDOWS: BookingWindow[] = [
  { weekday: 5, label: "Chiều thứ 6" },
  { weekday: 6, label: "Cả ngày thứ 7" },
  { weekday: 0, label: "Cả ngày Chủ nhật" },
  { weekday: 1, label: "Sáng thứ 2" },
];

export function describeOpenWindows(): string {
  return DEFAULT_OPEN_WINDOWS.map((w) => w.label).join(", ");
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function ordersOf(state: StateSnapshot): OrderShape[] {
  return Array.isArray(state.orders) ? (state.orders as OrderShape[]) : [];
}

function conceptsOf(state: StateSnapshot): ConceptShape[] {
  return Array.isArray(state.concepts) ? (state.concepts as ConceptShape[]) : [];
}

export interface CheckAvailableSlotsArgs {
  date?: string; // YYYY-MM-DD — bỏ trống = chỉ hỏi chung "còn lịch không"
  conceptName?: string;
}

export interface CheckAvailableSlotsResult {
  generalWindows: string; // luôn trả về, dùng khi khách hỏi chung chưa chọn ngày
  date?: string;
  weekday?: string;
  isPastDate?: boolean;
  inDefaultWindow?: boolean;
  freeHours?: string[]; // vài giờ trống thật trong ngày khách hỏi (rỗng = ngày đó kín)
  error?: string;
  [key: string]: unknown;
}

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function checkAvailableSlots(state: StateSnapshot, args: CheckAvailableSlotsArgs): CheckAvailableSlotsResult {
  const generalWindows = describeOpenWindows();
  const date = args.date?.trim();
  if (!date) return { generalWindows };
  if (!DATE_RE.test(date)) return { generalWindows, error: "invalid_date" };

  const d = new Date(`${date}T00:00:00`);
  const weekday = WEEKDAY_LABELS[d.getDay()];
  const todayIso = new Date().toISOString().slice(0, 10);
  if (date < todayIso) return { generalWindows, date, weekday, isPastDate: true, freeHours: [] };

  const inDefaultWindow = DEFAULT_OPEN_WINDOWS.some((w) => w.weekday === d.getDay());

  const concepts = conceptsOf(state);
  const concept = args.conceptName
    ? concepts.find((c) => c.status === "active" && (c.name ?? "").toLowerCase().includes(args.conceptName!.toLowerCase()))
    : undefined;
  const durationMin = concept?.durationMin ?? 60;

  const dayOrders = ordersOf(state).filter((o) => o.date === date && o.status !== "cancelled");
  const booked = dayOrders.map((o) => {
    const start = toMinutes(o.time ?? "00:00");
    return { start, end: start + (o.durationMin ?? 60) };
  });

  const isToday = date === todayIso;
  const nowMin = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : -1;

  const candidates: number[] = [];
  for (let min = DAY_START_MIN; min <= DAY_END_MIN - durationMin; min += STEP_MIN) {
    if (isToday && min < nowMin) continue;
    const overlaps = booked.some((b) => min < b.end && min + durationMin > b.start);
    if (!overlaps) candidates.push(min);
  }

  // Ưu tiên giờ đẹp lên trước, còn lại theo thứ tự thời gian — đủ dùng cho
  // AI liệt kê vài lựa chọn cho khách, không cần thang điểm đầy đủ như bản gốc.
  candidates.sort((a, b) => {
    const an = NICE_HOURS_MIN.has(a) ? 0 : 1;
    const bn = NICE_HOURS_MIN.has(b) ? 0 : 1;
    if (an !== bn) return an - bn;
    return a - b;
  });

  const freeHours = candidates.slice(0, 5).map(minutesToLabel);
  return { generalWindows, date, weekday, isPastDate: false, inDefaultWindow, freeHours };
}
