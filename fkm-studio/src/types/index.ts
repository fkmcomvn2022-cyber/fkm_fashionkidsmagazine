// Core domain types for FKM Studio — mirrors the 11-sheet Google Sheets schema
// that the legacy Apps Script backend reads/writes. These types are the contract
// the future Firebase/Postgres backend should also satisfy.

export type ConceptStatus = "active" | "paused" | "closed";

export interface Concept {
  id: string;
  name: string;
  color: string; // hex, used for banner + calendar chips
  category: "Trẻ em" | "Người lớn" | "Gia đình" | "Khác";
  priceFrom: number; // giá hiển thị "từ X" trên thẻ — luôn = min(priceChild, priceAdult)
  priceChild: number; // giá khi người chụp là Trẻ em
  priceAdult: number; // giá khi người chụp là Người lớn
  durationMin: number; // shoot duration
  makeupMin: number;
  status: ConceptStatus;
  thumbnail?: string;
  shortDesc?: string;
  // Giai đoạn 7 (xem [[fkm-studio-ai-chatbot-roadmap]]) — AI tư vấn khách cần
  // biết SÂU hơn `shortDesc` (chỉ 1 câu ngắn cho thẻ): mô tả/đặc điểm chi tiết
  // để trả lời đúng khi khách hỏi kỹ ("concept này chụp ở đâu, mặc đồ gì..."),
  // vài link ảnh mẫu để CHỦ ĐỘNG gửi khách xem (qua function send_concept_photos,
  // xem server/src/ai.ts), và tóm tắt gói gồm những gì (để khách không phải hỏi
  // lại studio "vậy giá đó có gồm trang điểm/ảnh in không").
  description?: string;
  sampleImageUrls?: string[];
  packageSummary?: string;
  // Ekip mặc định cho concept này — tự điền vào đơn mới (QuickOrderForm) để
  // không phải gán lại từng đơn; vẫn sửa được riêng theo từng đơn khi ca đó
  // có thay đổi thực tế (xem [[fkm-studio-scheduling-model]]).
  defaultPhotoStaffId?: string;
  defaultMakeupStaffId?: string;
  defaultStylistStaffId?: string;
  // Công thợ theo concept (tuỳ chọn) — nếu set, dùng mức này khi quyết toán
  // công thợ (xem `crewSettlements.ts`) THAY CHO mức lương khai báo trên hồ
  // sơ nhân sự (Staff.rate). Để trống = quyết toán tự lấy theo Staff.rate.
  // Theo mô hình `Cong_Photo`/`Cong_Makeup_Tre_Em`/`Nguoi_Lon`/`Cong_Stylist`/
  // `Cong_Retouch` của bản Apps Script — công thay đổi theo concept đang chụp,
  // không phụ thuộc nhân sự nào làm (vd. concept khó hơn thì công cao hơn,
  // bất kể ai chụp). Cong_Retouch tính theo đầu người (nhân với số người/đơn).
  crewCostPhoto?: number;
  crewCostMakeupChild?: number;
  crewCostMakeupAdult?: number;
  crewCostStylist?: number;
  crewCostRetouchPerPerson?: number;
}

export type StaffRole = "Photo" | "Makeup" | "Stylist" | "Retoucher" | "CSKH";
export type PayType = "Theo ca" | "Theo giờ" | "Theo ngày" | "Theo tháng";
export type StaffContactChannel = "call" | "zalo" | "sms" | "facebook";

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  phone: string;
  zalo?: string; // SĐT/link Zalo để liên lạc xếp ca, nhắc lịch — để trống nếu dùng chung SĐT ở trên
  // Link inbox Facebook Messenger của nhân sự (dán tay link m.me/... hoặc URL
  // inbox bất kỳ) — bấm "Liên lạc" với kênh này mở thẳng đúng đoạn chat đó,
  // khác với kênh khách hàng (vốn lưu trong order.socialContact).
  facebookLink?: string;
  avatar?: string;
  payType: PayType;
  rate: number;
  paidThisMonth: number;
  owedThisMonth: number;
  active: boolean;
  // STK nhận lương — dùng để studio chuyển lương cho nhân sự (khác với tài khoản
  // nhận tiền của studio ở Thiết lập > Thanh toán, vốn dùng để THU tiền khách).
  bankBin: string; // "" = chưa cài đặt, xem data/banks.ts
  accountNumber: string;
  accountName: string;
  // Kênh liên lạc mặc định khi nhắc lịch làm việc (TaskBoard "Việc nổi bật") —
  // bấm nút nhắc là mở thẳng kênh này. Nút "Liên lạc" ở StaffCard vẫn cho chọn
  // kênh khác làm phương án dự phòng khi kênh mặc định không liên lạc được.
  defaultContactChannel: StaffContactChannel;
}

