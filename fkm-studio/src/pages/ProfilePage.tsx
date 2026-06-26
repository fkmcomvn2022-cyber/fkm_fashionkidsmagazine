import { useMemo, useState } from "react";
import { Search, ChevronRight, Wallet, UserPlus } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { StaffCard } from "@/components/profile/StaffCard";
import { StaffPaySheet } from "@/components/profile/StaffPaySheet";
import { StaffEditSheet } from "@/components/profile/StaffEditSheet";
import { CrewSettlementSheet } from "@/components/profile/CrewSettlementSheet";
import { CustomerDetailSheet } from "@/components/profile/CustomerDetailSheet";
import { QuickStaffForm } from "@/components/QuickStaffForm";
import { customers, staff, toggleStaffStatus, deleteStaff } from "@/data";
import { formatVND } from "@/lib/format";
import { useAppState } from "@/lib/appState";
import type { Customer, Staff } from "@/types";

type Tab = "customer" | "staff";

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>("customer");
  const [query, setQuery] = useState("");
  const [openCustomer, setOpenCustomer] = useState<Customer | null>(null);
  const [payStaff, setPayStaff] = useState<Staff | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const { dataVersion, bumpDataVersion, triggerRefresh } = useAppState();

  const handleToggleStaffStatus = (s: Staff) => {
    toggleStaffStatus(s.id);
    setStaffError(null);
    bumpDataVersion();
    triggerRefresh();
  };

  const handleDeleteStaff = (s: Staff) => {
    const result = deleteStaff(s.id);
    if (!result.ok) {
      setStaffError(result.reason ?? "Không thể xóa nhân sự này.");
      return;
    }
    setStaffError(null);
    bumpDataVersion();
    triggerRefresh();
  };

  const filteredCustomers = useMemo(
    () => {
      void dataVersion;
      return customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query));
    },
    [query, dataVersion],
  );
  const filteredStaff = useMemo(
    () => { void dataVersion; return staff.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())); },
    [query, dataVersion],
  );

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        options={[
          { value: "customer", label: "Khách hàng" },
          { value: "staff", label: "Nhân sự" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "customer" ? "Tìm khách hàng..." : "Tìm nhân sự..."}
          className="w-full rounded-2xl border border-border-soft bg-surface pl-10 pr-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-blue"
        />
      </div>

      {tab === "customer" ? (
        <div className="flex flex-col gap-2">
          {filteredCustomers.map((c) => (
            <button
              key={c.id}
              onClick={() => setOpenCustomer(c)}
              className="flex items-center gap-3 rounded-3xl bg-surface border border-border-soft shadow-soft p-3 text-left tap-scale"
            >
              <Avatar name={c.name} size={42} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-ink truncate">{c.name}</span>
                  {c.tag && <Badge color="#4f6df5" bg="#e8edff">{c.tag}</Badge>}
                </div>
                <p className="text-[11px] text-muted mt-0.5">{c.phone} · {c.totalOrders} đơn · {formatVND(c.totalSpent)}</p>
              </div>
              <ChevronRight size={16} className="text-muted shrink-0" />
            </button>
          ))}
          {filteredCustomers.length === 0 && <p className="text-sm text-muted text-center py-8">Không tìm thấy khách hàng</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAddStaffOpen(true)}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-success-soft text-success text-xs font-semibold py-2.5 tap-scale"
            >
              <UserPlus size={14} /> Thêm nhân sự
            </button>
            <button
              onClick={() => setSettlementOpen(true)}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand-blue-soft text-brand-blue text-xs font-semibold py-2.5 tap-scale"
            >
              <Wallet size={14} /> Quyết toán công thợ
            </button>
          </div>

          {staffError && (
            <div className="rounded-2xl bg-danger-soft text-danger text-xs font-medium px-3 py-2.5">{staffError}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {filteredStaff.map((s) => (
              <StaffCard
                key={s.id}
                staff={s}
                onPay={setPayStaff}
                onEdit={setEditingStaff}
                onToggleStatus={handleToggleStaffStatus}
                onDelete={handleDeleteStaff}
              />
            ))}
            {filteredStaff.length === 0 && <p className="text-sm text-muted text-center py-8 col-span-2">Không tìm thấy nhân sự</p>}
          </div>
        </>
      )}

      <CustomerDetailSheet customer={openCustomer} onClose={() => setOpenCustomer(null)} />
      <StaffPaySheet staff={payStaff} onClose={() => setPayStaff(null)} />
      <StaffEditSheet staff={editingStaff} onClose={() => setEditingStaff(null)} />
      <CrewSettlementSheet open={settlementOpen} onClose={() => setSettlementOpen(false)} />
      <Sheet open={addStaffOpen} onClose={() => setAddStaffOpen(false)} title="Thêm nhân sự">
        <QuickStaffForm onDone={() => setAddStaffOpen(false)} />
      </Sheet>
    </div>
  );
}
