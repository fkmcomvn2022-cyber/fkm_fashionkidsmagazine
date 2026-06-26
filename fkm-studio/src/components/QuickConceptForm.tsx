import { useState, type FormEvent } from "react";
import { useAppState } from "@/lib/appState";
import { Button } from "@/components/ui/Button";
import { createConcept } from "@/data";
import type { Concept } from "@/types";

const inputClass = "w-full rounded-2xl border border-border-soft bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-blue";

function FieldLabel({ children }: { children: string }) {
  return <label className="text-xs font-medium text-ink-soft mb-1.5 block">{children}</label>;
}

const categories: Concept["category"][] = ["Trẻ em", "Người lớn", "Gia đình", "Khác"];

export function QuickConceptForm({ onDone }: { onDone: () => void }) {
  const { bumpDataVersion, triggerRefresh } = useAppState();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Concept["category"]>("Khác");
  const [priceChild, setPriceChild] = useState<number | "">("");
  const [priceAdult, setPriceAdult] = useState<number | "">("");
  const [color, setColor] = useState("#4f6df5");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Vui lòng nhập tên concept.");
      return;
    }
    createConcept({
      name,
      category,
      color,
      priceChild: priceChild === "" ? undefined : priceChild,
      priceAdult: priceAdult === "" ? undefined : priceAdult,
    });
    bumpDataVersion();
    triggerRefresh();
    onDone();
  };

  return (
    <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
      {error && <div className="rounded-2xl bg-danger-soft text-danger text-xs font-medium px-3 py-2">{error}</div>}
      <div>
        <FieldLabel>Tên concept</FieldLabel>
        <input className={inputClass} placeholder="Ví dụ: Thu Mơ" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <FieldLabel>Đối tượng</FieldLabel>
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as Concept["category"])}>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Giá Trẻ em (mặc định 3.500.000)</FieldLabel>
          <input type="number" className={inputClass} placeholder="3500000" value={priceChild} onChange={(e) => setPriceChild(e.target.value ? Number(e.target.value) : "")} />
        </div>
        <div>
          <FieldLabel>Giá Người lớn (mặc định 5.500.000)</FieldLabel>
          <input type="number" className={inputClass} placeholder="5500000" value={priceAdult} onChange={(e) => setPriceAdult(e.target.value ? Number(e.target.value) : "")} />
        </div>
      </div>
      <div>
        <FieldLabel>Màu nhận diện</FieldLabel>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-[42px] rounded-2xl border border-border-soft" />
      </div>
      <Button type="submit" className="w-full mt-1">Tạo concept</Button>
    </form>
  );
}