export type Gender = "Nam" | "Nữ" | "Khác";
export type Audience = "Trẻ em" | "Người lớn";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  facebookId?: string;
  tag?: "VIP" | "Mới" | "Thân thiết";
  totalOrders: number;
  totalSpent: number;
  lastVisit?: string; // ISO date
  notes?: string;
  // Giai đoạn 3.1 (function-calling) — AI tự đặt cờ này qua hàm
  // "escalate_to_staff" khi gặp câu hỏi ngoài khả năng trả lời. Hiển thị
  // banner "Cần hỗ trợ" ở Hội thoại; tự tắt khi studio tự gửi 1 tin trả lời
  // tay cho khách này (xem POST /api/messages/send ở server/src/index.ts).
  needsHumanHelp?: boolean;
}

export type OrderStatus =
  | "new"
  | "deposited"
  | "scheduled"
  | "shooting"
  | "shot"
  | "selecting"
  | "editing"
  | "delivered"
  | "completed"
  | "cancelled";

export interface OrderPerson {
  id: string;
  name: string;
  audience: Audience;
  age?: number;
  outfitSize?: string;
  conceptId: string;
}

export type OrderKind = "Chụp studio" | "Thuê đồ" | "Thuê set" | "In ảnh" | "Sự kiện";

export type PromoType = "Không có" | "Giảm tiền" | "Giảm %" | "Khách VIP";

export interface ExtraRole {
  id: string;
  role: string;
  staffId?: string;
}

export interface PhotoLinks {
  folder?: string;
  raw?: string;
  selected?: string;
  final?: string;
}

/**
 * Phase 5 (xem [[fkm-studio-ai-chatbot-roadmap]]): cổng chọn ảnh thật cho
 * khách, khác với `PhotoLinks` (chỉ là link folder studio tự dán). Studio
 * dán từng link ảnh riêng vào `items`, gửi link cổng chọn ảnh cho khách
 * (route công khai `/chon-anh/:orderId`), khách tick chọn rồi bấm xác nhận
 * -> ghi vào `selectedUrls` + `completedAt`, backend bắn push báo studio.
 */
export interface PhotoSelection {
  items: string[];
  selectedUrls?: string[];
  completedAt?: string; // ISO datetime — khách đã bấm "Xác nhận chọn xong"
}

export interface Order {
  id: string;
  code: string; // human readable order code e.g. FKM-2026-0114
  customerId: string;
  conceptId: string;
  kind?: OrderKind; // Loại đơn — mặc định "Chụp studio" nếu không chọn
  source?: string; // Nguồn khách (Facebook/Zalo/Giới thiệu/...)
  socialContact?: string; // Facebook/Zalo liên hệ
  mainDob?: string; // Ngày sinh khách/bé chính (ISO date)
  date: string; // ISO date
  time: string; // HH:mm
  durationMin: number;
  people: OrderPerson[];
  addonServiceIds: string[];
  surcharge?: number; // Phụ thu nhanh nhập tay
  promoType?: PromoType; // Ưu đãi nhập tay
  promoValue?: number; // Số tiền (Giảm tiền) hoặc % (Giảm %)
  promoNote?: string; // Ghi chú ưu đãi/quà tặng nhập tay
  extraRoles?: ExtraRole[]; // Vai trò phát sinh ngoài ekip mặc định
  total: number;
  deposit: number;
  remaining: number;
  status: OrderStatus;
  photoLinks?: PhotoLinks;
  photoSelection?: PhotoSelection;
  retoucherId?: string;
  photoStaffId?: string;
  makeupStaffId?: string;
  stylistStaffId?: string;
  photosToEdit?: number;
  notes?: string;
  // Các vai trò sản xuất (Photo/Makeup/Stylist/Retoucher) ĐÃ được quyết toán
  // công thợ cho đơn này — chặn tính trùng tiền công khi quyết toán lần sau
  // (xem [[fkm-studio-crew-settlement]], tương đương `Da_Thanh_Toan_Cong_Tho`
  // của bản Apps Script nhưng theo dõi riêng từng vai trò thay vì 1 cờ chung).
  crewSettledRoles?: CrewSettlementRole[];
  /**
   * Giai đoạn 6 (xem [[fkm-studio-ai-chatbot-roadmap]]) — đánh dấu ĐÃ tự gửi
   * từng loại nhắc tự động cho khách qua Facebook (server cron, xem
   * server/src/automationCron.ts), để không nhắc lại trùng lặp mỗi lần cron
   * chạy. Chỉ áp dụng cho khách có `facebookId` — khách kênh khác vẫn dùng
   * luồng nhắc tay ở TaskBoard (giữ nguyên, không đụng tới `reminders`).
   * Ghi ISO datetime lúc gửi (không phải boolean) để còn biết gửi lúc nào.
   */
  reminders?: OrderReminderFlags;
}

