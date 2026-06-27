/**
 * Phase 9 (xem [[fkm-studio-ai-chatbot-roadmap]]) — quản lý cấu hình 3 nhà
 * cung cấp AI (Gemini/OpenAI/DeepSeek) phía FRONTEND: API key + model + bật-
 * tắt + thứ tự ưu tiên retry/fallback (xem server/src/ai.ts:withProviderFallback).
 *
 * KHÁC với mọi settings khác trong app (vietQRSettings, reminderSettings...):
 * module này KHÔNG đi qua persistence.ts/bumpDataVersion()/state mirror, mà
 * gọi TRỰC TIẾP 2 route riêng GET/PUT /api/ai-providers trên server. Lý do:
 * GET/PUT /api/state là API CÔNG KHAI không xác thực (app.use(cors()), không
 * middleware nào) — bất kỳ ai biết URL server cũng đọc được nguyên văn. Lưu
 * API key thật vào đó sẽ lộ key ra ngoài. Xem comment đầu server/src/aiProviders.ts
 * để biết đầy đủ lý do + cách server mask key khi trả về (GET không bao giờ
 * trả nguyên văn key, chỉ vài ký tự cuối).
 *
 * Vì vậy module này không có state nội bộ kiểu singleton như aiReply.ts — mỗi
 * lần cần dữ liệu (mở trang Cài đặt) thì fetch thật từ server, không cache ở
 * localStorage (tránh vô tình lưu key thật vào trình duyệt của máy dùng chung).
 */
import { BACKEND_URL } from "./persistence";

export type AiProviderKey = "gemini" | "openai" | "deepseek";

export interface MaskedProviderConfig {
  provider: AiProviderKey;
  model: string;
  enabled: boolean;
  hasKey: boolean;
  maskedKey: string;
}

export interface AiProviderPatch {
  provider: AiProviderKey;
  apiKey?: string;
  model?: string;
  enabled?: boolean;
  clearKey?: boolean;
}

// Nhãn hiển thị + ghi chú khả năng đọc ảnh — DeepSeek loại khỏi fallback ảnh
// ở chính server (VISION_CAPABLE trong aiProviders.ts), hiển thị ghi chú ở
// đây để studio hiểu vì sao, không tưởng app thiếu sót.
export const PROVIDER_LABEL: Record<AiProviderKey, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  deepseek: "DeepSeek",
};

export const PROVIDER_NOTE: Record<AiProviderKey, string> = {
  gemini: "Đọc được ảnh khách gửi (chuyển khoản, ảnh thường).",
  openai: "Đọc được ảnh khách gửi. Ảnh được tải về và gửi dạng base64 (không gửi link Facebook thẳng) để tránh lỗi \"download error\" hay gặp ở UChat.",
  deepseek: "API DeepSeek hiện CHƯA hỗ trợ đọc ảnh (chỉ có ở chat web) — tự động bỏ qua DeepSeek khi khách gửi ảnh, dùng cho tin nhắn chữ thôi.",
};

export async function fetchAiProviders(): Promise<MaskedProviderConfig[]> {
  const res = await fetch(`${BACKEND_URL}/api/ai-providers`);
  if (!res.ok) throw new Error(`Không lấy được cấu hình AI (HTTP ${res.status})`);
  const data = (await res.json()) as { providers: MaskedProviderConfig[] };
  return data.providers;
}

export async function saveAiProviders(
  patches: AiProviderPatch[],
  order?: AiProviderKey[],
): Promise<MaskedProviderConfig[]> {
  const res = await fetch(`${BACKEND_URL}/api/ai-providers`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patches, order }),
  });
  if (!res.ok) throw new Error(`Không lưu được cấu hình AI (HTTP ${res.status})`);
  const data = (await res.json()) as { providers: MaskedProviderConfig[] };
  return data.providers;
}
