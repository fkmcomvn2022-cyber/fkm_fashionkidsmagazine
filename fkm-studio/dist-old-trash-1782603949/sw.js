// Service worker FKM Studio — Phase 1 (đường ống thông báo đẩy).
// Chỉ làm 2 việc: (1) nhận push từ backend và hiển thị notification, dù app
// đang tắt/không mở tab nào; (2) khi bấm vào notification, mở/focus lại app.
// Không cache gì cả (chưa cần offline) — tránh phức tạp ngoài phạm vi Phase 1.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "FKM Studio", body: "Có cập nhật mới", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // payload không phải JSON hợp lệ -> dùng mặc định ở trên
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => w.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.navigate?.(targetUrl);
        return;
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
