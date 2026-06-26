import type { InventoryItem, AddonService, Expense } from "@/types";

export const inventory: InventoryItem[] = [
  { id: "i1", conceptId: "c1", name: "Áo dài lụa vàng", size: "M", condition: "Tốt", rentalPrice: 150000, quantity: 4, inUse: 1 },
  { id: "i2", conceptId: "c1", name: "Áo dài lụa vàng", size: "L", condition: "Cần giặt", rentalPrice: 150000, quantity: 3, inUse: 2 },
  { id: "i3", conceptId: "c2", name: "Set váy tạp chí hồng", size: "S", condition: "Tốt", rentalPrice: 90000, quantity: 5, inUse: 2 },
  { id: "i4", conceptId: "c2", name: "Mũ phụ kiện kid", size: "Free", condition: "Tốt", rentalPrice: 30000, quantity: 6, inUse: 1 },
  { id: "i5", conceptId: "c3", name: "Áo dài vintage trắng", size: "M", condition: "Đang sửa", rentalPrice: 180000, quantity: 2, inUse: 0 },
  { id: "i6", conceptId: "c4", name: "Set đồng phục gia đình xanh", size: "Combo", condition: "Tốt", rentalPrice: 250000, quantity: 4, inUse: 1 },
  { id: "i7", conceptId: "c5", name: "Set sơ sinh bông gòn", size: "Free", condition: "Hư hỏng", rentalPrice: 60000, quantity: 2, inUse: 0 },
];

export const addonServices: AddonService[] = [
  { id: "sv1", name: "In ảnh 13x18 (10 tấm)", category: "In ấn", price: 150000, unit: "bộ" },
  { id: "sv2", name: "Album ảnh cao cấp", category: "Album", price: 590000, unit: "cuốn" },
  { id: "sv3", name: "Sửa thêm ảnh", category: "Chỉnh sửa", price: 50000, unit: "tấm" },
  { id: "sv4", name: "Phụ thu cuối tuần", category: "Phụ thu", price: 200000, unit: "đơn" },
  { id: "sv5", name: "Trang điểm thêm người", category: "Phụ thu", price: 200000, unit: "người" },
  { id: "sv6", name: "Thuê thêm trang phục", category: "Trang phục", price: 150000, unit: "bộ" },
  { id: "sv7", name: "Trang phục cao cấp/đặc biệt", category: "Trang phục", price: 350000, unit: "bộ" },
  { id: "sv8", name: "Makeup layout thêm", category: "Makeup layout", price: 250000, unit: "layout" },
  { id: "sv9", name: "Makeup chuyên sâu (dạ hội/cô dâu)", category: "Makeup layout", price: 450000, unit: "layout" },
];

export const expenses: Expense[] = [
  { id: "e1", date: "2026-06-20", category: "Nguyên liệu", amount: 850000, note: "Vải may đồ concept Thu Mơ", conceptId: "c1" },
  { id: "e2", date: "2026-06-21", category: "Quảng cáo", amount: 2000000, note: "Chạy ads Facebook tuần 25" },
  { id: "e3", date: "2026-06-22", category: "May đồ", amount: 1200000, note: "May 3 set đồng phục gia đình", conceptId: "c4" },
  { id: "e4", date: "2026-06-23", category: "Vận hành", amount: 450000, note: "Điện nước studio" },
  { id: "e5", date: "2026-06-24", category: "Lương", amount: 6000000, note: "Lương tháng CSKH" },
];
