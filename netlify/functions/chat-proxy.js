export default async (req, context) => {
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
    const messages = (body?.messages || []).map(m => ({ role: m.role, content: m.content }));
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.2
      })
    });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: 'Upstream error', detail: t }), { status: 502, headers: jsonHeaders() });
    }
    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content || '';
    return new Response(JSON.stringify({ reply }), { status: 200, headers: jsonHeaders() });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy failed', detail: String(err) }), { status: 500, headers: jsonHeaders() });
  }
};

const corsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
});
const jsonHeaders = () => ({ 'Content-Type':'application/json', ...corsHeaders() });
