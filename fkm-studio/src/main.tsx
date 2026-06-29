import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadPersisted, maybeRunAutoBackup } from './lib/persistence'
import { applySampleVisibilityFromPref } from './lib/demoView'

// Nạp dữ liệu đã lưu trong trình duyệt (nếu có) TRƯỚC khi app render lần đầu,
// để mọi màn hình đọc thẳng từ orders/customers/concepts... đều thấy đúng dữ
// liệu thật ngay từ frame đầu tiên, không bị nhấp nháy dữ liệu mẫu rồi đổi.
loadPersisted()

// Áp dụng đúng chế độ DEMO/THẬT đã chọn lần trước (ẩn dữ liệu mẫu nếu đang ở
// chế độ THẬT) — chạy ngay sau loadPersisted, trước khi render frame đầu.
applySampleVisibilityFromPref()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Kiểm tra backup tự động theo lịch SAU khi app đã render (không chặn frame
// đầu tiên) — xem maybeRunAutoBackup trong persistence.ts để hiểu rõ giới
// hạn thật (chỉ chạy được lúc app đang mở, không phải lịch nền cấp hệ điều
// hành).
setTimeout(maybeRunAutoBackup, 0)
