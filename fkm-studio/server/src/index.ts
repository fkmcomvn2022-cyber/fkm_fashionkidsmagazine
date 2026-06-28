/**
 * Backend FKM Studio — Phase 0 (nền tảng): chỉ làm 1 việc là mirror dữ liệu
 * app lên 1 server thật, chạy 24/7, có thể deploy public. Đây là điều kiện
 * cần để Phase 2+ (webhook Facebook/Zalo, push thông báo, AI trả lời) có nơi
 * "sống" — KHÔNG có server public thì Facebook/Zalo không gửi tin được vào.
 *
 * Chạy local: npm install && npm run dev (mặc định cổng 4000).
 * Deploy public: xem README.md trong thư mục này.
 */
import "dotenv/config"; // nạp server/.env khi chạy local — khi deploy (Render/Railway) biến môi trường đặt thẳng ở dashboard, dotenv không thấy file .env thì im lặng bỏ qua, không lỗi
import express from "express";
import cors from "cors";
import multer from "multer";
import { readState, writeState } from "./store.js";
import { addSubscription, getPublicKey, initPush, removeSubscription, sendPushToAll, subscriptionCount } from "./push.js";
import { getPhotoSelectionForOrder, submitPhotoSelection } from "./orders.js";
import {
  appendMessage,
  fetchImageAsBase64,
  findOrCreateCustomerByFacebookId,
  parseFacebookWebhookPayload,
  sendFacebookImage,
  sendFacebookMessage,
  verifyFacebookSignature,
} from "./facebook.js";
import {
  buildCombinedCustomPrompt,
  buildStudioContext,
  classifyPaymentImage,
  generateAiReply,
  generateImageReply,
  splitReplyIntoMessages,
  type AiFunctionConfig,
  type ChatTurn,
} from "./ai.js";
import { getMaskedProviders, reorderProviders, updateProviders, type AiProviderKey, type AiProviderPatch } from "./aiProviders.js";
import { getEffectiveFbConfig, getMaskedFbConfig, updateFbConfig, type FbConfigPatch } from "./fbConfig.js";
import { getMaskedDriveConfig, updateDriveConfig, type DriveConfigPatch } from "./driveConfig.js";
import { uploadImageToDrive, DriveNotConfiguredError } from "./googleDrive.js";
import { confirmDepositFromScreenshot } from "./chatOrders.js";
import { runAutomationCron } from "./automationCron.js";
import { generateAssistantReply, type AssistantTurn } from "./assistant.js";

// Nhận ảnh upload qua multipart/form-data (nút "Gửi ảnh"/kéo-thả) — giữ
// trong RAM (không lưu file tạm trên đĩa Render, đĩa Render KHÔNG persistent
// giữa các lần deploy) rồi đẩy thẳng lên Google Drive, xem googleDrive.ts.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
// FB_VERIFY_TOKEN/FB_APP_SECRET/FB_PAGE_ACCESS_TOKEN KHÔNG còn đọc 1 lần ở
// đây nữa — giờ đọc động qua getEffectiveFbConfig() mỗi lần cần (xem
// fbConfig.ts), vì studio có thể nhập/đổi qua UI Cài đặt bất kỳ lúc nào mà
// không cần redeploy lại server. Biến môi trường Render cũ vẫn là mặc định
// ngầm nếu studio chưa nhập gì qua UI.

app.use(cors());
app.use(
  express.json({
    limit: "5mb", // ảnh chuyển khoản (Phase 4) sẽ cần body lớn hơn JSON thường
    // Lưu lại buffer thô của body — cần để xác minh chữ ký X-Hub-Signature-256
    // của webhook Facebook (verify trên BYTES gốc, không phải object đã parse).
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "fkm-studio-server", time: new Date().toISOString() });
});

// --- Phase 1: thông báo đẩy (web push) ---------------------------------

app.get("/api/push/public-key", async (_req, res) => {
  res.json({ publicKey: await getPublicKey() });
});

app.post("/api/push/subscribe", async (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    res.status(400).json({ ok: false, error: "invalid_subscription" });
    return;
  }
  await addSubscription(sub);
  res.json({ ok: true });
});

app.post("/api/push/unsubscribe", async (req, res) => {
  const { endpoint } = req.body ?? {};
  if (!endpoint) {
    res.status(400).json({ ok: false, error: "missing_endpoint" });
    return;
  }
  await removeSubscription(endpoint);
  res.json({ ok: true });
});

// Gửi 1 thông báo thử tới mọi thiết bị đã đăng ký — dùng để xác nhận đường
// ống push hoạt động thật (xem nút "Gửi thử thông báo" ở Cài đặt trên app).
// Phase 2-5 sau này sẽ gọi sendPushToAll() trực tiếp từ code xử lý webhook,
// không qua route này.
app.post("/api/push/test", async (_req, res) => {
  const result = await sendPushToAll({
    title: "FKM Studio",
    body: "Thông báo thử — đường ống push đang hoạt động.",
    url: "/",
  });
  res.json({ ok: true, ...result });
});

