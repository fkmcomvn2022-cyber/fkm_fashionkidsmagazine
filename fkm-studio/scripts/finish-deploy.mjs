#!/usr/bin/env node
/**
 * Sau khi Render deploy xong — build web với URL backend và deploy Firebase Hosting.
 * Chạy: npm run deploy:finish
 * Tuỳ chọn: npm run deploy:finish -- --url=https://ten-khac.onrender.com
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const urlArg = process.argv.find((a) => a.startsWith("--url="));
const backendUrl = (urlArg ? urlArg.slice(6) : "https://fkm-studio-server.onrender.com").replace(/\/$/, "");

const prodEnv = `# Backend Render — dùng khi build web + APK
VITE_BACKEND_URL=${backendUrl}
`;
fs.writeFileSync(path.join(root, ".env.production"), prodEnv, "utf8");
console.log("✓ .env.production →", backendUrl);

const rcPath = path.join(root, ".firebaserc");
if (!fs.existsSync(rcPath)) {
  console.error("Thiếu .firebaserc — chạy npm run deploy:setup trước, rồi sửa project ID Firebase.");
  process.exit(1);
}
const rc = JSON.parse(fs.readFileSync(rcPath, "utf8"));
if (rc.projects?.default === "YOUR_FIREBASE_PROJECT_ID") {
  console.error(`
Chưa cấu hình Firebase project ID trong .firebaserc
1. Tạo project tại https://console.firebase.google.com
2. Sửa .firebaserc → thay YOUR_FIREBASE_PROJECT_ID
3. Chạy lại: npm run deploy:finish
`);
  process.exit(1);
}

console.log("\n→ Kiểm tra backend...");
try {
  execSync(`curl -sf "${backendUrl}/api/health"`, { stdio: "pipe", encoding: "utf8" });
  console.log("✓ Backend đang chạy:", backendUrl);
} catch {
  console.warn(`⚠ Backend chưa phản hồi tại ${backendUrl}/api/health`);
  console.warn("  Vẫn build web — nhưng app sẽ lỗi cho đến khi Render deploy xong.\n");
}

console.log("\n→ Build + deploy Firebase Hosting...\n");
execSync("npm run firebase:deploy", { cwd: root, stdio: "inherit" });

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Xong!                                                        ║
╚══════════════════════════════════════════════════════════════╝
  Web app:  https://${rc.projects.default}.web.app
  Backend:  ${backendUrl}
  Webhook:  ${backendUrl}/webhook/facebook
  (Chi tiết webhook: deploy/facebook-webhook.txt)
`);
