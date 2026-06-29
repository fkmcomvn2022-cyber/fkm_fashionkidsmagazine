import { useEffect, useRef, useState } from "react";
import { Phone, Folder, Image, ImageDown, Images, MessageCircle, Pencil, Check, X, Upload, Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/Badge";
import { formatVND, formatDateShort } from "@/lib/format";
import { customerAvatarSrc } from "@/lib/avatar";
import { useAppState } from "@/lib/appState";
import { fileToThumbnailDataUrl } from "@/lib/imageThumb";
import { ordersByCustomer, conceptById } from "@/data";
import type { Customer } from "@/types";

export function CustomerDetailSheet({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const { bumpDataVersion } = useAppState();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Đồng bộ ô nhập theo khách đang mở; đổi khách thì reset về chế độ xem.
  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone ?? "");
      setAvatar(customer.avatar ?? "");
      setEditing(false);
      setEditErr(null);
    }
  }, [customer]);

  if (!customer) return null;
  const history = ordersByCustomer(customer.id).sort((a, b) => b.date.localeCompare(a.date));

  // Mutate-in-place đúng pattern app (xem [[fkm-studio-data-write-path]]) rồi
  // bumpDataVersion() để lưu + mirror lên server + làm mới UI.
  const saveProfile = () => {
    customer.name = name.trim() || customer.name;
    customer.phone = phone.trim();
    customer.avatar = avatar.trim() || undefined; // bỏ trống = quay về ảnh Facebook/chữ cái đầu
    bumpDataVersion();
    setEditing(false);
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setEditErr("Chỉ chọn được file ảnh.");
      return;
    }
    setUploading(true);
    setEditErr(null);
    try {
      // Ảnh đại diện nhỏ -> nén thành thumbnail data URL ngay trên máy, lưu
      // thẳng vào customer.avatar (KHÔNG cần Google Drive).
      const url = await fileToThumbnailDataUrl(file, 240, 0.7);
      setAvatar(url);
    } catch {
      setEditErr("Không xử lý được ảnh, thử ảnh khác.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sheet open={!!customer} onClose={onClose} title="Hồ sơ khách hàng">
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <Avatar
            name={editing ? name || customer.name : customer.name}
            src={editing ? avatar || customerAvatarSrc(customer) : customerAvatarSrc(customer)}
            size={72}
          />
          {editing ? (
            <>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 text-[10px] font-medium text-brand-blue bg-brand-blue-soft rounded-full px-2.5 py-1 tap-scale disabled:opacity-50"
              >
                {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Tải ảnh
              </button>
              {avatar && (
                <button onClick={() => setAvatar("")} className="text-[10px] font-medium text-danger tap-scale">
                  Bỏ ảnh
                </button>
              )}
            </>
          ) : (
            customer.tag && (
              <span className="text-[10px] font-semibold bg-brand-blue-soft text-brand-blue rounded-full px-2.5 py-1">{customer.tag}</span>
            )
          )}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex flex-col gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tên khách"
                className="w-full rounded-xl border border-border-soft bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-blue"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Số điện thoại"
                inputMode="tel"
                className="w-full rounded-xl border border-border-soft bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-blue"
              />
              <input
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="Hoặc dán link ảnh đại diện"
                className="w-full rounded-xl border border-border-soft bg-surface px-3 py-2 text-[11px] text-ink-soft outline-none focus:border-brand-blue"
              />
              {editErr && <p className="text-[11px] text-danger">{editErr}</p>}
              <div className="flex gap-2">
                <button onClick={saveProfile} disabled={uploading} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-brand-blue text-white text-[13px] font-semibold py-2 tap-scale disabled:opacity-50">
                  <Check size={14} /> Lưu
                </button>
                <button onClick={() => setEditing(false)} className="flex items-center justify-center gap-1.5 rounded-xl bg-surface-soft text-ink-soft text-[13px] font-medium px-4 py-2 tap-scale">
                  <X size={14} /> Huỷ
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-bold text-ink truncate">{customer.name}</h3>
                <button
                  onClick={() => setEditing(true)}
                  className="w-7 h-7 rounded-full bg-surface-soft text-ink-soft flex items-center justify-center shrink-0 tap-scale"
                  title="Sửa hồ sơ khách"
                >
                  <Pencil size={13} />
                </button>
              </div>
              <p className="text-[13px] text-muted mt-0.5">{customer.phone || "Chưa có số điện thoại"}</p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Stat label="Tổng đơn" value={String(customer.totalOrders)} />
                <Stat label="Tổng chi tiêu" value={formatVND(customer.totalSpent)} />
              </div>
              {customer.lastVisit && <p className="text-[11px] text-muted mt-2">Chụp gần nhất: {formatDateShort(customer.lastVisit)}/2026</p>}
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <a href={`tel:${customer.phone}`} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-brand-blue text-white text-sm font-medium py-2.5 tap-scale">
          <Phone size={14} /> Gọi
        </a>
        <button className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-surface-soft text-ink-soft text-sm font-medium py-2.5 tap-scale">
          <MessageCircle size={14} /> Nhắn tin
        </button>
      </div>

      {customer.notes && (
        <div className="mt-4 rounded-2xl bg-surface-soft p-3 text-xs text-ink-soft">{customer.notes}</div>
      )}

      <p className="text-xs font-semibold text-ink-soft mt-5 mb-2">Lịch sử đơn hàng</p>
      <div className="flex flex-col gap-2.5">
        {history.map((order) => {
          const concept = conceptById(order.conceptId);
          return (
            <div key={order.id} className="rounded-2xl border border-border-soft p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: concept?.color }} />
                  <span className="text-[13px] font-semibold text-ink">{concept?.name}</span>
                </div>
                <StatusPill status={order.status} />
              </div>
              <p className="text-[11px] text-muted mt-1">{formatDateShort(order.date)}/2026 · {order.time} · {formatVND(order.total)}</p>
              {order.photoLinks && (
                <div className="flex gap-1.5 mt-2">
                  {[
                    { url: order.photoLinks.folder, icon: Folder, label: "Folder" },
                    { url: order.photoLinks.raw, icon: Images, label: "Gốc" },
                    { url: order.photoLinks.selected, icon: Image, label: "Chọn" },
                    { url: order.photoLinks.final, icon: ImageDown, label: "Final" },
                  ].map(({ url, icon: Icon, label }) =>
                    url ? (
                      <a key={label} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-medium text-brand-blue bg-brand-blue-soft rounded-full px-2 py-1">
                        <Icon size={11} /> {label}
                      </a>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          );
        })}
        {history.length === 0 && <p className="text-xs text-muted">Chưa có đơn hàng nào</p>}
      </div>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-soft px-2.5 py-1.5">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="text-[13px] font-semibold text-ink">{value}</p>
    </div>
  );
}
