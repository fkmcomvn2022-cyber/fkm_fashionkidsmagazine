import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "soft" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-blue text-white hover:bg-[#3e5ce0] shadow-soft",
  secondary: "bg-ink text-white hover:bg-black/80",
  soft: "bg-brand-blue-soft text-brand-blue hover:bg-[#dde4ff]",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-soft",
  danger: "bg-danger-soft text-danger hover:bg-[#fcd7dd]",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2.5 gap-2",
  lg: "text-[15px] px-5 py-3 gap-2",
};

export function Button({ variant = "primary", size = "md", icon, children, className, ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-2xl font-medium tap-scale transition-colors whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none cursor-pointer",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ children, className, variant = "ghost", ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-full w-9 h-9 tap-scale transition-colors cursor-pointer",
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
