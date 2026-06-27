/**
 * Cài đặt "AI tự động trả lời" (Giai đoạn 3 — xem [[fkm-studio-ai-chatbot-roadmap]]).
 * Cùng pattern module-level setting như breakWindowSettings/vietQRSettings/
 * reminderSettings (xem memory fkm-studio-data-write-path) — bật/tắt ở đây
 * được mirror lên backend qua persistAll() (PUT /api/state). Quan trọng: bên
 * THỰC SỰ đọc cờ này lúc quyết định tự trả lời khách là server
 * (server/src/index.ts, qua state.aiAutoReplySettings), KHÔNG phải app đang
 * mở — tắt ở app rồi lưu là server tự ngừng trả lời ở webhook tiếp theo, kể
 * cả khi app đang đóng trên điện thoại.
 *
 * Giai đoạn 3.1 (UChat-style): thêm `customPrompt` (hướng dẫn thêm, tự do,
 * studio gõ gì cũng được — server LUÔN ghép thêm các quy tắc an toàn cố định
 * phía trước, không cho phép tắt: không bịa giá, không tự chốt giờ/slot cụ
 * thể) và `functions` (danh sách "nghiệp vụ" AI được phép tự gọi khi trả lời
 * khách, giống cách UChat cho tạo AI Agent function). Tên kỹ thuật (`key`) và
 * tham số của mỗi hàm là CỐ ĐỊNH, do app định nghĩa sẵn (xem
 * server/src/ai.ts) — vì đây là các nghiệp vụ thật, đụng vào dữ liệu thật
 * (tag khách, báo nhân viên...), không an toàn nếu cho tự ý đổi tên/tham số.
 * Studio chỉ tự biên tập `name` (nhãn hiển thị trong app) và `description`
 * (mô tả tự nhiên — đây chính là "prompt" quyết định KHI NÀO Gemini gọi hàm
 * này, gửi thẳng vào functionDeclaration.description) và bật/tắt từng hàm.
 */
export interface AiFunctionConfig {
  key:
    | "lookup_order"
    | "tag_customer"
    | "escalate_to_staff"
    | "check_available_slots"
    | "create_order_from_chat"
    | "send_concept_photos"
    | "upsell_order"
    | "reschedule_order"
    | "cancel_order";
  enabled: boolean;
  name: string; // nhãn hiển thị trong app, không gửi cho Gemini
  description: string; // mô tả tự nhiên — gửi cho Gemini để quyết định khi nào gọi hàm
}

export interface AiAutoReplySettings {
  enabled: boolean;
  customPrompt: string;
  functions: AiFunctionConfig[];
  // 2 cài đặt studio tự chỉnh trong app (2026-06-28), KHÔNG hardcode trong
  // code nữa — xem chỗ dùng thật ở server/src/ai.ts (AiReplyContext.historyWindow/
  // temperature). Để trống/undefined = server tự dùng giá trị mặc định
  // (50 tin / 0.4) — không bắt buộc phải có ở dữ liệu cũ trước bản này.
  historyWindow?: number; // số tin gần nhất đưa vào ngữ cảnh — thấp hơn = tốn ít token hơn, nhưng AI mau "quên" ý cũ trong hội thoại dài
  temperature?: number; // 0–1, độ "sáng tạo": thấp = bám sát dữ liệu thật, cao = trả lời tự nhiên/đa dạng hơn nhưng dễ lệch ý
}

