/**
 * Upload 1 ảnh lên Google Drive qua backend (POST /api/upload-image,
 * multipart) — dùng chung cho nút "Gửi ảnh"/kéo-thả ở ChatPage và
 * OrderDetailSheet. Trả về link xem trực tiếp (đã set quyền công khai), xem
 * server/src/googleDrive.ts.
 */
import { BACKEND_URL } from "@/lib/persistence";

export class UploadImageError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`${BACKEND_URL}/api/upload-image`, { method: "POST", body: formData });
  if (!res.ok) {
    let code = "upload_failed";
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) code = json.error;
    } catch {
      // ignore — body không phải JSON
    }
    throw new UploadImageError(code);
  }
  const json = (await res.json()) as { ok: boolean; url?: string };
  if (!json.ok || !json.url) throw new UploadImageError("upload_failed");
  return json.url;
}

/** Thông báo lỗi dễ hiểu cho studio, tuỳ mã lỗi backend trả về. */
export function uploadImageErrorMessage(err: unknown): string {
  if (err instanceof UploadImageError && err.code === "drive_not_configured") {
    return "Chưa kết nối Google Drive — vào Trung tâm Dữ liệu để cấu hình trước.";
  }
  return "Không gửi được ảnh, thử lại sau.";
}
