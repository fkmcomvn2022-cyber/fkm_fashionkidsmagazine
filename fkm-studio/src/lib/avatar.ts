import { BACKEND_URL } from "@/lib/persistence";

/**
 * Link ảnh đại diện để hiển thị cho 1 khách.
 *
 * Khách Facebook (có facebookId/PSID): KHÔNG dùng thẳng link CDN của Facebook
 * (hay bị chặn hotlink/hết hạn/CORS khi hiện trên web), mà trỏ vào PROXY ở
 * server `/api/avatar/:psid` — server tự gọi Graph API `/{psid}/picture` kèm
 * Page Access Token (App cá nhân không qua App Review vẫn lấy được ở tầng
 * server), rồi stream ảnh "sạch" về. Nếu khách không có ảnh thật (silhouette)
 * thì proxy trả 404 -> component Avatar tự rơi về chữ cái đầu. Xem
 * [[fkm-studio-facebook-config]].
 *
 * Khách không phải Facebook: dùng đúng `avatar` đã lưu (nếu có).
 */
/**
 * Link ảnh để hiển thị trong hội thoại (ảnh khách gửi đến / studio gửi đi).
 *  - data URL (ảnh thu nhỏ studio tự gửi) -> dùng thẳng.
 *  - link CDN Facebook (ảnh khách gửi qua Messenger) -> đi qua PROXY server
 *    `/api/fb-image` vì nhúng thẳng hay bị chặn hotlink/CORS/hết hạn trên web.
 *  - link khác (Drive...) -> dùng thẳng.
 */
export function chatImageSrc(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  if (/^https?:\/\//.test(url) && /(fbcdn\.net|fbsbx\.com|facebook\.com)/.test(url)) {
    return `${BACKEND_URL}/api/fb-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function customerAvatarSrc(c: { facebookId?: string; avatar?: string }): string | undefined {
  // ƯU TIÊN ảnh chủ studio tự đặt tay (sửa hồ sơ khách) — kể cả khách Facebook.
  if (c.avatar) return c.avatar;
  // Khách Facebook chưa có ảnh tự đặt: lấy qua proxy server.
  if (c.facebookId) return `${BACKEND_URL}/api/avatar/${encodeURIComponent(c.facebookId)}`;
  return undefined;
}
