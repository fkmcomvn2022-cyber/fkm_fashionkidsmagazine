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
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${className ?? ""}`}
        style={{ width: size, height: size }}
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
