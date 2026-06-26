import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Workflow, Zap, Filter, Play } from "lucide-react";
import { Panel } from "@/components/ui/Card";
import { automationSettings, setAutomationSettings, type AutomationRuleKey } from "@/lib/automation";
import { useAppState } from "@/lib/appState";

// Giai đoạn 6 (xem [[fkm-studio-ai-chatbot-roadmap]]) — màn "Automation" dạng
// danh sách luật + mũi tên tĩnh (KHÔNG phải canvas node kéo thả kiểu UChat).
// Lý do: mọi automation thật ở đây đều là CHUỖI THẲNG 1 trigger -> 1 condition
// -> 1 action, không rẽ nhánh. Phần "có nhánh" thật (AI tự quyết định gọi
// nghiệp vụ nào khi đang trả lời 1 tin cụ thể) đã do Gemini function-calling
// tự xử lý (xem Tuỳ chỉnh AI ở Thiết lập), không cần vẽ thêm ở đây.

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

function ChainStep({ icon, label, text, color }: { icon: React.ReactNode; label: string; text: string; color: string }) {
  return (
    <div className="flex items-start gap-2 flex-1 min-w-0">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">{label}</p>
        <p className="text-[12px] text-ink-soft leading-snug mt-0.5">{text}</p>
      </div>
    </div>
  );
}

export default function AutomationPage() {
  const navigate = useNavigate();
  const { bumpDataVersion } = useAppState();
  const [settings, setSettings] = useState(automationSettings);

  const toggleRule = (key: AutomationRuleKey) => {
    const next = {
      ...settings,
      rules: settings.rules.map((r) => (r.key === key ? { ...r, enabled: !r.enabled } : r)),
    };
    setSettings(next);
    setAutomationSettings(next);
    bumpDataVersion(); // mirror lên backend ngay — server (automationCron.ts/ai.ts/index.ts) đọc đúng cờ này ở lượt quét/webhook tiếp theo
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full bg-surface border border-border-soft flex items-center justify-center tap-scale">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-[16px] font-bold text-ink">Automation</h2>
      </div>

      <Panel
        title="Luật tự động cho khách Facebook"
        subtitle="Mỗi luật là 1 chuỗi: Khi nào xảy ra → Điều kiện kiểm tra → AI/hệ thống tự làm gì. Chỉ áp dụng cho khách có Facebook — khách kênh khác vẫn dùng nút nhắc tay ở Việc nổi bật như trước."
        action={<Workflow size={16} className="text-brand-blue" />}
      >
        <div className="flex flex-col gap-3">
          {settings.rules.map((rule) => (
            <div key={rule.key} className="rounded-2xl border border-border-soft p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-ink">{rule.label}</p>
                <Toggle checked={rule.enabled} onChange={() => toggleRule(rule.key)} />
              </div>
              <div className={`flex items-center gap-2 ${!rule.enabled ? "opacity-40" : ""}`}>
                <ChainStep icon={<Zap size={13} />} label="Khi nào" text={rule.trigger} color="bg-amber-100 text-amber-600" />
                <ArrowRight size={14} className="text-muted shrink-0 mt-3" />
                <ChainStep icon={<Filter size={13} />} label="Điều kiện" text={rule.condition} color="bg-blue-100 text-blue-600" />
                <ArrowRight size={14} className="text-muted shrink-0 mt-3" />
                <ChainStep icon={<Play size={13} />} label="Hành động" text={rule.action} color="bg-emerald-100 text-emerald-600" />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <p className="text-[10px] text-muted text-center px-2">
        Mọi thay đổi được lưu ngay. Cần GEMINI_API_KEY + FB_PAGE_ACCESS_TOKEN đã cấu hình ở server để các luật này thực sự chạy.
      </p>
    </div>
  );
}
