#!/usr/bin/env node
/**
 * Chuẩn bị mọi thứ để build APK FKM Studio:
 * - Tạo .env.production (URL backend thật)
 * - Tạo android/local.properties nếu có Android SDK
 * - Build web + cap sync android
 *
 * Cách dùng:
 *   npm run apk:prepare
 *   npm run apk:prepare -- --url=https://your-server.onrender.com
 *   npm run apk:prepare -- --lan          # ép dùng IP mạng nội bộ (mặc định nếu không có --url)
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const net of ifaces ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

function parseUrlArg() {
  const urlArg = process.argv.find((a) => a.startsWith("--url="));
  return urlArg ? urlArg.slice("--url=".length).replace(/\/$/, "") : null;
}

function resolveBackendUrl() {
  const explicit = parseUrlArg();
  if (explicit) return { url: explicit, mode: "production" };

  const fromEnv = process.env.VITE_BACKEND_URL?.replace(/\/$/, "");
  if (fromEnv) return { url: fromEnv, mode: "production" };

  const lanIp = getLanIp();
  if (lanIp) {
    return { url: `http://${lanIp}:4000`, mode: "lan" };
  }

  console.error(
    "Không tìm thấy IP mạng nội bộ. Hãy truyền URL server:\n" +
      "  npm run apk:prepare -- --url=https://your-server.onrender.com",
  );
  process.exit(1);
}

function writeEnvProduction(backendUrl) {
  const content = `# Tự động tạo bởi scripts/prepare-apk.mjs — không commit (đã gitignore)
# Build lại APK sau khi đổi URL: npm run apk:prepare
VITE_BACKEND_URL=${backendUrl}
`;
  fs.writeFileSync(path.join(root, ".env.production"), content, "utf8");
}

function writeLocalProperties() {
  const sdkPath =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(os.homedir(), "Library", "Android", "sdk");

  if (!fs.existsSync(sdkPath)) {
    console.log(
      "Chưa thấy Android SDK tại:",
      sdkPath,
      "\n→ Cài Android Studio rồi chạy lại, hoặc đặt ANDROID_HOME.",
    );
    return false;
  }

  const props = `## Tự động tạo bởi scripts/prepare-apk.mjs
sdk.dir=${sdkPath.replace(/\\/g, "/")}
`;
  fs.writeFileSync(path.join(root, "android", "local.properties"), props, "utf8");
  console.log("Đã tạo android/local.properties →", sdkPath);
  return true;
}

function run(cmd, cwd = root) {
  console.log("\n$", cmd);
  execSync(cmd, { cwd, stdio: "inherit" });
}

const { url, mode } = resolveBackendUrl();
writeEnvProduction(url);
const hasSdk = writeLocalProperties();

console.log("\n=== Cấu hình APK ===");
console.log("Backend URL:", url);
console.log("Chế độ:", mode === "lan" ? "Mạng nội bộ (LAN)" : "Production (HTTPS)");

run("npm run build");
run("npx cap sync android");

console.log("\n=== Xong bước chuẩn bị ===");

if (mode === "lan") {
  console.log(`
Để dùng APK trên điện thoại (cùng Wi‑Fi với Mac):
  1. cd server && npm install && npm run dev
  2. Cài Android Studio (nếu chưa có)
  3. npm run android:build-debug   (hoặc mở Android Studio → Build APK)
  4. Cài file: android/app/build/outputs/apk/debug/app-debug.apk

Khi cần dùng ngoài Wi‑Fi / Facebook webhook: deploy server lên Render
(rồi chạy lại với --url=https://...).
`);
} else {
  console.log(`
Tiếp theo (cần Android Studio + SDK):
  npm run android:build-debug
  hoặc: npm run android:open → Build → Build APK(s)

APK debug: android/app/build/outputs/apk/debug/app-debug.apk
`);
}

if (!hasSdk) {
  console.log(
    "⚠ Chưa build được APK vì thiếu Android SDK. Tải Android Studio:\n" +
      "  https://developer.android.com/studio",
  );
}
