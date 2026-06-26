import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadPersisted } from './lib/persistence'

// Nạp dữ liệu đã lưu trong trình duyệt (nếu có) TRƯỚC khi app render lần đầu,
// để mọi màn hình đọc thẳng từ orders/customers/concepts... đều thấy đúng dữ
// liệu thật ngay từ frame đầu tiên, không bị nhấp nháy dữ liệu mẫu rồi đổi.
loadPersisted()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
