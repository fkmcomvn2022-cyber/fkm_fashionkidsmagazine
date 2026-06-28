import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { addDays, formatDateShort, startOfWeekIso, todayIso, weekdayLabel } from "@/lib/format";
import { computeMiniDayCells, minutesToLabel } from "@/lib/scheduling";
import { useAppState } from "@/lib/appState";

// Số ngày tối thiểu hiện ra MỖI BÊN quanh hôm nay, để vuốt tự do quanh ngày
// hiện tại mà không cần đợi nhảy tuần mới thấy thêm ngày — 4 tuần mỗi bên là
// đủ rộng cho vuốt tay thông thường (dải tự GIÃN thêm nếu anchorDate đẩy ra
// ngoài, xem useMemo `days` dưới).
const WINDOW_PAD_DAYS = 28;

interface WeekCalendarProps {
  /**
   * Ngày studio đang "neo" xem — đến từ thanh chọn tuần ở HomePage (chevron
   * lùi/tiến tuần, nút "Hôm nay", hoặc input ngày, giống SchedulePage).
   * WeekCalendar tự CUỘN tới đúng ngày này mỗi khi đổi, không remount lại cả
   * dải (giữ nguyên vị trí nếu người dùng đang tự vuốt tay). Mặc định hôm nay
   * nếu chưa truyền.
   */
  anchorDate?: string;
}