app.get("/api/push/status", async (_req, res) => {
  res.json({ subscriptions: await subscriptionCount() });
});

// Mirror toàn bộ state app (orders/customers/.../settings) — đúng shape
// PersistedSnapshot ở frontend. GET trả null nếu server chưa có dữ liệu nào
// (lần đầu chạy) -> frontend tự hiểu là "dùng localStorage/dữ liệu mẫu".
app.get("/api/state", async (_req, res) => {
  const state = await readState();
  res.json({ state });
});

/**
 * BUG ĐÃ SỬA (2026-06-28): PUT /api/state trước đây ghi đè (overwrite) TOÀN
 * BỘ state bằng đúng những gì frontend gửi lên. Vì frontend chỉ poll tin
 * nhắn/khách Facebook mới khi đang MỞ màn Hội thoại (xem ChatPage.tsx), nên
 * nếu lúc webhook Facebook vừa ghi 1 tin nhắn mới vào state, mà sau đó BẤT KỲ
 * thiết bị/tab nào (chưa kịp poll tin đó) làm 1 hành động ghi dữ liệu khác
 * (tạo đơn, sửa concept...) -> persistAll() -> PUT /api/state với bản
 * `messages`/`customers` CŨ (chưa có tin Facebook mới) -> ghi đè mất luôn tin
 * nhắn/khách mà webhook vừa tạo, KHÔNG có lỗi gì để thấy. Đây là lý do tin
 * nhắn test Facebook lên log "ghi vào state" thành công nhưng app không bao
 * giờ thấy — đã được merge lại trước khi app kịp đọc.
 *
 * Fix: với 2 mảng `messages` và `customers` — nơi DUY NHẤT có 2 phía cùng ghi
 * (frontend ghi tay + webhook backend ghi) — hợp nhất theo id: bản ghi nào
 * frontend gửi lên thì dùng bản đó (frontend vẫn là nguồn đúng cho việc sửa
 * trạng thái đã đọc/tên khách...), còn id nào CHỈ có ở server (frontend chưa
 * kịp poll) thì GIỮ LẠI, không cho ghi đè mất. Các mảng/field khác (orders,
 * concepts, staff...) không có ai khác ghi ngoài frontend nên vẫn ghi đè thẳng
 * như cũ.
 */
function mergeArraysById(serverArr: unknown, incomingArr: unknown): unknown[] {
  const server = Array.isArray(serverArr) ? (serverArr as { id?: string }[]) : [];
  const incoming = Array.isArray(incomingArr) ? (incomingArr as { id?: string }[]) : [];
  const incomingIds = new Set(incoming.map((x) => x.id));
  const onlyOnServer = server.filter((x) => x.id && !incomingIds.has(x.id));
  return [...incoming, ...onlyOnServer];
}

