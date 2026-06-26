import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
  glass?: boolean;
}

export function Card({ children, className, padded = true, glass = false, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-border-soft shadow-card",
        glass ? "glass" : "bg-surface",
        padded && "p-4",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, subtitle, action, children, className, ...rest }: PanelProps) {
  return (
    <section className={clsx("rounded-3xl bg-surface border border-border-soft shadow-card p-4 sm:p-5", className)} {...rest}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
