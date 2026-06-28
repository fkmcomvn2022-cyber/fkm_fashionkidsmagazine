import { useRef, useState } from "react";
import { Wallet, CalendarCheck, Users, ImageDown, ChevronsLeft, ChevronsRight, CalendarDays } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { ConceptBanner } from "@/components/home/ConceptBanner";
import { WeekCalendar } from "@/components/home/WeekCalendar";
import { TaskBoard } from "@/components/home/TaskBoard";
import { ConversationPreview } from "@/components/home/ConversationPreview";
import { ordersByDate } from "@/data";
import { addDays, formatVNDShort, formatDateShort, startOfWeekIso, todayIso } from "@/lib/format";

export default function HomePage() {
  const today = todayIso();
  // Ngày studio đang "neo" xem ở lịch mini — mặc định hôm nay, đổi qua thanh
  // chọn tuần dưới đây (chevron lùi/tiến ±7 ngày, nút "Hôm nay", input ngày),
  // giống thanh tuần đã có ở SchedulePage. WeekCalendar tự cuộn tới đúng ngày
  // này trong dải rộng của nó (xem prop anchorDate).
  const [anchorDate, setAnchorDate] = useState(today);
  const anchorWeekStart = startOfWeekIso(anchorDate);
  const isCurrentWeek = anchorWeekStart === startOfWeekIso(today);
  const dateInputRef = useRef<HTMLInputElement>(null);
  // Trước đây 4 ô KPI này dùng `today` cố định "2026-06-25" (đứng yên mãi),
  // và "Ảnh cần sửa" còn hardcode cứng 18, không liên quan gì tới dữ liệu thật
  // — giờ cả 4 đều tính từ đơn thật của hôm nay (loại đơn đã huỷ), giống cách
  // DaySummary.tsx đang tính cho trang Lịch.
  const todayOrders = ordersByDate(today).filter((o) => o.status !== "cancelled");
  const revenueToday = todayOrders.reduce((s, o) => s + o.deposit, 0);
  const peopleToday = todayOrders.reduce((s, o) => s + o.people.length, 0);
  const photosToEdit = todayOrders.reduce((s, o) => s + (o.photosToEdit ?? 0), 0);

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
        </div>

        {/* Trước đây dòng "22 – 28/06" chỉ là chữ tĩnh, không bấm được, và
            lịch mini bên dưới chỉ hiện đúng 1 tuần đó mãi mãi. Giờ thêm thanh
            chọn tuần (giống SchedulePage) để lùi/tiến cả tuần hoặc nhảy thẳng
            tới ngày bất kỳ — WeekCalendar vẫn cho vuốt tự do, thanh này chỉ
            giúp "nhảy nhanh" tới đúng chỗ trong dải dài đó. */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setAnchorDate((d) => addDays(startOfWeekIso(d), -7))}
            className="w-7 h-7 rounded-full bg-surface-soft flex items-center justify-center text-ink-soft tap-scale"
            aria-label="Tuần trước"
          >
            <ChevronsLeft size={14} />
          </button>

          <button
            onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
            className="flex items-center gap-1.5 text-[12px] font-medium text-ink-soft px-2.5 py-1 rounded-full bg-surface-soft tap-scale"
          >
            <CalendarDays size={13} />
            Tuần {formatDateShort(anchorWeekStart)}–{formatDateShort(addDays(anchorWeekStart, 6))}/2026
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={anchorDate}
            onChange={(e) => e.target.value && setAnchorDate(e.target.value)}
            className="sr-only"
            tabIndex={-1}
          />

          {!isCurrentWeek && (
            <button
              onClick={() => setAnchorDate(today)}
              className="text-[11px] font-semibold text-brand-blue px-2 py-1 rounded-full bg-brand-blue-soft tap-scale"
            >
              Hôm nay
            </button>
          )}

          <button
            onClick={() => setAnchorDate((d) => addDays(startOfWeekIso(d), 7))}
            className="w-7 h-7 rounded-full bg-surface-soft flex items-center justify-center text-ink-soft tap-scale"
            aria-label="Tuần sau"
          >
            <ChevronsRight size={14} />
          </button>
        </div>

        <WeekCalendar anchorDate={anchorDate} />
      </div>

      <TaskBoard />
      <ConversationPreview />
    </div>
  );
}
