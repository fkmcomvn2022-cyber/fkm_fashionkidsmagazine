/**
 * ID gốc của dữ liệu mẫu (seed) — viết cứng, KHÔNG tính lại từ dữ liệu đang
 * có, vì mục đích là nhận diện CHÍNH XÁC các bản ghi mẫu ban đầu này dù người
 * dùng đã sửa/lưu gì sau đó. Mọi bản ghi tạo qua app thật (createOrder,
 * findOrCreateCustomer, createConcept, createStaff...) đều sinh ID lớn hơn các
 * số này (nextNumericId quét ID lớn nhất hiện có rồi +1), nên không bao giờ
 * trùng vào nhóm này về sau.
 *
 * Tách riêng ra file này (trước đây nằm trong persistence.ts) để cả persistence
 * (xoá mẫu vĩnh viễn) và demoView (ẩn/hiện mẫu tạm thời theo công tắc DEMO/THẬT)
 * cùng dùng 1 nguồn, không lặp và không tạo import vòng.
 */
export const SAMPLE_IDS = {
  orders: new Set(["o1", "o2", "o3", "o4", "o5", "o6", "o7", "o8", "o9", "o10"]),
  customers: new Set(["u1", "u2", "u3", "u4", "u5", "u6", "u7"]),
  concepts: new Set(["c1", "c2", "c3", "c4", "c5"]),
  staff: new Set(["s1", "s2", "s3", "s4", "s5", "s6", "s7"]),
  inventory: new Set(["i1", "i2", "i3", "i4", "i5", "i6", "i7"]),
  addonServices: new Set(["sv1", "sv2", "sv3", "sv4", "sv5", "sv6", "sv7", "sv8", "sv9"]),
  expenses: new Set(["e1", "e2", "e3", "e4", "e5"]),
  messages: new Set(["m1", "m2", "m3", "m4", "m5"]),
} as const;
