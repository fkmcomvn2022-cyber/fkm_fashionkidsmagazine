# Lộ trình: AI Chatbot + Thông báo thật cho FKM Studio

Mục tiêu: app hiện tại (web app, chạy local, không server) trở thành "mini Meta Business Suite" riêng — AI tự trả lời khách, chủ studio theo dõi/can thiệp được, có thông báo thật khi: khách nhắn tin mới, AI đã trả lời, khách gửi ảnh chuyển khoản cọc, khách đã chọn ảnh.

## Vì sao cần xây thêm backend

App hiện tại là 1 trang web chạy hoàn toàn trên máy/điện thoại, dữ liệu lưu trong trình duyệt (localStorage), không có server nào chạy 24/7. Facebook/Zalo chỉ gửi tin nhắn của khách đến cho mình qua **webhook** — tức cần có 1 địa chỉ server công khai, chạy liên tục, để nhận tin đó, rồi mới đẩy thông báo vào app. Không có bước này thì không thể nhận tin khách hỏi, không có data để AI trả lời, và không thể tự gửi thông báo khi app đang tắt.

## Các quyết định đã chốt

- **Hạ tầng:** chưa có gì, xây từ đầu.
- **Xác nhận cọc:** không dùng dịch vụ ngân hàng trả phí — khách gửi ảnh chụp màn hình chuyển khoản trong chat, hệ thống (AI đọc ảnh) so khớp tên/số tiền với đơn hàng.
- **Kênh chat:** chưa chốt — xem khuyến nghị bên dưới.
- **Thứ tự làm:** theo lộ trình đề xuất dưới đây.

## Lộ trình 6 giai đoạn

### Giai đoạn 0 — Nền tảng backend ✅ Đã xong (bản đầu)
- Đã dựng server nhỏ (Node.js + Express, thư mục `server/`), lưu state vào file JSON (chưa cần Postgres/SQLite ngay — dữ liệu 1 studio, file JSON đủ dùng cho bước nền tảng này; sẽ đổi sang database thật khi backend bắt đầu là nguồn ghi từ nhiều phía ở Giai đoạn 1+).
- API: `GET/PUT /api/state` (mirror toàn bộ dữ liệu app), `GET /api/health`.
- Frontend (`src/lib/persistence.ts`) mỗi lần lưu dữ liệu giờ cũng bắn 1 bản mirror lên server này (best-effort, không chặn UI nếu server chưa chạy). **localStorage vẫn là nguồn đọc chính lúc khởi động** — server hiện chỉ nhận ghi, chưa được app đọc lại lúc mở app; việc đó thuộc Giai đoạn 1+ khi cần đồng bộ thời gian thực nhiều nguồn.
- Đã test: health check, GET/PUT round-trip, CORS cho phép frontend gọi qua — xem `server/README.md` để chạy local hoặc deploy public (cần deploy public trước khi làm Giai đoạn 2 — webhook).
- **Việc anh cần làm:** chưa cần gì — khi đến Giai đoạn 2 (cần server có địa chỉ public cho Facebook/Zalo gọi vào) tôi sẽ đề xuất nơi deploy cụ thể (Render/Railway).

### Giai đoạn 1 — Thông báo thật (push) trong app ✅ Đã xong (đường ống)
- Đã thêm service worker (`public/sw.js`) + web app manifest (`public/manifest.webmanifest`) — điều kiện để trình duyệt/điện thoại nhận được thông báo dù không mở app.
- Backend (`server/src/push.ts`) tự tạo cặp khoá VAPID, lưu danh sách thiết bị đã đăng ký, có hàm `sendPushToAll()` — đây chính là "đường ống" mà Giai đoạn 2-5 sẽ gọi để bắn thông báo khi có sự kiện thật.
- App (mục Thiết lập → Hệ thống) đã có nút "Thông báo đẩy" bật/tắt thật + nút "Gửi thử thông báo" để tự kiểm tra đường ống còn hoạt động.
- **Lưu ý quan trọng:** đường ống đã sẵn sàng nhưng **chưa có sự kiện thật nào tự bắn thông báo** — vì các sự kiện đó (khách nhắn tin, AI trả lời, khách chuyển khoản, khách chọn ảnh) chỉ phát sinh từ Giai đoạn 2-5. Giai đoạn 1 chỉ là hạ tầng, chưa tạo ra thông báo tự động trong vận hành hàng ngày.

