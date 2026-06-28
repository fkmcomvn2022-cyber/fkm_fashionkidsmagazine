import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowDown, ArrowUp, KeyRound, Loader2, Check, AlertCircle } from "lucide-react";
import { Sparkles, Wand2 } from "lucide-react";
import { Panel } from "@/components/ui/Card";
import { aiAutoReplySettings, setAiAutoReplySettings, type AiFunctionConfig } from "@/lib/aiReply";
import {
  fetchAiProviders,
  saveAiProviders,
  PROVIDER_LABEL,
  PROVIDER_NOTE,
  type AiProviderKey,
  type MaskedProviderConfig,
} from "@/lib/aiProviders";
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

/**
 * Panel cài đặt 3 nhà cung cấp AI — riêng biệt khỏi `settings` ở trên (xem
 * src/lib/aiProviders.ts) vì gọi trực tiếp /api/ai-providers, KHÔNG đi qua
 * bumpDataVersion()/state mirror (lý do bảo mật, xem comment đầu lib đó).
 * Thứ tự thẻ hiển thị = thứ tự ưu tiên thử khi 1 nhà bị lỗi (retry rồi mới
 * fallback sang nhà kế tiếp, xem server/src/ai.ts:withProviderFallback) — nút
 * mũi tên lên/xuống đổi thứ tự này.
 */
