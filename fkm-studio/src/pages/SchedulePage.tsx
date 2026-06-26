import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays, Sparkles } from "lucide-react";
import clsx from "clsx";
import { AppointmentBar } from "@/components/schedule/AppointmentBar";
import { DaySummary } from "@/components/schedule/DaySummary";
import { OrderDetailSheet } from "@/components/OrderDetailSheet";
import { CollectPaymentSheet } from "@/components/CollectPaymentSheet";
import { GroupOrdersSheet } from "@/components/schedule/GroupOrdersSheet";
import { conceptById } from "@/data";
import { addDays, formatDateShort, startOfWeekIso, todayIso, weekdayLabel } from "@/lib/format";
import { computeStudioTimeline, suggestNextSlot, minutesToLabel } from "@/lib/scheduling";
import { useAppState } from "@/lib/appState";
import type { Order } from "@/types";

interface ScheduleNavState {
  date?: string;
  /** Đến từ ô lịch mini đã có 1 khách -> mở thẳng chi tiết đơn đó. */
  openOrderId?: string;
  /** Đến từ "Việc nổi bật" (TaskBoard) loại nhắc cọc -> mở thẳng sheet thu tiền. */
  openCollectOrderId?: string;
  /** Đến từ ô lịch mini là 1 nhóm nhiều ca liền nhau -> mở danh sách khách trong nhóm. */
  openGroupOrderIds?: string[];
  /** Đến từ ô lịch mini còn trống -> mở sẵn form "Tạo đơn hàng" với giờ này. */
  prefillTime?: string;
}

