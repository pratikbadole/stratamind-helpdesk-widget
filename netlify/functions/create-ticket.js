// netlify/functions/create-ticket.js
import { createClient } from '@supabase/supabase-js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const { subject = 'IT issue', description = '', email = '', chat = [] } = body;

  const url  = process.env.SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE; // service key (NOT anon)
  const table = process.env.SUPABASE_TABLE || 'tickets';

  // DEMO fallback if Supabase isn’t configured yet
  if (!url || !key) {
    const id = `DEMO-${Date.now()}`;
    console.warn('[create-ticket] Supabase env missing — returning demo id', id);
    return json(200, { ok: true, id, demo: true });
  }

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false }});
    // Make sure your table exists; see SQL below.
    const { data, error } = await supabase
      .from(table)
      .insert([{
        subject,
        description,
        email,
        status: 'open',
        priority: 'medium',
        chat,              // jsonb column
      }])
      .select('id')
      .single();

    if (error) throw error;
    return json(200, { ok: true, id: data.id });
  } catch (err) {
    console.error('[create-ticket] insert failed:', err);
    return json(500, { ok: false, error: 'Insert failed' });
  }
};

function json(status, obj) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type,authorization',
    },
    body: JSON.stringify(obj),
  };
}
