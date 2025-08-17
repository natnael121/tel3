import axios from "axios";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function setupWebhook() {
  try {
    const response = await axios.post(`${TELEGRAM_API_URL}/setWebhook`, {
      url: WEBHOOK_URL,
      allowed_updates: ["callback_query", "message"]
    });
    console.log("Webhook setup result:", response.data);
  } catch (error) {
    console.error("Error setting up webhook:", error.response?.data || error.message);
  }
}

setupWebhook();
