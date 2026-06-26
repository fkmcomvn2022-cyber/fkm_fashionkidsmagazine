import { ordersByDate, conceptById } from "@/data";
import { addDays, weekdayLabel } from "@/lib/format";
import { DAY_START, DAY_END, toMinutes, minutesToLabel, simulateCandidate, groupExtraShootMin } from "@/lib/scheduling";

// ---------------------------------------------------------------------------
// Engine gợi ý lịch cho "AI nội bộ" (thay UChat) — KHÔNG tự bịa dữ liệu lịch.
// Mọi hàm ở đây chỉ ĐỌC dữ liệu đơn hàng hiện có và TÍNH ĐIỂM, không ghi gì
// vào Orders. AI gọi các hàm này để lấy gợi ý, rồi mới hỏi khách xác nhận;
// việc ghi đơn thật chỉ xảy ra khi khách xác nhận, qua luồng đặt đơn riêng.
//
// Quy trình hội thoại 2 bước (theo yêu cầu):
//   1) Khách hỏi chung ("studio còn lịch không?") → chỉ mô tả KHUNG MỞ BÁN
//      mặc định (describeOpenWindows), KHÔNG tính giờ cụ thể.
//   2) Khách chọn đúng 1 ngày cụ thể → mới gọi getSuggestedHours để tính và
//      trả về top giờ đẹp nhất cho ngày đó (vẫn luôn dùng giờ thật của ngày
//      đó, kể cả khi ngày đó nằm ngoài khung mở mặc định).
// ---------------------------------------------------------------------------

// "Hôm nay" theo mốc dữ liệu mock — dùng để tự loại ngày/giờ đã qua.
const MOCK_TODAY = "2026-06-25";
const MOCK_NOW_MIN = 9 * 60;

function isPastDate(dateIso: string): boolean {
  return dateIso < MOCK_TODAY;
}

function isPastHour(dateIso: string, min: number): boolean {
  return dateIso === MOCK_TODAY && min < MOCK_NOW_MIN;
}

// ---------------------------------------------------------------------------
// Khung giờ mở bán mặc định
// ---------------------------------------------------------------------------

export interface BookingWindow {
  weekday: number; // 0=CN .. 6=T7, khớp Date.getDay()
  startMin: number;
  endMin: number;
  label: string;
}

/**
 * Mặc định: chiều T6 + cả T7 + cả CN + sáng T2. T3–T5 dành cho hậu kỳ, không
 * chủ động gợi ý chụp mới. Đây là mặc định CHUNG — truyền `windows` riêng vào
 * các hàm dưới để override theo từng concept khi cần (chưa làm UI cấu hình).
 */
export const DEFAULT_OPEN_WINDOWS: BookingWindow[] = [
  { weekday: 5, startMin: 13 * 60, endMin: 18 * 60, label: "Chiều thứ 6" },
  { weekday: 6, startMin: 8 * 60, endMin: 18 * 60, label: "Cả ngày thứ 7" },
  { weekday: 0, startMin: 8 * 60, endMin: 18 * 60, label: "Cả ngày Chủ nhật" },
  { weekday: 1, startMin: 8 * 60, endMin: 12 * 60, label: "Sáng thứ 2" },
];

function dateWeekday(dateIso: string): number {
  return new Date(dateIso + "T00:00:00").getDay();
}

/** Mô tả khung mở bán mặc định bằng câu chữ, dùng cho bước hỏi chung (chưa chọn ngày). */
export function describeOpenWindows(windows: BookingWindow[] = DEFAULT_OPEN_WINDOWS): string {
  return windows.map((w) => w.label).join(", ");
}

/** Các khung mở bán khớp với ngày cụ thể (rỗng nếu ngày đó ngoài khung mặc định). */
export function openWindowsForDate(dateIso: string, windows: BookingWindow[] = DEFAULT_OPEN_WINDOWS): BookingWindow[] {
  const wd = dateWeekday(dateIso);
  return windows.filter((w) => w.weekday === wd);
}

// ---------------------------------------------------------------------------
// Trọng số điểm — cộng dồn (additive), không có thành phần nào áp đảo tuyệt
// đối. Có thể đổi theo preset chiến lược (data, không hardcode rule riêng).
// ---------------------------------------------------------------------------

