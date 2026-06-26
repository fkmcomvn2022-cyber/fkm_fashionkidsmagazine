interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  bg?: string;
  height?: number;
}

export function ProgressBar({ value, color = "#4f6df5", bg = "#e8edff", height = 6 }: ProgressBarProps) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ background: bg, height }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}
