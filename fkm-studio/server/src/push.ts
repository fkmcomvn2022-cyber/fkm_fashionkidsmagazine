/**
 * Phase 1 — đường ống thông báo đẩy (web push). Quản lý cặp khoá VAPID, danh
 * sách subscription (1 mục / 1 thiết bị đã bật thông báo), và hàm gửi push
 * thật tới các thiết bị đó. Đây là "đường ống" chung — Phase 2-5 (khách nhắn
 * tin, AI trả lời, xác nhận cọc, khách chọn ảnh) sẽ gọi `sendPushToAll()` ở
 * đây để bắn thông báo, không cần biết gì về cơ chế push bên dưới.
 */
import webpush from "web-push";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const VAPID_FILE = join(DATA_DIR, "vapid.json");
const SUBS_FILE = join(DATA_DIR, "subscriptions.json");

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/** Lấy cặp khoá VAPID — ưu tiên biến môi trường (khi deploy, để không mất khi
 * đĩa server bị xoá), nếu không có thì đọc/tạo file local (tiện cho dev). Cặp
 * khoá này định danh server với các dịch vụ push (FCM, Mozilla...) — phải
 * giữ ổn định, nếu đổi thì mọi thiết bị đã đăng ký sẽ phải bật lại thông báo. */
async function getOrCreateVapidKeys(): Promise<VapidKeys> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  try {
    const raw = await readFile(VAPID_FILE, "utf-8");
    return JSON.parse(raw) as VapidKeys;
  } catch {
    const keys = webpush.generateVAPIDKeys();
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(VAPID_FILE, JSON.stringify(keys, null, 2), "utf-8");
    console.log("[push] Đã tạo cặp khoá VAPID mới, lưu ở", VAPID_FILE);
    return keys;
  }
}

let vapidKeysPromise: Promise<VapidKeys> | null = null;

/** Gọi 1 lần khi server khởi động — nạp/tạo khoá VAPID và đăng ký với
 * thư viện web-push. Phải gọi trước khi dùng bất kỳ hàm khác trong file này. */
export async function initPush(): Promise<{ publicKey: string }> {
  if (!vapidKeysPromise) vapidKeysPromise = getOrCreateVapidKeys();
  const keys = await vapidKeysPromise;
  webpush.setVapidDetails("mailto:fkm.com.vn2022@gmail.com", keys.publicKey, keys.privateKey);
  return { publicKey: keys.publicKey };
}

export async function getPublicKey(): Promise<string> {
  const keys = await (vapidKeysPromise ?? getOrCreateVapidKeys());
  return keys.publicKey;
}

// Subscription thật là object PushSubscription trình duyệt trả về
// (endpoint + keys.p256dh + keys.auth) — không cần parse sâu, chỉ lưu lại
// nguyên vẹn và truyền thẳng cho webpush.sendNotification.
type PushSubscriptionJSON = { endpoint: string; keys: { p256dh: string; auth: string } };

let subsCache: PushSubscriptionJSON[] | null = null;

async function readSubs(): Promise<PushSubscriptionJSON[]> {
  if (subsCache) return subsCache;
  try {
    const raw = await readFile(SUBS_FILE, "utf-8");
    subsCache = JSON.parse(raw) as PushSubscriptionJSON[];
  } catch {
    subsCache = [];
  }
  return subsCache;
}

async function writeSubs(subs: PushSubscriptionJSON[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmpFile = `${SUBS_FILE}.tmp`;
  await writeFile(tmpFile, JSON.stringify(subs, null, 2), "utf-8");
  await rename(tmpFile, SUBS_FILE);
  subsCache = subs;
}

/** Thêm 1 subscription mới (1 thiết bị vừa bật thông báo) — dedupe theo
 * endpoint vì 1 thiết bị bật/tắt nhiều lần vẫn chỉ nên có 1 bản ghi. */
export async function addSubscription(sub: PushSubscriptionJSON): Promise<void> {
  const subs = await readSubs();
  const next = subs.filter((s) => s.endpoint !== sub.endpoint);
  next.push(sub);
  await writeSubs(next);
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const subs = await readSubs();
  await writeSubs(subs.filter((s) => s.endpoint !== endpoint));
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Gửi push tới TẤT CẢ thiết bị đã đăng ký — dùng cho thông báo dùng chung
 * (1 chủ studio, có thể bật trên nhiều thiết bị: điện thoại + máy tính).
 * Subscription hết hạn/bị trình duyệt huỷ (lỗi 404/410) sẽ tự bị xoá khỏi
 * danh sách, tránh tích lũy rác theo thời gian. */
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; removed: number }> {
  const subs = await readSubs();
  let sent = 0;
  const stillValid: PushSubscriptionJSON[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        sent += 1;
        stillValid.push(sub);
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Thiết bị đã huỷ đăng ký hoặc subscription hết hạn — bỏ khỏi danh sách.
          return;
        }
        // Lỗi khác (vd. mạng) — giữ lại subscription, có thể gửi lại được lần sau.
        stillValid.push(sub);
        console.error("[push] Gửi thất bại cho 1 subscription:", err);
      }
    })
  );

  if (stillValid.length !== subs.length) await writeSubs(stillValid);
  return { sent, removed: subs.length - stillValid.length };
}

export async function subscriptionCount(): Promise<number> {
  return (await readSubs()).length;
}
