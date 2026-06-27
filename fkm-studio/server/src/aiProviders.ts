/**
 * Cấu hình 3 nhà cung cấp AI (Gemini/OpenAI/DeepSeek) cho tính năng AI tự trả
 * lời khách (xem ai.ts) — API key + model + bật/tắt, dùng làm danh sách
 * retry/fallback theo đúng thứ tự lưu trong mảng (xem getOrderedAvailableProviders).
 *
 * QUYẾT ĐỊNH BẢO MẬT QUAN TRỌNG: state.json (GET/PUT /api/state, xem store.ts
 * + index.ts) là API CÔNG KHAI — `app.use(cors())` không giới hạn origin và
 * không có middleware xác thực nào trước route đó. Bất kỳ ai biết URL server
 * (vd link Render) cũng GET được nguyên văn toàn bộ state. Vì vậy KHÔNG được
 * lưu API key thật vào state mirror như các cài đặt khác (vietQRSettings,
 * reminderSettings...) — phải tách hẳn sang file riêng (ai-providers.json),
 * chỉ đọc/ghi qua 2 route riêng (GET/PUT /api/ai-providers, xem index.ts), và
 * GET KHÔNG BAO GIỜ trả nguyên văn key — chỉ trả vài ký tự cuối để hiển thị
 * dạng "đã lưu ••••xxxx" (xem getMaskedProviders).
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const FILE = join(DATA_DIR, "ai-providers.json");

export type AiProviderKey = "gemini" | "openai" | "deepseek";

export interface AiProviderConfig {
  provider: AiProviderKey;
  apiKey: string;
  model: string;
  enabled: boolean;
}

// Thứ tự trong mảng = thứ tự ưu tiên thử khi trả lời khách (retry hết 1 nhà
// rồi mới sang nhà kế tiếp, xem withProviderFallback ở ai.ts). Mặc định chỉ
// Gemini bật (giữ đúng hành vi cũ trước khi có UI này) — OpenAI/DeepSeek
// studio tự bật sau khi nhập key.
const DEFAULTS: AiProviderConfig[] = [
  { provider: "gemini", apiKey: "", model: "gemini-2.5-flash", enabled: true },
  { provider: "openai", apiKey: "", model: "gpt-4o-mini", enabled: false },
  { provider: "deepseek", apiKey: "", model: "deepseek-chat", enabled: false },
];

let cached: AiProviderConfig[] | null = null;

async function load(): Promise<AiProviderConfig[]> {
  if (cached) return cached;
  try {
    const raw = await readFile(FILE, "utf-8");
    const saved = JSON.parse(raw) as AiProviderConfig[];
    // Hợp nhất với DEFAULTS — đảm bảo luôn đủ 3 provider dù file cũ thiếu (vd
    // nếu sau này thêm nhà cung cấp mới, studio không cần xoá file cũ).
    cached = DEFAULTS.map((d) => saved.find((s) => s.provider === d.provider) ?? d);
  } catch {
    cached = DEFAULTS.map((d) => ({ ...d }));
  }
  return cached;
}

async function persist(configs: AiProviderConfig[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(configs), "utf-8");
  await rename(tmp, FILE);
  cached = configs;
}

// Vẫn hỗ trợ biến môi trường làm "mặc định ngầm" cho Gemini — đúng cách deploy
// cũ trước khi có UI này (server/.env.example). Studio đã đặt GEMINI_API_KEY
// trên Render thì AI vẫn chạy ngay, không cần cấu hình lại qua UI; nếu studio
// nhập key qua UI thì key UI được ưu tiên hơn (xem getEffectiveProviders).
const ENV_FALLBACK: Partial<Record<AiProviderKey, { apiKey?: string; model?: string }>> = {
  gemini: { apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL },
};

async function getEffectiveProviders(): Promise<AiProviderConfig[]> {
  const configs = await load();
  return configs.map((c) => {
    const fallback = ENV_FALLBACK[c.provider];
    return {
      ...c,
      apiKey: c.apiKey || fallback?.apiKey || "",
      model: c.model || fallback?.model || c.model,
    };
  });
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 4) return "••••";
  return `••••${key.slice(-4)}`;
}

export interface MaskedProviderConfig {
  provider: AiProviderKey;
  model: string;
  enabled: boolean;
  hasKey: boolean;
  maskedKey: string;
}

/** Dữ liệu trả về cho UI — KHÔNG bao giờ chứa apiKey thật (xem comment đầu file). */
export async function getMaskedProviders(): Promise<MaskedProviderConfig[]> {
  const configs = await getEffectiveProviders();
  return configs.map((c) => ({
    provider: c.provider,
    model: c.model,
    enabled: c.enabled,
    hasKey: !!c.apiKey,
    maskedKey: maskKey(c.apiKey),
  }));
}

