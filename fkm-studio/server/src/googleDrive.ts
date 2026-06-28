/**
 * Upload ảnh lên Google Drive (folder riêng anh đã share Editor cho service
 * account, xem driveConfig.ts) và trả về link xem trực tiếp (public,
 * "anyone with link can view") — dùng để:
 *   - Gửi ảnh qua Facebook Send API (cần URL ảnh công khai, không cần đăng
 *     nhập, xem facebook.ts sendFacebookImage).
 *   - Thêm vào danh sách `items` của Cổng chọn ảnh (`order.photoSelection`).
 *
 * KHÔNG dùng OAuth tương tác (sẽ phải xin lại quyền/refresh token) — dùng
 * JWT của Service Account, ký trực tiếp từ key JSON anh tải từ Google Cloud
 * Console. Dung lượng file tính vào quota Drive cá nhân của anh (folder
 * thuộc Drive của anh, service account chỉ được share Editor).
 */
import { google } from "googleapis";
import { Readable } from "node:stream";
import { getEffectiveDriveConfig } from "./driveConfig.js";

export class DriveNotConfiguredError extends Error {
  constructor() {
    super("drive_not_configured");
  }
}

async function getDriveClient() {
  const config = await getEffectiveDriveConfig();
  if (!config.serviceAccountKeyJson || !config.folderId) {
    throw new DriveNotConfiguredError();
  }
  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(config.serviceAccountKeyJson);
  } catch {
    throw new Error("drive_service_account_key_invalid_json");
  }
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return { drive: google.drive({ version: "v3", auth }), folderId: config.folderId };
}

export interface UploadedImage {
  fileId: string;
  // Link xem trực tiếp ảnh (dùng cho <img src>, Facebook Send API) — KHÔNG
  // phải link Drive viewer thường (drive.google.com/file/d/...), vì link đó
  // mở trang xem chứ không phải ảnh thô.
  viewUrl: string;
  // ID folder thật chứa ảnh vừa upload — bằng folder gốc nếu không có
  // `customer`, hoặc folder con riêng của khách nếu có. Trả về để
  // index.ts lưu lại vào Customer.driveFolderId (tái dùng lần sau).
  folderId: string;
}

export interface UploadCustomerContext {
  name: string;
  // Đã có sẵn từ Customer.driveFolderId (lần upload trước cho khách này) —
  // truyền vào để TÁI DÙNG, không tạo folder mới mỗi lần gửi ảnh.
  existingFolderId?: string;
}

/**
 * Upload 1 ảnh (buffer trong RAM, từ multer) lên Drive, đặt quyền "anyone
 * with link, reader", trả về link xem trực tiếp.
 *
 * Không truyền `customer` -> upload thẳng vào folder gốc đã cấu hình (xem
 * driveConfig.ts), như trước đây.
 *
 * Có truyền `customer` (theo yêu cầu của anh 2026-06-28, "tự tạo từng thư
 * mục riêng cho từng khách, tự link đúng với từng khách") -> tự tạo 1 folder
 * con tên theo khách NẰM TRONG folder gốc (nếu `existingFolderId` chưa có),
 * rồi upload ảnh vào đó. Lần gọi sau cho cùng khách thì truyền lại
 * `existingFolderId` đã lưu để khỏi tạo folder trùng.
 */
export async function uploadImageToDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  customer?: UploadCustomerContext,
): Promise<UploadedImage> {
  const { drive, folderId: rootFolderId } = await getDriveClient();

  let folderId = rootFolderId;
  if (customer) {
    if (customer.existingFolderId) {
      folderId = customer.existingFolderId;
    } else {
      const folderRes = await drive.files.create({
        requestBody: {
          name: customer.name.trim() || "Khách chưa rõ tên",
          mimeType: "application/vnd.google-apps.folder",
          parents: [rootFolderId],
        },
        fields: "id",
      });
      const newFolderId = folderRes.data.id;
      if (!newFolderId) throw new Error("drive_create_folder_failed");
      folderId = newFolderId;
    }
  }

  const res = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id",
  });
  const fileId = res.data.id;
  if (!fileId) throw new Error("drive_upload_no_file_id");

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return { fileId, viewUrl: `https://drive.google.com/uc?export=view&id=${fileId}`, folderId };
}
