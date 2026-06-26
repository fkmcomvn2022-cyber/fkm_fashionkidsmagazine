# So sánh bản Apps Script (đang chạy thật) với fkm-studio (React)

Mục tiêu tài liệu: ghi lại những gì fkm-studio nên học theo từ bản Apps Script
("FKM_STUDIO_V7_19_SYSTEM_CLEAN_CHAT_REBUILD_BASE", 2 file `code.gs` 5175
dòng + `app.html` 4733 dòng do anh xuất ra), theo đúng yêu cầu: xuất sắc về
nghiệp vụ nhưng khó nâng cấp tiếp vì còn lỗi. Không đụng code ở bước này —
đây là tài liệu tham khảo cho các bước nâng cấp fkm-studio sau.

## 1. Cách tính điểm gợi ý lịch (`scoreSlot_`)

Bản Apps Script có `scoreSlot_(date, time, concept, people)` — chấm điểm
0-100 cho mỗi khung giờ ứng viên, cộng/trừ điểm theo từng tình huống cụ thể:
nối sát cụm lịch đã có (+42, thêm +24 nếu đúng 2 bé, -18 nếu nhóm 3+ vì cần
kiểm tra thời lượng), giờ sớm hợp lý (+10 đến +18), càng dễ vướng giờ nghỉ
trưa/tối thì trừ theo số người (-24 đến -48), giờ muộn trừ dần theo từng giờ
quá mốc `LATE_PENALTY_FROM` (mặc định 16:00). 5 mốc trạng thái rõ ràng: Rất
nên tư vấn / Nên tư vấn / Có thể nhận / Không ưu tiên / Nên tránh. Mỗi điểm
trừ/cộng đều có lý do bằng tiếng Việt kèm theo (`reasons`), ghép lại thành
câu giải thích cho nhân viên tư vấn.

fkm-studio đã có `suggestionEngine.ts` (`getSuggestedDays`, `getSuggestedHours`)
theo đúng tinh thần cộng điểm tương tự, nhưng đang dùng các nhóm trọng số đặt
tên chung (`gioDep`, `caDaCoKhach`, `lapLich`, `satNghiTrua`...) thay vì luật
cụ thể theo số người/khoảng cách cụm lịch như bản Apps Script. Điểm khác
biệt chính: bản Apps Script phản ứng khác nhau rõ rệt theo **số người trong
nhóm** (1 / 2 / 3+) ở từng luật, còn fkm-studio hiện chưa phân theo số người
ở mức chi tiết đó. Nên cân nhắc bổ sung các luật phân theo số người + khoảng
cách tới cụm lịch gần nhất (`deltaAfterLast` trong 15 phút / 60 phút / xa
hơn) — đây là phần "tinh" nhất của bản Apps Script, được tinh chỉnh qua thời
gian vận hành thật.

## 2. Tạo đơn (`api_saveOrder_impl` + `calcOrder_`)

Luồng tạo đơn của Apps Script: nhận `subjects` (danh sách người chụp, mỗi
người gắn 1 concept riêng nếu khác concept nhau) → tự tìm concept đang mở
bán đúng ngày (`findOpenConcept_`, báo lỗi rõ nếu concept chưa mở lịch ngày
đó) → build chi tiết đơn (`buildDetails_`, mỗi người = 1 dòng chi tiết, đơn
giá lấy từ Bảng giá hoặc concept) → `calcOrder_` tính tiền: tổng tiền gói =
tổng tiền từng người (không phải đơn giá x số người một cách máy móc — nếu
mỗi người giá khác do concept khác nhau, vẫn đúng), cộng phụ thu, trừ
voucher (theo % hoặc tiền cố định), trả về cả số ảnh phải giao (ảnh cá nhân
theo từng người + ảnh nhóm = (số người - 1) × 5). Tự sinh `Lich_Tac_Vu`
(lịch makeup + chụp riêng + chụp nhóm) ngay khi lưu đơn, có kiểm tra trùng
ca (`orderSlotConflicts_`) và validate xác nhận trùng nếu nhân viên cố tình
xếp đè.

Cách tính lịch Makeup → Chụp riêng → Chụp nhóm theo từng người (cộng dồn thời
gian makeup mỗi người, ảnh chụp riêng nối tiếp nhau, ảnh nhóm cộng thêm theo
số người) khớp với mô hình 2 trạm fkm-studio đang dùng (xem
[[fkm-studio-scheduling-model]]). Điểm fkm-studio nên học: bản Apps Script
validate rất chặt — không cho tạo đơn nếu concept chưa mở lịch ngày đó, và
báo lỗi cụ thể từng ca đang trùng (giờ + tên khách + SĐT) trước khi cho xác
nhận đè. Nên kiểm tra xem fkm-studio's `QuickOrderForm` đã có validate tương
đương chưa.

## 3. Quản lý nhân sự + chấm công thợ — khác biệt kiến trúc lớn nhất

