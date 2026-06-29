import { RefreshCw, Cloud, CloudRain, Sun, CloudLightning, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/appState";
import { weatherForecast, orders, conceptById } from "@/data";
import { formatDateShort } from "@/lib/format";

const weatherIcon = {
  sun: Sun,
  cloud: Cloud,
  rain: CloudRain,
  storm: CloudLightning,
};

function nextShootWeather() {
  const upcoming = orders
    .filter((o) => o.status !== "completed" && o.status !== "cancelled")
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  if (!upcoming) return null;
  const w = weatherForecast.find((f) => f.date === upcoming.date);
  if (!w) return null;
  const concept = conceptById(upcoming.conceptId);
  return { weather: w, order: upcoming, concept };
}

export function TopHeader() {
  const { isDemo, refreshing, triggerRefresh } = useAppState();
  const navigate = useNavigate();
  const next = nextShootWeather();
  const Icon = next ? weatherIcon[next.weather.icon] : Cloud;

  return (
    <header className="sticky top-0 z-30 glass border-b border-border-soft">
      <div className="max-w-md mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <h1 className="text-[17px] font-bold tracking-tight text-ink">FKM STUDIO</h1>
              <span className="text-[10px] text-muted font-medium">v3.2</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Nút DEMO/THẬT đã chuyển vào Cài đặt > Chế độ Demo (gây lẫn khi ở
                header). Chỉ hiện 1 nhãn nhỏ khi đang BẬT Demo để khỏi quên. */}
            {isDemo && (
              <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-warning-soft text-warning">
                DEMO
              </span>
            )}
            <button
              onClick={triggerRefresh}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-soft text-ink-soft tap-scale"
              aria-label="Tải lại"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => navigate("/more")}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-soft text-ink-soft tap-scale"
              aria-label="Thêm"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>

        {next && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-soft">
            <Icon size={14} className="text-brand-blue" />
            <span>{formatDateShort(next.weather.date)}</span>
            <span className="text-muted">·</span>
            <span className="font-medium" style={{ color: next.concept?.color }}>
              {next.concept?.name}
            </span>
            <span className="text-muted">·</span>
            <span>{next.weather.tempLow}-{next.weather.tempHigh}°C</span>
            <span className="text-muted">·</span>
            <span>mưa {next.weather.rainChance}%</span>
          </div>
        )}
      </div>
    </header>
  );
}
