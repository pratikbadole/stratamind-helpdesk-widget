# StrataMind — AI Helpdesk (Standalone)

- `index.html` — full-page helpdesk (history + chat + actions).
- `styles.css` — dark glass UI.
- `app.js` — UI logic. Uses mock replies by default; automatically calls `/.netlify/functions/chat-proxy` if available.
- `netlify/functions/chat-proxy.js` — OpenAI proxy (set `OPENAI_API_KEY` in Netlify).

## Local quick start
Just open `index.html` in a browser. You’ll see the mock bot.

## Netlify
- Add env var `OPENAI_API_KEY`.
- Deploy. The app will start using the proxy automatically.
