import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { concepts } from "@/data";
import { persistAll } from "@/lib/persistence";
import { getDemoMode, hideSampleData, showSampleData } from "@/lib/demoView";

interface AppStateValue {
  isDemo: boolean;
  toggleDemo: () => void;
  activeConceptId: string;
  setActiveConceptId: (id: string) => void;
  refreshing: boolean;
  triggerRefresh: () => void;
  quickAddOpen: boolean;
  setQuickAddOpen: (open: boolean) => void;
  /** Đặt khi bấm vào 1 ô trống trên thẻ lịch mini — mở sẵn form "Tạo đơn hàng" với ngày/giờ điền trước. */
  quickAddPrefill: { date: string; time: string } | null;
  openQuickAddOrder: (date: string, time: string) => void;
  clearQuickAddPrefill: () => void;
  /** Tăng mỗi khi có ghi dữ liệu thật (vd. tạo đơn hàng mới) — các trang dùng
   * useMemo trên dữ liệu (orders/customers...) nên thêm giá trị này vào deps
   * để tự làm mới mà không cần điều hướng lại trang. */
  dataVersion: number;
  bumpDataVersion: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  // isDemo = true: Chế độ Demo BẬT (hiện dữ liệu mẫu); false: dữ liệu thật.
  // Mặc định false (thật) — bật/tắt trong Cài đặt > Chế độ Demo.
  const [isDemo, setIsDemo] = useState(() => getDemoMode());
  const [activeConceptId, setActiveConceptId] = useState(concepts[0]?.id ?? "");
  const [refreshing, setRefreshing] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddPrefill, setQuickAddPrefill] = useState<{ date: string; time: string } | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  // Bật/tắt giữa DEMO (hiện mẫu) và THẬT (ẩn mẫu). Đây chỉ là LỌC XEM nên CHỈ
  // bump dataVersion để mọi màn render lại, KHÔNG persistAll (không ghi đè
  // localStorage) — dữ liệu mẫu vẫn còn nguyên trong stash + bộ nhớ lưu trữ.
  const toggleDemo = useCallback(() => {
    setIsDemo((prev) => {
      const next = !prev;
      if (next) showSampleData();
      else hideSampleData();
      return next;
    });
    setDataVersion((v) => v + 1);
  }, []);

  const openQuickAddOrder = useCallback((date: string, time: string) => {
    setQuickAddPrefill({ date, time });
    setQuickAddOpen(true);
  }, []);

  const clearQuickAddPrefill = useCallback(() => setQuickAddPrefill(null), []);

  // Mọi ghi dữ liệu thật (tạo đơn, tạo concept, sửa giờ nghỉ...) đều gọi
  // bumpDataVersion() ngay sau khi mutate — tận dụng đúng điểm này để lưu lại
  // dữ liệu vào trình duyệt, không cần sửa từng nơi gọi mutator.
  const bumpDataVersion = useCallback(() => {
    persistAll();
    setDataVersion((v) => v + 1);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  return (
    <AppStateContext.Provider
      value={{
        isDemo,
        toggleDemo,
        activeConceptId,
        setActiveConceptId,
        refreshing,
        triggerRefresh,
        quickAddOpen,
        setQuickAddOpen,
        quickAddPrefill,
        openQuickAddOrder,
        clearQuickAddPrefill,
        dataVersion,
        bumpDataVersion,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
