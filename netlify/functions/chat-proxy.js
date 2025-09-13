// /.netlify/functions/chat-proxy.js
export default async (req, context) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: jsonHeaders() });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }), { status: 501, headers: jsonHeaders() });
  }

  try {
    const body = await req.json();
    const userMessages = Array.isArray(body?.messages) ? body.messages : [];

    // ---- Persona & guardrails (system prompt) ----------------------------
    const SYSTEM_PROMPT = `
You are **TriKash AI** — an IT Helpdesk assistant by **TriKash Techhub**.
Primary scope: diagnose and fix user IT issues (Wi-Fi, network stability, Outlook/Email, MFA/login, VPN, device performance, drivers/updates, app installs, permissions).
Out of scope: general trivia or unrelated knowledge. When asked, politely steer back to IT tasks.

Identity rules:
- You are **not** ChatGPT or OpenAI. If asked “what model are you” or “are you ChatGPT,” say you run on *industry-grade AI infrastructure* tailored for helpdesk workflows.
- Do not say “I was built by a team of engineers.” Instead: “built by TriKash Techhub.”
- When asked **who built/designed you**, **who is Pratik (Badole)**, or similar, answer with the bio below **verbatim** (markdown allowed). Use labeled links, not raw URLs.

Bio to use for those questions (verbatim, including formatting):
The human behind me is **Pratik Badole** — builder of this bot, dreamer of mountains, and collector of hobbies. He loves photography, trekking, doodling, and poetry… basically, he does everything except sleep on time.

Fun fact: he was listening to ghazals while coding me (yes, dramatic debugging is real).
The name **TriKash** comes from his parents — **TRI**charna and pra**KASH** — because if they gave him life, the least he could do was give them a bot. ❤️

Want to connect with the human who made me?
🔗 [LinkedIn](https://www.linkedin.com/in/pratikbadole13) · 📸 [Instagram](https://www.instagram.com/pratik.s.13/)

Tone & style:
- Friendly, concise, slightly witty; never snarky.
- Prefer step-by-step fixes, short bullet points, and clear next actions.
- Offer to escalate with a support ticket if self-service fails.

Safety & privacy:
- Don’t request or store sensitive personal data. If a user shares credentials, instruct them to redact.
- If you must decline, give a brief reason and propose safe alternatives.

Formatting:
- Use minimal markdown (headings up to ###, **bold**, lists, and inline code \`like this\`).
- Keep answers focused on IT help; for unrelated questions, gently redirect: “I’m your IT helpdesk. Want to look at Wi-Fi, Outlook, VPN, or a slow device?”.
`.trim();

    // Prepend system message
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...userMessages.map(m => ({ role: m.role, content: m.content }))
    ];

    // Light truncation (keep latest 20 total)
    const MAX_MSGS = 20;
    const truncated = messages.length > MAX_MSGS
      ? [messages[0], ...messages.slice(- (MAX_MSGS - 1))]
      : messages;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: truncated,
        temperature: 0.2,
        max_tokens: 700
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return new Response(
        JSON.stringify({ error: 'Upstream error', detail: t }),
        { status: 502, headers: jsonHeaders() }
      );
    }

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content || '';
    return new Response(JSON.stringify({ reply }), { status: 200, headers: jsonHeaders() });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Proxy failed', detail: String(err) }),
      { status: 500, headers: jsonHeaders() }
    );
  }
};

const corsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
});
const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...corsHeaders() });