### Giai đoạn 2 — Kết nối kênh chat ✅ Đã xong phần Facebook (code), còn chờ anh deploy + khai báo webhook
- Đã làm Facebook trước theo yêu cầu (Zalo để sau).
- Backend (`server/src/facebook.ts`): xác minh chữ ký webhook (`X-Hub-Signature-256` so với `FB_APP_SECRET`), parse tin nhắn Messenger, tự tạo khách mới theo `facebookId` (PSID) nếu chưa có, ghi tin vào `state.messages`, gửi trả lời qua Facebook Send API.
- Route mới (`server/src/index.ts`): `GET/POST /webhook/facebook` (nhận tin), `POST /api/messages/send` (studio gửi trả lời), `GET /api/chat-sync` (frontend đồng bộ tin + khách mới).
- Frontend: `src/data/messages.ts` đổi từ seed tĩnh sang dữ liệu sống (`addMessage`, `markThreadRead`, `mergeRemoteMessages`); `getConversationThreads()` tính lại từ `messages` hiện tại (bỏ mảng `conversationThreads` tĩnh cũ vì dễ lệch). `src/data/customers.ts` thêm `mergeRemoteCustomers` — khách Facebook nhắn lần đầu được webhook tạo trên backend, frontend cần đồng bộ về mới biết khách này tồn tại.
- Màn Hội thoại (`ChatPage.tsx`): tự poll backend mỗi 5s lấy tin + khách mới, nút Gửi đã hoạt động thật (gửi qua Facebook Send API khi khách có `facebookId`), tin nhắn mới có thông báo đẩy ngay (dùng đường ống Phase 1).
- Đã kiểm thử cục bộ: xác minh webhook (đúng/sai token), chữ ký webhook (đúng/sai), tạo khách mới + ghi tin khi nhận webhook giả lập, từ chối gửi khi khách chưa có facebookId. **Chưa kiểm thử được việc gửi tin thật qua Facebook** (sandbox dùng để code không có mạng ra ngoài tới graph.facebook.com) và **chưa kiểm thử webhook thật từ Meta** (cần server có địa chỉ public — xem `server/README.md`).
- **Việc anh cần làm tiếp:** deploy `server/` lên Render (hướng dẫn từng bước trong `server/README.md`, mục "Deploy public"), điền `FB_VERIFY_TOKEN`/`FB_APP_SECRET`/`FB_PAGE_ACCESS_TOKEN` vào Environment Variables của Render, rồi khai báo Callback URL trên Meta for Developers (cũng có hướng dẫn trong README). Sau bước đó là nhận/gửi tin Facebook thật được ngay (với tài khoản admin/tester trước, mọi khách sau khi Meta duyệt `pages_messaging`).
- Zalo: chưa làm, để sau theo đúng thứ tự anh chọn.

