# Telegram AI Multi Router

بوت Telegram على Cloudflare Workers يجمع OpenRouter وGemini وGroq مع fallback تلقائي.

## الميزات
- نصوص ومحادثة.
- تحليل الصور.
- قراءة PDF حتى 20MB عبر نموذج يدعم الملفات.
- ترجمة عبر /translate.
- تلخيص عبر /summarize.
- ذاكرة محادثة عبر Cloudflare KV لمدة 30 يومًا.
- /models و /help و /clear.
- تبديل تلقائي بين المزودين.
- لا توجد مفاتيح API داخل Git.

## إعداد KV
```bash
npx wrangler kv namespace create MEMORY
```
ضع id الناتج مكان REPLACE_WITH_KV_NAMESPACE_ID في wrangler.jsonc.

## الأسرار
```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GROQ_API_KEY
```
يمكن ترك أي مزود بلا مفتاح؛ سيُتخطى تلقائيًا.

## النشر
```bash
npm install -D wrangler
npx wrangler login
npx wrangler deploy
```

## Webhook
```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WORKER_URL>
```

## الأوامر
/start
/help
/models
/clear
/translate النص
/summarize النص

المشروع لا يتجاوز حصص المزودين؛ عند فشل مزود أو وصوله لحده ينتقل إلى مزود آخر وفق الحدود المسموح بها.