export interface SuggestionWeights {
  // điểm ngày
  khungMo: number;
  ganNgay: number;
  daCoKhach: number;
  conCho: number;
  tranhQuaTai: number;
  chienLuoc: number;
  // điểm ca/giờ
  gioDep: number;
  caDaCoKhach: number;
  lapLich: number;
  satNghiTrua: number;
  satNghiToi: number;
  quaTai: number;
  gioMuon: number;
  // Luật theo cụm lịch (khoảng cách tới ca gần nhất) + số người trong nhóm —
  // học theo `scoreSlot_`/`slotClusterInfo_` của bản Apps Script (xem
  // [[fkm-studio-apps-script-reference]]): ca nối SÁT 1 cụm đã có khách giúp
  // ekip không phải chờ/di chuyển lặp, nhưng nhóm đông (3+) nối sát lại RỦI RO
  // hơn vì 1 ca trễ kéo dây chuyền theo, nên phải trừ điểm thay vì cộng.
  canhCumSat: number; // gap ≤ 15 phút tới ca gần nhất — cộng điểm
  canhCumGanGap: number; // gap 15–60 phút — cộng điểm nhẹ hơn
  canhCum2Nguoi: number; // cộng thêm nếu nhóm ĐÚNG 2 người và đang nối sát cụm
  canhCum3NguoiPhat: number; // trừ điểm nếu nhóm 3+ người và đang nối sát cụm (rủi ro trễ dây chuyền)
}

const BASE_WEIGHTS: SuggestionWeights = {
  khungMo: 30,
  ganNgay: 20,
  daCoKhach: 15,
  conCho: 15,
  tranhQuaTai: 20,
  chienLuoc: 0,
  gioDep: 20,
  caDaCoKhach: 15,
  lapLich: 15,
  satNghiTrua: 12,
  satNghiToi: 8,
  quaTai: 20,
  gioMuon: 10,
  canhCumSat: 42,
  canhCumGanGap: 18,
  canhCum2Nguoi: 24,
  canhCum3NguoiPhat: 18,
};

export type StrategyKey = "lap_lich" | "gan_nhat" | "cuoi_tuan" | "trai_deu" | "tuy_chinh";

export const STRATEGY_PRESETS: Record<StrategyKey, { label: string; weights: Partial<SuggestionWeights> }> = {
  lap_lich: {
    label: "Lấp lịch (ưu tiên ngày/ca đã có khách)",
    weights: { daCoKhach: 30, caDaCoKhach: 28, lapLich: 25 },
  },
  gan_nhat: {
    label: "Gần nhất (ưu tiên ngày/giờ sớm nhất)",
    weights: { ganNgay: 35 },
  },
  cuoi_tuan: {
    label: "Ưu tiên cuối tuần",
    weights: { khungMo: 40 },
  },
  trai_deu: {
    label: "Trải đều (tránh dồn 1 ngày/ca)",
    weights: { tranhQuaTai: 35, conCho: 25, quaTai: 30 },
  },
  tuy_chinh: { label: "Tùy chỉnh", weights: {} },
};

export function resolveWeights(strategy: StrategyKey = "tuy_chinh", overrides?: Partial<SuggestionWeights>): SuggestionWeights {
  const preset = STRATEGY_PRESETS[strategy]?.weights ?? {};
  return { ...BASE_WEIGHTS, ...preset, ...overrides };
}

// ---------------------------------------------------------------------------
// Gợi ý NGÀY (Diem_Ngay = cộng dồn các thành phần)
// ---------------------------------------------------------------------------

export interface DaySuggestion {
  ngay: string; // ISO
  thu: string; // nhãn thứ trong tuần (CN, T2, ...)
  diemTong: number;
  diemKhungMo: number;
  diemGanNgay: number;
  diemDaCoKhach: number;
  diemConCho: number;
  diemTranhQuaTai: number;
  diemChienLuoc: number;
  trangThai: "phu_hop" | "khong_phu_hop";
  lyDo: string;
}

const REJECTION_THRESHOLD_DAY = 10;
const ASSUMED_DAILY_CAPACITY = 8; // ước lượng số khách/ngày — dùng để tính tỉ lệ "còn chỗ"

export interface DaySuggestionOptions {
  horizonDays?: number;
  topN?: number;
  strategy?: StrategyKey;
  weights?: Partial<SuggestionWeights>;
  windows?: BookingWindow[];
}

