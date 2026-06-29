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
export function customerAvatarSrc(c: { facebookId?: string; avatar?: string }): string | undefined {
  // ƯU TIÊN ảnh chủ studio tự đặt tay (sửa hồ sơ khách) — kể cả khách Facebook.
  if (c.avatar) return c.avatar;
  // Khách Facebook chưa có ảnh tự đặt: lấy qua proxy server.
  if (c.facebookId) return `${BACKEND_URL}/api/avatar/${encodeURIComponent(c.facebookId)}`;
  return undefined;
}
