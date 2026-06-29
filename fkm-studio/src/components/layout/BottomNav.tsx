import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { Home, CalendarDays, MessageCircle, Users, Package } from "lucide-react";
import clsx from "clsx";
import { messages, mergeRemoteCustomers, mergeRemoteMessages } from "@/data";
import { BACKEND_URL } from "@/lib/persistence";
import { useAppState } from "@/lib/appState";
import type { Message, Customer } from "@/types";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/schedule", label: "Ca chụp", icon: CalendarDays },
  { to: "/chat", label: "Hội thoại", icon: MessageCircle },
  { to: "/profile", label: "Hồ sơ", icon: Users },
  { to: "/product", label: "Sản phẩm", icon: Package },
];

// Poll nền cho huy hiệu tin chưa đọc — chạy ở MỌI màn (BottomNav luôn hiển thị
// trong AppShell), để số tin mới cập nhật kể cả khi đang không mở màn Hội
// thoại. Chậm hơn poll trong ChatPage (đang mở thread thì cần realtime hơn).
const BADGE_POLL_INTERVAL_MS = 20_000;

export function BottomNav() {
  const { dataVersion, bumpDataVersion } = useAppState();

  // Đếm tin khách gửi vào mà chưa đọc — đọc thẳng mảng messages sống (đã được
  // lọc theo chế độ DEMO/THẬT), tính lại mỗi khi dataVersion đổi (có tin mới
  // hoặc vừa đánh dấu đã đọc ở màn Hội thoại). void dataVersion để React hiểu
  // đây là phụ thuộc cần tính lại.
  void dataVersion;
  const unread = messages.filter((m) => m.fromCustomer && !m.read).length;

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/chat-sync`);
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { messages?: Message[]; customers?: Customer[] };
        const addedCustomers = mergeRemoteCustomers(json.customers ?? []);
        const addedMessages = mergeRemoteMessages(json.messages ?? []);
        if (!cancelled && (addedCustomers || addedMessages)) bumpDataVersion();
      } catch {
        // Backend chưa chạy/mất mạng — bỏ qua, thử lại lượt sau.
      }
    };
    poll();
    const interval = setInterval(poll, BADGE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ lập 1 lần khi mount; bumpDataVersion ổn định (useCallback)
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="glass mx-auto max-w-md flex items-center justify-between rounded-4xl border border-border-soft shadow-float px-2 py-1.5">
        {items.map(({ to, label, icon: Icon }) => {
          const showBadge = to === "/chat" && unread > 0;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-3xl py-2 tap-scale transition-colors",
                  isActive ? "text-brand-blue" : "text-muted",
                )
              }
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <span className="relative">
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                    {showBadge && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-soft">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </span>
                  <span className={clsx("text-[10px]", isActive ? "font-semibold" : "font-medium")}>{label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