export function getSuggestedDays(_conceptId: string, options: DaySuggestionOptions = {}): DaySuggestion[] {
  const { horizonDays = 14, topN = 6, strategy = "tuy_chinh", weights: overrides, windows = DEFAULT_OPEN_WINDOWS } = options;
  const w = resolveWeights(strategy, overrides);

  const candidates: DaySuggestion[] = [];

  for (let i = 0; i < horizonDays; i++) {
    const date = addDays(MOCK_TODAY, i);
    if (isPastDate(date)) continue;

    const dayOrders = ordersByDate(date).filter((o) => o.status !== "cancelled");
    const openHere = openWindowsForDate(date, windows);

    // Ngày trong khung mở mặc định được ưu tiên hơn, nhưng ngày ngoài khung
    // vẫn nhận điểm nhỏ — vì nếu khách hỏi đích danh ngày đó, app luôn trả
    // lịch thật, không loại cứng theo khung.
    const diemKhungMo = openHere.length > 0 ? w.khungMo : w.khungMo * 0.15;
    const diemGanNgay = Math.max(0, w.ganNgay - i * (w.ganNgay / horizonDays));
    const diemDaCoKhach = dayOrders.length > 0 ? Math.min(w.daCoKhach, dayOrders.length * (w.daCoKhach / 3)) : 0;

    const totalPeopleBooked = dayOrders.reduce((s, o) => s + o.people.length, 0);
    const loadRatio = Math.min(1, totalPeopleBooked / ASSUMED_DAILY_CAPACITY);
    const diemConCho = w.conCho * (1 - loadRatio);
    const diemTranhQuaTai = loadRatio > 0.7 ? -(w.tranhQuaTai * (loadRatio - 0.7)) / 0.3 : 0;

    const diemChienLuoc = w.chienLuoc;

    const diemTong = diemKhungMo + diemGanNgay + diemDaCoKhach + diemConCho + diemTranhQuaTai + diemChienLuoc;
    const trangThai: DaySuggestion["trangThai"] = diemTong < REJECTION_THRESHOLD_DAY ? "khong_phu_hop" : "phu_hop";

    const lyDo =
      trangThai === "khong_phu_hop"
        ? `Điểm thấp (${diemTong.toFixed(0)}) — ${openHere.length === 0 ? "ngoài khung mở mặc định" : "ngày đã khá đầy"}, nên báo khách chọn ca khác.`
        : `${openHere.length > 0 ? openHere.map((o) => o.label).join(", ") : "khách hỏi đích danh ngày này"}${
            dayOrders.length > 0 ? ", đã có khách đặt cùng ngày" : ", ngày còn trống"
          }.`;

    candidates.push({
      ngay: date,
      thu: weekdayLabel(date),
      diemTong,
      diemKhungMo,
      diemGanNgay,
      diemDaCoKhach,
      diemConCho,
      diemTranhQuaTai,
      diemChienLuoc,
      trangThai,
      lyDo,
    });
  }

  return candidates.sort((a, b) => b.diemTong - a.diemTong).slice(0, topN);
}

// ---------------------------------------------------------------------------
// Gợi ý GIỜ trong 1 ngày cụ thể (Diem_Ca)
// ---------------------------------------------------------------------------

export interface HourSuggestion {
  conceptId: string;
  conceptTen: string;
  ngay: string;
  gio: string; // HH:mm
  loaiCa: "dep" | "binh_thuong" | "khong_phu_hop";
  diemTong: number;
  trangThai: "phu_hop" | "khong_phu_hop";
  lyDo: string;
  capNhatLuc: string; // ISO timestamp lúc tính — để loại dữ liệu cũ/ảo
}

const REJECTION_THRESHOLD_HOUR = 10;
const NICE_HOURS = new Set([8 * 60, 9 * 60, 13 * 60 + 30, 14 * 60]);
// Mốc giờ muộn bắt đầu trừ điểm dần theo từng giờ quá mốc — khớp
// `LATE_PENALTY_FROM` (mặc định 16:00) của bản Apps Script.
const LATE_PENALTY_FROM_MIN = 16 * 60;
// Khoảng cách (phút) tới ca gần nhất để coi là "nối sát cụm" / "gần cụm" —
// khớp 2 mốc băng của `slotClusterInfo_` (15 phút / 60 phút).
const CLUSTER_TIGHT_GAP_MIN = 15;
const CLUSTER_LOOSE_GAP_MIN = 60;

function orderEndMin(o: { time: string; durationMin: number }): number {
  return toMinutes(o.time) + o.durationMin;
}

/** Khoảng cách (phút) từ khung [slotStart, slotEnd) tới ca gần nhất trong
 * ngày — 0 nếu chưa có ca nào, Infinity nếu ngày trống. Dùng để chấm "nối sát
 * cụm" (xem [[fkm-studio-apps-script-reference]] mục 1, `slotClusterInfo_`). */
