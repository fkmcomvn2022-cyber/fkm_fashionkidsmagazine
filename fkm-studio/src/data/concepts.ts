import type { Concept } from "@/types";
import { nextNumericId } from "@/lib/nextId";
import { orders } from "./orders";

// Giá Trẻ em/Người lớn: user cho mức chung 3.500.000 / 5.500.000 áp dụng cho mọi
// concept hiện có (2026-06-25) — chỉnh lại riêng từng concept tại Sản phẩm > Sửa.
const DEFAULT_PRICE_CHILD = 3500000;
const DEFAULT_PRICE_ADULT = 5500000;

export const concepts: Concept[] = [
  {
    id: "c1",
    name: "Thu Mơ",
    color: "#9b5cf6",
    category: "Gia đình",
    priceFrom: DEFAULT_PRICE_CHILD,
    priceChild: DEFAULT_PRICE_CHILD,
    priceAdult: DEFAULT_PRICE_ADULT,
    durationMin: 90,
    makeupMin: 45,
    status: "active",
    shortDesc: "Concept mùa thu, áo dài lụa, bối cảnh đồng lúa",
    description:
      "Chụp tại phim trường đồng lúa giả + backdrop trời thu của studio. Khách mặc áo dài lụa truyền thống (studio có sẵn nhiều màu/size), trang điểm nhẹ tự nhiên. Phù hợp chụp cá nhân hoặc theo đôi/gia đình muốn không khí hoài cổ, nhẹ nhàng.",
    sampleImageUrls: [
      "https://images.fkmstudio.vn/concept/c1/mau-01.jpg",
      "https://images.fkmstudio.vn/concept/c1/mau-02.jpg",
      "https://images.fkmstudio.vn/concept/c1/mau-03.jpg",
    ],
    packageSummary: "1 bộ áo dài lụa (chọn màu), trang điểm + làm tóc, 90 phút chụp, 20 ảnh đã chỉnh sửa, gửi ảnh qua link trong 5-7 ngày.",
  },
  {
    id: "c2",
    name: "Magazine Kid",
    color: "#ef5fa7",
    category: "Trẻ em",
    priceFrom: DEFAULT_PRICE_CHILD,
    priceChild: DEFAULT_PRICE_CHILD,
    priceAdult: DEFAULT_PRICE_ADULT,
    durationMin: 60,
    makeupMin: 20,
    status: "active",
    shortDesc: "Phong cách tạp chí thời trang trẻ em",
    description:
      "Phong cách bìa tạp chí thời trang dành cho bé, nhiều set trang phục màu sắc + đạo cụ (mũ, phụ kiện). Phù hợp bé 2-10 tuổi, ekip có kinh nghiệm dỗ/chơi với bé trong lúc chụp để bé tự nhiên, không gượng.",
    sampleImageUrls: [
      "https://images.fkmstudio.vn/concept/c2/mau-01.jpg",
      "https://images.fkmstudio.vn/concept/c2/mau-02.jpg",
    ],
    packageSummary: "1 set váy/đồ tạp chí + mũ phụ kiện, trang điểm nhẹ cho bé, 60 phút chụp, 15 ảnh đã chỉnh sửa.",
  },
  {
    id: "c3",
    name: "Vintage Áo Dài",
    color: "#ff9447",
    category: "Người lớn",
    priceFrom: DEFAULT_PRICE_CHILD,
    priceChild: DEFAULT_PRICE_CHILD,
    priceAdult: DEFAULT_PRICE_ADULT,
    durationMin: 120,
    makeupMin: 60,
    status: "active",
    shortDesc: "Áo dài cổ điển, phối cảnh phố cổ",
    description:
      "Concept áo dài vintage chụp tại phối cảnh phố cổ dựng trong studio (cổng gạch, đèn lồng, xe đạp cổ). Trang điểm + làm tóc kiểu cổ điển, có thể chụp thêm với đạo cụ (nón lá, quạt giấy). Thời gian chụp dài hơn (120 phút) vì nhiều góc máy/đổi đồ.",
    sampleImageUrls: [
      "https://images.fkmstudio.vn/concept/c3/mau-01.jpg",
      "https://images.fkmstudio.vn/concept/c3/mau-02.jpg",
      "https://images.fkmstudio.vn/concept/c3/mau-03.jpg",
    ],
    packageSummary: "1 bộ áo dài vintage + đạo cụ, trang điểm + làm tóc cổ điển, 120 phút chụp, 25 ảnh đã chỉnh sửa, 1 ảnh in 13x18 tặng kèm.",
  },
  {
    id: "c4",
    name: "Gia Đình Hạnh Phúc",
    color: "#4f6df5",
    category: "Gia đình",
    priceFrom: DEFAULT_PRICE_CHILD,
    priceChild: DEFAULT_PRICE_CHILD,
    priceAdult: DEFAULT_PRICE_ADULT,
    durationMin: 90,
    makeupMin: 30,
    status: "active",
    shortDesc: "Concept gia đình nhiều thành viên, trang phục đồng bộ",
    description:
      "Concept dành cho gia đình từ 2 người trở lên, trang phục đồng bộ màu sắc (studio có sẵn theo size, hoặc gia đình tự mang đồ tông màu tương tự). Phù hợp chụp dịp sinh nhật, đầy tháng, kỷ niệm gia đình. Mỗi người thêm vào nhóm tính giá riêng theo đối tượng Trẻ em/Người lớn.",
    sampleImageUrls: [
      "https://images.fkmstudio.vn/concept/c4/mau-01.jpg",
      "https://images.fkmstudio.vn/concept/c4/mau-02.jpg",
    ],
    packageSummary: "Trang phục đồng bộ theo số người, trang điểm cho người lớn, 90 phút chụp, 20 ảnh đã chỉnh sửa/gia đình.",
  },
  {
    id: "c5",
    name: "Sweet Baby",
    color: "#1fb27a",
    category: "Trẻ em",
    priceFrom: DEFAULT_PRICE_CHILD,
    priceChild: DEFAULT_PRICE_CHILD,
    priceAdult: DEFAULT_PRICE_ADULT,
    durationMin: 45,
    makeupMin: 15,
    status: "paused",
    shortDesc: "Newborn & baby concept, tone pastel",
    description:
      "Concept dành cho bé sơ sinh đến dưới 1 tuổi, phối cảnh tone pastel, đạo cụ bông gòn/giỏ mây an toàn cho bé. Thời gian chụp ngắn (45 phút), ekip ưu tiên giữ bé thoải mái, không ép tư thế. Hiện đang tạm dừng mở bán.",
    sampleImageUrls: ["https://images.fkmstudio.vn/concept/c5/mau-01.jpg"],
    packageSummary: "1 set đồ sơ sinh + đạo cụ, 45 phút chụp, 10 ảnh đã chỉnh sửa.",
  },
];

