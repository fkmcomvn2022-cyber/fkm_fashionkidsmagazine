import type { ReactNode } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface rounded-t-4xl shadow-float max-h-[85vh] overflow-y-auto animate-[slideUp_0.22s_ease-out]">
        <div className="sticky top-0 bg-surface flex items-center justify-between px-5 pt-4 pb-3 border-b border-border-soft rounded-t-4xl">
          <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface-soft flex items-center justify-center tap-scale">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
