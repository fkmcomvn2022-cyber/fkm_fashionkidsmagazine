/**
 * Phase 1 — thông báo đẩy thật (web push), phía trình duyệt. Đăng ký service
 * worker (public/sw.js), xin quyền thông báo, đăng ký nhận push qua backend
 * (server/src/push.ts). Sau khi đăng ký, thiết bị nhận được thông báo dù
 * không mở app/tab nào — đây là "đường ống" mà Phase 2-5 (khách nhắn tin, AI
 * trả lời, xác nhận cọc, khách chọn ảnh) sẽ bắn thông báo qua.
 */
import { BACKEND_URL } from "@/lib/persistence";

export type PushSupportState = "unsupported" | "denied" | "subscribed" | "unsubscribed";

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/** Chuyển khoá VAPID dạng base64url (backend trả về) sang Uint8Array —
 * format mà PushManager.subscribe() yêu cầu. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js");
}

/** Trạng thái hiện tại — dùng để hiển thị đúng UI (đã bật/chưa bật/bị chặn
 * quyền/không hỗ trợ) mà không cần thử subscribe trước. */
export async function getPushState(): Promise<PushSupportState> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? "subscribed" : "unsubscribed";
  } catch {
    return "unsubscribed";
  }
}

/** Bật thông báo: xin quyền, đăng ký service worker, lấy khoá VAPID từ
 * backend, subscribe, rồi gửi subscription lên backend để lưu lại. Trả về
 * false nếu người dùng từ chối quyền hoặc backend chưa chạy — gọi nơi dùng
 * tự hiển thị thông báo phù hợp, không throw để khỏi phải try/catch lồng. */
export async function subscribeToPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "permission_denied" };

  try {
    const reg = await registerServiceWorker();
    const keyRes = await fetch(`${BACKEND_URL}/api/push/public-key`);
    if (!keyRes.ok) return { ok: false, reason: "backend_unreachable" };
    const { publicKey } = (await keyRes.json()) as { publicKey: string };

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // TS (lib.dom strict typed-array generics) muốn ArrayBufferView<ArrayBuffer>
      // chính xác — ép kiểu qua BufferSource là cách chuẩn để khớp PushManager
      // API thật (chạy đúng ở runtime, chỉ là kiểu generic mới của TS quá chặt).
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const saveRes = await fetch(`${BACKEND_URL}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!saveRes.ok) return { ok: false, reason: "backend_unreachable" };
    return { ok: true };
  } catch (err) {
    console.warn("Không bật được thông báo đẩy:", err);
    return { ok: false, reason: "backend_unreachable" };
  }
}

/** Tắt thông báo: huỷ subscription ở trình duyệt + báo backend xoá. */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch(`${BACKEND_URL}/api/push/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    }).catch(() => {});
  } catch (err) {
    console.warn("Không tắt được thông báo đẩy:", err);
  }
}

/** Gửi 1 thông báo thử tới mọi thiết bị đã bật — dùng để xác nhận đường ống
 * hoạt động thật (xem nút ở Cài đặt). */
export async function sendTestNotification(): Promise<{ ok: boolean; sent?: number }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/push/test`, { method: "POST" });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { sent: number };
    return { ok: true, sent: data.sent };
  } catch {
    return { ok: false };
  }
}
