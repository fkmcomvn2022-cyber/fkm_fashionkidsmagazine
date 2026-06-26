import { ordersByDate, conceptById } from "@/data";
import type { Order } from "@/types";

// ---------------------------------------------------------------------------
// Mô hình "băng chuyền 2 trạm": 1 bàn trang điểm + 1 set chụp, mỗi trạm chỉ
// phục vụ 1 khách/đơn tại một thời điểm.
//   - `order.time` = giờ khách ĐẾN (bắt đầu trang điểm), không phải giờ chụp.
//   - Mỗi người trong đơn trang điểm lần lượt qua bàn trang điểm, mỗi người
//     tốn `concept.makeupMin` phút → tổng thời gian chiếm bàn trang điểm của
//     1 đơn = makeupMin × số người.
//   - Khi trang điểm xong cả đơn, cả nhóm bắt đầu chụp chung trong
//     `order.durationMin` phút tại set chụp.
//   - Bàn trang điểm rảnh ngay khi đơn xong trang điểm (không cần chờ đơn đó
//     chụp xong) → đơn tiếp theo có thể bắt đầu trang điểm trong lúc đơn
//     trước đang chụp.
//   - Set chụp chỉ rảnh khi đơn đang chụp xong; nếu đơn tiếp theo trang điểm
//     xong sớm hơn lúc set chụp rảnh, khách phải đợi (delay).
//
// Giờ nghỉ ăn của ekip (mặc định 12:30–13:00 và 18:30–19:00): KHÔNG chặn
// cứng, vì ekip ăn lệch ca (ví dụ photo ăn trong khi makeup vẫn làm việc) nên
// 1 ca đang trang điểm/chụp vẫn có thể trùng giờ này. Chỉ áp dụng khi GỢI Ý
// ca mới — tránh chủ động hẹn khách đến đúng lúc ekip nghỉ.
//
// Cấu hình được (Thiết lập → "Giờ nghỉ ekip"): mỗi khung giờ có thể đổi giờ
// bắt đầu/kết thúc, hoặc tắt hẳn. Khung giờ bị tắt = coi như studio KHÔNG
// nghỉ giờ đó — không né, không cảnh báo gì liên quan đến nó nữa.
//
// Ưu tiên ngày trong tuần (chiều T6, cả T7, CN, sáng T2) là quy tắc tiếp thị/
// nguồn khách, được xử lý ở AI prompt bên ngoài app này — khi khách hỏi
// đúng 1 ngày cụ thể, app vẫn luôn trả về khung giờ thật của ngày đó.
// ---------------------------------------------------------------------------

export const DAY_START = 8 * 60; // 08:00
export const DAY_END = 18 * 60; // 18:00

/** Mỗi người thêm vào nhóm (từ người thứ 2) làm set chụp tốn thêm bao nhiêu
 * phút — xác nhận với người dùng 2026-06-26: 1 người +0, 2 người +10, 3 người
 * +20. Từ 4 người trở lên TẠM tính như 3 người (không cộng thêm nữa) — người
 * dùng chưa chốt số cụ thể cho nhóm lớn hơn, xem [[fkm-studio-scheduling-model]]. */
const GROUP_EXTRA_PER_PERSON_MIN = 10;
const GROUP_EXTRA_CAP_PEOPLE = 3;

/** Số phút phát sinh thêm ở SET CHỤP do số người trong nhóm (không áp dụng
 * cho bàn trang điểm — makeup đã tính riêng theo từng người qua `makeupMin ×
 * số người`, không cộng thêm gì nữa ở đây). */
export function groupExtraShootMin(peopleCount: number): number {
  const capped = Math.min(Math.max(1, peopleCount), GROUP_EXTRA_CAP_PEOPLE);
  return (capped - 1) * GROUP_EXTRA_PER_PERSON_MIN;
}

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export interface BreakWindowSetting {
  id: string;
  label: string;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  enabled: boolean;
}

/**
 * Cấu hình giờ nghỉ ekip — mảng mutable cấp module (giống `orders`/
 * `customers` trong `src/data/*`), chỉnh qua `setBreakWindowSettings()` từ
 * trang Thiết lập. Khung giờ `enabled: false` bị bỏ hẳn khỏi tính toán.
 */
