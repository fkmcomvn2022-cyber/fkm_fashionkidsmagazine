/**
 * Cấu hình kết nối Facebook Messenger (Verify Token/App Secret/Page Access
 * Token/Page ID) phía FRONTEND — gọi thẳng 2 route riêng GET/PUT
 * /api/fb-config trên server, KHÔNG đi qua persistence.ts/bumpDataVersion()/
 * state mirror, đúng pattern đã dùng cho key AI (xem aiProviders.ts ở đây và
 * server/src/fbConfig.ts để biết đầy đủ lý do bảo mật).
 */
import { BACKEND_URL } from "./persistence";

export interface MaskedFbConfig {
  verifyToken: string;
  pageId: string;
  hasAppSecret: boolean;
  maskedAppSecret: string;
  hasPageAccessToken: boolean;
  maskedPageAccessToken: string;
}

export interface FbConfigPatch {
  verifyToken?: string;
  appSecret?: string;
  pageAccessToken?: string;
  pageId?: string;
  clearAppSecret?: boolean;
  clearPageAccessToken?: boolean;
}

export async function fetchFbConfig(): Promise<MaskedFbConfig> {
  const res = await fetch(`${BACKEND_URL}/api/fb-config`);
  if (!res.ok) throw new Error(`Không lấy được cấu hình Facebook (HTTP ${res.status})`);
  return (await res.json()) as MaskedFbConfig;
}

export async function saveFbConfig(patch: FbConfigPatch): Promise<MaskedFbConfig> {
  const res = await fetch(`${BACKEND_URL}/api/fb-config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Không lưu được cấu hình Facebook (HTTP ${res.status})`);
  const data = (await res.json()) as { ok: boolean; config: MaskedFbConfig };
  return data.config;
}