export interface OrderReminderFlags {
  depositReminderSentAt?: string; // đã tự nhắc cọc qua Facebook lúc nào
  scheduleReminderSentAt?: string; // đã tự nhắc lịch hẹn (trước ngày chụp) lúc nào
  selectPhotoReminderSentAt?: string; // đã tự nhắc chọn ảnh lúc nào
}

/** 4 vai trò sản xuất có công thợ tính theo đơn — không gồm CSKH (lương CSKH
 * không gắn theo từng đơn chụp cụ thể). */
export type CrewSettlementRole = "Photo" | "Makeup" | "Stylist" | "Retoucher";

export interface CrewSettlementItem {
  orderId: string;
  orderCode: string;
  date: string; // ISO date của đơn
  staffId: string;
  amount: number;
  /** true nếu nhân sự "Theo ngày" và đây không phải đơn đầu tiên trong ngày
   * của họ trong đợt quyết toán này — amount = 0 để khỏi tính trùng tiền/ngày,
   * nhưng vẫn giữ dòng để truy lại đủ danh sách đơn đã gộp vào đợt quyết toán. */
  dedupedSameDay?: boolean;
}

/**
 * Sổ quyết toán công thợ — 1 dòng = 1 lần quyết toán (chọn khoảng ngày + vai
 * trò + tuỳ chọn 1 nhân sự cụ thể), giữ `items` để truy lại đúng các đơn đã
 * trả tiền công (tương đương `Thanh_Toan_Cong_Tho` + `Don_ID_List` của bản
 * Apps Script). Xem [[fkm-studio-crew-settlement]].
 */
export interface CrewSettlement {
  id: string;
  createdAt: string; // ISO datetime
  role: CrewSettlementRole;
  staffId?: string; // để trống = quyết toán cho TẤT CẢ nhân sự có vai trò này trong khoảng ngày
  fromDate: string;
  toDate: string;
  items: CrewSettlementItem[];
  total: number;
  note?: string;
}

export type TaskType =
  | "remind_deposit"
  | "remind_schedule"
  | "remind_select_photo"
  | "remind_staff_schedule"
  | "conflict";

export interface OperationTask {
  id: string;
  type: TaskType;
  orderId: string;
  // Chỉ có khi type = "remind_staff_schedule" — nhân sự cụ thể cần nhắc lịch
  // làm việc (khác đối tượng với 4 loại việc còn lại, đều nhắc KHÁCH HÀNG).
  staffId?: string;
  title: string;
  dueLabel: string;
  urgent?: boolean;
}

export type InventoryCondition = "Tốt" | "Cần giặt" | "Hư hỏng" | "Đang sửa";

export interface InventoryItem {
  id: string;
  conceptId: string;
  name: string;
  size: string;
  condition: InventoryCondition;
  rentalPrice: number;
  quantity: number;
  inUse: number;
}

export interface AddonService {
  id: string;
  name: string;
  category: "In ấn" | "Album" | "Chỉnh sửa" | "Phụ thu" | "Trang phục" | "Makeup layout" | "Khác";
  price: number;
  unit: string;
}

export type ExpenseCategory =
  | "Nguyên liệu"
  | "Quảng cáo"
  | "May đồ"
  | "Lương"
  | "Vận hành"
  | "Khác";

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  note: string;
  conceptId?: string;
}

export type MessageChannel = "facebook" | "zalo" | "sms" | "call";

export interface Message {
  id: string;
  customerId: string;
  channel: MessageChannel;
  fromCustomer: boolean;
  text: string;
  time: string; // ISO datetime
  read: boolean;
  // Giai đoạn 3 — tin này do AI tự soạn + tự gửi (không phải studio gõ tay).
  // Dùng để hiển thị nhãn "AI" ở Hội thoại, không ảnh hưởng logic gửi/nhận.
  aiGenerated?: boolean;
}

export interface ConversationThread {
  customerId: string;
  lastMessage: Message;
  unreadCount: number;
}

export interface WeatherDay {
  date: string;
  icon: "sun" | "cloud" | "rain" | "storm";
  tempLow: number;
  tempHigh: number;
  rainChance: number;
}

export interface FinanceSummaryRow {
  label: string;
  revenue: number;
  cost: number;
  profit: number;
}