export let breakWindowSettings: BreakWindowSetting[] = [
  { id: "lunch", label: "Nghỉ trưa", start: "12:30", end: "13:00", enabled: true },
  { id: "dinner", label: "Nghỉ tối", start: "18:30", end: "19:00", enabled: true },
];

/** Ghi đè toàn bộ cấu hình giờ nghỉ. Gọi `bumpDataVersion()` sau đó để các trang lịch tính lại. */
export function setBreakWindowSettings(next: BreakWindowSetting[]) {
  breakWindowSettings = next;
}

function activeBreakWindows(): [number, number][] {
  return breakWindowSettings.filter((w) => w.enabled).map((w) => [toMinutes(w.start), toMinutes(w.end)]);
}

/** true nếu khoảng [min, min+durationMin) chạm vào 1 trong các giờ nghỉ ekip đang BẬT. */
function touchesBreakWindow(min: number, durationMin = 0): boolean {
  return activeBreakWindows().some(([start, end]) => min < end && min + durationMin > start);
}

/** Đẩy `min` ra khỏi giờ nghỉ ekip theo hướng đang quét (forward: tới giờ nghỉ → hết giờ nghỉ, backward: tới giờ nghỉ → trước giờ nghỉ). */
function avoidBreakWindow(min: number, forward: boolean): number {
  for (const [start, end] of activeBreakWindows()) {
    if (min >= start && min < end) return forward ? end : start;
  }
  return min;
}

