// api/telegram-webhook.js
import axios from "axios";
import admin from "firebase-admin";

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://<your-vercel-project>.vercel.app/api/telegram-webhook';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { callback_query } = req.body;

    if (callback_query) {
      const { data: callbackData, message } = callback_query;
      const chatId = message.chat.id;

      // ---------- Order Approve/Reject ----------
      if (callbackData.startsWith("approve_order_") || callbackData.startsWith("reject_order_")) {
        const orderId = callbackData.replace(/^(approve_order_|reject_order_)/, "");
        const isApproval = callbackData.startsWith("approve_order_");

        // Update Firestore
        await db.collection("orders").doc(orderId).set(
          { status: isApproval ? "approved" : "rejected", updatedAt: admin.firestore.Timestamp.now() },
          { merge: true }
        );

        const responseMessage = isApproval
          ? `✅ Order ${orderId.slice(0, 8)} approved and sent to kitchen/bar!`
          : `❌ Order ${orderId.slice(0, 8)} rejected.`;

        await axios.post(`${TELEGRAM_API_URL}/sendMessage`, { chat_id: chatId, text: responseMessage, parse_mode: "HTML" });
        await axios.post(`${TELEGRAM_API_URL}/answerCallbackQuery`, { callback_query_id: callback_query.id, text: isApproval ? "Order approved!" : "Order rejected!", show_alert: false });
      }

      // ---------- Payment Approve/Reject ----------
      else if (callbackData.startsWith("approve_payment_") || callbackData.startsWith("reject_payment_")) {
        const paymentId = callbackData.replace(/^(approve_payment_|reject_payment_)/, "");
        const isApproval = callbackData.startsWith("approve_payment_");

        // Update Firestore
        await db.collection("payments").doc(paymentId).set(
          { status: isApproval ? "approved" : "rejected", updatedAt: admin.firestore.Timestamp.now() },
          { merge: true }
        );

        const responseMessage = isApproval
          ? `✅ Payment ${paymentId.slice(0, 8)} approved!`
          : `❌ Payment ${paymentId.slice(0, 8)} rejected.`;

        await axios.post(`${TELEGRAM_API_URL}/sendMessage`, { chat_id: chatId, text: responseMessage, parse_mode: "HTML" });
        await axios.post(`${TELEGRAM_API_URL}/answerCallbackQuery`, { callback_query_id: callback_query.id, text: isApproval ? "Payment approved!" : "Payment rejected!", show_alert: false });
      }

      // ---------- Kitchen/Bar Ready/Delay ----------
      else if (callbackData.includes("ready_") || callbackData.includes("delay_")) {
        const [action, department, orderId] = callbackData.split("_");
        const isReady = action === "ready";
        const departmentName = department === "kitchen" ? "Kitchen" : "Bar";

        // Update Firestore
        await db.collection("orders").doc(orderId).set(
          { [`${departmentName.toLowerCase()}Status`]: isReady ? "ready" : "delayed", updatedAt: admin.firestore.Timestamp.now() },
          { merge: true }
        );

        const responseMessage = isReady
          ? `✅ ${departmentName} marked order ${orderId.slice(0, 8)} as READY!`
          : `⏰ ${departmentName} reported delay for order ${orderId.slice(0, 8)}`;

        await axios.post(`${TELEGRAM_API_URL}/sendMessage`, { chat_id: chatId, text: responseMessage, parse_mode: "HTML" });
        await axios.post(`${TELEGRAM_API_URL}/answerCallbackQuery`, { callback_query_id: callback_query.id, text: isReady ? "Marked as ready!" : "Delay reported!", show_alert: false });
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Setup webhook (optional, run once)
export async function setupWebhook() {
  try {
    const response = await axios.post(`${TELEGRAM_API_URL}/setWebhook`, {
      url: WEBHOOK_URL,
      allowed_updates: ["callback_query", "message"]
    });
    console.log("Webhook setup result:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error setting up webhook:", error);
    throw error;
  }
}
