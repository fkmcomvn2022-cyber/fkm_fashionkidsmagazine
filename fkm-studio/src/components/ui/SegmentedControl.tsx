import clsx from "clsx";

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="flex bg-surface-soft rounded-2xl p-1 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "flex-1 rounded-xl py-2 text-[13px] font-semibold tap-scale transition-colors",
            value === opt.value ? "bg-surface text-ink shadow-soft" : "text-muted",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
