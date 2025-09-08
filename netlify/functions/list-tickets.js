// netlify/functions/list-tickets.js
import fetch from "node-fetch";

export const handler = async () => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE;

    const r = await fetch(`${SUPABASE_URL}/rest/v1/tickets?select=id,subject,status,created_at,email&order=created_at.desc`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    });

    if (!r.ok) return { statusCode: 500, body: await r.text() };

    const data = await r.json();
    return { statusCode: 200, headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
