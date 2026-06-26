import { useMemo, useState } from "react";
import { ArrowLeft, Wallet, TrendingDown, TrendingUp, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { KpiCard } from "@/components/ui/KpiCard";
import { Panel } from "@/components/ui/Card";
import { orders, expenses, concepts, crewSettlements, staffById } from "@/data";
import { formatVND, formatVNDShort, addDays } from "@/lib/format";
import { useAppState } from "@/lib/appState";

type Range = "today" | "7d" | "month";

const today = "2026-06-25";

function inRange(date: string, range: Range) {
  if (range === "today") return date === today;
  if (range === "7d") return date >= addDays(today, -6) && date <= today;
  return date.startsWith("2026-06");
}

export default function FinancePage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>("month");
  const { dataVersion } = useAppState();

  // void dataVersion: kéo theo deps để làm mới sau khi tạo đơn thật (QuickAdd),
  // bản thân orders/expenses là mảng module-level nên không cần đọc trực tiếp.
  const filteredOrders = useMemo(
    () => { void dataVersion; return orders.filter((o) => inRange(o.date, range) && o.status !== "cancelled"); },
    [range, dataVersion],
  );
  const filteredExpenses = useMemo(
    () => { void dataVersion; return expenses.filter((e) => inRange(e.date, range)); },
    [range, dataVersion],
  );

  const revenue = filteredOrders.reduce((s, o) => s + o.deposit + (o.status === "completed" ? o.remaining : 0), 0);
  const cost = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const profit = revenue - cost;

  const byConcept = concepts.map((c) => {
    const rev = filteredOrders.filter((o) => o.conceptId === c.id).reduce((s, o) => s + o.total, 0);
    return { concept: c, revenue: rev };
  }).filter((r) => r.revenue > 0).sort((a, b) => b.revenue - a.revenue);
  const maxRevenue = Math.max(1, ...byConcept.map((r) => r.revenue));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <button onClick={() => navigate("/more")} className="w-8 h-8 rounded-full bg-surface border border-border-soft flex items-center justify-center tap-scale">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-[16px] font-bold text-ink">Trung tâm Tài chính</h2>
      </div>

      <SegmentedControl
        options={[
          { value: "today", label: "Hôm nay" },
          { value: "7d", label: "7 ngày" },
          { value: "month", label: "Tháng này" },
        ]}
        value={range}
        onChange={setRange}
      />

      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4">
        <KpiCard tone="blue" label="Doanh thu" value={formatVNDShort(revenue)} icon={<Wallet size={16} />} />
        <KpiCard tone="orange" label="Chi phí" value={formatVNDShort(cost)} icon={<TrendingDown size={16} />} />
        <KpiCard tone="green" label="Lợi nhuận tạm tính" value={formatVNDShort(profit)} icon={<TrendingUp size={16} />} />
      </div>

      <Panel title="Doanh thu theo Concept" subtitle="Trong khoảng thời gian đã chọn">
        <div className="flex flex-col gap-3">
          {byConcept.map(({ concept, revenue: rev }) => (
            <div key={concept.id}>
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span className="font-medium text-ink-soft flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: concept.color }} />
                  {concept.name}
                </span>
                <span className="font-semibold text-ink">{formatVND(rev)}</span>
              </div>
              <div className="h-2 rounded-full bg-surface-soft overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(rev / maxRevenue) * 100}%`, background: concept.color }} />
              </div>
            </div>
          ))}
          {byConcept.length === 0 && <p className="text-xs text-muted">Chưa có doanh thu trong khoảng này</p>}
        </div>
      </Panel>

      <Panel title="Quyết toán công thợ gần đây" subtitle={`${crewSettlements.length} đợt quyết toán`}>
        <div className="flex flex-col gap-2">
          {[...crewSettlements].reverse().slice(0, 5).map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-2xl border border-border-soft px-3 py-2.5">
              <div>
                <p className="text-[12px] font-semibold text-ink">
                  {s.role} · {s.staffId ? staffById(s.staffId)?.name ?? "—" : "Tất cả nhân sự"}
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  {s.fromDate.slice(8, 10)}/{s.fromDate.slice(5, 7)} – {s.toDate.slice(8, 10)}/{s.toDate.slice(5, 7)} · {s.items.length} đơn
                </p>
              </div>
              <span className="text-[12px] font-semibold text-success">{formatVND(s.total)}</span>
            </div>
          ))}
          {crewSettlements.length === 0 && <p className="text-xs text-muted">Chưa có đợt quyết toán nào — vào Hồ sơ &gt; Nhân sự để quyết toán.</p>}
        </div>
      </Panel>

      <Panel
        title="Chi phí vận hành"
        subtitle={`${filteredExpenses.length} khoản chi`}
        action={
          <button className="flex items-center gap-1 text-[12px] font-medium text-brand-blue">
            <Plus size={13} /> Thêm
          </button>
        }
      >
        <div className="flex flex-col gap-2">
          {filteredExpenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-2xl border border-border-soft px-3 py-2.5">
              <div>
                <p className="text-[12px] font-semibold text-ink">{e.note}</p>
                <p className="text-[11px] text-muted mt-0.5">{e.category} · {e.date.slice(8, 10)}/{e.date.slice(5, 7)}</p>
              </div>
              <span className="text-[12px] font-semibold text-danger">-{formatVND(e.amount)}</span>
            </div>
          ))}
          {filteredExpenses.length === 0 && <p className="text-xs text-muted">Không có chi phí nào trong khoảng này</p>}
        </div>
      </Panel>
    </div>
  );
}
