import { NavLink } from "react-router-dom";
import { Home, CalendarDays, MessageCircle, Users, Package } from "lucide-react";
import clsx from "clsx";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/schedule", label: "Ca chụp", icon: CalendarDays },
  { to: "/chat", label: "Hội thoại", icon: MessageCircle },
  { to: "/profile", label: "Hồ sơ", icon: Users },
  { to: "/product", label: "Sản phẩm", icon: Package },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="glass mx-auto max-w-md flex items-center justify-between rounded-4xl border border-border-soft shadow-float px-2 py-1.5">
        {items.map(({ to, label, icon: Icon }) => (
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
                <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                <span className={clsx("text-[10px]", isActive ? "font-semibold" : "font-medium")}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
