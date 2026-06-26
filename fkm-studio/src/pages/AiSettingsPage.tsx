import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Wand2 } from "lucide-react";
import { Panel } from "@/components/ui/Card";
import { aiAutoReplySettings, setAiAutoReplySettings, type AiFunctionConfig } from "@/lib/aiReply";
import { useAppState } from "@/lib/appState";

// Nhãn tiếng Việt cho từng "nghiệp vụ" cố định — chỉ để studio biết hàm này
// thực chất làm gì trong app (tên kỹ thuật + tham số KHÔNG sửa được, vì đụng
// trực tiếp vào dữ liệu thật — xem server/src/ai.ts). Studio chỉ tự biên tập
// "Tên hiển thị" và "Mô tả/khi nào gọi" — đúng phần quyết định Gemini gọi hàm
// nào, giống cách UChat cấu hình AI Agent function.
const FUNCTION_OPERATION_LABEL: Record<AiFunctionConfig["key"], string> = {
  lookup_order: "Nghiệp vụ có sẵn: tra cứu đơn hàng của khách đang chat",
  tag_customer: "Nghiệp vụ có sẵn: gắn nhãn VIP / Mới / Thân thiết cho khách",
  escalate_to_staff: "Nghiệp vụ có sẵn: báo nhân viên thật vào hỗ trợ + hiện banner \"Cần hỗ trợ\"",
  check_available_slots: "Nghiệp vụ có sẵn: kiểm tra lịch trống THẬT theo ngày khách hỏi, không cho AI tự đoán",
  create_order_from_chat: "Nghiệp vụ có sẵn: tự tạo đơn hàng mới (Chưa cọc) + tự gửi nhắc cọc kèm mã QR — xem thêm ở màn Automation",
  send_concept_photos: "Nghiệp vụ có sẵn: gửi vài ảnh mẫu thật của 1 concept cho khách xem qua Facebook khi khách hỏi/quan tâm",
  upsell_order: "Nghiệp vụ có sẵn: thêm dịch vụ/thêm người vào đơn đang có của khách + tự tính lại số tiền cần thu thêm",
  reschedule_order: "Nghiệp vụ có sẵn: đổi ngày/giờ đơn đang có của khách, có kiểm tra trùng giờ trước khi đổi",
  cancel_order: "Nghiệp vụ có sẵn: hủy đơn đang có của khách (chỉ đổi trạng thái, không đụng tiền đã cọc)",
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${checked ? "bg-brand-blue" : "bg-surface-soft"}`}
    >
      <span className={`block w-5 h-5 rounded-full bg-white shadow-soft transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

export default function AiSettingsPage() {
  const navigate = useNavigate();
  const { bumpDataVersion } = useAppState();
  const [settings, setSettings] = useState(aiAutoReplySettings);

  const save = (next: typeof settings) => {
    setSettings(next);
    setAiAutoReplySettings(next);
    bumpDataVersion(); // mirror lên backend ngay — server đọc đúng customPrompt/functions ở webhook tiếp theo
  };

  const updateFunction = (key: AiFunctionConfig["key"], patch: Partial<AiFunctionConfig>) => {
    save({
      ...settings,
      functions: settings.functions.map((f) => (f.key === key ? { ...f, ...patch } : f)),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full bg-surface border border-border-soft flex items-center justify-center tap-scale">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-[16px] font-bold text-ink">Tuỳ chỉnh AI trả lời khách</h2>
      </div>

      <Panel
        title="Hướng dẫn thêm cho AI"
        subtitle="Gõ tự do — vd phong cách trả lời, điều cần nhấn mạnh. Các quy tắc an toàn (không bịa giá, không tự chốt giờ) luôn được giữ, dù anh viết gì ở đây."
      >
        <textarea
          value={settings.customPrompt}
          onChange={(e) => save({ ...settings, customPrompt: e.target.value })}
          placeholder='Vd: "Khách hỏi giá trẻ em thì luôn nhắc thêm có tặng 1 ảnh in. Trả lời ngắn, đừng dài dòng."'
          rows={4}
          className="w-full rounded-2xl border border-border-soft bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand-blue resize-none"
        />
      </Panel>

      <Panel
        title="Function AI có thể tự gọi"
        subtitle='Giống cách cấu hình AI Agent function ở UChat — sửa "khi nào gọi" để đổi hành vi, không cần đụng code. Nghiệp vụ thật phía sau mỗi hàm là cố định, an toàn cho dữ liệu.'
        action={<Sparkles size={16} className="text-brand-blue" />}
      >
        <div className="flex flex-col gap-3">
          {settings.functions.map((fn) => (
            <div key={fn.key} className="rounded-2xl border border-border-soft p-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-surface-soft text-ink-soft flex items-center justify-center shrink-0">
                  <Wand2 size={14} />
                </span>
                <input
                  value={fn.name}
                  onChange={(e) => updateFunction(fn.key, { name: e.target.value })}
                  placeholder="Tên hiển thị"
                  className="flex-1 rounded-lg border border-border-soft bg-surface px-2.5 py-1.5 text-[13px] font-medium text-ink outline-none focus:border-brand-blue"
                />
                <Toggle checked={fn.enabled} onChange={() => updateFunction(fn.key, { enabled: !fn.enabled })} />
              </div>
              <p className="text-[10px] text-muted px-0.5">{FUNCTION_OPERATION_LABEL[fn.key]}</p>
              <textarea
                value={fn.description}
                onChange={(e) => updateFunction(fn.key, { description: e.target.value })}
                placeholder="Khi nào AI nên gọi hàm này..."
                rows={2}
                disabled={!fn.enabled}
                className="w-full rounded-xl border border-border-soft bg-surface px-2.5 py-2 text-[12px] text-ink-soft outline-none focus:border-brand-blue resize-none disabled:opacity-50"
              />
            </div>
          ))}
        </div>
      </Panel>

      <p className="text-[10px] text-muted text-center px-2">
        Mọi thay đổi được lưu ngay và áp dụng cho lượt khách nhắn vào tiếp theo — không có nút "Lưu" riêng.
      </p>
    </div>
  );
}
