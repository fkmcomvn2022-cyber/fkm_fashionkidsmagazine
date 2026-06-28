/**
 * Cấu hình Google Drive (Service Account) — dùng để upload ảnh studio gửi
 * cho khách (nút "Gửi ảnh" trong Chat, kéo-thả ảnh vào Cổng chọn ảnh) và lấy
 * link công khai (anyone-with-link) gửi qua Facebook Send API.
 *
 * Theo quyết định của anh (2026-06-28) — dùng Drive THƯỜNG (free 15GB) của
 * anh, không mua Google Workspace, không dùng OAuth tương tác (sẽ phải xin
 * lại quyền/refresh token định kỳ). Thay vào đó dùng SERVICE ACCOUNT: anh tạo
 * 1 service account trong Google Cloud Console, share quyền Editor 1 folder
 * trong Drive cá nhân cho email của service account đó — server dùng key
 * JSON của service account để upload thẳng vào folder đó, dung lượng tính
 * vào quota Drive của anh (service account dùng trên tài khoản cá nhân không
 * có quota riêng).
 *
 * Áp đúng pattern bảo mật đã dùng cho Facebook/AI provider config (xem
 * fbConfig.ts/aiProviders.ts): lưu vào file riêng (drive-config.json),
 * KHÔNG đi qua state.json (route công khai không xác thực). Chỉ đọc/ghi qua
 * GET/PUT /api/drive-config (xem index.ts). GET không trả nguyên văn key —
 * chỉ báo đã lưu/chưa lưu.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const FILE = join(DATA_DIR, "drive-config.json");

export interface DriveConfig {
  serviceAccountKeyJson: string; // nguyên văn file JSON key tải từ Google Cloud Console
  folderId: string; // ID folder trong Drive của anh đã share Editor cho service account
}

const EMPTY: DriveConfig = { serviceAccountKeyJson: "", folderId: "" };

let cached: DriveConfig | null = null;

async function load(): Promise<DriveConfig> {
  if (cached) return cached;
  try {
    const raw = await readFile(FILE, "utf-8");
    const saved = JSON.parse(raw) as Partial<DriveConfig>;
    cached = { ...EMPTY, ...saved };
  } catch {
    cached = { ...EMPTY };
  }
  return cached;
}

async function persist(config: DriveConfig): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(config), "utf-8");
  await rename(tmp, FILE);
  cached = config;
}

// Mặc định ngầm từ biến môi trường (deploy trên Render có thể đặt sẵn) — UI
// nhập trong app vẫn được ưu tiên hơn nếu có.
const ENV_FALLBACK: DriveConfig = {
  serviceAccountKeyJson: process.env.DRIVE_SERVICE_ACCOUNT_KEY ?? "",
  folderId: process.env.DRIVE_FOLDER_ID ?? "",
};

/** Giá trị THẬT dùng để gọi Drive API — gọi mỗi lần cần (không cache ở
 * module-level const, vì có thể đổi qua UI bất kỳ lúc nào không cần redeploy). */
export async function getEffectiveDriveConfig(): Promise<DriveConfig> {
  const saved = await load();
  return {
    serviceAccountKeyJson: saved.serviceAccountKeyJson || ENV_FALLBACK.serviceAccountKeyJson,
    folderId: saved.folderId || ENV_FALLBACK.folderId,
  };
}

export interface MaskedDriveConfig {
  hasServiceAccountKey: boolean;
  serviceAccountEmail: string; // trích từ key JSON (client_email) để studio đối chiếu đã share đúng email chưa — không bí mật
  folderId: string; // không bí mật, trả nguyên văn
}

export async function getMaskedDriveConfig(): Promise<MaskedDriveConfig> {
  const c = await getEffectiveDriveConfig();
  let serviceAccountEmail = "";
  if (c.serviceAccountKeyJson) {
    try {
      const parsed = JSON.parse(c.serviceAccountKeyJson) as { client_email?: string };
      serviceAccountEmail = parsed.client_email ?? "";
    } catch {
      // key dán vào không phải JSON hợp lệ — để rỗng, UI sẽ báo lỗi khi lưu
    }
  }
  return {
    hasServiceAccountKey: !!c.serviceAccountKeyJson,
    serviceAccountEmail,
    folderId: c.folderId,
  };
}

export interface DriveConfigPatch {
  serviceAccountKeyJson?: string;
  folderId?: string;
  clearServiceAccountKey?: boolean;
}

/**
 * Cập nhật cấu hình — `serviceAccountKeyJson` CHỈ ghi đè khi là chuỗi không
 * rỗng (UI không nhận lại key thật để gửi lại nguyên văn) — tránh "không gõ
 * gì, bấm lưu" lại xoá mất key cũ. Muốn xoá hẳn thì gửi `clearServiceAccountKey:
 * true` rõ ràng. `folderId` không bí mật nên ghi đè trực tiếp khi có gửi lên.
 */
export async function updateDriveConfig(patch: DriveConfigPatch): Promise<void> {
  const config = await load();
  if (patch.clearServiceAccountKey) config.serviceAccountKeyJson = "";
  else if (typeof patch.serviceAccountKeyJson === "string" && patch.serviceAccountKeyJson.trim())
    config.serviceAccountKeyJson = patch.serviceAccountKeyJson.trim();
  if (typeof patch.folderId === "string") config.folderId = patch.folderId.trim();
  await persist(config);
}
