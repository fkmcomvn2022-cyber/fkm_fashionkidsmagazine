import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import clsx from "clsx";
import { useAppState } from "@/lib/appState";
import { Button } from "@/components/ui/Button";
import { concepts, conceptById, staff, addonServices, customerById, createOrder, updateOrder, computeOrderPricing, OrderValidationError } from "@/data";
import type { CreateOrderPersonInput, OrderValidationIssue } from "@/data/orders";
import { formatVND } from "@/lib/format";
import type { Audience, ExtraRole, Order, OrderKind, OrderPerson, PromoType, StaffRole } from "@/types";

const inputClass = "w-full rounded-2xl border border-border-soft bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-blue";

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-xs font-medium text-ink-soft mb-1.5 block">{children}</label>;
}

function SectionTitle({ children }: { children: string }) {
  return <h4 className="text-[13px] font-semibold text-ink mt-1">{children}</h4>;
}

const orderKinds: OrderKind[] = ["Chụp studio", "Thuê đồ", "Thuê set", "In ảnh", "Sự kiện"];
const sourceOptions = ["Facebook", "Zalo", "Giới thiệu", "Khách lẻ/Walk-in", "Tiktok", "Khác"];
const promoTypes: PromoType[] = ["Không có", "Giảm tiền", "Giảm %", "Khách VIP"];

let rowSeq = 0;
function makePersonRow(name = ""): PersonRow {
  rowSeq += 1;
  return { key: `row${rowSeq}`, name, audience: "Người lớn", age: undefined, outfitSize: "", conceptId: concepts[0]?.id ?? "" };
}

function personRowFromOrderPerson(p: OrderPerson): PersonRow {
  rowSeq += 1;
  return { key: `row${rowSeq}`, name: p.name, audience: p.audience, age: p.age, outfitSize: p.outfitSize ?? "", conceptId: p.conceptId };
}

interface PersonRow {
  key: string;
  name: string;
  audience: Audience;
  age?: number;
  outfitSize: string;
  conceptId: string;
}

interface ExtraRoleRow {
  key: string;
  role: string;
  staffId: string;
}

interface AddonRow {
  key: string;
  category: "Trang phục" | "Makeup layout" | "Chỉnh sửa" | "In ấn" | "Album";
  serviceId: string;
}

const addonQuickButtons: { label: string; category: AddonRow["category"] }[] = [
  { label: "+ Trang phục", category: "Trang phục" },
  { label: "+ Makeup layout", category: "Makeup layout" },
  { label: "+ Sửa ảnh", category: "Chỉnh sửa" },
  { label: "+ In/album", category: "In ấn" },
];

function addonRowFromServiceId(serviceId: string): AddonRow {
  const svc = addonServices.find((s) => s.id === serviceId);
  const knownCategories: AddonRow["category"][] = ["Trang phục", "Makeup layout", "Chỉnh sửa", "In ấn", "Album"];
  const category = knownCategories.find((c) => c === svc?.category) ?? "Trang phục";
  rowSeq += 1;
  return { key: `addon${rowSeq}`, category, serviceId };
}

