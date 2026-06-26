import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { formatDateShort, weekdayLabel } from "@/lib/format";
import { computeMiniDayCells, minutesToLabel } from "@/lib/scheduling";
import { useAppState } from "@/lib/appState";

const today = "2026-06-25";
const days = Array.from({ length: 7 }, (_, i) => {
  const base = new Date("2026-06-22T00:00:00");
  base.setDate(base.getDate() + i);
  return base.toISOString().slice(0, 10);
});

// Thẻ lịch mini mỗi ngày luôn hiện đúng 5 ô (xem computeMiniDayCells):
//   - Ô đã có khách (gộp các ca liên tiếp không hở thành 1 nhóm) -> bấm vào:
//       · nhóm chỉ 1 đơn -> nhảy vào trang Lịch ca chụp của ngày đó, tự mở
//         sẵn chi tiết đơn đó.
//       · nhóm nhiều đơn -> nhảy vào trang Lịch ca chụp, tự mở sẵn danh sách
//         từng khách trong nhóm (kèm giờ riêng), bấm tiếp để xem chi tiết.
//   - Ô trống gợi ý -> nhảy vào trang Lịch ca chụp của ngày đó, tự mở sẵn
//     form "Tạo đơn hàng" với ngày/giờ điền trước theo đúng ô đã bấm.
export function WeekCalendar() {
  const navigate = useNavigate();
  // Đăng ký theo appState để thẻ lịch tự làm mới ngay khi có đơn hàng mới
  // được tạo qua QuickAdd (không cần điều hướng lại trang để remount).
  const { dataVersion, activeConceptId } = useAppState();

  const goToDay = (date: string, extra?: Record<string, unknown>) => {
    navigate("/schedule", { state: { date, ...extra } });
  };

  return (
    <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
      {days.map((date) => {
        const cells = computeMiniDayCells(date, activeConceptId);
        const isToday = date === today;
        const totalPeople = cells.reduce((s, c) => (c.kind === "booking" ? s + c.peopleCount : s), 0);

        return (
          <div
            key={`${date}-${dataVersion}`}
            className={clsx(
              "flex flex-col shrink-0 w-[104px] rounded-3xl border p-2.5 text-left",
              isToday ? "bg-brand-blue border-brand-blue shadow-card" : "bg-surface border-border-soft",
            )}
          >
            <button onClick={() => goToDay(date)} className="flex items-center justify-between mb-1.5 tap-scale">
              <span className={clsx("text-[11px] font-semibold", isToday ? "text-white/80" : "text-muted")}>
                {weekdayLabel(date)}
              </span>
              <span className={clsx("text-[11px] font-bold", isToday ? "text-white" : "text-ink")}>
                {formatDateShort(date)}
              </span>
            </button>

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
