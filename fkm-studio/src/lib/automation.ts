/**
 * Giai đoạn 6 (xem [[fkm-studio-ai-chatbot-roadmap]]) — danh sách "luật tự
 * động" hiển thị ở màn Automation (chỉ bản desktop/Tauri, xem
 * src/lib/platform.ts). Đây KHÔNG phải canvas node kéo thả kiểu UChat — là
 * danh sách thẻ "Khi [trigger] + [condition] thì [action]" kèm hình mũi tên
 * tĩnh, vì các automation thật trong app đều là CHUỖI THẲNG (không nhánh) —
 * phần "có nhánh" thật sự (AI tự quyết định gọi nghiệp vụ nào khi trả lời 1
 * tin nhắn cụ thể) đã do Gemini function-calling tự xử lý (xem
 * server/src/ai.ts), không cần thiết kế thêm ở đây.
 *
 * Mỗi rule chỉ có 1 cờ enabled — bật/tắt được đồng bộ lên backend qua
 * persistAll() (PUT /api/state), và server (server/src/automationCron.ts +
 * server/src/ai.ts) đọc lại đúng cờ này để quyết định có tự làm hay không.
 * Cùng pattern với aiAutoReplySettings (xem [[fkm-studio-data-write-path]]).
 */
export type AutomationRuleKey =
  | "auto_confirm_payment_screenshot"
  | "auto_create_order_from_chat"
  | "auto_remind_deposit"
  | "auto_remind_schedule"
  | "auto_remind_select_photo";

export interface AutomationRule {
  key: AutomationRuleKey;
  enabled: boolean;
  label: string;
  trigger: string;
  condition: string;
  action: string;
}

export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  {
    key: "auto_confirm_payment_screenshot",
    enabled: true,
    label: "Tự xác nhận đã cọc qua ảnh chuyển khoản",
    trigger: "Khách gửi 1 ảnh qua Facebook Messenger",
    condition: "AI (Gemini) nhìn ảnh, nhận diện là ảnh chuyển khoản/biên lai",
    action: "Tự đánh dấu đơn đang \"Chưa cọc\" gần nhất của khách sang \"Đã cọc\" + nhắn xác nhận lại khách",
  },
  {
    key: "auto_create_order_from_chat",
    enabled: true,
    label: "Tự tạo đơn khi khách cho đủ thông tin",
    trigger: "Khách nhắn tin (chữ) qua Facebook Messenger",
    condition: "AI thu thập đủ họ tên + SĐT + ngày/giờ muốn chụp trong hội thoại",
    action: "Tự tạo đơn hàng mới (trạng thái \"Chưa cọc\"), rồi tự gửi tin nhắc cọc kèm mã QR",
  },
  {
    key: "auto_remind_deposit",
    enabled: true,
    label: "Tự nhắc cọc",
    trigger: "Quét định kỳ (mỗi giờ)",
    condition: "Đơn ở trạng thái \"Chưa cọc\", khách có Facebook, chưa từng được tự nhắc",
    action: "Tự gửi tin nhắc cọc kèm mã QR qua Facebook",
  },
  {
    key: "auto_remind_schedule",
    enabled: true,
    label: "Tự nhắc lịch hẹn",
    trigger: "Quét định kỳ (mỗi giờ)",
    condition: "Còn đúng số ngày cấu hình (mục \"Nhắc lịch hẹn\" ở Thiết lập) tới ngày chụp, khách có Facebook, chưa từng được tự nhắc",
    action: "Tự gửi tin nhắc lịch hẹn qua Facebook",
  },
  {
    key: "auto_remind_select_photo",
    enabled: true,
    label: "Tự nhắc chọn ảnh",
    trigger: "Quét định kỳ (mỗi giờ)",
    condition: "Studio đã dán link ảnh vào cổng chọn ảnh của đơn, khách có Facebook, chưa từng được tự nhắc",
    action: "Tự gửi tin nhắc chọn ảnh kèm link cổng chọn ảnh qua Facebook",
  },
];

export interface AutomationSettings {
  rules: AutomationRule[];
}

export let automationSettings: AutomationSettings = {
  rules: DEFAULT_AUTOMATION_RULES,
};

export function setAutomationSettings(next: AutomationSettings) {
  automationSettings = next;
}

export function isAutomationEnabled(key: AutomationRuleKey, settings: AutomationSettings = automationSettings): boolean {
  return settings.rules.find((r) => r.key === key)?.enabled ?? true;
}