Đây là khoảng cách rõ nhất giữa 2 bản. Apps Script gắn **công thợ vào từng
Concept** (`Cong_Makeup_Tre_Em`, `Cong_Makeup_Nguoi_Lon`, `Cong_Photo`,
`Cong_Stylist`, `Cong_Retouch`) — tức tiền công thay đổi theo concept nào
được chụp, không phụ thuộc nhân sự nào làm. Khi quyết toán
(`api_settleCrewPayment_impl`), studio chọn khoảng ngày + vai trò + (tuỳ
chọn) đúng 1 nhân sự, hệ thống tự lọc đơn phù hợp, tự cộng tiền công theo
từng đơn (`crewRoleCostForOrder_`), ghi 1 dòng quyết toán vào sổ
`Thanh_Toan_Cong_Tho` (có `Don_ID_List` để truy lại đúng các đơn đã trả), và
đánh dấu các đơn đó "đã thanh toán công thợ" để không bị tính lại lần sau.

fkm-studio hiện **chưa có sổ quyết toán công thợ nào** — `Staff` có
`payType`/`rate`/`paidThisMonth`/`owedThisMonth` nhưng đây là số tự khai báo
trên hồ sơ nhân sự, không có cơ chế tự tính từ danh sách đơn theo khoảng
ngày, và `Concept` không có trường công thợ nào (giá công đang gắn ở nhân
sự, không gắn ở concept). Đây là gap lớn nhất cần quyết định trước khi đóng
gói: muốn giữ mô hình "giá công theo nhân sự" hiện tại của fkm-studio, hay
chuyển sang mô hình "giá công theo concept" như bản Apps Script (ưu điểm:
công thợ phản ánh đúng độ khó/độ dài từng loại concept, không phải mặc cả
riêng với từng thợ).

## 4. Quản lý khách hàng + workflow tổng thể

Bản Apps Script dùng **1 tab "Hồ sơ" chung cho cả khách hàng và nhân sự**
(`S.profileMode` = `customer` hoặc `staff`), chuyển qua lại bằng cùng 1 nút
điều hướng — giảm số tab phải nhớ. Điều hướng chính (bottom nav) chỉ có 4 nút
cố định: Home, Ca chụp (lịch), Hồ sơ, Sản phẩm — các màn còn lại (Đơn hàng,
Kho đồ, Hậu kỳ, Tài chính, Hội thoại, Media, AI, Cài đặt, Log lỗi) vào qua
menu hệ thống, không chiếm chỗ ở nav chính. Trạng thái đơn (`Trang_Thai_Don`)
là chuỗi tự do tiếng Việt ("Mới đặt", "Đã xếp"...) chứ không phải enum cứng —
linh hoạt nhưng rủi ro gõ sai chính tả làm lệch filter, đây là một phần
nguyên nhân khiến hệ thống "khó nâng cấp" như anh nói, vì sửa 1 trạng thái
phải tìm hết các chỗ so sánh chuỗi.

fkm-studio dùng TypeScript union type cho status — về lâu dài đáng tin cậy
hơn, nên đây là điểm fkm-studio đang làm tốt hơn, không cần học theo. Điều
nên học: gộp Khách hàng + Nhân sự vào cùng 1 khái niệm "Hồ sơ" (profile) nếu
muốn giảm số màn hình, và giữ bottom nav tối giản (3-4 mục cố định, còn lại
vào menu) — fkm-studio hiện có bao nhiêu mục ở nav chính nên rà lại theo
hướng này nếu thấy đang quá tải.

## 5. Vì sao KHÔNG đóng gói trực tiếp bản Apps Script thành APK/app Mac

Frontend (`app.html`) chạy trong iframe `HtmlService` của Google, gọi
backend bằng `google.script.run` (RPC riêng của Apps Script, có JSONP làm
phương án lùi) — không phải REST API thường. Muốn đóng gói app cài đặt
được, cần 1 trong 2 hướng: (a) viết lại toàn bộ tầng giao tiếp frontend↔backend
của bản Apps Script thành REST API thật (biến `Code.gs` thành 1 Express/Cloud
Function server, giữ Google Sheet làm DB qua Sheets API thay vì
`SpreadsheetApp` nội bộ), hoặc (b) không đóng gói bản Apps Script — chỉ
port các nghiệp vụ hay (mục 1-4 trên) sang fkm-studio rồi đóng gói fkm-studio
(Tauri cho macOS, Capacitor cho APK), vì fkm-studio đã là SPA + REST API
chuẩn, không có rào cản kỹ thuật này.

## Đề xuất hướng tiếp theo (chưa làm, chờ anh chọn)

Theo đúng câu trả lời anh đã chọn ("muốn app của tôi học hỏi theo giao diện,
cách tính điểm, tạo đơn, quản lý nhân sự, khách hàng, workflow"), hướng hợp
lý nhất là: tiếp tục phát triển fkm-studio (giữ kiến trúc REST/SPA để đóng
gói được), port từng phần nghiệp vụ ở trên sang, ưu tiên theo mức ảnh hưởng:
(1) bổ sung sổ quyết toán công thợ (mục 3, gap lớn nhất, ảnh hưởng vận hành
tài chính hàng ngày), (2) tinh chỉnh `suggestionEngine.ts` theo luật phân
nhóm người + cụm lịch (mục 1), (3) rà lại validate tạo đơn (mục 2), (4) gộp
màn Khách hàng/Nhân sự nếu muốn (mục 4, ít cấp thiết hơn). Sau khi port đủ,
mới bắt đầu đóng gói Tauri/Capacitor.
