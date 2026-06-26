import type { ReactNode } from "react";
import clsx from "clsx";

type Tone = "blue" | "purple" | "pink" | "orange" | "green";

const toneClasses: Record<Tone, string> = {
  blue: "from-[#5b7bff] to-[#4f6df5]",
  purple: "from-[#b07cf9] to-[#9b5cf6]",
  pink: "from-[#f57fb8] to-[#ef5fa7]",
  orange: "from-[#ffac6b] to-[#ff9447]",
  green: "from-[#3ec991] to-[#1fb27a]",
};

interface KpiCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: Tone;
  trend?: string;
  className?: string;
}

export function KpiCard({ label, value, icon, tone = "blue", trend, className }: KpiCardProps) {
  return (
    <div
      className={clsx(
        "relative rounded-3xl p-4 text-white shadow-card bg-gradient-to-br overflow-hidden min-w-[150px]",
        toneClasses[tone],
        className,
      )}
    >
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-white/80">{label}</span>
        {icon && <span className="text-white/90">{icon}</span>}
      </div>
      <div className="text-xl font-bold leading-tight">{value}</div>
      {trend && <div className="text-[11px] text-white/75 mt-1">{trend}</div>}
    </div>
  );
}
