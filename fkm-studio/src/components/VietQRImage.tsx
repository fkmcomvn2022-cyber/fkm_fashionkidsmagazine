import { buildVietQRUrl, isVietQRConfigured } from "@/lib/payments";
import { QRCodeMock } from "@/components/QRCodeMock";

interface VietQRImageProps {
  amount?: number;
  addInfo?: string;
  size?: number;
}

/**
 * Mã QR thanh toán thật, sinh qua VietQR Quick Link (img.vietqr.io, không cần API key).
 * Nếu studio chưa cài tài khoản nhận tiền trong Thiết lập, rơi về QRCodeMock + cảnh báo
 * thay vì hiện QR giả mà không nói gì — tránh thu nhầm vào tài khoản không tồn tại.
 */
export function VietQRImage({ amount, addInfo, size = 180 }: VietQRImageProps) {
  if (!isVietQRConfigured()) {
    return (
      <div className="flex flex-col items-center gap-2">
        <QRCodeMock seed={addInfo ?? "demo"} size={size} />
        <p className="text-[11px] text-danger text-center max-w-[220px]">
          Chưa cài tài khoản nhận tiền — vào Thiết lập → Thanh toán để cài VietQR thật
        </p>
      </div>
    );
  }

  const url = buildVietQRUrl(amount, addInfo)!;
  return (
    <div className="bg-white rounded-2xl p-3 inline-block">
      <img src={url} alt="Mã VietQR" width={size} height={size} className="rounded-lg" />
    </div>
  );
}
