#!/usr/bin/env node
/**
 * Chuẩn bị deploy online: Render (backend + webhook FB) + Firebase (web).
 * Chạy: npm run deploy:setup
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const deployDir = path.join(root, "deploy");

function isPlaceholderValue(key, val) {
  if (!val) return true;
  if (val.startsWith("test_")) return true;
  return false;
}

function pickEnv(key, localEnv, fallback = "") {
  const v = localEnv[key];
  return isPlaceholderValue(key, v) ? fallback : v;
}

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function generateVapid() {
  const out = execSync("node --input-type=module -e \"import w from 'web-push'; const k=w.generateVAPIDKeys(); console.log(JSON.stringify(k))\"", {
    cwd: path.join(root, "server"),
    encoding: "utf8",
  }).trim();
  return JSON.parse(out);
}

function writeRenderEnvLocal(vars) {
  const lines = [
    "# Dán TỪNG DÒNG vào Render Dashboard → fkm-studio-server → Environment",
    "# KHÔNG commit file này (đã gitignore)",
    "",
    `FB_VERIFY_TOKEN=${vars.FB_VERIFY_TOKEN || ""}`,
    `FB_APP_SECRET=${vars.FB_APP_SECRET || ""}`,
    `FB_PAGE_ACCESS_TOKEN=${vars.FB_PAGE_ACCESS_TOKEN || ""}`,
    `GEMINI_API_KEY=${vars.GEMINI_API_KEY || ""}`,
    `VAPID_PUBLIC_KEY=${vars.VAPID_PUBLIC_KEY}`,
    `VAPID_PRIVATE_KEY=${vars.VAPID_PRIVATE_KEY}`,
    "",
    "# Sau khi deploy, URL server thường là:",
    "# https://fkm-studio-server.onrender.com",
  ];
  const file = path.join(deployDir, "render-env.local.txt");
  fs.writeFileSync(file, lines.join("\n"), "utf8");
  return file;
}

function writeWebhookGuide(verifyToken) {
  const backendUrl = "https://fkm-studio-server.onrender.com";
  const content = `=== WEBHOOK FACEBOOK (làm SAU khi Render deploy xong) ===

1. Vào https://developers.facebook.com → App → Messenger → Webhooks
2. Callback URL:
   ${backendUrl}/webhook/facebook
3. Verify Token (phải khớp FB_VERIFY_TOKEN trên Render):
   ${verifyToken || "(xem deploy/render-env.local.txt)"}
4. Subscribe field: messages
5. Page Subscriptions → chọn Trang Facebook → Subscribe

Kiểm tra server sống:
  curl ${backendUrl}/api/health
`;
  fs.writeFileSync(path.join(deployDir, "facebook-webhook.txt"), content, "utf8");
}

function initGitIfNeeded() {
  const gitDir = path.join(root, ".git");
  if (fs.existsSync(gitDir)) return false;
  execSync("git init -b main", { cwd: root, stdio: "inherit" });
  return true;
}

function writeFirebaseRc() {
  const rc = path.join(root, ".firebaserc");
  if (fs.existsSync(rc)) return;
  fs.copyFileSync(path.join(root, ".firebaserc.example"), rc);
}

ensureDir(deployDir);

const localEnv = readDotEnv(path.join(root, "server", ".env"));
const vapid = generateVapid();

const merged = {
  FB_VERIFY_TOKEN: pickEnv("FB_VERIFY_TOKEN", localEnv, "fkm_xac_minh_2026"),
  FB_APP_SECRET: pickEnv("FB_APP_SECRET", localEnv),
  FB_PAGE_ACCESS_TOKEN: pickEnv("FB_PAGE_ACCESS_TOKEN", localEnv),
  GEMINI_API_KEY: pickEnv("GEMINI_API_KEY", localEnv),
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
};

const renderEnvFile = writeRenderEnvLocal(merged);
writeWebhookGuide(merged.FB_VERIFY_TOKEN);
writeFirebaseRc();

const gitNew = initGitIfNeeded();

const backendUrl = "https://fkm-studio-server.onrender.com";
const prodEnv = `# Chuẩn bị deploy — cập nhật sau khi Render xong (npm run deploy:finish)
VITE_BACKEND_URL=${backendUrl}
`;
fs.writeFileSync(path.join(root, ".env.production"), prodEnv, "utf8");

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  FKM Studio — đã chuẩn bị deploy online                      ║
╚══════════════════════════════════════════════════════════════╝

✓ Git repo: ${gitNew ? "vừa tạo mới (fkm-studio/)" : "đã có sẵn"}
✓ VAPID keys (push notification): đã sinh
✓ deploy/render-env.local.txt — biến môi trường cho Render
✓ deploy/facebook-webhook.txt — hướng dẫn webhook Meta
✓ .env.production — URL backend: ${backendUrl}
✓ .firebaserc — sửa YOUR_FIREBASE_PROJECT_ID trước khi deploy web

── Bạn cần làm 3 bước (chỉ 1 lần) ──

【1】 Đẩy code lên GitHub
    cd "${root}"
    git add .
    git commit -m "Chuẩn bị deploy FKM Studio"
    # Tạo repo mới trên github.com → copy URL →:
    git remote add origin https://github.com/TEN-BAN/fkm-studio.git
    git push -u origin main

【2】 Deploy backend lên Render (webhook Facebook)
    • Vào https://dashboard.render.com → New → Blueprint
    • Chọn repo GitHub vừa push
    • Render đọc render.yaml → tạo service fkm-studio-server
    • Environment → Add từ file: deploy/render-env.local.txt
      (dán từng biến; thay FB_* bằng token THẬT từ Meta nếu đang là test)
    • Deploy xong → mở ${backendUrl}/api/health

【3】 Deploy giao diện web + cấu hình Facebook
    npm install -g firebase-tools
    firebase login
    # Sửa .firebaserc → project ID Firebase thật
    npm run deploy:finish

── APK Android (sau khi backend online) ──
    npm run apk:prepare -- --url=${backendUrl}
    npm run android:build-debug

⚠ server/.env hiện có token TEST — trên Render phải dùng token Facebook THẬT.
`);