// Thẻ lịch mini mỗi ngày luôn hiện đúng 5 ô (xem computeMiniDayCells):
//   - Ô đã có khách (gộp các ca liên tiếp không hở thành 1 nhóm) -> bấm vào:
//       · nhóm chỉ 1 đơn -> nhảy vào trang Lịch ca chụp của ngày đó, tự mở
//         sẵn chi tiết đơn đó.
//       · nhóm nhiều đơn -> nhảy vào trang Lịch ca chụp, tự mở sẵn danh sách
//         từng khách trong nhóm (kèm giờ riêng), bấm tiếp để xem chi tiết.
//   - Ô trống gợi ý -> nhảy vào trang Lịch ca chụp của ngày đó, tự mở sẵn
//     form "Tạo đơn hàng" với ngày/giờ điền trước theo đúng ô đã bấm.
export function WeekCalendar({ anchorDate }: WeekCalendarProps) {
  const navigate = useNavigate();
  // Đăng ký theo appState để thẻ lịch tự làm mới ngay khi có đơn hàng mới
  // được tạo qua QuickAdd (không cần điều hướng lại trang để remount).
  const { dataVersion, activeConceptId } = useAppState();
  const today = todayIso();
  const anchor = anchorDate ?? today;
  const dayRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Trước đây dải ngày là 7 NGÀY CỐ ĐỊNH viết tay (22–28/06/2026, không bao
  // giờ đổi cho dù hôm nay là ngày nào). Giờ tính 1 dải RỘNG quanh hôm nay để
  // vuốt tự do, tự GIÃN thêm nếu `anchor` (do thanh chọn tuần ở HomePage đẩy
  // tới) vượt ra ngoài dải mặc định — so sánh trực tiếp chuỗi ISO yyyy-mm-dd
  // vẫn đúng thứ tự ngày vì độ dài cố định.
  const days = useMemo(() => {
    const todayWeekStart = startOfWeekIso(today);
    const anchorWeekStart = startOfWeekIso(anchor);
    const defaultStart = addDays(todayWeekStart, -WINDOW_PAD_DAYS);
    const defaultEnd = addDays(todayWeekStart, WINDOW_PAD_DAYS + 6);
    const start = [defaultStart, addDays(anchorWeekStart, -7)].sort()[0];
    const end = [defaultEnd, addDays(anchorWeekStart, 13)].sort()[1];
    const list: string[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) list.push(d);
    return list;
  }, [today, anchor]);

  // Mỗi khi `anchor` đổi (kể cả lần mount đầu) -> cuộn ngang tới đúng ngày đó,
  // căn giữa, mượt — để nút "Hôm nay"/chevron tuần ở HomePage thật sự dẫn mắt
  // người dùng tới đúng chỗ trong dải dài, không phải tự dò.
  useEffect(() => {
    const el = dayRefs.current.get(anchor);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [anchor]);

  const goToDay = (date: string, extra?: Record<string, unknown>) => {
    navigate("/schedule", { state: { date, ...extra } });
  };

  return (
    <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
      {days.map((date) => {
        const cells = computeMiniDayCells(date, activeConceptId);
        const isToday = date === today;
        // Ngày đang neo (đến từ thanh chọn tuần) nhưng KHÔNG phải hôm nay —
        // viền nổi riêng, để phân biệt với highlight nền xanh đậm của hôm nay.
        const isAnchor = date === anchor && !isToday;
        const totalPeople = cells.reduce((s, c) => (c.kind === "booking" ? s + c.peopleCount : s), 0);

        return (
          <div
            key={`${date}-${dataVersion}`}
            ref={(el) => {
              if (el) dayRefs.current.set(date, el);
              else dayRefs.current.delete(date);
            }}
            className={clsx(
              "flex flex-col shrink-0 w-[104px] rounded-3xl border p-2.5 text-left",
              isToday ? "bg-brand-blue border-brand-blue shadow-card ring-2 ring-brand-blue/40 ring-offset-2" : "bg-surface border-border-soft",
              isAnchor && "ring-2 ring-brand-blue ring-offset-1",
            )}
          >
            <button onClick={() => goToDay(date)} className="flex items-center justify-between mb-1 tap-scale">
              <span className={clsx("text-[11px] font-semibold", isToday ? "text-white/80" : "text-muted")}>
                {weekdayLabel(date)}
              </span>
              <span className={clsx("text-[11px] font-bold", isToday ? "text-white" : "text-ink")}>
                {formatDateShort(date)}
              </span>
            </button>

            {/* Trước đây hôm nay chỉ khác bằng màu nền xanh — dễ lẫn khi cả
                dải đều là thẻ nhỏ. Thêm hẳn 1 nhãn chữ để chắc chắn nhận ra. */}
            {isToday && (
              <span className="self-start mb-1 text-[8px] font-bold uppercase tracking-wide text-brand-blue bg-white rounded-full px-1.5 py-0.5 w-fit">
                Hôm nay
              </span>
            )}

            <div className="flex flex-col gap-1">
              {cells.map((cell, i) =>
                cell.kind === "booking" ? (
                  <button
                    key={i}
                    onClick={() =>
                      goToDay(
                        date,
                        cell.orderIds.length > 1
                          ? { openGroupOrderIds: cell.orderIds }
                          : { openOrderId: cell.orderIds[0] },
                      )
                    }
                    className={clsx(
                      "rounded-xl px-1.5 py-1 text-[10px] font-semibold flex items-center gap-1 tap-scale",
                      isToday ? "bg-white/20 text-white" : "bg-surface-soft text-ink-soft",
                    )}
                  >
                    <span className="flex gap-0.5">
                      {cell.conceptColors.slice(0, 3).map((col, j) => (
                        <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: isToday ? "#fff" : col }} />
                      ))}
                    </span>
                    <span>
                      {minutesToLabel(cell.startMin)} · {cell.peopleCount}p{cell.orderIds.length > 1 ? ` (${cell.orderIds.length})` : ""}
                    </span>
                  </button>
                ) : (
                  <button
                    key={i}
                    onClick={() => goToDay(date, { prefillTime: minutesToLabel(cell.min) })}
                    className={clsx(
                      "rounded-xl px-1.5 py-1 text-[10px] font-medium border border-dashed tap-scale",
                      cell.deprioritized
                        ? isToday
                          ? "border-white/25 text-white/55"
                          : "border-border-soft text-muted/60"
                        : isToday
                          ? "border-white/40 text-white/80"
                          : "border-border-soft text-muted",
                    )}
                  >
                    Trống {minutesToLabel(cell.min)}
                  </button>
                ),
              )}
            </div>

            {totalPeople > 0 && (
              <div className={clsx("text-[10px] mt-1.5 font-medium", isToday ? "text-white/85" : "text-muted")}>
                {totalPeople} người chụp
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
