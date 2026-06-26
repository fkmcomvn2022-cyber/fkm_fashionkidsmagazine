/**
 * Lưu trữ state phía server — bản JSON mirror của đúng `PersistedSnapshot` mà
 * frontend đang lưu vào localStorage (xem fkm-studio/src/lib/persistence.ts).
 * Đây là bước nền (Phase 0) để có 1 backend thật chạy 24/7, chưa có database
 * quan hệ — dữ liệu nhỏ (1 studio), 1 file JSON là đủ và đơn giản để bắt đầu.
 * Sau này nếu cần (nhiều studio, dữ liệu lớn) thì đổi sang Postgres/SQLite mà
 * không cần đổi API phía trên (GET/PUT /api/state).
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const STATE_FILE = join(DATA_DIR, "state.json");

// Không ràng buộc shape cụ thể ở server — frontend là nguồn quyết định shape
// thật (PersistedSnapshot), server chỉ lưu/trả lại nguyên vẹn. Tránh phải
// đồng bộ type giữa 2 project riêng (frontend Vite app vs server Node).
export type StateSnapshot = Record<string, unknown>;

let cached: StateSnapshot | null = null;

export async function readState(): Promise<StateSnapshot | null> {
  if (cached) return cached;
  try {
    const raw = await readFile(STATE_FILE, "utf-8");
    cached = JSON.parse(raw) as StateSnapshot;
    return cached;
  } catch {
    return null; // chưa từng lưu, hoặc file lỗi -> để frontend tự dùng localStorage
  }
}

/** Ghi atomic (viết ra file tạm rồi rename) để tránh hỏng file nếu server bị
 * tắt giữa lúc ghi — quan trọng vì đây sẽ là nguồn dữ liệu thật duy nhất phía
 * server khi các webhook (Phase 2+) bắt đầu viết vào cùng state này. */
export async function writeState(next: StateSnapshot): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmpFile = `${STATE_FILE}.tmp`;
  await writeFile(tmpFile, JSON.stringify(next), "utf-8");
  await rename(tmpFile, STATE_FILE);
  cached = next;
}
