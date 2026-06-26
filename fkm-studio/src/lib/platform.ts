/**
 * Giai đoạn 6 (xem [[fkm-studio-ai-chatbot-roadmap]]) — phát hiện app đang
 * chạy trên bản native Capacitor (Android) hay không, để ẨN HẲN màn
 * Automation + Tuỳ chỉnh AI trên bản mobile (theo quyết định đã chốt với
 * anh: mobile ít tính năng hơn, mọi cấu hình AI/Automation sâu chỉ làm trên
 * desktop/Tauri). `Capacitor.isNativePlatform()` trả `false` trên Tauri/web/
 * desktop, chỉ `true` khi chạy thật trong app Android đóng gói (xem
 * [[fkm-studio-native-packaging]]) — đây là cách phát hiện chuẩn của
 * Capacitor, không cần thêm logic suy đoán user-agent.
 */
import { Capacitor } from "@capacitor/core";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}
