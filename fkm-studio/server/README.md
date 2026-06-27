# FKM Studio — Server

Backend cho app FKM Studio. API hiện có:

- `GET /api/state` — trả về state đã lưu (hoặc `{ "state": null }` nếu chưa có).
- `PUT /api/state` — ghi đè toàn bộ state (frontend mirror toàn bộ dữ liệu).
- `GET /api/health` — kiểm tra server còn sống.
- `GET/POST /api/orders/:id/photo-selection` — cổng chọn ảnh cho khách (Phase 5).
- `GET /webhook/facebook`, `POST /webhook/facebook` — nhận tin Messenger (Phase 2, xem dưới).
- `POST /api/messages/send`, `GET /api/chat-sync` — gửi/đồng bộ tin nhắn (Phase 2).

Đây là Phase 0 trong lộ trình AI chatbot + thông báo (xem
`../docs/lo-trinh-ai-chatbot-thong-bao.md`). Mục tiêu: có 1 server thật chạy
24/7 để các phase sau (webhook Facebook/Zalo, push thông báo, AI trả lời) có
nơi "sống" — vì các nền tảng đó không gửi được tin nhắn vào 1 app chỉ chạy
trong trình duyệt người dùng.

**Frontend hiện tại vẫn dùng localStorage làm nguồn chính** — mỗi lần lưu dữ
liệu (`persistAll()` trong `src/lib/persistence.ts`), app sẽ thêm 1 lần gửi
mirror lên server này (best-effort, không chặn UI, im lặng nếu server chưa
chạy). Backend **chưa** được đọc lúc khởi động app — đó là việc của Phase 1
trở đi, khi cần đồng bộ thời gian thực giữa nhiều thiết bị/nguồn (webhook).

## Chạy ở máy (development)

```bash
cd server
npm install
npm run dev      # chạy ở http://localhost:4000, tự reload khi sửa code
```

Mặc định frontend gọi `http://localhost:4000`. Nếu đổi cổng, đặt biến môi
trường `PORT` khi chạy server, và `VITE_BACKEND_URL` khi chạy frontend (file
`.env` ở thư mục `fkm-studio/`, ví dụ `VITE_BACKEND_URL=http://localhost:5000`).

Copy `.env.example` thành `.env` trong thư mục `server/` để điền các biến
Facebook (xem mục Phase 2 dưới) khi test local — file `.env` đã có trong
`.gitignore`, không bị commit nhầm.

## Deploy public (BẮT BUỘC để Facebook gửi được webhook vào)

Facebook chỉ gửi webhook tới 1 địa chỉ HTTPS công khai (không gọi được vào
`localhost`). Cần deploy server này lên 1 dịch vụ có HTTPS, ví dụ Render
(miễn phí, đủ dùng cho 1 studio):

1. Đẩy code lên 1 Git repo (riêng hoặc trong cùng repo `fkm-studio`) — nếu
   chưa có repo, tạo 1 repo trên GitHub rồi `git push` thư mục `fkm-studio/`
   lên đó.
2. Vào [render.com](https://render.com), đăng nhập (có thể dùng GitHub),
   bấm "New +" → "Web Service" → chọn repo vừa đẩy lên.
3. Cấu hình:
   - **Root Directory**: `server` (vì repo có cả frontend, chỉ deploy thư mục server)
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start`
   - **Instance Type**: Free là đủ để bắt đầu.
4. Mục "Environment Variables" trên Render, thêm các biến (giá trị thật anh đã
   có sẵn — Page Access Token + App Secret):
   - `FB_VERIFY_TOKEN` = 1 chuỗi tự đặt bất kỳ (vd. `fkm_xac_minh_2026`) — sẽ dùng lại ở bước khai báo webhook trên Meta.
   - `FB_APP_SECRET` = App Secret (Meta for Developers > App > Cài đặt > Cơ bản).
   - `FB_PAGE_ACCESS_TOKEN` = Page Access Token (Meta for Developers > App > Messenger > Cài đặt Messenger).
   - `GEMINI_API_KEY` (tuỳ chọn) = lấy miễn phí ở https://aistudio.google.com/apikey
     — chỉ là "mặc định ngầm" cho Gemini nếu chưa nhập key qua UI. Từ Giai
     đoạn 9, key của cả 3 nhà AI (Gemini/OpenAI/DeepSeek) cấu hình NGAY TRONG
     APP (Cài đặt > AI > Nhà cung cấp AI) — không cần thêm biến môi trường nào
     khác trên Render cho OpenAI/DeepSeek. Thiếu key (cả 2 đường) thì AI tự bỏ
     qua, không lỗi, anh tự trả lời tay như bình thường.
5. Bấm "Create Web Service" — Render build + chạy, ra 1 URL dạng
   `https://fkm-studio-server.onrender.com`.
6. Cập nhật `VITE_BACKEND_URL=https://fkm-studio-server.onrender.com` ở
   frontend (file `.env` thư mục `fkm-studio/`) rồi build/deploy lại frontend.

### Khai báo webhook trên Meta for Developers (sau khi đã deploy ở bước trên)

1. Vào [developers.facebook.com](https://developers.facebook.com) → App đã
   tạo → mục **Messenger** → **Cài đặt Messenger** (Messenger Settings).
2. Mục "Webhooks" → "Add Callback URL":
   - **Callback URL**: `https://<url-render-của-anh>/webhook/facebook`
   - **Verify Token**: đúng giá trị đã đặt ở `FB_VERIFY_TOKEN` trên Render.
3. Meta gọi thử `GET /webhook/facebook` ngay lúc đó — nếu token khớp, server
   trả lại `hub.challenge` và Meta báo "Verified" (xanh).
4. Mục "Webhook Fields" (subscribe fields) → tick **messages** (và
   **messaging_postbacks** nếu sau này dùng nút bấm) → Save.
5. Mục "Page Subscriptions" → chọn đúng Trang Facebook của anh → Subscribe.
6. Test: nhắn vào Trang Facebook (qua tài khoản cá nhân, hoặc tài khoản
   admin/tester của App) → tin sẽ xuất hiện ở app FKM Studio (màn Hội thoại)
   trong vòng vài giây + có thông báo đẩy nếu đã bật (xem Phase 1).

**Lưu ý quan trọng:** để AI/studio trả lời được **MỌI khách** (không chỉ
admin/tester của App), Meta yêu cầu App Review cho quyền `pages_messaging` —
có thể mất vài ngày đến vài tuần xét duyệt. Trong lúc chờ duyệt, vẫn test đầy
đủ được 2 chiều (nhận tin + gửi trả lời) với các tài khoản Facebook đã thêm
làm admin/tester của App đó.

Lưu ý khác: file `data/state.json` lưu trên đĩa của server — Render free tier
có "ephemeral disk" (mất dữ liệu khi service restart/redeploy, thường vài
ngày 1 lần với free tier). Với 1 studio nhỏ, mất state.json chỉ là mất bản
mirror — dữ liệu thật vẫn còn ở localStorage trình duyệt + sẽ tự mirror lại
lần persistAll() kế tiếp; NHƯNG khách Facebook mới (do webhook tạo trực tiếp
trên backend) sẽ bị mất nếu restart xảy ra giữa lúc chưa kịp đồng bộ về
frontend. Nếu thấy mất dữ liệu khách Facebook thường xuyên, đó là lúc cần
chuyển `store.ts` sang 1 database thật (Postgres) — chưa cần ngay lúc này.
