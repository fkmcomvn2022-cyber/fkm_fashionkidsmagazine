import type { ReactNode } from "react";
import type { OrderStatus } from "@/types";
import { orderStatusMeta } from "@/lib/format";

interface BadgeProps {
  children: ReactNode;
  color?: string;
  bg?: string;
  className?: string;
}

export function Badge({ children, color = "#4f6df5", bg = "#e8edff", className }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${className ?? ""}`}
      style={{ color, background: bg }}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const meta = orderStatusMeta[status];
  return <Badge color={meta.color} bg={meta.bg}>{meta.label}</Badge>;
}