function ProviderSettingsPanel() {
  const [providers, setProviders] = useState<MaskedProviderConfig[] | null>(null);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [modelDrafts, setModelDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<AiProviderKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<AiProviderKey | null>(null);

  const load = () => {
    fetchAiProviders()
      .then((list) => {
        setProviders(list);
        setError(null);
      })
      .catch(() => setError("Chưa kết nối được tới server — kiểm tra lại backend đang chạy chưa."));
  };

  useEffect(load, []);

  const move = async (provider: AiProviderKey, dir: -1 | 1) => {
    if (!providers) return;
    const idx = providers.findIndex((p) => p.provider === provider);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= providers.length) return;
    const reordered = [...providers];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    setProviders(reordered); // cập nhật UI ngay, không chờ server, cho cảm giác phản hồi tức thì
    try {
      const order = reordered.map((p) => p.provider);
      const updated = await saveAiProviders([], order);
      setProviders(updated);
    } catch {
      setError("Không đổi được thứ tự ưu tiên — thử lại sau.");
      load();
    }
  };

  const saveOne = async (provider: AiProviderKey) => {
    setSavingKey(provider);
    setError(null);
    try {
      const patch = {
        provider,
        ...(keyDrafts[provider]?.trim() ? { apiKey: keyDrafts[provider].trim() } : {}),
        ...(modelDrafts[provider]?.trim() ? { model: modelDrafts[provider].trim() } : {}),
      };
      const updated = await saveAiProviders([patch]);
      setProviders(updated);
      setKeyDrafts((d) => ({ ...d, [provider]: "" })); // xoá draft key sau khi lưu — không giữ key thật trong state UI lâu hơn cần
      setJustSaved(provider);
      setTimeout(() => setJustSaved(null), 1800);
    } catch {
      setError("Không lưu được — kiểm tra lại kết nối server rồi thử lại.");
    } finally {
      setSavingKey(null);
    }
  };

  const toggleEnabled = async (provider: AiProviderKey, enabled: boolean) => {
    if (!providers) return;
    setProviders(providers.map((p) => (p.provider === provider ? { ...p, enabled } : p)));
    try {
      const updated = await saveAiProviders([{ provider, enabled }]);
      setProviders(updated);
    } catch {
      setError("Không lưu được trạng thái bật/tắt — thử lại sau.");
      load();
    }
  };

  return (
    <Panel
      title="Nhà cung cấp AI (key + model)"
      subtitle="Nhập API key của từng nhà — thẻ xếp trên cùng được thử trước, lỗi/quá tải thì tự thử lại rồi chuyển sang nhà kế tiếp theo thứ tự dưới đây."
      action={<KeyRound size={16} className="text-brand-blue" />}
    >
      {error && (
        <div className="flex items-center gap-1.5 rounded-xl bg-red-50 text-red-600 px-3 py-2 text-[11px] mb-3">
          <AlertCircle size={13} className="shrink-0" />
          {error}
        </div>
      )}
      {!providers ? (
        <div className="flex items-center justify-center py-6 text-muted text-[12px] gap-2">
          <Loader2 size={14} className="animate-spin" /> Đang tải cấu hình...
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {providers.map((p, idx) => (
            <div key={p.provider} className="rounded-2xl border border-border-soft p-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => move(p.provider, -1)}
                    disabled={idx === 0}
                    className="w-5 h-4 flex items-center justify-center text-muted disabled:opacity-25"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    onClick={() => move(p.provider, 1)}
                    disabled={idx === providers.length - 1}
                    className="w-5 h-4 flex items-center justify-center text-muted disabled:opacity-25"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
                <span className="w-6 h-6 rounded-full bg-surface-soft text-ink-soft text-[11px] font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <p className="flex-1 text-[13px] font-semibold text-ink">{PROVIDER_LABEL[p.provider]}</p>
                {justSaved === p.provider && <Check size={14} className="text-green-600" />}
                <Toggle checked={p.enabled} onChange={() => toggleEnabled(p.provider, !p.enabled)} />
              </div>

              <p className="text-[10px] text-muted px-0.5">{PROVIDER_NOTE[p.provider]}</p>

              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  value={keyDrafts[p.provider] ?? ""}
                  onChange={(e) => setKeyDrafts((d) => ({ ...d, [p.provider]: e.target.value }))}
                  placeholder={p.hasKey ? `Đã lưu key ${p.maskedKey} — gõ để đổi key khác` : "Dán API key vào đây"}
                  className="w-full rounded-xl border border-border-soft bg-surface px-2.5 py-2 text-[12px] text-ink outline-none focus:border-brand-blue"
                />
                <input
                  value={modelDrafts[p.provider] ?? p.model}
                  onChange={(e) => setModelDrafts((d) => ({ ...d, [p.provider]: e.target.value }))}
                  placeholder="Tên model"
                  className="w-full rounded-xl border border-border-soft bg-surface px-2.5 py-2 text-[12px] text-ink outline-none focus:border-brand-blue"
                />
                <button
                  onClick={() => saveOne(p.provider)}
                  disabled={savingKey === p.provider}
                  className="self-end rounded-lg bg-brand-blue text-white text-[12px] font-medium px-3 py-1.5 tap-scale disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingKey === p.provider && <Loader2 size={12} className="animate-spin" />}
                  Lưu
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
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

      <ProviderSettingsPanel />

      <Panel
        title="Hiệu suất & độ sáng tạo"
        subtitle="Tự chỉnh ngay ở đây, không cần báo lại — đổi là áp dụng cho tin khách nhắn vào tiếp theo."
      >
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[12px] font-medium text-ink">Số tin nhớ trong hội thoại</p>
              <span className="text-[12px] font-semibold text-brand-blue">{settings.historyWindow ?? 50} tin</span>
            </div>
            <input
              type="range"
              min={6}
              max={50}
              step={2}
              value={settings.historyWindow ?? 50}
              onChange={(e) => save({ ...settings, historyWindow: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-[10px] text-muted px-0.5 mt-1">Thấp hơn = tốn ít token hơn mỗi lần AI trả lời, nhưng AI mau "quên" ý khách nói ở các tin trước trong hội thoại dài. 50 là mức nhớ nhiều nhất.</p>
          </div>

          <div className="h-px bg-border-soft" />

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[12px] font-medium text-ink">Độ sáng tạo</p>
              <span className="text-[12px] font-semibold text-brand-blue">{(settings.temperature ?? 0.4).toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={settings.temperature ?? 0.4}
              onChange={(e) => save({ ...settings, temperature: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted px-0.5 mt-1">
              <span>Bám sát dữ liệu thật</span>
              <span>Tự nhiên, đa dạng câu chữ</span>
            </div>
          </div>

          <div className="h-px bg-border-soft" />

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[12px] font-medium text-ink">Tạm dừng AI khi nhân viên tự trả lời</p>
              <span className="text-[12px] font-semibold text-brand-blue">{settings.pauseMinutesAfterStaffReply ?? 30} phút</span>
            </div>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={settings.pauseMinutesAfterStaffReply ?? 30}
              onChange={(e) => save({ ...settings, pauseMinutesAfterStaffReply: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-[10px] text-muted px-0.5 mt-1">Khi anh/chị tự bấm gửi tin cho khách ở màn Hội thoại, AI tự ngừng trả lời riêng khách đó trong số phút này (để không chen ngang) — hết hạn AI tự bật lại và báo qua thông báo. Có thể chỉnh/bật lại sớm hơn ngay trong từng hội thoại.</p>
          </div>
        </div>
      </Panel>

      <Panel
        title="Hướng dẫn thêm cho AI"
        subtitle='Chia theo 5 ô riêng, giống cách cấu hình AI Agent ở UChat — gõ ô nào cũng được, để trống ô nào cũng không sao. Các quy tắc an toàn (không bịa giá, không tự chốt giờ) luôn được giữ, dù anh viết gì ở đây.'
      >
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[12px] font-medium text-ink mb-1">Constraints — Quy tắc bắt buộc</p>
            <textarea
              value={settings.constraintsPrompt ?? ""}
              onChange={(e) => save({ ...settings, constraintsPrompt: e.target.value })}
              placeholder='Vd: "Trả lời tối đa 3 ý. Không dùng markdown hoặc ký tự định dạng AI hay viết." — đây là quy tắc CỨNG về cách viết câu trả lời, ưu tiên cao nhất trong 5 ô.'
              rows={2}
              className="w-full rounded-2xl border border-border-soft bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand-blue resize-none"
            />
          </div>
          <div>
            <p className="text-[12px] font-medium text-ink mb-1">Persona — Vai trò/nhân cách AI</p>
            <textarea
              value={settings.personaPrompt ?? ""}
              onChange={(e) => save({ ...settings, personaPrompt: e.target.value })}
              placeholder='Vd: "Em tên là Mi, lễ tân FKM Studio. Xưng em, gọi khách là anh/chị. Nói chuyện nhẹ nhàng, nhiệt tình."'
              rows={2}
              className="w-full rounded-2xl border border-border-soft bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand-blue resize-none"
            />
          </div>
          <div>
            <p className="text-[12px] font-medium text-ink mb-1">Description — Giới thiệu chung studio</p>
            <textarea
              value={settings.descriptionPrompt ?? ""}
              onChange={(e) => save({ ...settings, descriptionPrompt: e.target.value })}
              placeholder='Vd: "FKM Studio chuyên chụp ảnh kỷ yếu/gia đình tại Q.7, hoạt động từ 2018, có 3 phòng chụp."'
              rows={2}
              className="w-full rounded-2xl border border-border-soft bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand-blue resize-none"
            />
          </div>
          <div>
            <p className="text-[12px] font-medium text-ink mb-1">Product — Ghi thêm về sản phẩm</p>
            <textarea
              value={settings.productPrompt ?? ""}
              onChange={(e) => save({ ...settings, productPrompt: e.target.value })}
              placeholder='Vd: "Ngoài các concept đang mở, studio có bán thêm khung ảnh gỗ, giá 150k/khung." (thông tin sản phẩm thật trong Concept vẫn tự sinh riêng, không cần gõ lại ở đây)'
              rows={2}
              className="w-full rounded-2xl border border-border-soft bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand-blue resize-none"
            />
          </div>
          <div>
            <p className="text-[12px] font-medium text-ink mb-1">Skill — AI biết làm gì thêm</p>
            <textarea
              value={settings.skillPrompt ?? ""}
              onChange={(e) => save({ ...settings, skillPrompt: e.target.value })}
              placeholder='Vd: "Khách hỏi giá trẻ em thì luôn nhắc thêm có tặng 1 ảnh in. Trả lời ngắn, đừng dài dòng." (chỉ là hướng dẫn trả lời, không phải nghiệp vụ AI tự gọi — xem mục Function bên dưới)'
              rows={2}
              className="w-full rounded-2xl border border-border-soft bg-surface px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-brand-blue resize-none"
            />
          </div>
        </div>
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
