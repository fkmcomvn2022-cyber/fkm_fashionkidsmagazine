import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, ChevronRight } from "lucide-react";
import { Panel } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { getConversationThreads, customerById } from "@/data";
import { timeAgoVi } from "@/lib/format";
import { customerAvatarSrc } from "@/lib/avatar";
import { useAppState } from "@/lib/appState";

export function ConversationPreview() {
  const navigate = useNavigate();
  const { dataVersion } = useAppState();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion chỉ để buộc tính lại khi messages đổi (xem Phase 2, addMessage/mergeRemoteMessages gọi bumpDataVersion)
  const conversationThreads = useMemo(() => getConversationThreads(), [dataVersion]);
  const unread = conversationThreads.filter((t) => t.unreadCount > 0).length;

  return (
    <Panel
      title="Trò chuyện"
      subtitle={`${unread} hội thoại chưa đọc`}
      action={
        <button onClick={() => navigate("/chat")} className="text-[12px] font-medium text-brand-blue flex items-center gap-0.5">
          Tất cả <ChevronRight size={13} />
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        {conversationThreads.map((t) => {
          const customer = customerById(t.customerId);
          if (!customer) return null;
          return (
            <button
              key={t.customerId}
              onClick={() => navigate("/chat", { state: { customerId: t.customerId } })}
              className="flex items-center gap-3 rounded-2xl p-2 text-left tap-scale hover:bg-surface-soft"
            >
              <div className="relative">
                <Avatar name={customer.name} src={customerAvatarSrc(customer)} size={38} />
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#1877F2] flex items-center justify-center border-2 border-surface">
                  <MessageCircle size={9} className="text-white" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-ink truncate">{customer.name}</span>
                  <span className="text-[10px] text-muted shrink-0 ml-2">{timeAgoVi(t.lastMessage.time)}</span>
                </div>
                <p className="text-[12px] text-muted truncate">
                  {t.lastMessage.fromCustomer ? "" : "Bạn: "}{t.lastMessage.text}
                </p>
              </div>
              {t.unreadCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-danger shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
