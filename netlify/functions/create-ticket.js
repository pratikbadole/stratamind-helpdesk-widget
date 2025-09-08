// netlify/functions/create-ticket.js
import fetch from "node-fetch";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { subject, description, email, chat } = JSON.parse(event.body || '{}');
    if (!subject || !description) {
      return { statusCode: 400, body: 'subject and description are required' };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE;

    const r = await fetch(`${SUPABASE_URL}/rest/v1/tickets`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify([{ subject, description, email: email || null, chat, status: 'open' }])
    });

    if (!r.ok) {
      const t = await r.text();
      return { statusCode: 500, body: `Insert failed: ${t}` };
    }

    const [row] = await r.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, id: row.id })
    };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
