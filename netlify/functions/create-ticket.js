import { createClient } from '@supabase/supabase-js'

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey     = process.env.SUPABASE_ANON_KEY;

  // get the user's JWT from the browser
  const authHeader  = req.headers.get('authorization') || '';
  const token       = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // client bound to the user's JWT so RLS applies
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: token ? `Bearer ${token}` : '' } }
  });

  const body = await req.json().catch(() => ({}));
  const { subject, description, email, priority = 'medium', chat = [] } = body;

  if (!token) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  // Get user to set user_id and a trustworthy email
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return Response.json({ ok: false, error: 'Invalid session' }, { status: 401 });
  }

  const row = {
    subject: subject || 'IT issue',
    description: description || '',
    email: user.email || email || '',
    priority,
    status: 'open',
    user_id: user.id,
    chat
  };

  const { data, error } = await supabase
    .from('tickets')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 400 });
  }
  return Response.json({ ok: true, id: data.id });
}
