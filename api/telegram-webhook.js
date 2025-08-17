// Telegram webhook handler for Vercel with Firebase integration
const axios = require('axios');
const admin = require('firebase-admin');

// Initialize Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = admin.firestore();
const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://your-app.vercel.app/api/telegram-webhook';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { callback_query } = req.body;
    
    if (callback_query) {
      const { data: callbackData, message, from } = callback_query;
      const chatId = message.chat.id;
      
      // Handle order approval/rejection
      if (callbackData.startsWith('approve_order_') || callbackData.startsWith('reject_order_')) {
        const orderId = callbackData.replace(/^(approve_order_|reject_order_)/, '');
        const isApproval = callbackData.startsWith('approve_order_');
        
        try {
          // Update order status in Firebase
          await db.collection('orders').doc(orderId).update({
            status: isApproval ? 'approved' : 'rejected',
            processedBy: from.username || from.first_name,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          const responseMessage = isApproval 
            ? `✅ Order ${orderId.slice(0, 8)} has been approved and sent to kitchen/bar!`
            : `❌ Order ${orderId.slice(0, 8)} has been rejected.`;
          
          await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
            chat_id: chatId,
            text: responseMessage,
            parse_mode: 'HTML'
          });
          
          await axios.post(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
            callback_query_id: callback_query.id,
            text: isApproval ? 'Order approved!' : 'Order rejected!',
            show_alert: false
          });
          
        } catch (error) {
          console.error('Error processing order:', error);
          
          await axios.post(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
            callback_query_id: callback_query.id,
            text: 'Error processing order. Please try again.',
            show_alert: true
          });
        }
      }
      
      // [Rest of your existing callback handlers...]
    }
    
    res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function setupWebhook() {
  try {
    const response = await axios.post(`${TELEGRAM_API_URL}/setWebhook`, {
      url: WEBHOOK_URL,
      allowed_updates: ['callback_query', 'message']
    });
    
    console.log('Webhook setup result:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error setting up webhook:', error);
    throw error;
  }
}
