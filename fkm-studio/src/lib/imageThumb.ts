/**
 * Tạo data URL ảnh THU NHỎ (JPEG nén) từ 1 File ảnh, ngay trên trình duyệt —
 * KHÔNG cần upload lên Google Drive. Dùng để:
 *  - Hiển thị lại ảnh vừa gửi trong hội thoại (ảnh GỐC vẫn gửi nguyên cho khách
 *    qua Facebook; thumbnail chỉ để xem lại trong app, gọn nhẹ khi lưu).
 *  - Đặt ảnh đại diện khách (sửa hồ sơ) mà không phụ thuộc Drive.
 * maxDim = cạnh dài tối đa (px), quality 0..1. Lỗi giải mã thì trả về data URL
 * gốc (vẫn dùng được, chỉ là không thu nhỏ).
 */
export async function fileToThumbnailDataUrl(file: File, maxDim = 360, quality = 0.6): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("decode_failed"));
      im.src = dataUrl;
    });
    let width = img.width;
    let height = img.height;
    if (width >= height && width > maxDim) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else if (height > maxDim) {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}
