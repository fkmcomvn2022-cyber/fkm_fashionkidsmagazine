import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Heart, ImageOff, Loader2, Check } from "lucide-react";
import { BACKEND_URL } from "@/lib/persistence";

/**
 * Trang công khai cho KHÁCH (Giai đoạn 5, xem fkm-studio-ai-chatbot-roadmap)
 * — mở qua link studio gửi (`/chon-anh/:orderId`), KHÔNG cần đăng nhập, nên
 * chỉ đọc/ghi đúng 1 đơn qua backend (server/src/orders.ts), không đụng tới
 * dữ liệu khác. Đặt ngoài <AppShell> (xem App.tsx) — không có nav studio.
 */

interface SelectionData {
  orderCode?: string;
  customerName?: string;
  items: string[];
  selectedUrls: string[];
  completedAt?: string;
  // Số ảnh tối đa được chọn (theo gói concept, ô "Ảnh cần sửa" studio nhập
  // trong đơn) — undefined = không giới hạn.
  maxSelectable?: number;
}

type LoadState = "loading" | "ready" | "not_found" | "error";

export default function PhotoSelectionPortalPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<SelectionData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [limitHit, setLimitHit] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setState("error");
      return;
    }
    fetch(`${BACKEND_URL}/api/orders/${orderId}/photo-selection`)
      .then(async (res) => {
        if (res.status === 404) {
          setState("not_found");
          return;
        }
        if (!res.ok) {
          setState("error");
          return;
        }
        const json = (await res.json()) as SelectionData;
        setData(json);
        setSelected(new Set(json.selectedUrls ?? []));
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [orderId]);

  const maxSelectable = data?.maxSelectable;

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
        setLimitHit(false);
      } else {
        if (maxSelectable !== undefined && next.size >= maxSelectable) {
          setLimitHit(true);
          return prev;
        }
        next.add(url);
        setLimitHit(false);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!orderId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/orders/${orderId}/photo-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedUrls: Array.from(selected) }),
      });
      if (res.ok) {
        setJustSubmitted(true);
        setData((prev) => (prev ? { ...prev, selectedUrls: Array.from(selected), completedAt: new Date().toISOString() } : prev));
      } else if (res.status === 422) {
        setLimitHit(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return (
      <PortalShell>
        <div className="flex flex-col items-center gap-2 py-16 text-muted">
          <Loader2 size={22} className="animate-spin" />
          <p className="text-sm">Đang tải ảnh...</p>
        </div>
      </PortalShell>
    );
  }

  if (state === "not_found" || state === "error" || !data) {
    return (
      <PortalShell>
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <ImageOff size={28} className="text-muted" />
          <p className="text-sm font-medium text-ink">Không tìm thấy đơn này</p>
          <p className="text-xs text-muted">Link có thể đã hết hạn hoặc sai — liên hệ studio để được gửi lại link.</p>
        </div>
      </PortalShell>
    );
  }

  if (data.items.length === 0) {
    return (
      <PortalShell title={data.orderCode}>
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <ImageOff size={28} className="text-muted" />
          <p className="text-sm font-medium text-ink">Studio chưa đưa ảnh lên</p>
          <p className="text-xs text-muted">Vui lòng quay lại sau, hoặc liên hệ studio để biết thêm.</p>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell title={data.orderCode} subtitle={data.customerName}>
      <p className="text-xs text-muted mb-1">
        Bấm vào ảnh để thả tim chọn{maxSelectable !== undefined ? ` (tối đa ${maxSelectable} ảnh)` : ""}, sau đó bấm "Xác nhận đã chọn xong" ở dưới. Có thể mở lại link này để sửa lựa chọn trước khi studio bắt đầu sửa ảnh.
      </p>

      <p className="text-xs font-semibold text-ink mb-3">
        Đã chọn {selected.size}
        {maxSelectable !== undefined ? `/${maxSelectable}` : ""} ảnh
      </p>

      {justSubmitted && (
        <div className="rounded-2xl bg-success/10 text-success text-xs font-medium px-3 py-2.5 mb-3 flex items-center gap-2">
          <Check size={14} /> Đã gửi lựa chọn cho studio — cảm ơn anh/chị!
        </div>
      )}

      {limitHit && maxSelectable !== undefined && (
        <div className="rounded-2xl bg-danger/10 text-danger text-xs font-medium px-3 py-2.5 mb-3">
          Gói này chỉ được chọn tối đa {maxSelectable} ảnh — hãy bỏ chọn 1 ảnh khác trước khi chọn thêm.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {data.items.map((url) => {
          const isSelected = selected.has(url);
          return (
            <button
              key={url}
              onClick={() => toggle(url)}
              className={`relative rounded-2xl overflow-hidden border-2 tap-scale aspect-square bg-surface-soft ${
                isSelected ? "border-brand-blue" : "border-transparent"
              }`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
              <span
                className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center ${
                  isSelected ? "bg-white" : "bg-black/30"
                }`}
              >
                <Heart size={15} className={isSelected ? "text-rose-500 fill-rose-500" : "text-white/80"} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-3">
        <button
          onClick={handleSubmit}
          disabled={submitting || selected.size === 0}
          className="w-full rounded-2xl bg-brand-blue text-white text-sm font-semibold py-3.5 tap-scale disabled:opacity-50"
        >
          {submitting ? "Đang gửi..." : `Xác nhận đã chọn xong (${selected.size} ảnh)`}
        </button>
      </div>
    </PortalShell>
  );
}

function PortalShell({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-soft">
      <div className="max-w-md w-full mx-auto px-4 py-5">
        <div className="mb-4">
          <p className="text-[15px] font-bold text-ink">FKM Studio — Chọn ảnh</p>
          {(title || subtitle) && (
            <p className="text-xs text-muted mt-0.5">
              {title}
              {title && subtitle ? " · " : ""}
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