export const conceptById = (id: string) => concepts.find((c) => c.id === id);

/**
 * Sửa giá Trẻ em/Người lớn (và các trường cơ bản khác) của 1 concept — điểm ghi
 * dữ liệu duy nhất cho màn Sản phẩm > Sửa concept. priceFrom tự cập nhật theo
 * min(priceChild, priceAdult) để badge "giá từ X" trên thẻ luôn đúng.
 */
export function updateConcept(id: string, patch: Partial<Pick<Concept, "name" | "priceChild" | "priceAdult" | "durationMin" | "makeupMin" | "shortDesc" | "description" | "sampleImageUrls" | "samplePhotosByAge" | "packageSummary" | "defaultPhotoStaffId" | "defaultMakeupStaffId" | "defaultStylistStaffId" | "crewCostPhoto" | "crewCostMakeupChild" | "crewCostMakeupAdult" | "crewCostStylist" | "crewCostRetouchPerPerson">>): Concept | undefined {
  const concept = conceptById(id);
  if (!concept) return undefined;
  Object.assign(concept, patch);
  concept.priceFrom = Math.min(concept.priceChild, concept.priceAdult);
  return concept;
}

export interface CreateConceptInput {
  name: string;
  category?: Concept["category"];
  color?: string;
  priceChild?: number;
  priceAdult?: number;
  durationMin?: number;
  makeupMin?: number;
  shortDesc?: string;
  description?: string;
  sampleImageUrls?: string[];
  packageSummary?: string;
}

