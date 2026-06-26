# Đóng gói APK (Android) và app Mac

Kiến trúc đã chọn: **server host riêng, app chỉ là client**. App Android/Mac
không chứa server — chỉ gọi API qua mạng tới server đã deploy. Cần internet +
server đang chạy để app hoạt động (đồng bộ nhiều máy, webhook Facebook hoạt
động bình thường — xem `server/README.md`).

Đã scaffold sẵn trong repo:
- `capacitor.config.ts` + thư mục `android/` (appId `vn.fkm.studio`) — đóng gói Android.
- `src-tauri/` (identifier `vn.fkm.studio`) — đóng gói Mac.
- `.env.production.example` — mẫu khai báo URL server thật.
- Script trong `package.json`: `android:sync`, `android:open`,
  `android:build-debug`, `mac:dev`, `mac:build`.

## Bước 1 — Deploy server lên Render

Làm theo `server/README.md` mục "Deploy public" (đã có sẵn hướng dẫn từng
bước). Kết quả là 1 URL dạng `https://fkm-studio-server.onrender.com`.

## Bước 2 — Khai báo URL server thật cho bản build

```bash
cd fkm-studio
cp .env.production.example .env.production
```

Sửa file `.env.production`, đổi giá trị `VITE_BACKEND_URL` thành URL Render
thật ở bước 1. File này không bị commit (đã thêm vào `.gitignore`).

Mọi lần build production (`npm run build`, `android:sync`, `mac:build`) Vite
sẽ tự đọc `.env.production` và nhúng URL này vào app — không cần sửa code.

## Bước 3 — Đóng gói APK (Android)

Cần làm trên máy có cài **Android Studio** (kèm Android SDK) — máy hiện tại
(sandbox của Claude) không có SDK/Gradle nên không build được APK thật, chỉ
scaffold sẵn cấu trúc project.

```bash
npm run android:sync          # build web + copy vào android/
npm run android:open          # mở Android Studio
```

Trong Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s). File
APK debug nằm ở `android/app/build/outputs/apk/debug/`.

Hoặc dùng dòng lệnh (cần `ANDROID_HOME` đã trỏ đúng SDK):

```bash
npm run android:build-debug
```

Muốn bản release (để cài lâu dài, ký số) thì làm theo hướng dẫn "Generate
Signed Bundle/APK" trong Android Studio — cần tạo keystore riêng.

## Bước 4 — Đóng gói app Mac (Tauri)

Cần cài trên máy Mac thật (không build được app macOS trên Linux/sandbox):

```bash
# 1 lần duy nhất: cài Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# cài Xcode Command Line Tools (nếu chưa có)
xcode-select --install
```

Sau đó:

```bash
npm run mac:dev      # chạy thử app Mac ở chế độ dev (mở cửa sổ native)
npm run mac:build    # build bản .app/.dmg thật, dùng .env.production
```

File `.app`/`.dmg` ra ở `src-tauri/target/release/bundle/`.

## Đổi icon app (tuỳ chọn)

Icon hiện tại là icon mặc định của Tauri. Khi có logo FKM Studio (PNG vuông,
nên ≥1024×1024):

```bash
npx tauri icon path/to/logo.png
```

Lệnh này tự sinh đủ icon cho cả Mac/Windows/Android vào `src-tauri/icons/`.
Riêng icon Android (`android/app/src/main/res/mipmap-*`) cần làm thêm
qua Android Studio → Image Asset Studio.

## Lưu ý chung

- App không hoạt động offline — mọi màn hình phụ thuộc server đang chạy
  (xem [[fkm-studio-ai-chatbot-roadmap]] để hiểu lý do chọn kiến trúc này).
- Render free tier có "ephemeral disk" — xem cảnh báo cuối `server/README.md`
  về việc mất `state.json` khi server restart.
- Mỗi khi đổi `VITE_BACKEND_URL` (ví dụ chuyển sang server trả phí, domain
  riêng), build lại cả 2 bản APK và Mac — URL bị nhúng cứng lúc build, không
  đổi được sau khi đã đóng gói.
