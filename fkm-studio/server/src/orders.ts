/**
 * Phase 5 — đọc/ghi phần "chọn ảnh" của 1 đơn, ngay trong state mirror chung
 * (xem store.ts). Backend không có model `Order` đầy đủ như frontend — chỉ
 * cần đủ field để phục vụ cổng chọn ảnh công khai (`/chon-anh/:orderId`):
 * danh sách link ảnh studio đã dán (`items`), khách đã chọn ảnh nào
 * (`selectedUrls`), và đã hoàn tất chưa (`completedAt`).
 *
 * Lưu ý quan trọng: studio dán `items` thông qua app frontend bình thường
 * (qua PUT /api/state — mirror toàn bộ state, xem persistence.ts) — backend
 * KHÔNG có route riêng để set `items`. Backend chỉ ghi 1 thứ duy nhất mà
 * frontend không tự biết: kết quả khách chọn (`selectedUrls`/`completedAt`),
 * vì đó đến từ trình duyệt của khách, không phải từ app studio.
 */
import type { StateSnapshot } from "./store.js";

interface PhotoSelectionShape {
  items?: string[];
  selectedUrls?: string[];
  completedAt?: string;
}

interface OrderShape {
  id?: string;
  code?: string;
  customerId?: string;
  photoSelection?: PhotoSelectionShape;
  [key: string]: unknown;
}

interface CustomerShape {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

function ordersOf(state: StateSnapshot): OrderShape[] {
  return Array.isArray(state.orders) ? (state.orders as OrderShape[]) : [];
}

function customerNameOf(state: StateSnapshot, customerId: string | undefined): string | undefined {
  if (!customerId) return undefined;
  const customers = Array.isArray(state.customers) ? (state.customers as CustomerShape[]) : [];
  return customers.find((c) => c.id === customerId)?.name;
}

export interface PhotoSelectionView {
  found: boolean;
  orderCode?: string;
  customerName?: string;
  items: string[];
  selectedUrls: string[];
  completedAt?: string;
}

/** Dùng cho GET /api/orders/:id/photo-selection — cổng chọn ảnh khách mở lên
 * sẽ gọi cái này để biết hiển thị ảnh nào, và khách đã chọn gì từ trước (mở
 * lại link vẫn thấy đúng lựa chọn cũ, sửa được tiếp). */
export function getPhotoSelectionForOrder(state: StateSnapshot, orderId: string): PhotoSelectionView {
  const order = ordersOf(state).find((o) => o.id === orderId);
  if (!order) return { found: false, items: [], selectedUrls: [] };
  return {
    found: true,
    orderCode: order.code,
    customerName: customerNameOf(state, order.customerId),
    items: order.photoSelection?.items ?? [],
    selectedUrls: order.photoSelection?.selectedUrls ?? [],
    completedAt: order.photoSelection?.completedAt,
  };
}

export interface SubmitPhotoSelectionResult {
  found: boolean;
  orderCode?: string;
  customerName?: string;
}

/** Dùng cho POST /api/orders/:id/photo-selection — khách bấm "Xác nhận chọn
 * xong". Ghi đè `selectedUrls` + đặt `completedAt` = giờ hiện tại. Không xoá
 * `items` (danh sách ảnh gốc studio đưa lên) — chỉ cập nhật phần khách chọn. */
export function submitPhotoSelection(state: StateSnapshot, orderId: string, selectedUrls: string[]): SubmitPhotoSelectionResult {
  const order = ordersOf(state).find((o) => o.id === orderId);
  if (!order) return { found: false };
  order.photoSelection = {
    items: order.photoSelection?.items ?? [],
    selectedUrls,
    completedAt: new Date().toISOString(),
  };
  return { found: true, orderCode: order.code, customerName: customerNameOf(state, order.customerId) };
}