export interface AiProviderPatch {
  provider: AiProviderKey;
  apiKey?: string;
  model?: string;
  enabled?: boolean;
  clearKey?: boolean;
}

/**
 * Cập nhật cấu hình — `apiKey` trong patch CHỈ ghi đè khi là chuỗi không rỗng,
 * vì UI không bao giờ nhận lại key thật để gửi lại nguyên văn (xem
 * getMaskedProviders) — tránh việc "không gõ gì, bấm lưu các ô khác" lại xoá
 * mất key cũ. Muốn xoá hẳn key thì gửi `clearKey: true` rõ ràng.
 *
 * Tiện dụng: nếu patch gửi 1 key mới mà không nói rõ `enabled`, tự bật luôn
 * provider đó — studio nhập key thường là để DÙNG NGAY, không cần thêm 1
 * bước tự đi bật toggle riêng.
 */
export async function updateProviders(patches: AiProviderPatch[]): Promise<void> {
  const configs = await load();
  for (const patch of patches) {
    const cfg = configs.find((c) => c.provider === patch.provider);
    if (!cfg) continue;
    const gotNewKey = typeof patch.apiKey === "string" && patch.apiKey.trim().length > 0;
    if (patch.clearKey) cfg.apiKey = "";
    else if (gotNewKey) cfg.apiKey = patch.apiKey!.trim();
    if (typeof patch.model === "string" && patch.model.trim()) cfg.model = patch.model.trim();
    if (typeof patch.enabled === "boolean") cfg.enabled = patch.enabled;
    else if (gotNewKey) cfg.enabled = true;
  }
  await persist(configs);
}

/** Đổi thứ tự ưu tiên (kéo-thả ở UI) — `order` là danh sách provider theo thứ
 * tự mới mong muốn; provider nào bị thiếu trong `order` (an toàn nếu UI gửi
 * sót) được giữ nguyên, xếp vào cuối. */
export async function reorderProviders(order: AiProviderKey[]): Promise<void> {
  const configs = await load();
  const reordered = order.map((p) => configs.find((c) => c.provider === p)).filter((c): c is AiProviderConfig => !!c);
  for (const c of configs) if (!reordered.includes(c)) reordered.push(c);
  await persist(reordered);
}

// API DeepSeek hiện CHƯA hỗ trợ ảnh (chỉ có ở chat web, không có ở endpoint
// API) — đúng với điều anh gặp ở UChat ("deepseek thì không đọc được"). Gemini
// và OpenAI đều đọc ảnh được (gửi base64, không gửi link Facebook thẳng — xem
// comment ở ai.ts vì sao tránh được lỗi "download error" của OpenAI).
const VISION_CAPABLE: AiProviderKey[] = ["gemini", "openai"];

/** Danh sách provider khả dụng (có key + đang bật), đúng thứ tự ưu tiên đã
 * lưu — lọc thêm theo khả năng đọc ảnh khi gọi cho nhu cầu ảnh. */
export async function getOrderedAvailableProviders(capability?: "vision"): Promise<AiProviderConfig[]> {
  const configs = await getEffectiveProviders();
  return configs.filter((c) => c.enabled && c.apiKey && (capability !== "vision" || VISION_CAPABLE.includes(c.provider)));
}