export function QuickOrderForm({
  onDone,
  defaultDate,
  defaultTime,
  editOrder,
}: {
  onDone: () => void;
  defaultDate?: string;
  defaultTime?: string;
  /** Có truyền vào -> form chuyển sang chế độ "Sửa đơn": ẩn phần thông tin
   * khách (đổi khách không thuộc phạm vi sửa đơn), nút Lưu gọi updateOrder()
   * thay vì createOrder(). */
  editOrder?: Order;
}) {
  const { bumpDataVersion, triggerRefresh } = useAppState();

  const [kind, setKind] = useState<OrderKind>(editOrder?.kind ?? "Chụp studio");
  const [source, setSource] = useState(editOrder?.source ?? "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [socialContact, setSocialContact] = useState(editOrder?.socialContact ?? "");
  const [mainDob, setMainDob] = useState(editOrder?.mainDob ?? "");
  const [date, setDate] = useState(editOrder?.date ?? defaultDate ?? "2026-06-25");
  const [time, setTime] = useState(editOrder?.time ?? defaultTime ?? "09:00");

  const [peopleCount, setPeopleCount] = useState(editOrder?.people.length ?? 1);
  const [namesCsv, setNamesCsv] = useState("");
  const [rows, setRows] = useState<PersonRow[]>(
    editOrder ? editOrder.people.map(personRowFromOrderPerson) : [makePersonRow()],
  );

  const [photoStaffId, setPhotoStaffId] = useState(editOrder?.photoStaffId ?? "");
  const [makeupStaffId, setMakeupStaffId] = useState(editOrder?.makeupStaffId ?? "");
  const [stylistStaffId, setStylistStaffId] = useState(editOrder?.stylistStaffId ?? "");
  const [retoucherId, setRetoucherId] = useState(editOrder?.retoucherId ?? "");
  const [extraRoles, setExtraRoles] = useState<ExtraRoleRow[]>(
    editOrder?.extraRoles?.map((r) => ({ key: r.id, role: r.role, staffId: r.staffId ?? "" })) ?? [],
  );
  // Ekip mặc định của concept tự điền vào đơn MỚI (không áp dụng khi sửa đơn cũ
  // — giữ đúng ekip thực tế đã gán). `ekipTouched` = true ngay khi người dùng tự
  // sửa 1 trong 3 ô Photo/Makeup/Stylist, để lần đổi concept sau đó không ghi đè
  // mất lựa chọn họ vừa tự chọn cho riêng đơn này.
  const [ekipTouched, setEkipTouched] = useState(false);
  const primaryConceptIdForEkip = rows[0]?.conceptId;
  useEffect(() => {
    if (editOrder || ekipTouched) return;
    const concept = conceptById(primaryConceptIdForEkip ?? "");
    if (!concept) return;
    setPhotoStaffId(concept.defaultPhotoStaffId ?? "");
    setMakeupStaffId(concept.defaultMakeupStaffId ?? "");
    setStylistStaffId(concept.defaultStylistStaffId ?? "");
  }, [primaryConceptIdForEkip, editOrder, ekipTouched]);
  const setPhotoStaffIdManual = (v: string) => { setEkipTouched(true); setPhotoStaffId(v); };
  const setMakeupStaffIdManual = (v: string) => { setEkipTouched(true); setMakeupStaffId(v); };
  const setStylistStaffIdManual = (v: string) => { setEkipTouched(true); setStylistStaffId(v); };

  const [surcharge, setSurcharge] = useState(editOrder?.surcharge ?? 0);
  const [promoType, setPromoType] = useState<PromoType>(editOrder?.promoType ?? "Không có");
  const [promoValue, setPromoValue] = useState(editOrder?.promoValue ?? 0);
  const [deposit, setDeposit] = useState(editOrder?.deposit ?? 0);
  const [promoNote, setPromoNote] = useState(editOrder?.promoNote ?? "");
  const [addonRows, setAddonRows] = useState<AddonRow[]>(
    editOrder?.addonServiceIds.map(addonRowFromServiceId) ?? [],
  );
  const [notes, setNotes] = useState(editOrder?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  // Cảnh báo validate chặt (concept chưa mở bán / trùng ca ekip) — học theo
  // `Allow_Conflict` của bản Apps Script: lần submit đầu chặn lại để người
  // dùng đọc rõ từng cảnh báo, bấm "Vẫn tạo đơn" mới submit lại với cờ bỏ
  // qua chặn (xem `previewOrderIssues`/`OrderValidationError` ở data/orders.ts).
  const [issues, setIssues] = useState<OrderValidationIssue[]>([]);

  const editCustomer = editOrder ? customerById(editOrder.customerId) : undefined;

  // Đồng bộ số dòng "Người chụp" theo "Tổng số người chụp", giữ lại dữ liệu đã nhập của dòng cũ.
  const syncPeopleCount = (count: number) => {
    const safe = Math.max(1, Math.floor(count) || 1);
    setPeopleCount(safe);
    setRows((prev) => {
      if (safe === prev.length) return prev;
      if (safe < prev.length) return prev.slice(0, safe);
      return [...prev, ...Array.from({ length: safe - prev.length }, () => makePersonRow())];
    });
  };

  // Tách "Tên từng người, cách nhau dấu phẩy" và gán lần lượt vào tên các dòng.
  const applyNamesCsv = (csv: string) => {
    setNamesCsv(csv);
    const names = csv.split(",").map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    setRows((prev) => prev.map((row, i) => (names[i] !== undefined ? { ...row, name: names[i] } : row)));
    if (names.length > rows.length) syncPeopleCount(names.length);
  };

  const updateRow = (key: string, patch: Partial<PersonRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addAddonRow = (category: AddonRow["category"]) => {
    const first = addonServices.find((s) => s.category === category);
    if (!first) return;
    rowSeq += 1;
    setAddonRows((prev) => [...prev, { key: `addon${rowSeq}`, category, serviceId: first.id }]);
  };
  const removeAddonRow = (key: string) => setAddonRows((prev) => prev.filter((r) => r.key !== key));
  const updateAddonRow = (key: string, serviceId: string) =>
    setAddonRows((prev) => prev.map((r) => (r.key === key ? { ...r, serviceId } : r)));

  const addExtraRole = () => {
    rowSeq += 1;
    setExtraRoles((prev) => [...prev, { key: `extra${rowSeq}`, role: "", staffId: "" }]);
  };
  const removeExtraRole = (key: string) => setExtraRoles((prev) => prev.filter((r) => r.key !== key));
  const updateExtraRole = (key: string, patch: Partial<ExtraRoleRow>) =>
    setExtraRoles((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const peopleForPricing: CreateOrderPersonInput[] = useMemo(
    () => rows.map((r) => ({ name: r.name, audience: r.audience, age: r.age, outfitSize: r.outfitSize, conceptId: r.conceptId })),
    [rows],
  );

  const pricing = useMemo(
    () => computeOrderPricing(peopleForPricing, addonRows.map((a) => a.serviceId), surcharge || 0, promoType, promoValue || 0),
    [peopleForPricing, addonRows, surcharge, promoType, promoValue],
  );
  const remaining = Math.max(0, pricing.total - (deposit || 0));

  // Mặc định theo concept của người chụp đầu tiên — nếu chưa có ưu đãi/quà tặng
  // mặc định nào được khai báo cho concept đó (v1: không có catalog mặc định),
  // hiển thị fallback tĩnh đúng theo spec.
  const primaryConcept = concepts.find((c) => c.id === rows[0]?.conceptId);

  const handleSubmit = (e: { preventDefault: () => void }, allowConflict = false) => {
    e.preventDefault();
    if (!editOrder && !customerName.trim()) {
      setError("Vui lòng nhập tên khách / phụ huynh.");
      return;
    }
    if (rows.some((r) => !r.conceptId)) {
      setError("Vui lòng chọn concept cho từng người chụp.");
      return;
    }
    setError(null);

    const extraRolesPayload: ExtraRole[] = extraRoles.filter((r) => r.role.trim()).map((r) => ({ id: r.key, role: r.role.trim(), staffId: r.staffId || undefined }));

    try {
      if (editOrder) {
        updateOrder(editOrder.id, {
          kind,
          source: source || undefined,
          date,
          time,
          people: peopleForPricing,
          primaryConceptId: rows[0]?.conceptId,
          photoStaffId: photoStaffId || undefined,
          makeupStaffId: makeupStaffId || undefined,
          stylistStaffId: stylistStaffId || undefined,
          retoucherId: retoucherId || undefined,
          extraRoles: extraRolesPayload,
          addonServiceIds: addonRows.map((a) => a.serviceId),
          surcharge: surcharge || 0,
          promoType,
          promoValue: promoValue || 0,
          promoNote: promoNote || undefined,
          deposit: deposit || 0,
          notes: notes || undefined,
          allowConflict,
        });
      } else {
        createOrder({
          kind,
          source: source || undefined,
          customerName,
          customerPhone: customerPhone || undefined,
          socialContact: socialContact || undefined,
          mainDob: mainDob || undefined,
          date,
          time,
          people: peopleForPricing,
          photoStaffId: photoStaffId || undefined,
          makeupStaffId: makeupStaffId || undefined,
          stylistStaffId: stylistStaffId || undefined,
          retoucherId: retoucherId || undefined,
          extraRoles: extraRolesPayload,
          addonServiceIds: addonRows.map((a) => a.serviceId),
          surcharge: surcharge || 0,
          promoType,
          promoValue: promoValue || 0,
          promoNote: promoNote || undefined,
          deposit: deposit || 0,
          notes: notes || undefined,
          allowConflict,
        });
      }
    } catch (err) {
      if (err instanceof OrderValidationError) {
        setIssues(err.issues);
        return;
      }
      throw err;
    }

    setIssues([]);
    bumpDataVersion();
    triggerRefresh();
    onDone();
  };

  return (
    <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
      {defaultDate && defaultTime && (
        <div className="rounded-2xl bg-brand-blue-soft text-brand-blue text-xs font-medium px-3 py-2">
          Đã điền sẵn theo ô bạn chọn trên thẻ lịch — chỉnh lại nếu cần.
        </div>
      )}
      {error && <div className="rounded-2xl bg-danger-soft text-danger text-xs font-medium px-3 py-2">{error}</div>}
      {issues.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium px-3 py-2.5 flex flex-col gap-2">
          <p className="font-semibold">Phát hiện {issues.length} cảnh báo trước khi lưu:</p>
          <ul className="flex flex-col gap-1 list-disc pl-4">
            {issues.map((iss, i) => (
              <li key={i}>{iss.message}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            className="self-start rounded-2xl bg-amber-600 text-white text-[12px] font-semibold px-3 py-1.5 tap-scale"
          >
            Vẫn {editOrder ? "lưu" : "tạo đơn"} dù có cảnh báo
          </button>
        </div>
      )}

      {/* Loại đơn + Nguồn */}
      <div>
        <FieldLabel>Loại đơn</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {orderKinds.map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              className={clsx(
                "rounded-2xl px-3 py-1.5 text-[12px] font-semibold tap-scale transition-colors",
                kind === k ? "bg-brand-blue text-white" : "bg-surface-soft text-ink-soft",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Nguồn</FieldLabel>
        <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Chưa rõ (mặc định)</option>
          {sourceOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Thông tin khách */}
      {editOrder ? (
        <div className="rounded-2xl bg-surface-soft p-3 flex items-center justify-between">
          <span className="text-xs text-ink-soft">Khách hàng</span>
          <span className="text-sm font-semibold text-ink">{editCustomer?.name ?? "—"} {editCustomer?.phone ? `· ${editCustomer.phone}` : ""}</span>
        </div>
      ) : (
        <>
          <SectionTitle>Thông tin khách</SectionTitle>
          <div>
            <FieldLabel>Tên khách / phụ huynh</FieldLabel>
            <input className={inputClass} placeholder="Tên khách" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>SĐT</FieldLabel>
              <input className={inputClass} placeholder="09xxxxxxxx" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Facebook/Zalo</FieldLabel>
              <input className={inputClass} placeholder="Không bắt buộc" value={socialContact} onChange={(e) => setSocialContact(e.target.value)} />
            </div>
          </div>
          <div>
            <FieldLabel>Ngày sinh khách/bé</FieldLabel>
            <input type="date" className={inputClass} value={mainDob} onChange={(e) => setMainDob(e.target.value)} />
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Ngày hẹn</FieldLabel>
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Giờ hẹn</FieldLabel>
          <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      {/* Người chụp */}
      <SectionTitle>Người chụp</SectionTitle>
      <div>
        <FieldLabel>Tổng số người chụp</FieldLabel>
        <input type="number" min={1} className={inputClass} value={peopleCount} onChange={(e) => syncPeopleCount(Number(e.target.value))} />
      </div>
      <div>
        <FieldLabel>Tên từng người, cách nhau dấu phẩy</FieldLabel>
        <input
          className={inputClass}
          placeholder="Ví dụ: Bé Tôm, Mẹ Mai"
          value={namesCsv}
          onChange={(e) => applyNamesCsv(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row, i) => {
          const concept = concepts.find((c) => c.id === row.conceptId);
          return (
            <div key={row.key} className="rounded-2xl border border-border-soft p-3 flex flex-col gap-2.5">
              <p className="text-[11px] font-semibold text-muted">Người chụp #{i + 1} · bắt buộc chọn đúng Trẻ em/Người lớn để lấy đúng giá &amp; công makeup</p>
              <input
                className={inputClass}
                placeholder="Tên người chụp"
                value={row.name}
                onChange={(e) => updateRow(row.key, { name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2.5">
                <select className={inputClass} value={row.audience} onChange={(e) => updateRow(row.key, { audience: e.target.value as Audience })}>
                  <option value="Người lớn">Người lớn</option>
                  <option value="Trẻ em">Trẻ em</option>
                </select>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="Tuổi"
                  value={row.age ?? ""}
                  onChange={(e) => updateRow(row.key, { age: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  className={inputClass}
                  placeholder="Size đồ"
                  value={row.outfitSize}
                  onChange={(e) => updateRow(row.key, { outfitSize: e.target.value })}
                />
                <select className={inputClass} value={row.conceptId} onChange={(e) => updateRow(row.key, { conceptId: e.target.value })}>
                  {concepts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {concept && (
                <p className="text-[11px] text-muted">
                  {concept.name} · TE {formatVND(concept.priceChild)} / NL {formatVND(concept.priceAdult)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Ekip */}
      <SectionTitle>Ekip thực tế của đơn</SectionTitle>
      <p className="text-[11px] text-muted -mt-1">Photo/Makeup/Stylist tự điền theo ekip mặc định của concept (cài ở Sản phẩm &gt; Sửa concept) — đổi riêng cho đơn này nếu ca đó có thay đổi người.</p>
      <div className="grid grid-cols-2 gap-3">
        <StaffPicker label="Photo" role="Photo" value={photoStaffId} onChange={setPhotoStaffIdManual} />
        <StaffPicker label="Makeup" role="Makeup" value={makeupStaffId} onChange={setMakeupStaffIdManual} />
        <StaffPicker label="Stylist" role="Stylist" value={stylistStaffId} onChange={setStylistStaffIdManual} />
        <StaffPicker label="Retoucher" role="Retoucher" value={retoucherId} onChange={setRetoucherId} />
      </div>
      <div className="flex flex-col gap-2">
        {extraRoles.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <input className={inputClass} placeholder="Vai trò phát sinh (vd. Hỗ trợ)" value={r.role} onChange={(e) => updateExtraRole(r.key, { role: e.target.value })} />
            <select className={clsx(inputClass, "max-w-[40%]")} value={r.staffId} onChange={(e) => updateExtraRole(r.key, { staffId: e.target.value })}>
              <option value="">Chưa gán</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => removeExtraRole(r.key)} className="w-9 h-9 rounded-2xl bg-danger-soft text-danger flex items-center justify-center tap-scale shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
        <button type="button" onClick={addExtraRole} className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border-soft py-2 text-xs font-medium text-brand-blue tap-scale">
          <Plus size={13} /> Thêm vai trò phát sinh
        </button>
      </div>

      {/* Tiền - ưu đãi - quà tặng */}
      <SectionTitle>Tiền · ưu đãi · quà tặng</SectionTitle>
      <div className="rounded-2xl bg-surface-soft p-3 text-[12px] text-ink-soft flex justify-between">
        <span>Giá chụp concept (combo mặc định)</span>
        <span className="font-semibold text-ink">{formatVND(pricing.subtotal)}</span>
      </div>
      <div>
        <FieldLabel>Phụ thu nhanh (nếu có)</FieldLabel>
        <input type="number" className={inputClass} value={surcharge} onChange={(e) => setSurcharge(Number(e.target.value) || 0)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Ưu đãi nhập tay</FieldLabel>
          <select className={inputClass} value={promoType} onChange={(e) => setPromoType(e.target.value as PromoType)}>
            {promoTypes.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Giá trị ưu đãi {promoType === "Giảm %" ? "(%)" : promoType === "Giảm tiền" ? "(VNĐ)" : ""}</FieldLabel>
          <input type="number" className={inputClass} value={promoValue} onChange={(e) => setPromoValue(Number(e.target.value) || 0)} disabled={promoType === "Không có"} />
        </div>
      </div>
      <div>
        <FieldLabel>Đã thu/cọc</FieldLabel>
        <input type="number" className={inputClass} value={deposit} onChange={(e) => setDeposit(Number(e.target.value) || 0)} />
      </div>
      <div>
        <FieldLabel>Ghi chú ưu đãi/quà</FieldLabel>
        <textarea className={inputClass} rows={2} placeholder="Vd. Mẹ con tặng thêm ảnh in, giảm 10%..." value={promoNote} onChange={(e) => setPromoNote(e.target.value)} />
      </div>
      <div className="rounded-2xl bg-surface-soft p-3 text-[11px] text-muted flex flex-col gap-1">
        <span>Ưu đãi áp dụng: {primaryConcept ? "Không có ưu đãi mặc định cho concept này" : "—"}</span>
        <span>Quà tặng: {primaryConcept ? "Không có quà tặng mặc định cho concept này" : "—"}</span>
      </div>

      {/* Dịch vụ bổ trợ phát sinh */}
      <SectionTitle>Dịch vụ bổ trợ phát sinh</SectionTitle>
      <p className="text-[11px] text-muted -mt-1">Chỉ thêm khi khách phát sinh ngoài combo concept.</p>
      <div className="flex flex-wrap gap-1.5">
        {addonQuickButtons.map((b) => (
          <button
            type="button"
            key={b.category}
            onClick={() => addAddonRow(b.category)}
            className="rounded-2xl bg-brand-blue-soft text-brand-blue text-[12px] font-semibold px-3 py-1.5 tap-scale"
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {addonRows.map((row) => {
          const options = addonServices.filter((s) => s.category === row.category);
          const selected = addonServices.find((s) => s.id === row.serviceId);
          return (
            <div key={row.key} className="flex items-center gap-2">
              <select className={inputClass} value={row.serviceId} onChange={(e) => updateAddonRow(row.key, e.target.value)}>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} · {formatVND(o.price)}</option>
                ))}
              </select>
              <button type="button" onClick={() => removeAddonRow(row.key)} className="w-9 h-9 rounded-2xl bg-danger-soft text-danger flex items-center justify-center tap-scale shrink-0">
                <X size={14} />
              </button>
              {selected && <span className="sr-only">{selected.name}</span>}
            </div>
          );
        })}
      </div>

      {/* Tổng */}
      <div className="rounded-2xl bg-surface-soft p-3.5 flex flex-col gap-1.5">
        <p className="text-[11px] text-muted">
          Đang tính: {formatVND(pricing.subtotal)} (concept) + {formatVND(pricing.addonsTotal)} (bổ trợ) + {formatVND(pricing.surcharge)} (phụ thu) − {formatVND(pricing.discount)} (ưu đãi)
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Tổng phải thu</span>
          <span className="text-base font-bold text-brand-blue">{formatVND(pricing.total)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-soft">Còn lại</span>
          <span className="text-sm font-semibold text-ink">{formatVND(remaining)}</span>
        </div>
      </div>

      {/* Ghi chú */}
      <div>
        <FieldLabel>Ghi chú</FieldLabel>
        <textarea className={inputClass} rows={2} placeholder="Ghi chú thêm cho đơn này" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <Button type="submit" className="w-full mt-1">{editOrder ? "Lưu thay đổi" : "Lưu đơn"}</Button>
    </form>
  );
}

function StaffPicker({ label, role, value, onChange }: { label: string; role: StaffRole; value: string; onChange: (v: string) => void }) {
  const options = staff.filter((s) => s.role === role);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Chưa gán</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  );
}