/** Nếu thời điểm rơi vào giờ nghỉ ăn của ekip (đang bật), đẩy ra hết khung giờ nghỉ đó. */
function skipBreakWindows(min: number): number {
  let result = min;
  for (const [start, end] of activeBreakWindows()) {
    if (result >= start && result < end) result = end;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Lõi mô phỏng băng chuyền (dùng chung cho timeline thật + mô phỏng ứng viên).
// ---------------------------------------------------------------------------

export interface PipelineJob {
  id: string;
  requestedMin: number;
  totalMakeup: number;
  durationMin: number;
}

export interface PipelineResult {
  id: string;
  requestedMin: number;
  makeupStart: number;
  makeupEnd: number;
  shootStart: number;
  shootEnd: number;
  waitMin: number;
  queueMin: number;
  isDelayed: boolean;
}

/** Chạy mô phỏng 2 trạm cho 1 tập job, sắp theo requestedMin (sort ổn định → cùng giờ thì giữ thứ tự đưa vào). */
export function runPipeline(jobs: PipelineJob[], dayStart: number = DAY_START): PipelineResult[] {
  const sorted = [...jobs].sort((a, b) => a.requestedMin - b.requestedMin);
  let makeupFree = dayStart;
  let shootFree = dayStart;
  const results: PipelineResult[] = [];

  for (const job of sorted) {
    const makeupStart = Math.max(job.requestedMin, makeupFree);
    const makeupEnd = makeupStart + job.totalMakeup;
    const shootStart = Math.max(makeupEnd, shootFree);
    const shootEnd = shootStart + job.durationMin;

    results.push({
      id: job.id,
      requestedMin: job.requestedMin,
      makeupStart,
      makeupEnd,
      shootStart,
      shootEnd,
      waitMin: makeupStart - job.requestedMin,
      queueMin: shootStart - makeupEnd,
      isDelayed: makeupStart > job.requestedMin || shootStart > makeupEnd,
    });

    makeupFree = makeupEnd;
    shootFree = shootEnd;
  }

  return results;
}

/**
 * `order.durationMin` chỉ là SNAPSHOT lúc tạo đơn (xem `createOrder`/
 * `updateOrder` trong `src/data/orders.ts`) — không tự cập nhật khi sau đó
 * concept bị sửa thời lượng chụp ở Sản phẩm > Sửa (`updateConcept`). Trong khi
 * đó `makeupMin` luôn lấy SỐNG từ concept (dòng dưới). Hai cách lấy khác nhau
 * này từng gây lệch số: concept đổi chụp 90→60 phút, đơn cũ vẫn chạy với 90
 * (cũ) + makeup 60 (mới) → giờ "Trống" tính sai 30 phút (phát hiện qua báo
 * lỗi thực tế của người dùng 2026-06-26: concept Thu Mơ đổi thành chụp 60/
 * makeup 60, đơn 8h cũ vẫn lệch, "Trống" báo 9h30 thay vì 9h00 đúng). Lấy
 * `concept.durationMin` SỐNG giống `makeupMin`, chỉ rơi về `order.durationMin`
 * khi concept đã bị xoá (orphan) — để lịch luôn khớp với cấu hình concept
 * hiện tại, không bị kẹt số cũ.
 */
function jobFromOrder(order: Order): PipelineJob {
  const concept = conceptById(order.conceptId);
  const perPersonMakeup = concept?.makeupMin ?? 30;
  const peopleCount = Math.max(1, order.people.length);
  const baseDuration = concept?.durationMin ?? order.durationMin;
  return {
    id: order.id,
    requestedMin: toMinutes(order.time),
    totalMakeup: perPersonMakeup * peopleCount,
    durationMin: baseDuration + groupExtraShootMin(peopleCount),
  };
}

export interface TimelineEntry {
  order: Order;
  requestedMin: number; // giờ khách hẹn đến
  makeupStart: number;
  makeupEnd: number;
  shootStart: number;
  shootEnd: number;
  waitMin: number; // phải đợi bao lâu mới được trang điểm (bàn còn bận)
  queueMin: number; // trang điểm xong rồi mà set chụp còn bận, phải đợi thêm
  isDelayed: boolean;
}

/** Mô phỏng dòng chảy thực tế trong ngày qua 2 trạm: trang điểm → chụp. */
export function computeStudioTimeline(dateIso: string): TimelineEntry[] {
  const dayOrders = ordersByDate(dateIso).filter((o) => o.status !== "cancelled");
  const jobs = dayOrders.map(jobFromOrder);
  const results = runPipeline(jobs);
  const byId = new Map(results.map((r) => [r.id, r]));

  return dayOrders
    .map((order) => {
      const r = byId.get(order.id)!;
      return {
        order,
        requestedMin: r.requestedMin,
        makeupStart: r.makeupStart,
        makeupEnd: r.makeupEnd,
        shootStart: r.shootStart,
        shootEnd: r.shootEnd,
        waitMin: r.waitMin,
        queueMin: r.queueMin,
        isDelayed: r.isDelayed,
      };
    })
    .sort((a, b) => a.requestedMin - b.requestedMin);
}

export interface CandidateSimulation {
  arrival: number;
  makeupEnd: number;
  shootStart: number;
  shootEnd: number;
  waitMin: number;
  queueMin: number;
  isDelayed: boolean;
  fitsBeforeClose: boolean;
  /** Các đơn đã có trong ngày bị đẩy trễ thêm nếu chèn ứng viên này vào. */
  pushedOrders: { orderId: string; delayMin: number }[];
}

/**
 * Mô phỏng việc chèn 1 khách ứng viên (chưa đặt thật) vào giờ `arrivalMin`
 * của ngày `dateIso`, dùng để chấm điểm các giờ/ngày gợi ý mà KHÔNG ghi gì
 * vào dữ liệu đơn hàng. Trả về cả độ trễ của chính ứng viên và việc ứng viên
 * có làm trễ thêm các đơn đã có trong ngày hay không (qua tải).
 */
export function simulateCandidate(
  dateIso: string,
  conceptId: string,
  peopleCount: number,
  arrivalMin: number,
): CandidateSimulation {
  const concept = conceptById(conceptId);
  const peopleCountSafe = Math.max(1, peopleCount);
  const totalMakeup = (concept?.makeupMin ?? 30) * peopleCountSafe;
  const durationMin = (concept?.durationMin ?? 60) + groupExtraShootMin(peopleCountSafe);

  const dayOrders = ordersByDate(dateIso).filter((o) => o.status !== "cancelled");
  const baselineJobs = dayOrders.map(jobFromOrder);
  const baseline = runPipeline(baselineJobs);
  const baselineEnd = new Map(baseline.map((r) => [r.id, r.shootEnd]));

  const candidateJob: PipelineJob = { id: "__candidate__", requestedMin: arrivalMin, totalMakeup, durationMin };
  const withCandidate = runPipeline([...baselineJobs, candidateJob]);
  const byId = new Map(withCandidate.map((r) => [r.id, r]));

  const candidateResult = byId.get("__candidate__")!;
  const pushedOrders = dayOrders
    .map((o) => {
      const before = baselineEnd.get(o.id) ?? 0;
      const after = byId.get(o.id)?.shootEnd ?? before;
      return { orderId: o.id, delayMin: after - before };
    })
    .filter((p) => p.delayMin > 0);

  return {
    arrival: arrivalMin,
    makeupEnd: candidateResult.makeupEnd,
    shootStart: candidateResult.shootStart,
    shootEnd: candidateResult.shootEnd,
    waitMin: candidateResult.waitMin,
    queueMin: candidateResult.queueMin,
    isDelayed: candidateResult.isDelayed,
    fitsBeforeClose: candidateResult.shootEnd <= DAY_END,
    pushedOrders,
  };
}

export interface SuggestedSlot {
  arrival: number;
  makeupEnd: number;
  shootStart: number;
  shootEnd: number;
  nudgedForBreak: boolean; // đã né giờ nghỉ ăn ekip
}

/**
 * Tính giờ sớm nhất studio có thể nhận thêm 1 khách mới với concept đã chọn.
 *
 * Quy tắc (đã xác nhận với người dùng): coi các ca liên tiếp không hở là 1
 * "cụm" (giống cách ô lịch mini gộp nhóm — xem `groupTimeline`). Quét các khe
 * hở GIỮA các cụm theo đúng thứ tự thời gian trong ngày (kể cả khe trước cụm
 * đầu tiên); khe hở sớm nhất mà khách mới vừa khít — không bị đẩy lùi ca nào
 * khác, không phải tự chờ, không dính giờ nghỉ ăn ekip (12:30–13:00,
 * 18:30–19:00) — là gợi ý ƯU TIÊN CAO NHẤT, dù nó nằm giữa lịch chứ không
 * phải cuối ngày. Chỉ khi không khe nào vừa mới rơi về cách cũ: xếp sau cụm
 * cuối cùng của ngày.
 *
 * Mốc thử cho mỗi cụm = "điểm gối ca" tối ưu (bug đã sửa 2026-06-25, mở rộng
 * lại 2026-06-25 theo ví dụ cụ thể của người dùng — chụp 60', makeup 45', xem
 * [[fkm-studio-scheduling-model]]): khách mới có thể vào trang điểm sớm nhất
 * từ lúc bàn trang điểm rảnh (`makeupFreeMin`), NHƯNG nếu trang điểm của
 * khách mới xong trước khi set chụp rảnh (`endMin`) thì khách đó phải đợi —
 * vậy mốc tối ưu thực ra là `max(makeupFreeMin, endMin - totalMakeup)`: đến
 * đủ sớm để không phải chờ gì cả ở CẢ 2 trạm, không sớm hơn (sẽ phải chờ ở
 * set chụp), không muộn hơn (mất thời gian chờ ở nhà oan). Khi makeup là
 * trạm chậm hơn (makeupMin ≥ durationMin), công thức tự rút về `makeupFreeMin`
 * như cũ; khi chụp là trạm chậm hơn (durationMin > makeupMin, ca này), công
 * thức tự "lùi" mốc lại đúng bằng khoảng `totalMakeup` trước `endMin` — tức
 * xếp khách theo nhịp của trạm CHẬM HƠN (đúng yêu cầu "phải theo cái nào lâu
 * hơn"), không phải cộng dồn 2 trạm nối tiếp như cách tính bảo toàn cũ.
 * Trả về null nếu không còn khe nào kịp trước giờ đóng cửa (18:00).
 */
export function suggestNextSlot(dateIso: string, conceptId: string, peopleCount = 1): SuggestedSlot | null {
  const timeline = computeStudioTimeline(dateIso);
  const clusters = groupTimeline(timeline);
  const concept = conceptById(conceptId);
  const totalMakeup = (concept?.makeupMin ?? 30) * Math.max(1, peopleCount);

  // Các điểm bắt đầu khe hở cần xét, theo thứ tự thời gian tăng dần: trước
  // cụm đầu tiên (DAY_START), rồi với mỗi cụm — mốc "gối ca" tối ưu (xem
  // JSDoc phía trên) TRƯỚC, mốc set-chụp-rảnh-hẳn (cách tính cũ, an toàn nhất
  // nhưng có thể chậm hơn cần thiết) làm phương án dự phòng SAU. Cụm cuối
  // cùng vẫn tạo ra khe hở "phần còn lại của ngày" như trước.
  const gapStarts = [
    DAY_START,
    ...clusters.flatMap((c) => {
      const optimal = Math.max(c.makeupFreeMin, c.endMin - totalMakeup);
      return optimal < c.endMin ? [optimal, c.endMin] : [c.endMin];
    }),
  ];

  for (const gapStart of gapStarts) {
    const arrival = skipBreakWindows(Math.max(DAY_START, gapStart));
    const sim = simulateCandidate(dateIso, conceptId, peopleCount, arrival);
    const occupiesBreak = touchesBreakWindow(arrival, sim.shootEnd - arrival);

    // Vừa khít khe hở = không đẩy lùi đơn nào đã có (pushedOrders rỗng),
    // không tự bị chờ/xếp hàng (isDelayed false), không dính giờ nghỉ, và
    // chụp xong trước giờ đóng cửa.
    if (sim.fitsBeforeClose && !sim.isDelayed && sim.pushedOrders.length === 0 && !occupiesBreak) {
      return {
        arrival,
        makeupEnd: sim.makeupEnd,
        shootStart: sim.shootStart,
        shootEnd: sim.shootEnd,
        nudgedForBreak: arrival !== gapStart,
      };
    }
  }

  return null;
}

export interface DayBlock {
  startMin: number;
  endMin: number;
  peopleCount: number;
  conceptColors: string[];
  isDelayed: boolean;
}

export interface FreeSlot {
  startMin: number;
  endMin: number;
}

/** Tóm tắt ngày cho các ô lịch nhỏ (Home/WeekCalendar): khối chụp thực tế + khoảng bàn trang điểm còn trống. */
export function computeDayLayout(dateIso: string) {
  const timeline = computeStudioTimeline(dateIso);

  const clusters: DayBlock[] = timeline.map((t) => ({
    startMin: t.shootStart,
    endMin: t.shootEnd,
    peopleCount: t.order.people.length,
    conceptColors: [conceptById(t.order.conceptId)?.color ?? "#94a3b8"],
    isDelayed: t.isDelayed,
  }));

  // Khoảng trống = khe hở trong lịch bàn trang điểm (trạm quyết định có nhận
  // được khách mới hay không), ≥60 phút mới đáng tính là "trống" hữu ích.
  const freeSlots: FreeSlot[] = [];
  let cursor = DAY_START;
  for (const t of timeline) {
    if (t.makeupStart - cursor >= 60) freeSlots.push({ startMin: cursor, endMin: t.makeupStart });
    cursor = Math.max(cursor, t.makeupEnd);
  }
  if (DAY_END - cursor >= 60) freeSlots.push({ startMin: cursor, endMin: DAY_END });

  return {
    clusters,
    freeSlots,
    totalPeople: timeline.reduce((s, t) => s + t.order.people.length, 0),
  };
}

export function minutesToLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// "5 ô lịch" cho thẻ ngày mini (WeekCalendar trên Trang chủ).
//
// Quy tắc (đã xác nhận với người dùng):
//   - Luôn hiện ĐÚNG 5 ô/ngày — không hơn, không kém.
//   - Nhiều ca liên tiếp KHÔNG có khoảng trống giữa chừng (ca sau bắt đầu
//     chụp đúng lúc ca trước chụp xong) gộp lại thành 1 "nhóm" duy nhất.
//   - Nếu số nhóm đã ≥ 5, chỉ hiện 5 nhóm đầu (theo thời gian), không thêm ô
//     trống nữa.
//   - Nếu còn thiếu ô, lấp đầy bằng các ô TRỐNG liền kề các nhóm đã có (gợi ý
//     giờ đến cho khách mới), bước nhảy 60 phút — vì ở mini-card này chưa
//     biết khách sẽ chọn concept nào, nên dùng bước nhảy chung; khi bấm vào ô
//     trống mới chọn concept/giờ chính xác trong form thêm khách.
//   - Giờ nghỉ ăn ekip (12:30–13:00, 18:30–19:00): không loại bỏ, nhưng khi
//     quét để tạo ô trống thì né ra trước/sau giờ nghỉ — ô trống chỉ rơi đúng
//     vào giờ nghỉ khi không còn lựa chọn nào khác hợp lý hơn.
// ---------------------------------------------------------------------------

export interface MiniBookingGroup {
  kind: "booking";
  startMin: number; // giờ khách đầu tiên trong nhóm đến
  endMin: number; // lúc nhóm cuối trong cụm rời set chụp (set chụp rảnh hẳn)
  makeupFreeMin: number; // lúc bàn trang điểm rảnh hẳn sau cụm — có thể SỚM HƠN endMin, vì khách mới có thể vào trang điểm trong lúc cụm này còn đang chụp
  peopleCount: number;
  conceptColors: string[];
  orderIds: string[];
  isDelayed: boolean;
}

export interface MiniEmptySlot {
  kind: "empty";
  min: number; // giờ gợi ý khách mới có thể đến
  deprioritized: boolean; // true nếu sát/trong giờ nghỉ ekip
}

export type MiniCell = MiniBookingGroup | MiniEmptySlot;

const MINI_TARGET_CELLS = 5;
const MINI_STEP = 60; // bước nhảy chung khi chưa biết concept cụ thể

function cellAnchor(cell: MiniCell): number {
  return cell.kind === "booking" ? cell.startMin : cell.min;
}

/** Gộp các ca liên tiếp không có khoảng trống (ca sau chụp ngay khi ca trước vừa xong) thành 1 nhóm. */
function groupTimeline(timeline: TimelineEntry[]): MiniBookingGroup[] {
  const sorted = [...timeline].sort((a, b) => a.shootStart - b.shootStart);
  const groups: MiniBookingGroup[] = [];

  for (const entry of sorted) {
    const color = conceptById(entry.order.conceptId)?.color ?? "#94a3b8";
    const last = groups[groups.length - 1];
    if (last && entry.shootStart <= last.endMin) {
      last.endMin = Math.max(last.endMin, entry.shootEnd);
      last.makeupFreeMin = Math.max(last.makeupFreeMin, entry.makeupEnd);
      last.peopleCount += entry.order.people.length;
      last.orderIds.push(entry.order.id);
      last.isDelayed = last.isDelayed || entry.isDelayed;
      if (!last.conceptColors.includes(color)) last.conceptColors.push(color);
    } else {
      groups.push({
        kind: "booking",
        startMin: entry.requestedMin,
        endMin: entry.shootEnd,
        makeupFreeMin: entry.makeupEnd,
        peopleCount: entry.order.people.length,
        conceptColors: [color],
        orderIds: [entry.order.id],
        isDelayed: entry.isDelayed,
      });
    }
  }

  return groups;
}

/**
 * Tính đúng 5 ô hiển thị cho 1 ngày trên thẻ lịch mini: nhóm ca đã có khách +
 * ô trống gợi ý liền kề (nếu còn thiếu để đủ 5). Không ghi/đổi dữ liệu gì.
 *
 * `conceptId` (mặc định = concept đang chọn ở Trang chủ, `activeConceptId`):
 * dùng để tính mốc "gối ca" tối ưu cho ô Trống — CÙNG công thức với
 * `suggestNextSlot` (Lịch ca chụp): `max(makeupFreeMin, endMin - makeupMin)`.
 * Lý do (xác nhận với người dùng 2026-06-26, xem
 * [[fkm-studio-scheduling-model]]): chỉ neo vào `makeupFreeMin` là CHƯA ĐỦ —
 * khi set chụp là trạm chậm hơn (chụp lâu hơn trang điểm), khách mới đến đúng
 * lúc bàn trang điểm rảnh sẽ trang điểm xong sớm hơn lúc set chụp rảnh và
 * phải đợi. Phải cho khách đến SỚM HƠN lúc set chụp rảnh hẳn (`endMin`) đúng
 * bằng thời gian trang điểm của khách đó (`makeupMin`), để trang điểm xong
 * đúng lúc set chụp vừa trống — không đợi ở trạm nào cả. Khi trang điểm là
 * trạm chậm hơn, công thức tự rút về `makeupFreeMin` như cũ.
 */
export function computeMiniDayCells(dateIso: string, conceptId?: string): MiniCell[] {
  const timeline = computeStudioTimeline(dateIso);
  const groups = groupTimeline(timeline);

  if (groups.length >= MINI_TARGET_CELLS) {
    return groups.slice(0, MINI_TARGET_CELLS);
  }

  const needed = MINI_TARGET_CELLS - groups.length;
  const taken = new Set<number>();
  // Chỉ [startMin, makeupFreeMin) của 1 cụm là thực sự "kẹt cứng" (bàn trang
  // điểm còn đang phục vụ cụm đó) — từ makeupFreeMin trở đi, dù cụm vẫn còn
  // đang chụp, bàn trang điểm đã rảnh nên có thể nhận khách mới vào trang
  // điểm (xác nhận với người dùng 2026-06-25, xem [[fkm-studio-scheduling-model]]).
  const within = (min: number) => groups.some((g) => min >= g.startMin && min < g.makeupFreeMin);
  const empties: MiniEmptySlot[] = [];

  // Mốc "gối ca" tối ưu cho 1 cụm, theo makeupMin của concept đang chọn. Không
  // có concept (gọi không kèm conceptId) -> rút về makeupFreeMin thuần như
  // cách tính cũ, KHÔNG lùi về endMin (lùi về endMin mới là cách tính cũ HƠN,
  // bảo toàn quá mức — tránh nhầm 2 mốc cũ với nhau).
  const hintMakeup = conceptId ? conceptById(conceptId)?.makeupMin : undefined;
  const anchorFor = (g: MiniBookingGroup) => (hintMakeup == null ? g.makeupFreeMin : Math.max(g.makeupFreeMin, g.endMin - hintMakeup));

  const tryAdd = (min: number) => {
    if (min < DAY_START || min + MINI_STEP > DAY_END) return false;
    if (taken.has(min) || within(min)) return false;
    taken.add(min);
    empties.push({ kind: "empty", min, deprioritized: touchesBreakWindow(min, MINI_STEP) });
    return true;
  };

  if (groups.length === 0) {
    // Ngày trống hoàn toàn: lấp 5 ô cách đều từ giờ mở cửa.
    for (let m = DAY_START; empties.length < needed && m + MINI_STEP <= DAY_END; m += MINI_STEP) {
      const safe = avoidBreakWindow(m, true);
      tryAdd(safe);
    }
  } else {
    // Khe giữa các nhóm liên tiếp (hữu ích nhất vì sát khách 2 phía) — neo
    // vào mốc gối ca tối ưu (anchorFor), không phải lúc set chụp rảnh hẳn
    // (endMin), để không bỏ lỡ khe sớm hơn — nhưng cũng không sớm hơn mức an
    // toàn nếu chụp là trạm chậm hơn.
    for (let i = 0; i < groups.length - 1 && empties.length < needed; i++) {
      tryAdd(avoidBreakWindow(anchorFor(groups[i]), true));
    }

    // Quét ra 2 phía: trước nhóm đầu, sau nhóm cuối, xen kẽ.
    let beforeCursor = avoidBreakWindow(groups[0].startMin - MINI_STEP, false);
    let afterCursor = avoidBreakWindow(anchorFor(groups[groups.length - 1]), true);

    while (empties.length < needed && (beforeCursor >= DAY_START || afterCursor + MINI_STEP <= DAY_END)) {
      if (afterCursor + MINI_STEP <= DAY_END) {
        tryAdd(afterCursor);
        afterCursor = avoidBreakWindow(afterCursor + MINI_STEP, true);
      }
      if (empties.length >= needed) break;
      if (beforeCursor >= DAY_START) {
        tryAdd(beforeCursor);
        beforeCursor = avoidBreakWindow(beforeCursor - MINI_STEP, false);
      } else if (afterCursor + MINI_STEP > DAY_END) {
        break; // hết chỗ cả 2 phía
      }
    }
  }

  const cells: MiniCell[] = [...groups, ...empties.slice(0, needed)];
  return cells.sort((a, b) => cellAnchor(a) - cellAnchor(b));
}
