import { createClient } from '@supabase/supabase-js'

export default async (req, context) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey     = process.env.SUPABASE_ANON_KEY;

  const authHeader  = req.headers.get('authorization') || '';
  const token       = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: token ? `Bearer ${token}` : '' } }
  });

  // With RLS, authenticated users only see their own rows automatically
  const { data, error } = await supabase
    .from('tickets')
    .select('id, subject, description, email, status, priority, chat, created_at')
    .order('created_at', { ascending: false });

  if (error) return Response.json({ ok: false, error: error.message }, { status: 400 });
  return Response.json(data);
}
