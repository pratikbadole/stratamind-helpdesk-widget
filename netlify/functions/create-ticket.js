// netlify/functions/create-ticket.js
import { createClient } from '@supabase/supabase-js';

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE; // server key ONLY

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const { subject, description, email, chat } = JSON.parse(event.body || '{}');

    if (!subject || !description) {
      return { statusCode: 400, body: JSON.stringify({ error: 'subject and description are required' }) };
    }

    const safeChat = Array.isArray(chat)
      ? chat.filter(m => m && m.role && m.content).map(m => ({ role: m.role, content: m.content }))
      : null;

    const { data, error } = await supabase
      .from('tickets')
      .insert({
        subject,
        description,
        email: email || null,
        status: 'open',
        chat: safeChat   // 👈 stored in JSONB column
      })
      .select('id')
      .single();

    if (error) throw error;

    return { statusCode: 200, body: JSON.stringify({ ok: true, id: data.id }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
