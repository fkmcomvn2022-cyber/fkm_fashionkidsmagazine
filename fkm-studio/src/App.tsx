import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppStateProvider } from "@/lib/appState";
import { AppShell } from "@/components/layout/AppShell";
import HomePage from "@/pages/HomePage";
import SchedulePage from "@/pages/SchedulePage";
import ChatPage from "@/pages/ChatPage";
import ProfilePage from "@/pages/ProfilePage";
import ProductPage from "@/pages/ProductPage";
import MorePage from "@/pages/MorePage";
import FinancePage from "@/pages/FinancePage";
import DataCenterPage from "@/pages/DataCenterPage";
import SettingsPage from "@/pages/SettingsPage";
import AiSettingsPage from "@/pages/AiSettingsPage";
import AutomationPage from "@/pages/AutomationPage";
import FacebookSettingsPage from "@/pages/FacebookSettingsPage";
import AssistantPage from "@/pages/AssistantPage";
import PhotoSelectionPortalPage from "@/pages/PhotoSelectionPortalPage";
import { isNativePlatform } from "@/lib/platform";

// /chon-anh/:orderId là trang công khai cho KHÁCH (Giai đoạn 5, xem
// fkm-studio-ai-chatbot-roadmap) — đặt ngoài <AppShell> để khách không thấy
// top header/bottom nav vận hành của studio, chỉ thấy đúng màn chọn ảnh.
function StudioApp() {
  // Bản mobile (Capacitor/Android) ẨN HẲN 2 màn cấu hình sâu AI/Automation —
  // không chỉ ẩn link điều hướng (xem SettingsPage) mà chặn luôn ở tầng route,
  // để gõ thẳng URL trên app Android cũng không vào được (xem src/lib/platform.ts).
  const showAdvancedAiRoutes = !isNativePlatform();
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/product" element={<ProductPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/data-center" element={<DataCenterPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {showAdvancedAiRoutes && <Route path="/settings/ai" element={<AiSettingsPage />} />}
        {showAdvancedAiRoutes && <Route path="/settings/automation" element={<AutomationPage />} />}
        {showAdvancedAiRoutes && <Route path="/settings/facebook" element={<FacebookSettingsPage />} />}
      </Routes>
    </AppShell>
  );
}

function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/chon-anh/:orderId" element={<PhotoSelectionPortalPage />} />
          <Route path="/*" element={<StudioApp />} />
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  );
}

export default App;
