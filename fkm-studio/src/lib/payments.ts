// Cấu hình tài khoản nhận tiền (VietQR) — CHƯA hardcode tài khoản của riêng ai,
// để app có thể chuyển giao cho studio/người dùng khác mà chỉ cần đổi ở đây
// (qua màn Thiết lập), không cần sửa code. Cùng pattern mutable module-array
// như `orders`/`customers` (xem memory fkm-studio-data-write-path) và
// `breakWindowSettings` trong scheduling.ts.
import { bankByBin } from "@/data/banks";

export interface VietQRSettings {
  bankBin: string; // "" = chưa cài đặt
  accountNumber: string;
  accountName: string;
}

export let vietQRSettings: VietQRSettings = {
  bankBin: "",
  accountNumber: "",
  accountName: "",
};

export function setVietQRSettings(next: VietQRSettings) {
  vietQRSettings = next;
}

export function isVietQRConfigured(s: VietQRSettings = vietQRSettings): boolean {
  return Boolean(s.bankBin && s.accountNumber.trim() && s.accountName.trim());
}

// VietQR yêu cầu accountName không dấu, in hoa (theo đúng tên trên thẻ ngân hàng).
// Tự chuẩn hoá để người dùng gõ có dấu vẫn ra QR đúng.
export function toVietQRName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toUpperCase()
    .trim();
}

/**
 * Sinh URL ảnh QR thật qua img.vietqr.io (Quick Link API, không cần API key).
 * Trả về null nếu chưa cài đặt tài khoản — màn hình gọi hàm này phải tự xử lý
 * placeholder/cảnh báo, không được giả định luôn có QR.
 */
export function buildVietQRUrl(amount?: number, addInfo?: string, s: VietQRSettings = vietQRSettings): string | null {
  if (!isVietQRConfigured(s)) return null;
  const params = new URLSearchParams();
  if (amount && amount > 0) params.set("amount", String(Math.round(amount)));
  if (addInfo) params.set("addInfo", addInfo);
  if (s.accountName) params.set("accountName", toVietQRName(s.accountName));
  const qs = params.toString();
  return `https://img.vietqr.io/image/${s.bankBin}-${s.accountNumber.trim()}-compact2.png${qs ? `?${qs}` : ""}`;
}

export function vietQRBankLabel(s: VietQRSettings = vietQRSettings): string {
  const bank = bankByBin(s.bankBin);
  return bank?.shortName ?? "";
}
