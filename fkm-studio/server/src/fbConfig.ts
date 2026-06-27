/**
 * Cấu hình kết nối Facebook Messenger (Verify Token / App Secret / Page
 * Access Token / Page ID) — TRƯỚC bản này, 4 giá trị này chỉ đọc được qua
 * biến môi trường (FB_VERIFY_TOKEN/FB_APP_SECRET/FB_PAGE_ACCESS_TOKEN) đặt
 * trên Render Dashboard, không có ô nhập trong app (xem README.md cũ). Theo
 * yêu cầu của anh (2026-06-28) — muốn có "chỗ nhập" ngay trong app, giống
 * cách đã làm cho 3 key AI (xem aiProviders.ts) — file này áp DÚNG NGUYÊN
 * pattern bảo mật đó:
 *
 *   - Lưu vào file riêng (fb-config.json), KHÔNG đi qua state.json (GET/PUT
 *     /api/state là API công khai, không xác thực — xem comment đầu
 *     aiProviders.ts để biết đầy đủ lý do).
 *   - Chỉ đọc/ghi qua 2 route riêng GET/PUT /api/fb-config (xem index.ts).
 *   - GET KHÔNG BAO GIỜ trả nguyên văn appSecret/pageAccessToken — chỉ vài
 *     ký tự cuối (maskedAppSecret/maskedPageAccessToken). verifyToken KHÔNG
 *     cần mask (không phải bí mật thật — Facebook chỉ dùng nó để xác minh 1
 *     lần lúc khai báo webhook, tự đặt được, không phải credential cấp bởi
 *     Meta) nên trả nguyên văn để studio dễ copy dán lại vào Meta Developer.
 *   - pageId: KHÔNG bí mật (Page ID là công khai trên Facebook), trả nguyên
 *     văn. Hiện chưa được dùng trực tiếp ở logic gọi Graph API nào (Send
 *     API/Profile API chỉ cần pageAccessToken) — lưu lại chủ yếu để studio
 *     tự đối chiếu đúng Trang khi cấu hình, và dự phòng cho nhu cầu sau này.
 *
 * Vẫn giữ biến môi trường làm "mặc định ngầm" — studio đã đặt trên Render từ
 * trước (theo CLAUDE.md, server đã chạy LIVE) thì KHÔNG bị mất cấu hình khi
 * lên bản này; giá trị nhập qua UI (nếu có) được ưu tiên hơn.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const FILE = join(DATA_DIR, "fb-config.json");

export interface FbConfig {
  verifyToken: string;
  appSecret: string;
  pageAccessToken: string;
  pageId: string;
}

const EMPTY: FbConfig = { verifyToken: "", appSecret: "", pageAccessToken: "", pageId: "" };

let cached: FbConfig | null = null;

async function load(): Promise<FbConfig> {
  if (cached) return cached;
  try {
    const raw = await readFile(FILE, "utf-8");
    const saved = JSON.parse(raw) as Partial<FbConfig>;
    cached = { ...EMPTY, ...saved };
  } catch {
    cached = { ...EMPTY };
  }
  return cached;
}

async function persist(config: FbConfig): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(config), "utf-8");
  await rename(tmp, FILE);
  cached = config;
}

// Mặc định ngầm từ biến môi trường Render (cách deploy cũ) — UI ưu tiên hơn
// khi studio đã nhập (xem getEffectiveFbConfig).
const ENV_FALLBACK: FbConfig = {
  verifyToken: process.env.FB_VERIFY_TOKEN ?? "",
  appSecret: process.env.FB_APP_SECRET ?? "",
  pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN ?? "",
  pageId: process.env.FB_PAGE_ID ?? "",
};

/** Giá trị THẬT dùng để gọi webhook/Graph API — gọi ở index.ts mỗi lần cần
 * (không cache ở module-level const như trước, vì giờ có thể đổi qua UI bất
 * kỳ lúc nào mà không cần redeploy lại server). */
export async function getEffectiveFbConfig(): Promise<FbConfig> {
  const saved = await load();
  return {
    verifyToken: saved.verifyToken || ENV_FALLBACK.verifyToken,
    appSecret: saved.appSecret || ENV_FALLBACK.appSecret,
    pageAccessToken: saved.pageAccessToken || ENV_FALLBACK.pageAccessToken,
    pageId: saved.pageId || ENV_FALLBACK.pageId,
  };
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export interface MaskedFbConfig {
  verifyToken: string; // không mask — xem comment đầu file
  pageId: string; // không mask — không phải bí mật
  hasAppSecret: boolean;
  maskedAppSecret: string;
  hasPageAccessToken: boolean;
  maskedPageAccessToken: string;
}

export async function getMaskedFbConfig(): Promise<MaskedFbConfig> {
  const c = await getEffectiveFbConfig();
  return {
    verifyToken: c.verifyToken,
    pageId: c.pageId,
    hasAppSecret: !!c.appSecret,
    maskedAppSecret: maskSecret(c.appSecret),
    hasPageAccessToken: !!c.pageAccessToken,
    maskedPageAccessToken: maskSecret(c.pageAccessToken),
  };
}

export interface FbConfigPatch {
  verifyToken?: string;
  appSecret?: string;
  pageAccessToken?: string;
  pageId?: string;
  clearAppSecret?: boolean;
  clearPageAccessToken?: boolean;
}

/**
 * Cập nhật cấu hình — `appSecret`/`pageAccessToken` trong patch CHỈ ghi đè
 * khi là chuỗi không rỗng (UI không nhận lại giá trị thật để gửi lại nguyên
 * văn, xem getMaskedFbConfig) — tránh "không gõ gì, bấm lưu ô khác" lại xoá
 * mất token cũ. Muốn xoá hẳn thì gửi `clearAppSecret`/`clearPageAccessToken:
 * true` rõ ràng. `verifyToken`/`pageId` không bí mật nên ghi đè trực tiếp khi
 * có gửi lên (không cần cờ "clear" riêng — gửi chuỗi rỗng là xoá luôn).
 */
export async function updateFbConfig(patch: FbConfigPatch): Promise<void> {
  const config = await load();
  if (patch.clearAppSecret) config.appSecret = "";
  else if (typeof patch.appSecret === "string" && patch.appSecret.trim()) config.appSecret = patch.appSecret.trim();
  if (patch.clearPageAccessToken) config.pageAccessToken = "";
  else if (typeof patch.pageAccessToken === "string" && patch.pageAccessToken.trim())
    config.pageAccessToken = patch.pageAccessToken.trim();
  if (typeof patch.verifyToken === "string") config.verifyToken = patch.verifyToken.trim();
  if (typeof patch.pageId === "string") config.pageId = patch.pageId.trim();
  await persist(config);
}