### Giai đoạn 3 — AI tự trả lời ✅ Đã xong (chế độ tự gửi luôn, không qua duyệt)
- Quyết định đã chốt (anh xác nhận 2026-06-26): **tự gửi luôn**, không có hàng chờ duyệt trước khi gửi. Nhà cung cấp AI: **Gemini (Google)** — anh có sẵn key Gemini/DeepSeek/OpenAI, không có key Anthropic nên không dùng Claude API.
- Backend (`server/src/ai.ts`): `buildStudioContext()` đọc đúng concept đang `status: "active"` + `addonServices` từ state mirror, dựng thành đoạn text giá/tên THẬT để nhồi vào system prompt — tránh AI tự bịa giá. `generateAiReply()` gọi thẳng REST API Gemini (`generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, model mặc định `gemini-2.5-flash`), không dùng SDK ngoài (cùng style với `sendFacebookMessage`). System prompt: xưng "em", lịch sự ngắn gọn, CHỈ dùng giá thật, KHÔNG tự chốt giờ/slot trống cụ thể (app hiện không có dữ liệu giờ mở/lịch trống để AI biết), không tự bịa khuyến mãi.
- Thiếu `GEMINI_API_KEY` (server/.env hoặc Environment Variables trên Render) → AI tự bỏ qua bước trả lời, hoàn toàn im lặng, KHÔNG lỗi — tin khách vẫn lưu vào hộp thư bình thường để anh tự trả lời tay. Đã test bằng webhook giả lập: tin khách lưu đúng, không có lỗi, không có tin AI nào được thêm khi chưa cấu hình key (đúng hành vi mong đợi).
- Webhook (`server/src/index.ts` → `handleFacebookWebhookPayload`): sau khi lưu tin khách + báo push như Giai đoạn 2, nếu `state.aiAutoReplySettings.enabled === true` VÀ khách có `facebookId` VÀ đã có `FB_PAGE_ACCESS_TOKEN` → gọi AI, gửi thẳng qua Facebook Send API, lưu tin AI vào `state.messages` với `aiGenerated: true`, rồi bắn thêm 1 thông báo đẩy riêng "AI đã tự trả lời [khách]". Lỗi ở bước AI (thiếu key, mạng lỗi, Gemini từ chối...) chỉ log ra console, không làm hỏng luồng lưu tin khách phía trên.
- App: nút "AI tự động trả lời khách" ở Cài đặt (trước đây là toggle giả, giờ nối vào cờ thật `aiAutoReplySettings`, mirror lên backend qua `PUT /api/state` giống mọi cài đặt khác). Mặc định TẮT (an toàn — tránh bật nhầm lúc chưa cấu hình `GEMINI_API_KEY`), anh bật lên trong app khi đã sẵn sàng. Hội thoại (`ChatPage.tsx`) hiển thị nhãn nhỏ "AI" trên các tin do AI tự trả lời, để phân biệt với tin anh tự gõ.
- **Việc anh cần làm:** lấy 1 API key Gemini miễn phí ở https://aistudio.google.com/apikey, điền vào `GEMINI_API_KEY` trên Render (Environment Variables, cùng chỗ với `FB_PAGE_ACCESS_TOKEN`) hoặc `server/.env` nếu chạy local, rồi vào Cài đặt trong app bật "AI tự động trả lời khách". Vì là chế độ tự gửi luôn (không có bước duyệt), nên kiểm tra thử bằng 1 tài khoản Facebook test trước khi để khách thật nhắn vào.

#### Giai đoạn 3.1 — Tuỳ chỉnh prompt + function AI tự gọi (kiểu UChat) ✅ Đã xong
- Yêu cầu gốc (anh, 2026-06-26): có chỗ nhập prompt tự do cho AI, và chỗ "tạo function" giống cách UChat cấu hình AI Agent — hoặc dùng luôn các nghiệp vụ có sẵn trong app.
- Quyết định đã chốt: (1) Prompt — ô nhập tự do (`customPrompt`), nhưng các luật an toàn cốt lõi (không bịa giá, không tự chốt giờ/slot cụ thể) LUÔN được ghép vào trước, không thể tắt bằng prompt tự do. (2) Function — anh sửa được **tên hiển thị** + **mô tả** (chính mô tả này quyết định khi nào Gemini gọi hàm), nhưng **không** tự tạo function mới hoàn toàn tự do — chỉ chọn bật/tắt + tuỳ biến mô tả cho 3 nghiệp vụ thật đã có sẵn, an toàn: `lookup_order` (tra cứu đơn hàng), `tag_customer` (gắn nhãn VIP/Mới/Thân thiết), `escalate_to_staff` (báo nhân viên thật + bật banner "Cần hỗ trợ"). Không làm "tự tạo đơn mới" — rủi ro cao nhất, để sau nếu anh thật sự cần. (3) Tự thực thi luôn, không có hàng chờ duyệt — nhất quán với quyết định Giai đoạn 3.
- Giao thức function-calling Gemini (`server/src/ai.ts`): gửi kèm `tools` (khai báo tên + mô tả + tham số cho từng hàm đang bật) trong mỗi lần gọi `generateContent`. Nếu Gemini trả về `functionCall`, server tự thực thi hàm thật ngay trên state mirror (mutate trực tiếp `customer`/đọc `orders`), rồi gửi lại `functionResponse` cho Gemini để nó tổng hợp câu trả lời cuối — lặp tối đa 4 lượt, chỉ trả về đúng đoạn text cuối cùng cho khách.
- `Customer.needsHumanHelp` (mới) — AI tự đặt `true` qua `escalate_to_staff`, hiện banner đỏ "Cần hỗ trợ" ở danh sách hội thoại + trong khung chat đang mở (`ChatPage.tsx`). Tự tắt ngay khi anh (người thật) tự gửi 1 tin trả lời tay cho khách đó (`POST /api/messages/send`) — không cần tắt tay.
- Cấu hình ở Cài đặt → "Tuỳ chỉnh AI (prompt + function)" (`/settings/ai`, trang `AiSettingsPage.tsx`) — tự lưu ngay khi gõ, không có nút Lưu riêng.
- Đã kiểm thử end-to-end bằng script mock (không gọi mạng thật tới Gemini/Facebook, chỉ mock 2 domain đó, mọi request khác đi tới server Express THẬT chạy local): xác nhận đúng (1) gửi tin tay tự tắt `needsHumanHelp`, (2) webhook khách nhắn → Gemini "gọi" `tag_customer` → tag khách đổi thật trong state → Gemini trả lời cuối → lưu đúng tin có `aiGenerated: true`.

### Giai đoạn 4 — Xác nhận cọc qua ảnh chuyển khoản ✅ Đã xong (gộp vào Giai đoạn 6)
- Phần này được làm cùng lúc với toàn bộ luồng tự động hoá kiểu UChat — xem chi tiết ở Giai đoạn 6 ngay dưới đây.

### Giai đoạn 5 — Khách chọn ảnh ✅ Đã xong
- `Order.photoSelection { items, selectedUrls, completedAt }` — khác với `photoLinks` (chỉ là link folder studio tự dán).
- Studio dán từng link ảnh (mỗi dòng 1 ảnh) trong chi tiết đơn (mục "Cổng chọn ảnh cho khách"), copy link `/chon-anh/:orderId` gửi khách qua nút có sẵn.
- Trang công khai `PhotoSelectionPortalPage` (route `/chon-anh/:orderId`, đặt ngoài layout studio) — khách xem lưới ảnh, tick chọn, bấm "Xác nhận đã chọn xong". Mở lại link vẫn sửa được lựa chọn trước khi studio bắt đầu sửa.
- Backend (`server/src/orders.ts`): `GET/POST /api/orders/:id/photo-selection` — đọc/ghi trực tiếp vào state mirror, đây là route DUY NHẤT backend tự ghi (mọi field khác của đơn vẫn do app studio ghi qua `PUT /api/state` như cũ). Khi khách xác nhận → backend gọi `sendPushToAll()` báo "[Khách] đã chọn xong N ảnh" ngay (dùng đường ống Giai đoạn 1).
- App studio tự fetch lại trạng thái mới nhất khi bấm "Cập nhật" trong chi tiết đơn (vì backend chưa phải nguồn đọc chính lúc mở app — xem lưu ý Giai đoạn 0/1) — đồng bộ điểm-tới-điểm riêng cho tính năng này, không đổi kiến trúc đọc chung.
- Tin nhắc "chọn ảnh" ở Việc nổi bật (`buildSelectPhotoMessage`) tự kèm link cổng chọn ảnh nếu studio đã dán ảnh.

### Giai đoạn 6 — Tự động hoá toàn luồng kiểu UChat (ảnh chuyển khoản, tự tạo đơn, tự nhắc) ✅ Đã xong
Yêu cầu gốc (anh, 2026-06-26): AI phải tự xác nhận cọc qua ảnh khách gửi trong Messenger, tự tạo đơn (hoặc lưu "chưa cọc" nếu đã đủ tên/SĐT/ngày giờ), tự áp luồng nhắc cọc sau khi tạo đơn, tự nhắc lịch hẹn trước 1 ngày, tự nhắc chọn ảnh sau khi studio up ảnh — toàn bộ chỉ áp dụng cho khách có Facebook, khách kênh khác vẫn dùng đúng nút nhắc tay ở Việc nổi bật như cũ (không đổi gì luồng #76-84).

**Quyết định kiến trúc đã chốt:**
- AI tự làm luôn, không qua hàng chờ duyệt — nhất quán với Giai đoạn 3/3.1.
- Phân biệt 2 loại "rẽ nhánh": việc AI tự quyết định gọi nghiệp vụ nào khi đang trả lời 1 tin chữ cụ thể (tra cứu đơn, tạo đơn, kiểm tra lịch trống...) dùng Gemini function-calling như Giai đoạn 3.1; còn việc "khách gửi ảnh → có phải ảnh chuyển khoản không → tự đánh dấu đã cọc" được làm **tất định** (deterministic), không giao cho Gemini tự quyết — vì đụng tới tiền, cần chắc chắn, không thể để AI "tự nhiên" trả treo qua lại.
- Mobile (Capacitor/Android) **ẩn hẳn** 2 màn "Tuỳ chỉnh AI" và "Automation" — chỉ làm trên desktop/web/Tauri.

**Webhook ảnh (`server/src/facebook.ts`, `server/src/index.ts → handleIncomingImage`):**
- Khách gửi ảnh qua Messenger → tải ảnh từ Facebook CDN, mã hoá base64, gửi cho Gemini Vision (`classifyPaymentImage`) để hỏi đúng 1 câu: ảnh này có phải biên lai/ảnh chuyển khoản không, số tiền bao nhiêu (trả JSON nghiêm ngặt, temperature 0).
- Là ảnh chuyển khoản → chạy `confirmDepositFromScreenshot` (`server/src/chatOrders.ts`): tìm đơn "Chưa cọc" gần nhất của khách, tự đánh dấu "Đã cọc", gửi tin xác nhận lại khách — toàn bộ KHÔNG qua Gemini sinh câu trả lời (tránh AI tự "diễn giải" sai số tiền/trạng thái cọc).
- Không phải ảnh chuyển khoản → AI tự nhìn ảnh và trả lời tự nhiên (`generateImageReply`), không escalate/không bỏ qua — đúng quyết định "Tự nhìn ảnh + trả lời tự nhiên" anh đã chốt.

**2 function mới cho Gemini (`server/src/ai.ts`, cấu hình ở `/settings/ai`, mặc định TẮT vì rủi ro cao hơn 3 function cũ):**
- `check_available_slots` — bản port rút gọn của bộ gợi ý lịch (`server/src/availability.ts`), trả về giờ trống THẬT trong ngày khách hỏi (không cho AI tự đoán giờ).
- `create_order_from_chat` — khi AI đã thu thập đủ họ tên + SĐT + ngày/giờ trong hội thoại, tự tạo đơn mới (trạng thái "Chưa cọc") qua `createOrderFromChat` (`server/src/chatOrders.ts`); ngay sau khi tạo, server tự gửi luôn tin nhắc cọc kèm ảnh mã QR VietQR (build lại bằng `buildVietQRUrl`, vì server không import được code frontend) — đây chính là yêu cầu "tự áp luồng nhắc cọc sau khi tạo đơn".

**Cron tự động (`server/src/automationCron.ts`, chạy mỗi giờ, khởi động cùng `server/src/index.ts`):**
- Chỉ quét đơn của khách có `facebookId` (khách kênh khác bỏ qua hoàn toàn, giữ nguyên luồng TaskBoard nhắc tay).
- 3 việc tự nhắc, mỗi việc có cờ chống nhắc lại riêng trong `Order.reminders`: nhắc cọc (đơn "Chưa cọc" chưa từng nhắc), nhắc lịch hẹn (đúng số ngày trước ngày chụp theo cấu hình "Nhắc lịch hẹn" ở Thiết lập), nhắc chọn ảnh (studio đã dán link ảnh, khách chưa chọn xong).
- Toàn bộ 5 luật (gồm 2 việc xử lý ngay lúc webhook + 3 việc cron) bật/tắt riêng được ở màn **Automation** mới (`/settings/automation`, `AutomationPage.tsx`) — hiển thị dạng danh sách thẻ "Khi nào → Điều kiện → Hành động" kèm mũi tên tĩnh (không phải canvas kéo thả, vì mọi luật ở đây là chuỗi thẳng, không rẽ nhánh).

**Ẩn trên mobile:** `src/lib/platform.ts` dùng `Capacitor.isNativePlatform()` — `App.tsx` chặn hẳn ở tầng route (`/settings/ai`, `/settings/automation` không tồn tại trên bản Android), `SettingsPage.tsx` ẩn luôn 2 nút điều hướng tương ứng.

**Đã kiểm thử:** `npx tsc -b` sạch ở cả `server/` và `fkm-studio/` (gốc); `vite build` dựng thành công (lỗi `dist/.DS_Store` gặp phải chỉ do quyền file hệ thống của máy tính khi build thử trong môi trường này, không phải lỗi code — anh build lại trên máy thật sẽ không gặp lỗi này).

**Việc anh cần làm:** vào `/settings/automation` xem/tắt-mở từng luật theo ý anh (mặc định cả 5 luật đều BẬT); nếu muốn AI tự tạo đơn + tự báo lịch trống ngay trong chat, vào `/settings/ai` bật 2 function `check_available_slots`/`create_order_from_chat` (đang mặc định TẮT vì rủi ro tạo đơn sai cao hơn 3 function cũ).

### Giai đoạn 7 — Gộp nhiều nguồn khách (Instagram, TikTok Business, Zalo...) vào 1 kênh chat — CHƯA LÀM, kế hoạch để AI sau biết hướng phát triển

Yêu cầu gốc (anh, 2026-06-28): muốn quản lý nhiều nguồn khách hơn (TikTok Business, Instagram...) trong CÙNG 1 khung Hội thoại như Facebook hiện tại, để có nhiều nguồn khách hơn. Quyết định lúc này: chưa làm ngay, chỉ ghi lại kế hoạch.

**Kiến trúc hiện có tận dụng được:**
- `Customer`/`Message` hiện chỉ phân biệt Facebook qua field riêng `facebookId` (xem `src/types/index.ts`, `server/src/facebook.ts`) — nên tổng quát hoá thành 1 field `channel` (`"facebook" | "instagram" | "tiktok" | "zalo"` ...) thay vì mỗi nền tảng tự thêm 1 field id riêng, để thread-list/badge nguồn dễ mở rộng.
- `ChatPage.tsx` lấy thread từ `getConversationThreads()` (tính lại từ `messages` hiện tại, không gắn cứng Facebook) — nên KHÔNG cần đổi UI khung chat khi thêm nguồn mới, chỉ cần icon/badge nhận diện nguồn trên mỗi thread.
- Mỗi nguồn mới cần làm riêng theo đúng pattern `facebook.ts` đã có: 1 file webhook receiver (verify signature, parse payload, tìm/tạo customer theo id riêng nền tảng, ghi message, gọi AI nếu auto-reply đang bật) + 1 hàm gửi tin riêng (API gửi tin mỗi nền tảng khác hẳn nhau, không dùng chung được `sendFacebookMessage`).
- Cấu hình token/secret từng kênh nên theo đúng pattern Facebook/Drive đã có: nhập trong app (Cài đặt > tên kênh), Render env var chỉ là fallback — KHÔNG bắt khách phải vào lại Render mỗi lần đổi.

**Lưu ý kỹ thuật theo từng nền tảng (để AI tiếp quản không mất công research lại từ đầu):**
- **Instagram** — nên làm TRƯỚC, ít việc nhất: nếu Instagram Business Account đã liên kết với Facebook Page, dùng CHUNG hạ tầng Meta for Developers (cùng App ID, cùng cách verify `X-Hub-Signature-256`) — tái dùng tối đa code `facebook.ts`, chỉ khác cách lấy ID người gửi (IGSID) + endpoint gửi tin.
- **TikTok Business** — rủi ro kỹ thuật cao nhất: KHÔNG có webhook nhắn tin 1-1 (DM) công khai dễ tiếp cận như Messenger; API công khai của TikTok hiện chủ yếu phục vụ quảng cáo (Marketing API) và TikTok Shop, không phải chat trực tiếp. Trước khi code, AI tiếp quản PHẢI tra cứu lại tình trạng API mới nhất (chính sách hay đổi) — nhiều khả năng phải qua giải pháp trung gian (Zapier/n8n) hoặc chưa làm được webhook trực tiếp kiểu Facebook.
- **Zalo** — đã từng nêu ở Giai đoạn 2 ("để sau"), vẫn là ứng viên hợp lý làm cùng lúc/ngay sau Instagram vì khách Việt Nam dùng nhiều.

**Thứ tự khuyến nghị:** Instagram (ít việc nhất, tái dùng code Facebook) → Zalo → TikTok (cần nghiên cứu lại khả năng kỹ thuật trước khi nhận lời làm).

**Việc CHƯA chốt — AI tiếp quản phải hỏi chủ studio trước khi code:** làm nguồn nào trước trong 3 nguồn trên, có cần icon/badge phân biệt nguồn ở thread-list hay không, và AI tự trả lời (auto-reply) có áp dụng đồng nhất cho mọi nguồn hay chỉ riêng Facebook như hiện tại.

## Việc tiếp theo

Giai đoạn 0, 1, 2 (phần Facebook), 3, 3.1, 4, 5, 6 đã xong phần code. Việc còn lại của Giai đoạn 2: anh deploy `server/` lên Render + khai báo webhook trên Meta for Developers — xem hướng dẫn từng bước trong `server/README.md`. Việc còn lại của Giai đoạn 3: anh lấy `GEMINI_API_KEY` (miễn phí, xem mục Giai đoạn 3 trên) và bật toggle trong app. Việc còn lại của Giai đoạn 6: xem qua `/settings/automation` + cân nhắc bật 2 function rủi ro cao hơn ở `/settings/ai` khi đã thấy yên tâm. Zalo (phần còn lại của Giai đoạn 2) để sau theo đúng thứ tự anh chọn.
