/**
 * Cấu hình kết nối Google Drive (Service Account key + Folder ID) phía
 * FRONTEND — gọi thẳng 2 route riêng GET/PUT /api/drive-config trên server,
 * KHÔNG đi qua persistence.ts/bumpDataVersion()/state mirror, đúng pattern
 * đã dùng cho Facebook (xem fbConfig.ts ở đây và server/src/driveConfig.ts
 * để biết đầy đủ lý do bảo mật + vì sao dùng Service Account thay OAuth).
 */
import { BACKEND_URL } from "./persistence";

export interface MaskedDriveConfig {
  hasServiceAccountKey: boolean;
  // Trích từ key JSON (client_email) để anh đối chiếu đã share Editor đúng
  // email chưa — không phải bí mật, server trả nguyên văn.
  serviceAccountEmail: string;
  folderId: string;
}

export interface DriveConfigPatch {
  serviceAccountKeyJson?: string;
  folderId?: string;
  clearServiceAccountKey?: boolean;
}

export async function fetchDriveConfig(): Promise<MaskedDriveConfig> {
  const res = await fetch(`${BACKEND_URL}/api/drive-config`);
  if (!res.ok) throw new Error(`Không lấy được cấu hình Google Drive (HTTP ${res.status})`);
  return (await res.json()) as MaskedDriveConfig;
}

export async function saveDriveConfig(patch: DriveConfigPatch): Promise<MaskedDriveConfig> {
  const res = await fetch(`${BACKEND_URL}/api/drive-config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Không lưu được cấu hình Google Drive (HTTP ${res.status})`);
  const data = (await res.json()) as { ok: boolean; config: MaskedDriveConfig };
  return data.config;
}
