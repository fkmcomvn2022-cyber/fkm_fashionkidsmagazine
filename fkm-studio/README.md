# FKM Studio (Web App)

Bản dựng lại của FKM Studio dưới dạng web app (React + TypeScript + Vite + Tailwind CSS v4), thay cho backend Google Apps Script + Sheets cũ — mượt hơn, cảm giác native hơn, có thể cài vào màn hình chính như một app thật (PWA-ready).

**Trạng thái hiện tại:** giao diện tĩnh đầy đủ tất cả màn hình, dùng dữ liệu mẫu (mock data) mô phỏng đúng cấu trúc 11 sheet của hệ thống cũ. Chưa nối backend thật (Firebase/Postgres) — đây là bước tiếp theo.

## Chạy thử

```bash
npm install
npm run dev
```

Mở `http://localhost:5173`. Giao diện được thiết kế mobile-first (khung điện thoại `max-w-md`) — xem đẹp nhất khi thu nhỏ trình duyệt hoặc dùng chế độ giả lập thiết bị di động (DevTools).

```bash
npm run build    # build production vào dist/
npm run lint      # oxlint
```

## Các màn hình đã có

- **Home** — KPI hôm nay, banner concept đang chạy, lịch tuần, công việc cần làm, hội thoại gần đây
- **Ca chụp** — lịch theo ngày, "Smart Clusters" gom ca gần nhau, khung giờ trống, chi tiết đơn + thu tiền (VietQR mock)
- **Hồ sơ** — danh sách khách hàng (lịch sử đơn, link ảnh) và nhân sự (lương, thanh toán)
- **Sản phẩm** — Concept, Kho đồ (trang phục/dụng cụ), Dịch vụ thêm
- **Hội thoại** — khung chat theo từng khách (giả lập Messenger), mẫu trả lời nhanh, sao chép để gửi qua Zalo/SMS
- **Trung tâm Tài chính** — doanh thu/chi phí/lợi nhuận theo khoảng thời gian, theo concept
- **Trung tâm Dữ liệu** — quản lý database, Google Drive, backup
- **Thiết lập** — kết nối Messenger, AI tự động trả lời, thanh toán, hệ thống

## Kiến trúc

- `src/data/` — dữ liệu mẫu, mô phỏng schema Sheets cũ (Concepts, Staff, Customers, Orders, OperationTasks, Inventory, AddonServices, Expenses, Messages)
- `src/types/` — định nghĩa kiểu dữ liệu dùng chung
- `src/lib/` — hàm định dạng, thuật toán xếp lịch, state toàn cục
- `src/components/ui/` — design system (Card, Button, Badge, Avatar, KpiCard, Sheet...)
- `src/pages/` — các màn hình chính, nối qua React Router

## Bước tiếp theo (chưa làm)

Nối dữ liệu thật: thay `src/data/*` bằng gọi API tới Firebase hoặc Postgres, giữ nguyên các kiểu trong `src/types` để không phải sửa giao diện.