// 3 nghiệp vụ thật đã có sẵn trong app, an toàn để AI tự gọi (không tạo đơn
// mới/không thu tiền — những việc rủi ro cao hơn để sau, xem
// [[fkm-studio-ai-chatbot-roadmap]]). Mô tả mặc định viết theo đúng tinh thần
// "prompt cho function" mà studio yêu cầu — studio sửa lại tự do trong Cài đặt.
export const DEFAULT_AI_FUNCTIONS: AiFunctionConfig[] = [
  {
    key: "lookup_order",
    enabled: true,
    name: "Tra cứu đơn hàng",
    description:
      "Gọi khi khách hỏi về đơn hàng của chính mình (đã cọc chưa, ngày/giờ chụp, còn nợ bao nhiêu, trạng thái sửa ảnh...). Không cần hỏi lại số điện thoại nếu đã biết khách đang nhắn từ đoạn chat nào.",
  },
  {
    key: "tag_customer",
    enabled: true,
    name: "Gắn nhãn khách hàng",
    description:
      "Gọi khi nhận ra khách nên được gắn nhãn VIP, Thân thiết, hoặc Mới — dựa trên lịch sử mua hàng đã biết hoặc cách khách nói chuyện (vd khách quay lại nhiều lần, khách lần đầu hỏi).",
  },
  {
    key: "escalate_to_staff",
    enabled: true,
    name: "Báo nhân viên hỗ trợ",
    description:
      "Gọi khi khách hỏi điều ngoài khả năng trả lời của em (khiếu nại, yêu cầu đặc biệt, mặc cả giá, câu hỏi nhạy cảm, hoặc khách có vẻ không hài lòng) — báo ngay cho nhân viên thật vào hỗ trợ, đừng tự cố trả lời.",
  },
  // Giai đoạn 6 (xem [[fkm-studio-ai-chatbot-roadmap]]) — 2 nghiệp vụ rủi ro
  // cao hơn (tạo đơn thật, trả lời lịch trống thật) nên MẶC ĐỊNH TẮT, studio
  // tự cân nhắc bật sau khi đã xem qua màn Automation.
  {
    key: "check_available_slots",
    enabled: false,
    name: "Kiểm tra lịch trống",
    description:
      "Gọi khi khách hỏi còn lịch trống ngày nào/giờ nào để chụp. Chỉ trả lời đúng giờ trống THẬT lấy được từ hàm này, không tự đoán.",
  },
  {
    key: "create_order_from_chat",
    enabled: false,
    name: "Tự tạo đơn hàng",
    description:
      "Gọi khi đã thu thập đủ họ tên, số điện thoại, và ngày + giờ khách muốn chụp trong đoạn chat — tạo đơn mới (trạng thái Chưa cọc), sau đó hệ thống tự gửi nhắc cọc kèm mã QR cho khách.",
  },
  // Giai đoạn 7 (xem [[fkm-studio-ai-chatbot-roadmap]]) — chỉ GỬI ẢNH, không
  // đụng tới đơn/tiền nên an toàn, mặc định BẬT giống 3 nghiệp vụ đầu.
  {
    key: "send_concept_photos",
    enabled: true,
    name: "Gửi ảnh mẫu concept",
    description:
      "Gọi khi khách hỏi có ảnh mẫu không, hoặc đang cân nhắc/so sánh giữa các concept — gửi vài ảnh mẫu thật của đúng concept khách đang hỏi.",
  },
  // Giai đoạn 7 — ĐỤNG VÀO đơn đã có + đổi số tiền cần thu, rủi ro cao hơn các
  // hàm chỉ đọc/gửi ảnh ở trên nên mặc định TẮT giống check_available_slots/
  // create_order_from_chat.
  {
    key: "upsell_order",
    enabled: false,
    name: "Tự upsell thêm dịch vụ/người",
    description:
      "Gọi khi khách ĐÃ ĐỒNG Ý mua thêm dịch vụ bổ trợ hoặc thêm người vào đơn đang có — tự thêm vào đơn và tính lại số tiền cần thu thêm. Không tự thêm khi khách chỉ mới hỏi/cân nhắc, chưa xác nhận.",
  },
  // Giai đoạn 7 — rủi ro CAO NHẤT (đụng tới lịch ekip đã xếp/hủy doanh thu),
  // mặc định TẮT, studio cân nhắc kỹ trước khi bật.
  {
    key: "reschedule_order",
    enabled: false,
    name: "Tự đổi lịch hẹn",
    description:
      "Gọi khi khách ĐÃ XÁC NHẬN rõ ràng muốn đổi sang ngày/giờ chụp cụ thể khác — tự kiểm tra trùng giờ rồi đổi lịch đơn đang có.",
  },
  {
    key: "cancel_order",
    enabled: false,
    name: "Tự hủy lịch hẹn",
    description:
      "Gọi khi khách ĐÃ XÁC NHẬN rõ ràng muốn hủy lịch hẹn đang có, không chỉ hỏi thăm hoặc than phiền.",
  },
];

// Mặc định TẮT — chỉ nên bật sau khi đã khai báo GEMINI_API_KEY trên server
// (server/.env hoặc biến môi trường Render), tránh bật nhầm lúc chưa cấu hình.
export let aiAutoReplySettings: AiAutoReplySettings = {
  enabled: false,
  customPrompt: "",
  functions: DEFAULT_AI_FUNCTIONS,
  historyWindow: 50,
  temperature: 0.4,
};

export function setAiAutoReplySettings(next: AiAutoReplySettings) {
  aiAutoReplySettings = next;
}