app.put("/api/state", async (req, res) => {
  try {
    const incoming = (req.body ?? {}) as Record<string, unknown>;
    const current = (await readState()) ?? {};
    const merged: Record<string, unknown> = {
      ...incoming,
      messages: mergeArraysById(current.messages, incoming.messages),
      customers: mergeArraysById(current.customers, incoming.customers),
    };
    await writeState(merged);
    res.json({ ok: true });
  } catch (err) {
    console.error("Không lưu được state:", err);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

/**
 * Phase 9 (xem [[fkm-studio-ai-chatbot-roadmap]]) — cấu hình 3 nhà cung cấp AI
 * (key/model/bật-tắt/thứ tự ưu tiên), TÁCH RIÊNG khỏi GET/PUT /api/state ở
 * trên vì route đó công khai không xác thực — xem comment đầu file
 * aiProviders.ts để biết vì sao không thể lưu API key thật vào đó. GET ở đây
 * cũng KHÔNG bao giờ trả nguyên văn key, chỉ trả vài ký tự cuối để hiển thị.
 */
app.get("/api/ai-providers", async (_req, res) => {
  res.json({ providers: await getMaskedProviders() });
});

app.put("/api/ai-providers", async (req, res) => {
  try {
    const { patches, order } = (req.body ?? {}) as { patches?: AiProviderPatch[]; order?: AiProviderKey[] };
    if (Array.isArray(patches) && patches.length) await updateProviders(patches);
    if (Array.isArray(order) && order.length) await reorderProviders(order);
    res.json({ ok: true, providers: await getMaskedProviders() });
  } catch (err) {
    console.error("[ai-providers] Không lưu được cấu hình:", err);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// Cấu hình kết nối Facebook Messenger (Verify Token/App Secret/Page Access
// Token/Page ID) nhập trực tiếp trong app, thay cho cách cũ phải vào Render
// Dashboard đặt biến môi trường (xem fbConfig.ts đầu file để biết đầy đủ lý
// do bảo mật — tách hẳn khỏi state.json công khai, giống pattern key AI).
app.get("/api/fb-config", async (_req, res) => {
  res.json(await getMaskedFbConfig());
});

app.put("/api/fb-config", async (req, res) => {
  try {
    await updateFbConfig((req.body ?? {}) as FbConfigPatch);
    res.json({ ok: true, config: await getMaskedFbConfig() });
  } catch (err) {
    console.error("[fb-config] Không lưu được cấu hình:", err);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// Cấu hình Google Drive (service account key + folder) — xem driveConfig.ts.
app.get("/api/drive-config", async (_req, res) => {
  res.json(await getMaskedDriveConfig());
});

app.put("/api/drive-config", async (req, res) => {
  try {
    await updateDriveConfig((req.body ?? {}) as DriveConfigPatch);
    res.json({ ok: true, config: await getMaskedDriveConfig() });
  } catch (err) {
    console.error("[drive-config] Không lưu được cấu hình:", err);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// Upload 1 ảnh (multipart, field "image") lên Google Drive, trả về link xem
// trực tiếp — dùng cho nút "Gửi ảnh"/kéo-thả ở ChatPage + OrderDetailSheet.
// KHÔNG ghi gì vào state ở đây ngoài driveFolderId của khách (chỉ để TÁI
// DÙNG đúng folder đã tạo, không phải dữ liệu nghiệp vụ) — frontend tự quyết
// định dùng link trả về để làm gì (gửi tin nhắn qua /api/messages/send, hoặc
// thêm vào photoSelection qua PUT /api/state như mọi field đơn hàng khác).
//
// Có gửi kèm field "customerId" (+ "customerName") -> tự tạo/tái dùng 1
// folder con riêng cho khách đó trong folder gốc (theo yêu cầu của anh
// 2026-06-28: "tự tạo từng thư mục riêng cho từng khách, tự link đúng với
// từng khách luôn", giống cách app khác anh dùng tự làm khi kết nối
// workspace) — xem googleDrive.ts. Không gửi customerId (vd ảnh không gắn
// với khách cụ thể) thì vẫn upload thẳng vào folder gốc như trước.
app.post("/api/upload-image", upload.single("image"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ ok: false, error: "missing_file" });
    return;
  }
  const customerId = typeof req.body?.customerId === "string" ? req.body.customerId.trim() : "";
  const customerName = typeof req.body?.customerName === "string" ? req.body.customerName.trim() : "";
  const state = customerId ? ((await readState()) ?? {}) : null;
  const customers = state && Array.isArray(state.customers)
    ? (state.customers as { id?: string; name?: string; driveFolderId?: string }[])
    : [];
  const customer = customerId ? customers.find((c) => c.id === customerId) : undefined;
  try {
    const result = await uploadImageToDrive(
      file.buffer,
      file.originalname || `anh-${Date.now()}.jpg`,
      file.mimetype || "image/jpeg",
      customerId ? { name: customerName || customer?.name || "Khách chưa rõ tên", existingFolderId: customer?.driveFolderId } : undefined,
    );
    // Lưu lại folderId vừa tạo/dùng để lần sau khỏi tạo trùng — chỉ ghi khi
    // có khách thật trong state và folderId đổi khác giá trị đã lưu.
    if (state && customer && customer.driveFolderId !== result.folderId) {
      customer.driveFolderId = result.folderId;
      await writeState(state);
    }
    res.json({ ok: true, url: result.viewUrl });
  } catch (err) {
    if (err instanceof DriveNotConfiguredError) {
      res.status(409).json({ ok: false, error: "drive_not_configured" });
      return;
    }
    console.error("[upload-image] Lỗi upload Google Drive:", err);
    res.status(502).json({ ok: false, error: "upload_failed" });
  }
});

// Giai đoạn 8 (xem [[fkm-studio-ai-chatbot-roadmap]]) — trợ lý AI NỘI BỘ cho
// chủ studio (xem assistant.ts). CHỈ ĐỌC state, không ghi gì lại — không cần
// writeState() sau khi xử lý, khác hẳn các route AI khách hàng ở trên.
app.post("/api/assistant/chat", async (req, res) => {
  const history = Array.isArray(req.body?.history) ? (req.body.history as AssistantTurn[]) : [];
  if (history.length === 0 || !history[history.length - 1]?.fromOwner) {
    res.status(400).json({ ok: false, error: "missing_owner_message" });
    return;
  }
  const state = (await readState()) ?? {};
  try {
    const reply = await generateAssistantReply({ state, history });
    if (reply == null) {
      res.json({ ok: false, error: "no_reply" });
      return;
    }
    res.json({ ok: true, reply });
  } catch (err) {
    console.error("[assistant] Lỗi xử lý chat trợ lý nội bộ:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// --- Phase 5: cổng chọn ảnh cho khách ----------------------------------
// Đọc/ghi trực tiếp vào state mirror (state.orders) — xem orders.ts để biết
// vì sao route POST là route DUY NHẤT backend tự ghi vào (mọi field khác của
// đơn hàng đều do app studio ghi qua PUT /api/state như thường).

app.get("/api/orders/:id/photo-selection", async (req, res) => {
  const state = await readState();
  const result = getPhotoSelectionForOrder(state ?? {}, req.params.id);
  if (!result.found) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  res.json({ ok: true, ...result });
});

app.post("/api/orders/:id/photo-selection", async (req, res) => {
  const state = await readState();
  if (!state) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  const { selectedUrls } = req.body ?? {};
  if (!Array.isArray(selectedUrls) || !selectedUrls.every((u) => typeof u === "string")) {
    res.status(400).json({ ok: false, error: "invalid_body" });
    return;
  }
  const result = submitPhotoSelection(state, req.params.id, selectedUrls);
  if (!result.found) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  if (result.tooMany) {
    res.status(422).json({ ok: false, error: "too_many", maxSelectable: result.maxSelectable });
    return;
  }
  await writeState(state);
  const who = result.customerName ?? "Khách";
  const orderLabel = result.orderCode ? ` (đơn ${result.orderCode})` : "";
  await sendPushToAll({
    title: "FKM Studio",
    body: `${who} đã chọn xong ${selectedUrls.length} ảnh${orderLabel} — vào sửa ảnh giúp em nha.`,
    url: "/",
  });
  res.json({ ok: true });
});

// --- Phase 2: webhook Facebook Messenger -------------------------------
// Đọc/ghi trực tiếp vào state mirror (state.customers, state.messages) —
// giống Phase 5 (orders.ts), vì tin khách gửi phát sinh từ phía Facebook,
// không phải từ app studio, nên backend phải tự ghi ngay khi nhận được.

// Meta gọi GET này 1 LẦN DUY NHẤT khi anh khai báo webhook trên Meta for
// Developers (mục Messenger > Webhooks) — để xác minh server đúng là của
// mình trước khi Meta bắt đầu gửi tin nhắn thật vào.
app.get("/webhook/facebook", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const { verifyToken: FB_VERIFY_TOKEN } = await getEffectiveFbConfig();
  const ok = mode === "subscribe" && FB_VERIFY_TOKEN && token === FB_VERIFY_TOKEN;
  console.log(`[facebook webhook] Meta xác minh webhook (GET) — mode=${mode} tokenKhớp=${token === FB_VERIFY_TOKEN} => ${ok ? "OK 200" : "TỪ CHỐI 403"}`);
  if (ok) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook/facebook", async (req, res) => {
  console.log("[facebook webhook] Nhận được 1 request POST từ Facebook");
  const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody;
  const { appSecret: FB_APP_SECRET } = await getEffectiveFbConfig();
  if (!FB_APP_SECRET) {
    console.error("[facebook webhook] TỪ CHỐI 401 — thiếu App Secret (chưa nhập ở Cài đặt và cũng chưa đặt FB_APP_SECRET trên Render)");
    res.sendStatus(401);
    return;
  }
  if (!rawBody || !verifyFacebookSignature(rawBody, req.get("x-hub-signature-256"), FB_APP_SECRET)) {
    console.error("[facebook webhook] TỪ CHỐI 401 — chữ ký x-hub-signature-256 không khớp App Secret hiện tại (có thể App Secret đã nhập không đúng với App đang gửi webhook)");
    res.sendStatus(401);
    return;
  }
  console.log("[facebook webhook] Chữ ký hợp lệ — đang xử lý payload");
  // Facebook yêu cầu phản hồi 200 trong vài giây, không chờ xử lý xong mới trả lời.
  res.sendStatus(200);
  handleFacebookWebhookPayload(req.body)
    .then(() => console.log("[facebook webhook] Xử lý payload xong, đã ghi vào state"))
    .catch((err) => {
      console.error("[facebook webhook] Lỗi xử lý payload:", err);
    });
});

/**
 * Giai đoạn 6 (xem [[fkm-studio-ai-chatbot-roadmap]]) — khách gửi 1 ẢNH qua
 * Facebook. Thứ tự xử lý, đúng 2 quyết định kiến trúc đã chốt với anh:
 *  1) Nếu luật "auto_confirm_payment_screenshot" đang bật (Cài đặt Automation)
 *     -> AI Vision phân loại ảnh; nếu LÀ ảnh chuyển khoản, chạy thẳng
 *     confirmDepositFromScreenshot() (tiền định, không qua model soạn câu trả
 *     lời) rồi tự nhắn xác nhận lại khách.
 *  2) Nếu KHÔNG phải ảnh chuyển khoản (hoặc không khớp được đơn chờ cọc) và
 *     anh đã bật AI tự trả lời (Cài đặt > AI) -> AI tự nhìn ảnh + trả lời tự
 *     nhiên, không escalate, không bịa số tiền.
 * Mọi lỗi ở đây chỉ log, không throw — không chặn các tin khác trong batch.
 */
// Gửi 1 câu trả lời AI cho khách — có thể tách thành NHIỀU tin Messenger
// liên tiếp nếu AI đã chủ động ngắt ý bằng 2 lần xuống dòng (xem
// splitReplyIntoMessages + SYSTEM_PROMPT_HEADER ở ai.ts, theo đúng quy ước
// anh dùng ở UChat) — để giống người thật nhắn nhiều tin, không dồn 1 cục.
// Dừng ~0.9s giữa mỗi tin (anh chọn "có dừng nhẹ" khi em hỏi). Trả về true
// nếu gửi được ÍT NHẤT 1 đoạn.
async function sendAiReplyChunks(
  state: Record<string, unknown>,
  customer: { id?: string; facebookId?: string },
  reply: string,
  token: string,
): Promise<boolean> {
  if (!customer.facebookId) return false;
  const chunks = splitReplyIntoMessages(reply);
  let sentAny = false;
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 900));
    const sent = await sendFacebookMessage(customer.facebookId, chunks[i], token);
    if (sent.ok) {
      appendMessage(state, { customerId: customer.id ?? "", channel: "facebook", fromCustomer: false, text: chunks[i], aiGenerated: true });
      sentAny = true;
    } else {
      console.error("[ai] Gửi 1 đoạn tin AI thất bại:", sent.error);
    }
  }
  return sentAny;
}

async function handleIncomingImage(
  state: Record<string, unknown>,
  customer: { id?: string; facebookId?: string; name?: string },
  imageUrl: string,
  isAutomationEnabled: (key: string) => boolean,
  aiSettings:
    | {
        enabled?: boolean;
        customPrompt?: string;
        constraintsPrompt?: string;
        personaPrompt?: string;
        descriptionPrompt?: string;
        productPrompt?: string;
        skillPrompt?: string;
        temperature?: number;
      }
    | undefined,
  FB_PAGE_ACCESS_TOKEN: string,
  // Giai đoạn 7.2 — true khi khách này đang trong thời gian AI bị tạm dừng
  // (nhân viên vừa tự trả lời). CHỈ chặn nhánh AI tự soạn trả lời ảnh —
  // nhánh xác nhận cọc tiền định (auto_confirm_payment_screenshot) phía trên
  // vẫn chạy bình thường, vì đó là hành động tiền định/an toàn, không phải
  // AI "chen ngang" tự soạn câu trả lời.
  aiPaused = false,
): Promise<void> {
  if (!customer.facebookId || !FB_PAGE_ACCESS_TOKEN) return;
  const img = await fetchImageAsBase64(imageUrl);
  if (!img) return;

  const fmt = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

  if (isAutomationEnabled("auto_confirm_payment_screenshot")) {
    try {
      const cls = await classifyPaymentImage(img.base64, img.mimeType);
      if (cls?.isPayment) {
        const result = confirmDepositFromScreenshot(state, customer, cls.amount);
        if (result.ok) {
          const remainingNote = (result.remaining ?? 0) > 0 ? "" : " Đơn đã đủ cọc, hẹn gặp anh/chị đúng lịch nha.";
          const text = `Dạ FKM Studio đã nhận được ${fmt(result.amount ?? 0)} tiền cọc cho đơn ${result.orderCode}, còn lại ${fmt(result.remaining ?? 0)}. Em cảm ơn anh/chị!${remainingNote}`;
          const sent = await sendFacebookMessage(customer.facebookId, text, FB_PAGE_ACCESS_TOKEN);
          if (sent.ok) {
            appendMessage(state, { customerId: customer.id ?? "", channel: "facebook", fromCustomer: false, text, aiGenerated: true });
            await sendPushToAll({
              title: "FKM Studio",
              body: `AI đã tự xác nhận cọc cho ${customer.name ?? "khách"} (đơn ${result.orderCode})`,
              url: "/chat",
            });
          }
          return;
        }
      }
    } catch (err) {
      console.error("[ai] Lỗi phân loại/xác nhận ảnh chuyển khoản:", err);
    }
  }

  if (aiSettings?.enabled && !aiPaused) {
    try {
      const reply = await generateImageReply({
        base64: img.base64,
        mimeType: img.mimeType,
        studioContext: buildStudioContext(state as never),
        customPrompt: buildCombinedCustomPrompt(aiSettings),
        temperature: aiSettings.temperature,
      });
      if (reply) {
        await sendAiReplyChunks(state, customer, reply, FB_PAGE_ACCESS_TOKEN);
      }
    } catch (err) {
      console.error("[ai] Lỗi khi AI tự trả lời ảnh:", err);
    }
  }
}

async function handleFacebookWebhookPayload(body: unknown): Promise<void> {
  const incoming = parseFacebookWebhookPayload(body);
  if (incoming.length === 0) return;

  const { pageAccessToken: FB_PAGE_ACCESS_TOKEN } = await getEffectiveFbConfig();
  const state = (await readState()) ?? {};
  const automationRules = Array.isArray((state.automationSettings as { rules?: unknown })?.rules)
    ? ((state.automationSettings as { rules: { key: string; enabled: boolean }[] }).rules)
    : [];
  const isAutomationEnabled = (key: string) => automationRules.find((r) => r.key === key)?.enabled ?? true;

  for (const msg of incoming) {
    const customer = await findOrCreateCustomerByFacebookId(state, msg.psid, FB_PAGE_ACCESS_TOKEN, {
      name: msg.senderNameHint,
      avatar: msg.senderAvatarHint,
    });
    const hasImage = msg.attachmentUrls.length > 0;
    const text = msg.text ?? (hasImage ? "[Đã gửi ảnh]" : "");
    if (!text) {
      // BUG (2026-06-28): khách "fbu2" (tài khoản admin) đã được tạo (qua
      // findOrCreateCustomerByFacebookId phía trên) nhưng KHÔNG có tin nhắn
      // nào ghi vào `messages` — nghĩa là Facebook có gửi webhook (đủ psid +
      // message) nhưng msg.text rỗng/undefined VÀ không có attachment nào có
      // url (sticker dạng khác, share bài viết, vị trí, hoặc quick_reply
      // không text...). Trước đây bị `continue` âm thầm, không log gì, nên
      // không biết Facebook thực sự gửi gì. Log lại nguyên `msg` để lần sau
      // thấy ngay psid + text + attachmentUrls thật, từ đó biết cần xử lý
      // thêm loại nội dung gì (sticker, vị trí, share bài viết...).
      console.warn("[facebook webhook] Bỏ qua 1 tin không có nội dung nhận diện được (psid:", msg.psid, "):", JSON.stringify(msg));
      continue;
    }
    appendMessage(state, { customerId: customer.id ?? "", channel: "facebook", fromCustomer: true, text });
    await sendPushToAll({
      title: `Tin nhắn mới từ ${customer.name ?? "khách"}`,
      body: text.length > 80 ? `${text.slice(0, 80)}...` : text,
      url: "/chat",
    });

    // Giai đoạn 7.2 — nhân viên vừa tự trả lời khách này gần đây (qua POST
    // /api/messages/send hoặc nút chỉnh trong ChatPage) thì AI tạm ngừng tự
    // trả lời CHO RIÊNG khách này. Hết hạn -> AI tự bật lại NHƯ BÌNH THƯỜNG
    // (không cần làm gì thêm) NHƯNG phải tự gửi push báo lại (anh đã chọn rõ
    // "không im lặng" khi chốt thiết kế) — chỉ báo 1 LẦN ngay khi phát hiện
    // hết hạn (xóa aiPausedUntil ngay sau đó để tin tiếp theo không báo lại).
    const now = Date.now();
    const pausedUntil = customer.aiPausedUntil;
    const aiPaused = typeof pausedUntil === "number" && now < pausedUntil;
    if (typeof pausedUntil === "number" && !aiPaused) {
      delete customer.aiPausedUntil;
      await sendPushToAll({
        title: "FKM Studio",
        body: `AI đã tự bật lại trả lời ${customer.name ?? "khách"}`,
        url: "/chat",
      });
    }

    const aiSettings = state.aiAutoReplySettings as
      | {
          enabled?: boolean;
          customPrompt?: string;
          constraintsPrompt?: string;
          personaPrompt?: string;
          descriptionPrompt?: string;
          productPrompt?: string;
          skillPrompt?: string;
          functions?: AiFunctionConfig[];
          historyWindow?: number;
          temperature?: number;
        }
      | undefined;

    // Ảnh đính kèm — đi qua nhánh riêng (xác nhận cọc tiền định / AI nhìn ảnh
    // trả lời tự nhiên), KHÔNG đi qua nhánh trả lời chữ bên dưới (tránh gọi
    // Gemini 2 lần cho cùng 1 tin nhắn).
    if (hasImage) {
      await handleIncomingImage(state, customer, msg.attachmentUrls[0], isAutomationEnabled, aiSettings, FB_PAGE_ACCESS_TOKEN, aiPaused);
      continue;
    }

    // Phase 3 — AI tự trả lời, chỉ chạy khi anh đã bật ở Cài đặt (mirror lên
    // đây qua PUT /api/state, xem src/lib/aiReply.ts) VÀ khách này có
    // facebookId thật để gửi trả lời qua. Lỗi ở bước này (thiếu API key, lỗi
    // mạng, Gemini từ chối...) chỉ log, KHÔNG chặn việc lưu tin khách phía
    // trên — tin khách vẫn vào hộp thư bình thường để anh tự trả lời nếu AI
    // không trả lời được.
    if (aiSettings?.enabled && !aiPaused && customer.facebookId && FB_PAGE_ACCESS_TOKEN) {
      try {
        const allMessages = Array.isArray(state.messages)
          ? (state.messages as { customerId?: string; fromCustomer?: boolean; text?: string }[])
          : [];
        const history: ChatTurn[] = allMessages
          .filter((m) => m.customerId === customer.id)
          .map((m) => ({ fromCustomer: !!m.fromCustomer, text: String(m.text ?? "") }));
        const reply = await generateAiReply({
          state,
          customer,
          history,
          studioContext: buildStudioContext(state),
          customPrompt: buildCombinedCustomPrompt(aiSettings),
          functions: aiSettings.functions ?? [],
          historyWindow: aiSettings.historyWindow,
          temperature: aiSettings.temperature,
        });
        if (reply) {
          const sentAny = await sendAiReplyChunks(state, customer, reply, FB_PAGE_ACCESS_TOKEN);
          if (sentAny) {
            await sendPushToAll({
              title: "FKM Studio",
              body: `AI đã tự trả lời ${customer.name ?? "khách"}`,
              url: "/chat",
            });
          } else {
            console.error("[ai] Gửi trả lời AI thất bại (tất cả đoạn đều lỗi)");
          }
        }
      } catch (err) {
        console.error("[ai] Lỗi khi AI tự trả lời:", err);
      }
    }
  }
  await writeState(state);
}

// Studio (hoặc AI ở Phase 3) trả lời 1 khách qua đúng kênh đã nhắn vào — hiện
// chỉ hỗ trợ Facebook (Zalo để sau, xem roadmap). Frontend gọi route này khi
// bấm nút gửi ở màn Hội thoại.
app.post("/api/messages/send", async (req, res) => {
  const { customerId, text, imageUrl } = req.body ?? {};
  const hasImage = typeof imageUrl === "string" && !!imageUrl.trim();
  const hasText = typeof text === "string" && !!text.trim();
  if (typeof customerId !== "string" || (!hasText && !hasImage)) {
    res.status(400).json({ ok: false, error: "invalid_body" });
    return;
  }
  const state = (await readState()) ?? {};
  const customers = Array.isArray(state.customers)
    ? (state.customers as { id?: string; facebookId?: string; needsHumanHelp?: boolean; aiPausedUntil?: number }[])
    : [];
  const customer = customers.find((c) => c.id === customerId);
  if (!customer?.facebookId) {
    res.status(400).json({ ok: false, error: "no_facebook_id" });
    return;
  }
  const { pageAccessToken: FB_PAGE_ACCESS_TOKEN } = await getEffectiveFbConfig();
  if (!FB_PAGE_ACCESS_TOKEN) {
    res.status(500).json({ ok: false, error: "missing_page_access_token" });
    return;
  }
  // Ảnh + chữ thì gửi 2 tin riêng (Facebook Send API không gộp ảnh+text 1
  // tin) — ảnh trước, chữ chú thích sau cho tự nhiên.
  if (hasImage) {
    const imgResult = await sendFacebookImage(customer.facebookId, imageUrl, FB_PAGE_ACCESS_TOKEN);
    if (!imgResult.ok) {
      res.status(502).json({ ok: false, error: imgResult.error });
      return;
    }
    appendMessage(state, { customerId, channel: "facebook", fromCustomer: false, text: "", imageUrl });
  }
  if (hasText) {
    const result = await sendFacebookMessage(customer.facebookId, text, FB_PAGE_ACCESS_TOKEN);
    if (!result.ok) {
      res.status(502).json({ ok: false, error: result.error });
      return;
    }
    appendMessage(state, { customerId, channel: "facebook", fromCustomer: false, text });
  }
  // Studio (người thật) đã tự vào trả lời khách này -> coi như đã được hỗ trợ,
  // tắt cờ "Cần hỗ trợ" do AI đặt trước đó (hàm escalate_to_staff, xem ai.ts).
  if (customer.needsHumanHelp) customer.needsHumanHelp = false;
  // Giai đoạn 7.2 — nhân viên VỪA tự tay gửi tin cho khách này qua route này
  // (CHỈ route này — không phải escalate_to_staff/cron) -> tạm dừng AI tự trả
  // lời CHO RIÊNG khách này N phút (mặc định 30, chỉnh ở Cài đặt > AI), để AI
  // không chen ngang khi nhân viên đang tự xử lý hội thoại. Xem
  // handleFacebookWebhookPayload (chặn AI lúc đang pause + tự gửi push khi
  // pause hết hạn) và ChatPage (UI xem/chỉnh thời gian pause của hội thoại).
  const aiSettings = state.aiAutoReplySettings as { pauseMinutesAfterStaffReply?: number } | undefined;
  const pauseMinutes = aiSettings?.pauseMinutesAfterStaffReply ?? 30;
  customer.aiPausedUntil = Date.now() + pauseMinutes * 60_000;
  await writeState(state);
  res.json({ ok: true });
});

/**
 * Xoá hội thoại — xoá TOÀN BỘ tin nhắn (cả 2 chiều) của 1 khách khỏi state
 * thật trên server. Phải có route riêng (không thể xoá bằng cách chỉ
 * persistAll() từ frontend với mảng messages đã lọc bớt) vì PUT /api/state
 * dùng mergeArraysById bảo vệ tin server có mà frontend chưa gửi lên — nếu
 * không xoá ở đây, tin "đã xoá" sẽ bị merge trả lại ở lượt PUT kế tiếp.
 */
app.post("/api/messages/clear", async (req, res) => {
  const { customerId } = req.body ?? {};
  if (typeof customerId !== "string" || !customerId) {
    res.status(400).json({ ok: false, error: "invalid_body" });
    return;
  }
  const state = (await readState()) ?? {};
  const messages = Array.isArray(state.messages) ? (state.messages as { customerId?: string }[]) : [];
  state.messages = messages.filter((m) => m.customerId !== customerId);
  await writeState(state);
  res.json({ ok: true });
});

// Giai đoạn 7.2 — ChatPage cho phép xem/chỉnh trực tiếp thời gian tạm dừng AI
// của 1 hội thoại (không cần gửi tin mới): { minutes } > 0 = dừng thêm/dừng
// lại từ bây giờ trong N phút; { minutes: 0 } = bật lại AI ngay (xoá pause).
app.post("/api/customers/:id/ai-pause", async (req, res) => {
  const { minutes } = req.body ?? {};
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0) {
    res.status(400).json({ ok: false, error: "invalid_body" });
    return;
  }
  const state = (await readState()) ?? {};
  const customers = Array.isArray(state.customers)
    ? (state.customers as { id?: string; aiPausedUntil?: number }[])
    : [];
  const customer = customers.find((c) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  if (minutes === 0) {
    delete customer.aiPausedUntil;
  } else {
    customer.aiPausedUntil = Date.now() + minutes * 60_000;
  }
  await writeState(state);
  res.json({ ok: true, aiPausedUntil: customer.aiPausedUntil ?? null });
});

// Frontend poll định kỳ (xem ChatPage) — trả CẢ messages VÀ customers, vì
// khách nhắn Facebook lần đầu sẽ được webhook tạo mới ngay trên state mirror
// của backend (findOrCreateCustomerByFacebookId), nhưng frontend chưa đọc
// backend làm nguồn chính lúc khởi động (xem Phase 0) nên sẽ KHÔNG biết khách
// này tồn tại nếu chỉ đồng bộ messages mà không đồng bộ luôn customers mới.
// Trả toàn bộ 2 mảng, đơn giản vì dữ liệu 1 studio nhỏ; client tự dedupe theo
// id (xem mergeRemoteMessages/mergeRemoteCustomers).
app.get("/api/chat-sync", async (_req, res) => {
  const state = await readState();
  res.json({
    messages: (state?.messages as unknown[]) ?? [],
    customers: (state?.customers as unknown[]) ?? [],
  });
});

await initPush();

// Giai đoạn 6 (xem [[fkm-studio-ai-chatbot-roadmap]]) — quét tự động mỗi giờ
// để tự gửi nhắc cọc/nhắc lịch/nhắc chọn ảnh cho khách Facebook (chỉ khách có
// facebookId; xem automationCron.ts). Lỗi 1 lượt quét chỉ log, không crash
// server, không chặn lượt quét kế tiếp.
const AUTOMATION_CRON_INTERVAL_MS = 60 * 60 * 1000; // 1 giờ
async function runCronTick(): Promise<void> {
  try {
    const state = (await readState()) ?? {};
    const result = await runAutomationCron(state);
    if (result.depositReminders || result.scheduleReminders || result.selectPhotoReminders) {
      await writeState(state);
      console.log("[automationCron] Đã tự gửi nhắc:", result);
    }
  } catch (err) {
    console.error("[automationCron] Lỗi khi quét tự động:", err);
  }
}
setInterval(runCronTick, AUTOMATION_CRON_INTERVAL_MS);
runCronTick().catch((err) => console.error("[automationCron] Lỗi lượt quét đầu tiên:", err));

app.listen(PORT, () => {
  console.log(`[fkm-studio-server] đang chạy ở http://localhost:${PORT}`);
});
