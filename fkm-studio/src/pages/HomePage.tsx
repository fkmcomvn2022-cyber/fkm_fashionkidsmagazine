import { Wallet, CalendarCheck, Users, ImageDown } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { ConceptBanner } from "@/components/home/ConceptBanner";
import { WeekCalendar } from "@/components/home/WeekCalendar";
import { TaskBoard } from "@/components/home/TaskBoard";
import { ConversationPreview } from "@/components/home/ConversationPreview";
import { ordersByDate } from "@/data";
import { formatVNDShort } from "@/lib/format";

const today = "2026-06-25";

export default function HomePage() {
  const todayOrders = ordersByDate(today);
  const revenueToday = todayOrders.reduce((s, o) => s + o.deposit, 0);
  const peopleToday = todayOrders.reduce((s, o) => s + o.people.length, 0);
  const photosToEdit = 18;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4">
        <KpiCard tone="blue" label="Doanh thu hôm nay" value={formatVNDShort(revenueToday)} icon={<Wallet size={16} />} />
        <KpiCard tone="purple" label="Ca chụp hôm nay" value={String(todayOrders.length)} icon={<CalendarCheck size={16} />} />
        <KpiCard tone="pink" label="Người chụp" value={String(peopleToday)} icon={<Users size={16} />} />
        <KpiCard tone="orange" label="Ảnh cần sửa" value={String(photosToEdit)} icon={<ImageDown size={16} />} />
      </div>

      <ConceptBanner />

      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <h3 className="text-[15px] font-semibold text-ink">Lịch điều phối</h3>
          <span className="text-[11px] text-muted">22 – 28/06</span>
        </div>
        <WeekCalendar />
      </div>

      <TaskBoard />
      <ConversationPreview />
    </div>
  );
}