export default function SchedulePage() {
  const location = useLocation();
  const navState = location.state as ScheduleNavState | null;
  const initialDate = navState?.date ?? "2026-06-25";
  const [date, setDate] = useState(initialDate);
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [groupOrders, setGroupOrders] = useState<{ orders: Order[]; title: string } | null>(null);
  const [collectOrder, setCollectOrder] = useState<Order | null>(null);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());
  const dateInputRef = useRef<HTMLInputElement>(null);

  const { activeConceptId, openQuickAddOrder, dataVersion } = useAppState();

  // Trước đây dải ngày trong tuần là 1 mảng CỐ ĐỊNH (chỉ đúng 22-28/06) — giờ
  // tính lại theo `date` đang xem, để lùi/tiến qua tuần khác vẫn ra đúng 7 ngày
  // của tuần đó (xem startOfWeekIso trong lib/format.ts).
  const weekStart = useMemo(() => startOfWeekIso(date), [date]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const isCurrentWeek = weekStart === startOfWeekIso(todayIso());

  // dataVersion thay đổi mỗi khi có đơn hàng thật được tạo (QuickAdd) — thêm
  // vào deps để timeline/gợi ý giờ tự làm mới ngay, không cần điều hướng lại.
  const timeline = useMemo(() => { void dataVersion; return computeStudioTimeline(date); }, [date, dataVersion]);
  const nextSlot = useMemo(
    () => { void dataVersion; return suggestNextSlot(date, activeConceptId); },
    [date, activeConceptId, dataVersion],
  );
  const activeConcept = conceptById(activeConceptId);

  // Xử lý 1 lần cho mỗi lượt điều hướng từ thẻ lịch mini (WeekCalendar):
  // ô có 1 khách -> mở chi tiết đơn; ô là nhóm nhiều khách -> mở danh sách
  // nhóm; ô trống -> mở sẵn form thêm khách đúng giờ đã bấm.
  const handledNav = useRef(false);
  useEffect(() => {
    if (handledNav.current || !navState) return;
    if (navState.openOrderId) {
      const entry = timeline.find((t) => t.order.id === navState.openOrderId);
      if (entry) {
        setOpenOrder(entry.order);
        handledNav.current = true;
      }
    } else if (navState.openCollectOrderId) {
      const entry = timeline.find((t) => t.order.id === navState.openCollectOrderId);
      if (entry) {
        setCollectOrder(entry.order);
        handledNav.current = true;
      }
    } else if (navState.openGroupOrderIds?.length) {
      const orders = timeline.filter((t) => navState.openGroupOrderIds!.includes(t.order.id)).map((t) => t.order);
      if (orders.length) {
        setGroupOrders({ orders, title: `${orders.length} khách trong nhóm này` });
        handledNav.current = true;
      }
    } else if (navState.prefillTime) {
      openQuickAddOrder(date, navState.prefillTime);
      handledNav.current = true;
    }
  }, [navState, timeline, date, openQuickAddOrder]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <button onClick={() => setDate((d) => addDays(d, -1))} className="w-8 h-8 rounded-full bg-surface flex items-center justify-center border border-border-soft tap-scale">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-[15px] font-semibold text-ink">{weekdayLabel(date)}, {formatDateShort(date)}/2026</h2>
          <button onClick={() => setDate((d) => addDays(d, 1))} className="w-8 h-8 rounded-full bg-surface flex items-center justify-center border border-border-soft tap-scale">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Trước đây dải tuần là cố định, không có cách xem tuần khác — giờ
            thêm hàng điều hướng TUẦN (lùi/tiến cả tuần) + nút lịch để nhảy
            thẳng tới ngày/tuần bất kỳ qua input[type=date] ẩn. */}
        <div className="flex items-center justify-between mb-1.5">
          <button
            onClick={() => setDate((d) => addDays(startOfWeekIso(d), -7))}
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
            Tuần {formatDateShort(weekDays[0])}–{formatDateShort(weekDays[6])}/2026
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="sr-only"
            tabIndex={-1}
          />

          {!isCurrentWeek && (
            <button
              onClick={() => setDate(todayIso())}
              className="text-[11px] font-semibold text-brand-blue px-2 py-1 rounded-full bg-brand-blue-soft tap-scale"
            >
              Hôm nay
            </button>
          )}

          <button
            onClick={() => setDate((d) => addDays(startOfWeekIso(d), 7))}
            className="w-7 h-7 rounded-full bg-surface-soft flex items-center justify-center text-ink-soft tap-scale"
            aria-label="Tuần sau"
          >
            <ChevronsRight size={14} />
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {weekDays.map((d) => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={clsx(
                "shrink-0 w-11 h-14 rounded-2xl flex flex-col items-center justify-center text-xs font-medium tap-scale",
                d === date ? "bg-brand-blue text-white" : "bg-surface border border-border-soft text-ink-soft",
              )}
            >
              <span className="text-[9px] opacity-80">{weekdayLabel(d)}</span>
              <span className="text-[13px] font-bold">{formatDateShort(d).slice(0, 2)}</span>
            </button>
          ))}
        </div>
      </div>

      <DaySummary date={date} onShowOrders={(orders, title) => setGroupOrders({ orders, title })} />

      {/* Trước đây chỉ là dòng thông báo tĩnh — giờ bấm vào (khi còn giờ trống)
          mở thẳng form "Tạo đơn hàng" với giờ đã gợi ý điền sẵn, để xem/dùng
          ngay chứ không chỉ đọc thông tin suông. */}
      <button
        onClick={() => nextSlot && openQuickAddOrder(date, minutesToLabel(nextSlot.arrival))}
        disabled={!nextSlot}
        className="rounded-3xl bg-brand-blue-soft p-3.5 flex items-start gap-2.5 text-left w-full tap-scale disabled:opacity-80"
      >
        <span className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center text-brand-blue shrink-0">
          <Sparkles size={15} />
        </span>
        <div className="text-[12px]">
          <p className="font-semibold text-ink">Gợi ý nhận khách tiếp theo ({activeConcept?.name ?? "—"})</p>
          {nextSlot ? (
            <p className="text-ink-soft mt-0.5">
              Có thể đón khách lúc <span className="font-semibold text-brand-blue">{minutesToLabel(nextSlot.arrival)}</span> — trang
              điểm xong {minutesToLabel(nextSlot.makeupEnd)}, chụp {minutesToLabel(nextSlot.shootStart)}–{minutesToLabel(nextSlot.shootEnd)}.
              {nextSlot.nudgedForBreak && " (đã né giờ ekip nghỉ ăn)"} Bấm để tạo đơn ngay giờ này.
            </p>
          ) : (
            <p className="text-ink-soft mt-0.5">Ngày này đã kín lịch, không còn kịp giờ trước khi đóng cửa (18:00).</p>
          )}
        </div>
      </button>

      <div>
        <h3 className="text-[15px] font-semibold text-ink mb-2.5 px-0.5">Lịch ca chụp ({timeline.length})</h3>
        <div className="flex flex-col gap-2.5">
          {timeline.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border-soft py-10 text-center text-sm text-muted">
              Chưa có ca chụp nào trong ngày này
            </div>
          )}
          {timeline.map((entry) => (
            <div key={entry.order.id} className="relative">
              <AppointmentBar
                entry={entry}
                onOpen={setOpenOrder}
                onCollect={setCollectOrder}
                onCheckIn={(o) => setCheckedIn((prev) => new Set(prev).add(o.id))}
              />
              {checkedIn.has(entry.order.id) && (
                <span className="absolute -top-1.5 -right-1.5 bg-success text-white text-[10px] font-semibold rounded-full px-2 py-0.5 shadow-soft">
                  Đã điểm danh
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <OrderDetailSheet order={openOrder} onClose={() => setOpenOrder(null)} />
      <GroupOrdersSheet
        orders={groupOrders?.orders ?? null}
        title={groupOrders?.title}
        onClose={() => setGroupOrders(null)}
        onOpenOrder={(order) => {
          setGroupOrders(null);
          setOpenOrder(order);
        }}
      />
      <CollectPaymentSheet order={collectOrder} onClose={() => setCollectOrder(null)} />
    </div>
  );
}