function nearestClusterGapMin(
  dayOrders: { time: string; durationMin: number }[],
  slotStart: number,
  slotEnd: number,
): number {
  if (dayOrders.length === 0) return Infinity;
  let best = Infinity;
  for (const o of dayOrders) {
    const oStart = toMinutes(o.time);
    const oEnd = orderEndMin(o);
    const gap = oEnd <= slotStart ? slotStart - oEnd : oStart >= slotEnd ? oStart - slotEnd : 0;
    if (gap < best) best = gap;
  }
  return best;
}

export interface HourSuggestionOptions {
  topN?: number;
  strategy?: StrategyKey;
  weights?: Partial<SuggestionWeights>;
  stepMin?: number;
}

/**
 * Chỉ gọi sau khi khách đã chốt 1 NGÀY cụ thể (bước 2 của luồng hội thoại).
 * Luôn dùng lịch thật của ngày đó (qua simulateCandidate), không bịa giờ.
 */
export function getSuggestedHours(
  conceptId: string,
  dateIso: string,
  peopleCount = 1,
  options: HourSuggestionOptions = {},
): HourSuggestion[] {
  const { topN = 3, strategy = "tuy_chinh", weights: overrides, stepMin = 30 } = options;
  const w = resolveWeights(strategy, overrides);
  const concept = conceptById(conceptId);
  if (!concept) return [];

  const dayOrders = ordersByDate(dateIso).filter((o) => o.status !== "cancelled");
  const capNhatLuc = new Date().toISOString();
  const results: HourSuggestion[] = [];
  // Set chụp tốn thêm thời gian theo số người trong nhóm (xem groupExtraShootMin)
  // — dùng để loop bound + cảnh báo giờ nghỉ khớp với cách simulateCandidate tính thật.
  const effectiveDurationMin = concept.durationMin + groupExtraShootMin(Math.max(1, peopleCount));

  for (let min = DAY_START; min <= DAY_END - effectiveDurationMin; min += stepMin) {
    if (isPastHour(dateIso, min)) continue;

    const sim = simulateCandidate(dateIso, conceptId, peopleCount, min);
    if (!sim.fitsBeforeClose) continue;

    const people = Math.max(1, peopleCount);
    const diemGioDep = NICE_HOURS.has(min) ? w.gioDep : 0;
    const diemLapLich = sim.waitMin === 0 && sim.queueMin === 0 ? w.lapLich : 0;
    const diemConCho = dayOrders.length === 0 ? w.conCho * 0.5 : 0;

    // Cụm lịch: nối SÁT (≤15p) hoặc gần (15-60p) 1 ca đã có khách — phản ứng
    // khác nhau theo số người trong nhóm (xem [[fkm-studio-apps-script-reference]]):
    // nhóm đúng 2 người tận dụng tốt việc nối sát (vd. 2 bé makeup nối tiếp,
    // ekip không rảnh tay), còn nhóm 3+ nối sát lại rủi ro vì 1 ca trễ kéo dây
    // chuyền cả cụm — nên TRỪ điểm thay vì cộng.
    const gapMin = nearestClusterGapMin(dayOrders, min, min + effectiveDurationMin);
    let diemCumLich = 0;
    if (gapMin <= CLUSTER_TIGHT_GAP_MIN) {
      diemCumLich = w.canhCumSat;
      if (people === 2) diemCumLich += w.canhCum2Nguoi;
      else if (people >= 3) diemCumLich -= w.canhCum3NguoiPhat;
    } else if (gapMin <= CLUSTER_LOOSE_GAP_MIN) {
      diemCumLich = w.canhCumGanGap;
    }
    // w.caDaCoKhach vẫn là trọng số chung "ngày đã có khách khác" (preset
    // lap_lich tăng trọng số này) — cộng thêm phần này bên cạnh điểm cụm chi
    // tiết theo khoảng cách/số người ở trên, không thay thế nhau.
    const diemNgayDaCoKhach = dayOrders.length > 0 ? w.caDaCoKhach * (gapMin <= CLUSTER_LOOSE_GAP_MIN ? 1 : 0.3) : 0;
    const diemCaDaCoKhach = diemCumLich + diemNgayDaCoKhach;

    // Giờ nghỉ trưa/tối: nhóm đông hơn càng khó tránh vướng giờ nghỉ (makeup +
    // chụp riêng từng người cộng dồn dễ lấn giờ nghỉ ekip hơn nhóm ít người) —
    // nhân hệ số theo số người, khớp dải "-24 đến -48" theo nhóm của bản gốc.
    const pplPenaltyFactor = people === 1 ? 1 : people === 2 ? 1.5 : 2;
    const overlaps = (start: number, end: number) => min < end && min + effectiveDurationMin > start;
    const diemSatNghiTrua = overlaps(12 * 60, 13 * 60) ? w.satNghiTrua * pplPenaltyFactor : 0;
    const diemSatNghiToi = overlaps(18 * 60 + 30, 19 * 60) ? w.satNghiToi * pplPenaltyFactor : 0;
    const diemQuaTai = sim.pushedOrders.length > 0 ? w.quaTai * Math.min(1, sim.pushedOrders.length / 2) : 0;

    // Giờ muộn: trừ dần theo từng giờ quá mốc LATE_PENALTY_FROM (không phải
    // cờ on/off như trước) — nhóm đông quá giờ này rủi ro cao hơn nên nhân hệ
    // số nhẹ theo số người thêm.
    const hoursPastLate = Math.max(0, (min - LATE_PENALTY_FROM_MIN) / 60);
    const diemGioMuon = hoursPastLate > 0 ? w.gioMuon * hoursPastLate * (1 + 0.15 * (people - 1)) : 0;

    const diemTong =
      diemGioDep + diemCaDaCoKhach + diemLapLich + diemConCho - diemSatNghiTrua - diemSatNghiToi - diemQuaTai - diemGioMuon;

    const trangThai: HourSuggestion["trangThai"] =
      diemTong < REJECTION_THRESHOLD_HOUR || sim.isDelayed ? "khong_phu_hop" : "phu_hop";
    const loaiCa: HourSuggestion["loaiCa"] = diemTong >= 70 ? "dep" : diemTong >= 40 ? "binh_thuong" : "khong_phu_hop";

    const reasons: string[] = [];
    if (diemGioDep > 0) reasons.push("giờ đẹp, khách dễ nhớ");
    if (gapMin <= CLUSTER_TIGHT_GAP_MIN && diemCumLich > 0) reasons.push(people === 2 ? "nối sát ca khác, vừa đẹp cho nhóm 2 người" : "nối sát ca đã có khách khác, tiện ekip");
    if (gapMin <= CLUSTER_TIGHT_GAP_MIN && people >= 3 && diemCumLich < w.canhCumSat) reasons.push("nối sát ca khác nhưng nhóm đông, dễ trễ dây chuyền nếu ca trước trễ");
    else if (gapMin > CLUSTER_TIGHT_GAP_MIN && gapMin <= CLUSTER_LOOSE_GAP_MIN) reasons.push("gần 1 ca khác trong ngày");
    if (diemLapLich > 0) reasons.push("ekip rảnh ngay, không phải chờ");
    if (diemSatNghiTrua > 0) reasons.push(`sát giờ nghỉ trưa ekip${people >= 2 ? ` (nhóm ${people} người)` : ""}`);
    if (diemSatNghiToi > 0) reasons.push(`sát giờ nghỉ tối ekip${people >= 2 ? ` (nhóm ${people} người)` : ""}`);
    if (diemQuaTai > 0) reasons.push(`làm trễ ${sim.pushedOrders.length} đơn khác`);
    if (diemGioMuon > 0) reasons.push(`giờ muộn (quá ${minutesToLabel(LATE_PENALTY_FROM_MIN)} khoảng ${hoursPastLate.toFixed(1)} giờ)`);
    if (sim.isDelayed) reasons.push("khách phải chờ vì bàn/set còn bận");

    results.push({
      conceptId,
      conceptTen: concept.name,
      ngay: dateIso,
      gio: minutesToLabel(min),
      loaiCa,
      diemTong,
      trangThai,
      lyDo: reasons.join(", ") || "ca bình thường",
      capNhatLuc,
    });
  }

  return results.sort((a, b) => b.diemTong - a.diemTong).slice(0, topN);
}

// ---------------------------------------------------------------------------
// Định dạng câu trả lời AI mẫu (không phải UI, chỉ để demo/test logic)
// ---------------------------------------------------------------------------

export function formatHourSuggestionsReply(suggestions: HourSuggestion[]): string {
  const ok = suggestions.filter((s) => s.trangThai === "phu_hop");
  if (ok.length === 0) {
    return "Ngày này hiện chưa có ca phù hợp, bạn xem giúp studio ngày khác nha.";
  }
  const lines = ok.map((s) => `${s.gio} (${s.lyDo})`);
  return `Studio gợi ý các ca: ${lines.join("; ")}.`;
}