/** Tạo concept mới từ form "Tạo concept" (QuickAdd) — ô bỏ trống dùng mặc định
 * chung (TE 3.500.000 / NL 5.500.000, 60 phút chụp, 20 phút makeup). */
export function createConcept(input: CreateConceptInput): Concept {
  const seq = nextNumericId("c", concepts);
  const priceChild = input.priceChild ?? DEFAULT_PRICE_CHILD;
  const priceAdult = input.priceAdult ?? DEFAULT_PRICE_ADULT;
  const concept: Concept = {
    id: `c${seq}`,
    name: input.name.trim() || `Concept mới #${seq}`,
    color: input.color ?? "#4f6df5",
    category: input.category ?? "Khác",
    priceFrom: Math.min(priceChild, priceAdult),
    priceChild,
    priceAdult,
    durationMin: input.durationMin ?? 60,
    makeupMin: input.makeupMin ?? 20,
    status: "active",
    shortDesc: input.shortDesc,
    description: input.description,
    sampleImageUrls: input.sampleImageUrls,
    packageSummary: input.packageSummary,
  };
  concepts.push(concept);
  return concept;
}

/** Nhân bản 1 concept — copy toàn bộ giá/thời lượng, đổi tên thêm "(bản sao)". */
export function duplicateConcept(id: string): Concept | undefined {
  const source = conceptById(id);
  if (!source) return undefined;
  const seq = nextNumericId("c", concepts);
  const clone: Concept = { ...source, id: `c${seq}`, name: `${source.name} (bản sao)` };
  concepts.push(clone);
  return clone;
}

/** Bật/tắt nhanh 1 concept (nút PowerOff trên thẻ) — active <-> paused. */
export function toggleConceptStatus(id: string): Concept | undefined {
  const concept = conceptById(id);
  if (!concept) return undefined;
  concept.status = concept.status === "active" ? "paused" : "active";
  return concept;
}

export interface DeleteConceptResult {
  ok: boolean;
  reason?: string;
}

/**
 * Xóa thật 1 concept khỏi danh sách (người dùng xác nhận 2026-06-26 muốn xóa
 * thật, không phải chỉ ẩn). CHẶN xóa nếu còn bất kỳ đơn nào (cả đơn đã huỷ,
 * để giữ đúng tên/giá hiển thị khi xem lại lịch sử) đang tham chiếu concept
 * này — qua `order.conceptId` (concept chính của đơn) hoặc `person.conceptId`
 * (từng người trong đơn có thể chọn concept riêng) — tránh đơn cũ bị mất tên/
 * giá/thời lượng gốc và làm sai lịch (xem [[fkm-studio-scheduling-model]]:
 * `jobFromOrder` chỉ fallback về số cũ khi concept bị "orphan", không phải
 * trạng thái nên cố ý tạo ra). Muốn ẨN concept khỏi danh sách chọn mà vẫn giữ
 * đơn cũ nguyên vẹn, dùng nút Tạm dừng (`toggleConceptStatus`) thay vì xóa.
 */
export function deleteConcept(id: string): DeleteConceptResult {
  const concept = conceptById(id);
  if (!concept) return { ok: false, reason: "Không tìm thấy concept." };

  const inUse = orders.some((o) => o.conceptId === id || o.people.some((p) => p.conceptId === id));
  if (inUse) {
    return {
      ok: false,
      reason: `"${concept.name}" đang được dùng trong ít nhất 1 đơn hàng (kể cả đơn cũ/đã huỷ) — không thể xóa vì sẽ làm mất tên/giá gốc của đơn đó. Dùng nút Tạm dừng để ẩn khỏi danh sách chọn, hoặc đổi concept của các đơn liên quan trước khi xóa.`,
    };
  }

  const idx = concepts.findIndex((c) => c.id === id);
  if (idx === -1) return { ok: false, reason: "Không tìm thấy concept." };
  concepts.splice(idx, 1);
  return { ok: true };
}
