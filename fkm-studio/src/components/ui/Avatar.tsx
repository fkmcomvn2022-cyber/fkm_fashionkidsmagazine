import { useState } from "react";

const palette = ["#4f6df5", "#9b5cf6", "#ef5fa7", "#ff9447", "#1fb27a", "#f5a524"];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % palette.length;
  return palette[Math.abs(hash) % palette.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1]?.[0]?.toUpperCase() ?? "?";
}

interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  className?: string;
}

export function Avatar({ name, src, size = 40, className }: AvatarProps) {
  // Ảnh avatar Facebook (platform-lookaside.fbsbx.com) đôi khi không tải được
  // trong trình duyệt (link hết hạn, bị chặn hotlink, mạng chậm...) — không có
  // onError thì <img> sẽ vỡ ảnh vĩnh viễn thay vì rơi về chữ viết tắt. Theo
  // dõi lỗi tải theo src cụ thể (key) để tự thử lại khi src đổi (vd lấy được
  // avatar mới qua lazy-backfill ở server).
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && src !== failedSrc) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${className ?? ""}`}
        style={{ width: size, height: size }}
        onError={() => setFailedSrc(src)}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full text-white font-semibold shrink-0 ${className ?? ""}`}
      style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );
}
