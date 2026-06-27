import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { updateConcept, staff } from "@/data";
import { useAppState } from "@/lib/appState";
import type { Concept, StaffRole } from "@/types";

const inputClass =
  "w-full rounded-2xl border border-border-soft bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-blue";

interface ConceptEditSheetProps {
  concept: Concept | null;
  onClose: () => void;
}

/** Sheet sửa giá Trẻ em/Người lớn + thời lượng + ekip mặc định của 1 concept —
 * đây là nơi người dùng tự cài đặt giá riêng cho từng concept (thay cho mức
 * mặc định chung 3.500.000 / 5.500.000 được seed sẵn), và cài ekip mặc định
 * (Photo/Makeup/Stylist) để QuickOrderForm tự điền sẵn khi tạo đơn mới cho
 * concept này, đỡ phải gán lại từng đơn. */
export function ConceptEditSheet({ concept, onClose }: ConceptEditSheetProps) {
  const { bumpDataVersion, triggerRefresh } = useAppState();
  const [name, setName] = useState("");
  const [priceChild, setPriceChild] = useState(0);
  const [priceAdult, setPriceAdult] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [makeupMin, setMakeupMin] = useState(0);
  const [description, setDescription] = useState("");
  const [packageSummary, setPackageSummary] = useState("");
  const [sampleImageUrlsText, setSampleImageUrlsText] = useState("");
  const [ageGroups, setAgeGroups] = useState<{ label: string; urlsText: string }[]>([]);
  const [defaultPhotoStaffId, setDefaultPhotoStaffId] = useState("");
  const [defaultMakeupStaffId, setDefaultMakeupStaffId] = useState("");
  const [defaultStylistStaffId, setDefaultStylistStaffId] = useState("");
  const [crewCostPhoto, setCrewCostPhoto] = useState("");
  const [crewCostMakeupChild, setCrewCostMakeupChild] = useState("");
  const [crewCostMakeupAdult, setCrewCostMakeupAdult] = useState("");
  const [crewCostStylist, setCrewCostStylist] = useState("");
  const [crewCostRetouchPerPerson, setCrewCostRetouchPerPerson] = useState("");

  useEffect(() => {
    if (concept) {
      setName(concept.name);
      setPriceChild(concept.priceChild);
      setPriceAdult(concept.priceAdult);
      setDurationMin(concept.durationMin);
      setMakeupMin(concept.makeupMin);
      setDescription(concept.description ?? "");
      setPackageSummary(concept.packageSummary ?? "");
      setSampleImageUrlsText((concept.sampleImageUrls ?? []).join("\n"));
      setAgeGroups(
        (concept.samplePhotosByAge ?? []).map((g) => ({ label: g.label ?? "", urlsText: (g.urls ?? []).join("\n") })),
      );
      setDefaultPhotoStaffId(concept.defaultPhotoStaffId ?? "");
      setDefaultMakeupStaffId(concept.defaultMakeupStaffId ?? "");
      setDefaultStylistStaffId(concept.defaultStylistStaffId ?? "");
      setCrewCostPhoto(concept.crewCostPhoto != null ? String(concept.crewCostPhoto) : "");
      setCrewCostMakeupChild(concept.crewCostMakeupChild != null ? String(concept.crewCostMakeupChild) : "");
      setCrewCostMakeupAdult(concept.crewCostMakeupAdult != null ? String(concept.crewCostMakeupAdult) : "");
      setCrewCostStylist(concept.crewCostStylist != null ? String(concept.crewCostStylist) : "");
      setCrewCostRetouchPerPerson(concept.crewCostRetouchPerPerson != null ? String(concept.crewCostRetouchPerPerson) : "");
    }
  }, [concept]);

  if (!concept) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateConcept(concept.id, {
      name: name.trim() || concept.name,
      priceChild: priceChild || concept.priceChild,
      priceAdult: priceAdult || concept.priceAdult,
      durationMin: durationMin || concept.durationMin,
      makeupMin: makeupMin || concept.makeupMin,
      description: description.trim() || undefined,
      packageSummary: packageSummary.trim() || undefined,
      sampleImageUrls: sampleImageUrlsText.split("\n").map((s) => s.trim()).filter(Boolean),
      samplePhotosByAge: ageGroups
        .map((g) => ({ label: g.label.trim(), urls: g.urlsText.split("\n").map((s) => s.trim()).filter(Boolean) }))
        .filter((g) => g.label && g.urls.length > 0),
      defaultPhotoStaffId: defaultPhotoStaffId || undefined,
      defaultMakeupStaffId: defaultMakeupStaffId || undefined,
      defaultStylistStaffId: defaultStylistStaffId || undefined,
      crewCostPhoto: crewCostPhoto === "" ? undefined : Number(crewCostPhoto),
      crewCostMakeupChild: crewCostMakeupChild === "" ? undefined : Number(crewCostMakeupChild),
      crewCostMakeupAdult: crewCostMakeupAdult === "" ? undefined : Number(crewCostMakeupAdult),
      crewCostStylist: crewCostStylist === "" ? undefined : Number(crewCostStylist),
      crewCostRetouchPerPerson: crewCostRetouchPerPerson === "" ? undefined : Number(crewCostRetouchPerPerson),
    });
    bumpDataVersion();
    triggerRefresh();
    onClose();
  };

  return (
    <Sheet open={!!concept} onClose={onClose} title={`Sửa concept · ${concept.name}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field label="Tên concept">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={concept.name} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Giá Trẻ em">
            <input type="number" className={inputClass} value={priceChild} onChange={(e) => setPriceChild(Number(e.target.value))} placeholder={String(concept.priceChild)} />
          </Field>
          <Field label="Giá Người lớn">
            <input type="number" className={inputClass} value={priceAdult} onChange={(e) => setPriceAdult(Number(e.target.value))} placeholder={String(concept.priceAdult)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Thời gian chụp (phút)">
            <input type="number" className={inputClass} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} placeholder={String(concept.durationMin)} />
          </Field>
          <Field label="Thời gian makeup (phút)">
            <input type="number" className={inputClass} value={makeupMin} onChange={(e) => setMakeupMin(Number(e.target.value))} placeholder={String(concept.makeupMin)} />
          </Field>
        </div>

        <p className="text-[11px] text-muted -mt-1">Để trống ô nào thì giữ nguyên giá trị hiện tại.</p>

        <div className="h-px bg-border-soft my-0.5" />

        <div>
          <p className="text-xs font-medium text-ink-soft">Thông tin cho AI tư vấn khách</p>
          <p className="text-[11px] text-muted mt-0.5">AI đọc đúng nội dung này (không bịa thêm) khi khách hỏi kỹ về concept qua Facebook Messenger — xem [[fkm-studio-ai-chatbot-roadmap]].</p>
        </div>
        <Field label="Mô tả / đặc điểm chi tiết">
          <textarea
            className={inputClass}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Vd. Chụp ở phối cảnh nào, trang phục gì, phù hợp đối tượng nào..."
          />
        </Field>
        <Field label="Gói gồm những gì (cụ thể)">
          <textarea
            className={inputClass}
            rows={2}
            value={packageSummary}
            onChange={(e) => setPackageSummary(e.target.value)}
            placeholder="Vd. 1 bộ trang phục, trang điểm, 90 phút chụp, 20 ảnh đã chỉnh sửa..."
          />
        </Field>
        <Field label="Link ảnh mẫu gửi khách (mỗi link 1 dòng)">
          <textarea
            className={inputClass}
            rows={3}
            value={sampleImageUrlsText}
            onChange={(e) => setSampleImageUrlsText(e.target.value)}
            placeholder={"https://...\nhttps://..."}
          />
        </Field>

        <div>
          <p className="text-xs font-medium text-ink-soft">Ảnh mẫu riêng theo độ tuổi (tuỳ chọn)</p>
          <p className="text-[11px] text-muted mt-0.5">
            Để AI gửi đúng ảnh khi khách hỏi tuổi bé cụ thể (vd "bé 4 tuổi"). Đặt tên khung tuổi tự do (vd "3-5 tuổi"), AI tự khớp gần nhất. Để trống hết = AI dùng ảnh mẫu chung ở trên.
          </p>
        </div>
        {ageGroups.map((g, idx) => (
          <div key={idx} className="rounded-2xl border border-border-soft bg-surface-soft p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                className={inputClass}
                value={g.label}
                onChange={(e) => setAgeGroups((prev) => prev.map((it, i) => (i === idx ? { ...it, label: e.target.value } : it)))}
                placeholder='Vd. "3-5 tuổi"'
              />
              <button
                type="button"
                onClick={() => setAgeGroups((prev) => prev.filter((_, i) => i !== idx))}
                className="text-[12px] text-red-500 px-2 shrink-0"
              >
                Xóa
              </button>
            </div>
            <textarea
              className={inputClass}
              rows={2}
              value={g.urlsText}
              onChange={(e) => setAgeGroups((prev) => prev.map((it, i) => (i === idx ? { ...it, urlsText: e.target.value } : it)))}
              placeholder={"https://...\nhttps://..."}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setAgeGroups((prev) => [...prev, { label: "", urlsText: "" }])}
        >
          + Thêm khung tuổi
        </Button>

        <div className="h-px bg-border-soft my-0.5" />

        <div>
          <p className="text-xs font-medium text-ink-soft">Ekip mặc định</p>
          <p className="text-[11px] text-muted mt-0.5">Tự điền vào đơn mới của concept này — đỡ phải gán lại từng đơn. Sửa được riêng cho 1 đơn cụ thể khi ca đó đổi người.</p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <StaffSelect label="Photo" role="Photo" value={defaultPhotoStaffId} onChange={setDefaultPhotoStaffId} />
          <StaffSelect label="Makeup" role="Makeup" value={defaultMakeupStaffId} onChange={setDefaultMakeupStaffId} />
          <StaffSelect label="Stylist" role="Stylist" value={defaultStylistStaffId} onChange={setDefaultStylistStaffId} />
        </div>

        <div className="h-px bg-border-soft my-0.5" />

        <div>
          <p className="text-xs font-medium text-ink-soft">Công thợ riêng cho concept này (tuỳ chọn)</p>
          <p className="text-[11px] text-muted mt-0.5">Để trống = tính theo lương khai báo của nhân sự (Hồ sơ &gt; Nhân sự). Đặt mức ở đây nếu muốn công thay đổi theo độ khó của concept, không phụ thuộc ai làm — dùng khi Quyết toán công thợ.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Công Photo / đơn">
            <input type="number" className={inputClass} value={crewCostPhoto} onChange={(e) => setCrewCostPhoto(e.target.value)} placeholder="Theo lương NS" />
          </Field>
          <Field label="Công Stylist / đơn">
            <input type="number" className={inputClass} value={crewCostStylist} onChange={(e) => setCrewCostStylist(e.target.value)} placeholder="Theo lương NS" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Công Makeup / bé">
            <input type="number" className={inputClass} value={crewCostMakeupChild} onChange={(e) => setCrewCostMakeupChild(e.target.value)} placeholder="Theo lương NS" />
          </Field>
          <Field label="Công Makeup / người lớn">
            <input type="number" className={inputClass} value={crewCostMakeupAdult} onChange={(e) => setCrewCostMakeupAdult(e.target.value)} placeholder="Theo lương NS" />
          </Field>
        </div>
        <Field label="Công Retouch / người">
          <input type="number" className={inputClass} value={crewCostRetouchPerPerson} onChange={(e) => setCrewCostRetouchPerPerson(e.target.value)} placeholder="Theo lương NS" />
        </Field>

        <Button type="submit" className="w-full mt-1">Lưu thay đổi</Button>
      </form>
    </Sheet>
  );
}

function StaffSelect({ label, role, value, onChange }: { label: string; role: StaffRole; value: string; onChange: (v: string) => void }) {
  const options = staff.filter((s) => s.role === role);
  return (
    <Field label={label}>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Chưa gán</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
