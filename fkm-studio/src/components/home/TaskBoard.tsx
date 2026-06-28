import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, CalendarClock, ImageDown, AlertTriangle, ChevronRight, Briefcase, UserX } from "lucide-react";
import { Panel } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { orderById, customerById, conceptById, staffById } from "@/data";
import { formatVND } from "@/lib/format";
import { sendTaskReminder, sendStaffScheduleReminder } from "@/lib/messaging";
import { computeOperationTasks } from "@/lib/operationTasks";
import { useAppState } from "@/lib/appState";
import type { OperationTask, TaskType } from "@/types";

const taskMeta: Record<TaskType, { icon: typeof Wallet; color: string; bg: string; action: string }> = {
  remind_deposit: { icon: Wallet, color: "#f5a524", bg: "#fef3dc", action: "Nhắc cọc" },
  remind_schedule: { icon: CalendarClock, color: "#4f6df5", bg: "#e8edff", action: "Nhắc lịch" },
  remind_select_photo: { icon: ImageDown, color: "#ef5fa7", bg: "#ffe6f2", action: "Nhắc chọn ảnh" },
  remind_staff_schedule: { icon: Briefcase, color: "#1fb27a", bg: "#e3f8ee", action: "Nhắc lịch làm việc" },
  missing_staff: { icon: UserX, color: "#f0476b", bg: "#fde6ea", action: "Gán ngay" },
  conflict: { icon: AlertTriangle, color: "#f0476b", bg: "#fde6ea", action: "Xem chi tiết" },
};

export function TaskBoard() {
  const navigate = useNavigate();
  // Trước đây là `data/tasks.ts` — 6 dòng MẪU cố định, không bao giờ đổi theo
  // dữ liệu thật. Giờ tính lại SỐNG từ orders/customers/staff (xem
  // lib/operationTasks.ts) — `dataVersion` đổi mỗi khi có đơn được tạo/sửa
  // (xem memory fkm-studio-data-write-path) nên thêm vào deps để tính lại ngay.
  const { dataVersion } = useAppState();
  const operationTasks = useMemo(() => { void dataVersion; return computeOperationTasks(); }, [dataVersion]);

  const goToOrder = (task: OperationTask) => {
    const order = orderById(task.orderId);
    if (!order) return;
    navigate("/schedule", { state: { date: order.date, openOrderId: task.orderId, focusEkip: task.type === "missing_staff" } });
  };

  // Mỗi loại việc bấm nút là chạy đúng hành động thật:
  // - Nhắc cọc/nhắc lịch/nhắc chọn ảnh -> mở thẳng kênh chat của KHÁCH (Facebook
  //   nếu nguồn Facebook, còn lại Zalo) với nội dung tin nhắn soạn sẵn.
  // - Nhắc lịch làm việc -> mở kênh liên lạc MẶC ĐỊNH của nhân sự đó.
  // - Thiếu nhân sự -> mở thẳng đơn ở chế độ Sửa, cuộn tới phần Ekip (giống
  //   DaySummary.onResolveMissingStaff, tái dùng cờ focusEkip có sẵn).
  // - Trùng lịch -> chưa có hành động nhắn tin, mở chi tiết đơn ở trang Lịch.
  const runTask = (task: OperationTask) => {
    if (task.type === "conflict" || task.type === "missing_staff") {
      goToOrder(task);
      return;
    }
    if (task.type === "remind_staff_schedule") {
      if (task.staffId) sendStaffScheduleReminder(task.orderId, task.staffId);
      return;
    }
    sendTaskReminder(task.orderId, task.type);
  };

  return (
    <Panel title="Việc nổi bật" subtitle={`${operationTasks.length} việc cần xử lý hôm nay`}>
      <div className="flex flex-col gap-2.5">
        {operationTasks.map((task) => {
          const meta = taskMeta[task.type];
          const Icon = meta.icon;
          const order = orderById(task.orderId);
          const customer = order ? customerById(order.customerId) : undefined;
          const concept = order ? conceptById(order.conceptId) : undefined;
          const staffMember = task.staffId ? staffById(task.staffId) : undefined;
          const avatarName = task.type === "remind_staff_schedule" ? (staffMember?.name ?? "?") : (customer?.name ?? "?");
          return (
            <div
              key={task.id}
              onClick={() => goToOrder(task)}
              className="flex items-center gap-3 rounded-2xl border border-border-soft p-3 tap-scale cursor-pointer"
            >
              <Avatar name={avatarName} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: meta.bg, color: meta.color }}>
                    <Icon size={11} />
                  </span>
                  <p className="text-[13px] font-semibold text-ink truncate">{task.title}</p>
                </div>
                <p className="text-[11px] text-muted mt-0.5 truncate">
                  {concept?.name} {order && `· ${formatVND(order.remaining)} còn lại`} · {task.dueLabel}
                </p>
              </div>
              <Button
                size="sm"
                variant={task.urgent ? "primary" : "soft"}
                className="shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  runTask(task);
                }}
              >
                {meta.action}
              </Button>
            </div>
          );
        })}
      </div>
      <button
        onClick={() => navigate("/schedule")}
        className="flex items-center justify-center gap-1 w-full mt-3 text-[12px] font-medium text-brand-blue"
      >
        Xem tất cả việc cần làm <ChevronRight size={14} />
      </button>
    </Panel>
  );
}
