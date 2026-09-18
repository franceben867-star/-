# Telegram + Gemini Educational Bot

Cloudflare Worker that connects Telegram to Gemini and supports text, images and PDF documents.

## Features

- 🤖 Telegram webhook
- 🧠 Gemini
- 📝 Text
- 🖼️ Images
- 📄 PDF
- 🌐 Translation
- 📚 Explanation and summarization
- ❓ Direct and indirect questions
- 📊 Tables
- 🔤 Terms and abbreviations
- 🔐 API keys stored as Cloudflare Worker Secrets

## 1. Install and deploy

Install Wrangler and authenticate with Cloudflare:

    npm install -g wrangler
    wrangler login

Deploy:

    npx wrangler deploy

## 2. Add secrets

Never put the Telegram token or Gemini API key in GitHub source code.

    npx wrangler secret put TELEGRAM_BOT_TOKEN
    npx wrangler secret put GEMINI_API_KEY

Optional webhook secret:

    npx wrangler secret put TELEGRAM_WEBHOOK_SECRET

Cloudflare exposes these values to the Worker through env at runtime.

## 3. Set the Telegram webhook

After deployment, take the Worker URL and run:

    https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://YOUR-WORKER.workers.dev/webhook

If TELEGRAM_WEBHOOK_SECRET is configured, set the same secret when creating the webhook using Telegram's setWebhook API and its secret_token parameter.

## Request flow

    Telegram
      -> Cloudflare Worker /webhook
      -> webhook authentication
      -> detect text/image/PDF
      -> Telegram getFile/download
      -> Gemini generateContent
      -> split long answer
      -> Telegram sendMessage

## Security

Secrets are never hard-coded. Keep .dev.vars and .env out of GitHub. For production, use Cloudflare Worker Secrets.

## Educational response format

The system instruction asks Gemini to preserve English text when relevant and provide:
translation -> explanation -> terms/abbreviations -> tables -> summary -> direct questions -> indirect questions.

## Notes

Telegram file limits and Gemini model limits still apply. For very large PDFs, a production version should add chunking/file-upload handling rather than sending the entire binary inline.
