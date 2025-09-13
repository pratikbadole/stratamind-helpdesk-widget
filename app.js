// app.js
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  // ── profile links (edit if needed) ───────────────────────────────────────
  const LINKS = {
    linkedIn: 'https://www.linkedin.com/in/pratikbadole13',
    instagram: 'https://www.instagram.com/pratik.s.13/'
  };

  const historyEl  = $('#history');
  const messagesEl = $('#messages');
  const form       = $('#chatForm');
  const input      = $('#input');
  const newChatBtn = $('#newChatBtn');
  const kbBtn      = $('#kbBtn');
  const ticketsBtn = $('#ticketsBtn');
  const ticketBtnRowId = 'ticket-cta-row';

  // ── toggles ──────────────────────────────────────────────────────────────
  const TYPEWRITER = true;      // set false to disable typing animation
  const TYPE_SPEED = 4;         // ms per character when typewriter is on

  let chats = [];
  let currentId = null;

  // ───────────────────────────────── utils ─────────────────────────────────
  // tiny Markdown → HTML (headings, **bold**, *em*, `code`, bullets, numbers)
  // Also auto-link raw http(s) URLs
  function mdToHtml(src){
    let s = (src || '').replace(/\r\n?/g, '\n');

    // escape first
    s = s.replace(/[&<>"']/g, m => (
      {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
    ));

    // autolink bare URLs (kept after escaping)
    s = s.replace(/https?:\/\/[^\s)]+/g, u => {
      const safe = u.replace(/"/g, '&quot;');
      return `<a href="${safe}" target="_blank" rel="noopener">${u}</a>`;
    });

    // normalize "• " bullets to "- "
    s = s.replace(/^\s*•\s+/gm, '- ');

    // inline styles
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
         .replace(/\*(.+?)\*/g, '<em>$1</em>')
         .replace(/`([^`]+)`/g, '<code>$1</code>');

    const lines = s.split('\n');
    let out = [];
    let inUL = false, inOL = false;

    const closeLists = () => {
      if (inUL) { out.push('</ul>'); inUL = false; }
      if (inOL) { out.push('</ol>'); inOL = false; }
    };

    for (let i = 0; i < lines.length; i++){
      const line = lines[i];

      // Headings (#, ##, ###) — clamp to h3 for bubble scale
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h){
        closeLists();
        const level = Math.min(h[1].length, 3);
        out.push(`<h${level}>${h[2]}</h${level}>`);
        continue;
      }

      // "Step title" pattern:  `1. Something:`  (numbered section header)
      const step = line.match(/^\s*(\d+)\.\s+(.+?):\s*$/);
      if (step){
        closeLists();
        out.push(`<h3 class="step"><span class="step-num">${step[1]}.</span> ${step[2]}</h3>`);
        continue;
      }

      // Unordered list
      if (/^\s*-\s+/.test(line)){
        if (!inUL){ closeLists(); out.push('<ul>'); inUL = true; }
        out.push('<li>' + line.replace(/^\s*-\s+/, '') + '</li>');
        continue;
      }

      // Ordered list (true numbered list items like "1. Do X")
      const num = line.match(/^\s*(\d+)\.\s+(.*)$/);
      if (num){
        if (!inOL){ closeLists(); out.push('<ol>'); inOL = true; }
        out.push('<li>' + num[2] + '</li>');

        // absorb a single blank line if the next non-blank is another number
        while (i + 2 < lines.length &&
               lines[i + 1].trim() === '' &&
               /^\s*\d+\.\s+/.test(lines[i + 2])) {
          i++; // skip the blank line
        }
        continue;
      }

      // Blank line
      if (line.trim() === ''){
        closeLists();
        out.push('<br>');
        continue;
      }

      // Normal paragraph
      closeLists();
      out.push('<p>' + line + '</p>');
    }

    closeLists();
    return out.join('\n').replace(/^(<br>\n?)+/, '');
  }

  // HTML-aware typewriter (types text nodes inside tags; doesn’t break markup)
  async function typeInto(el, html, delay = TYPE_SPEED){
    const temp = document.createElement('div');
    temp.innerHTML = html;
    el.innerHTML = '';

    const walk = async (node, mount) => {
      if (node.nodeType === 3){ // Text
        const t = node.nodeValue || '';
        for (let i = 0; i < t.length; i++){
          mount.appendChild(document.createTextNode(t[i]));
          await new Promise(r => setTimeout(r, delay));
        }
        return;
      }
      // Element
      const clone = node.cloneNode(false);
      mount.appendChild(clone);
      for (const child of Array.from(node.childNodes)){
        await walk(child, clone);
      }
    };

    for (const child of Array.from(temp.childNodes)){
      await walk(child, el);
    }
  }

  // Enter to send, Shift+Enter for newline
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      form?.requestSubmit();
    }
  });

  // ───────────────────────────────── state ─────────────────────────────────
  function newChat(initial){
    const id = 'c_' + Date.now();
    // start chat with a friendly identity line + links (auto-linked)
    const welcome = {
      role: 'assistant',
      content: `Hi — I’m **TriKash AI**, built by TriKash Techhub and designed by Pratik. Tell me what’s breaking and I’ll walk you through fixes. If it fights back, we can create a ticket in one click.
LinkedIn: ${LINKS.linkedIn}${LINKS.instagram ? ` • Instagram: ${LINKS.instagram}` : ''}`,
      meta: 'TriKash AI'
    };
    chats.unshift({ id, title: (initial || 'New chat'), messages: [welcome], offers: 0 });
    currentId = id;
    renderHistory();
  }
  const currentChat = () => chats.find(c => c.id === currentId);

  function renderHistory(){
    historyEl.innerHTML = '';
    chats.forEach(c => {
      const div = document.createElement('div');
      div.className = 'history-item' + (c.id === currentId ? ' active' : '');
      div.textContent = c.title.slice(0, 48);
      div.onclick = () => { currentId = c.id; renderHistory(); renderMessages(); };
      historyEl.appendChild(div);
    });
  }

  function appendMsg({ role, meta }){
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + (role === 'user' ? 'user' : 'bot');

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    wrap.appendChild(bubble);

    if (meta){
      const small = document.createElement('small');
      small.textContent = meta;
      wrap.appendChild(small);
    }
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function renderMessages(){
    const chat = currentChat();
    messagesEl.innerHTML = '';
    (chat?.messages || []).forEach(m => {
      const bubble = appendMsg({ role: m.role, meta: m.meta });
      bubble.innerHTML = mdToHtml(m.content);
    });
    if (chat?._showTicketCTA) insertTicketCTA();
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ───────────────────────────── backend: model ────────────────────────────
  async function sendToModel(messages){
    if (window.USE_MOCK) return mockReply(messages);
    try{
      const r = await fetch('/.netlify/functions/chat-proxy', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ messages })
      });
      if (!r.ok) throw new Error('proxy unavailable');
      const data = await r.json();
      return data.reply || '(No reply)';
    } catch(e){
      console.warn('Falling back to mock:', e.message);
      return mockReply(messages);
    }
  }

  // ── Guardrailed mock replies (identity-safe, friendly tone) ─────────────
  function mockReply(messages){
    const last = (messages[messages.length - 1]?.content || '').trim();

    // Identity / model / creator questions
    if (/\b(who\s+made|who\s+built|who\s+created|are\s+you\s+chatgpt|are\s+you\s+openai|what\s+model|who\s+are\s+you|your\s+name)\b/i.test(last)){
      return `I’m **TriKash AI**, built by TriKash Techhub and designed by Pratik. I use industry-grade AI infrastructure behind the scenes, but I’m customized for IT help. How can I help you today?`;
    }

    // Who is Pratik
    if (/\bwho\s+is\s+pratik( badole)?\b/i.test(last)){
      return `**Pratik Badole** is the designer and builder behind TriKash AI at TriKash Techhub — he’s the reason I’m helpful (and occasionally sassy).
LinkedIn: ${LINKS.linkedIn}${LINKS.instagram ? ` • Instagram: ${LINKS.instagram}` : ''}`;
    }

    // Privacy / data
    if (/\b(privacy|store|save|data|logs?|collect)\b/i.test(last)){
      return `I only use what you type here to help troubleshoot. For the prototype, chat content can be included in a support ticket if you choose to create one. Keep sensitive info out of the chat, or say “redact this” and I’ll help summarize safely.`;
    }

    // Pricing
    if (/\b(price|pricing|cost|subscription|free)\b/i.test(last)){
      return `Right now it’s free to try while we test the prototype. We’ll share pricing publicly when the full helpdesk + knowledge hub launches.`;
    }

    // Remote access
    if (/\b(remote|take\s+over|control\s+my|access\s+my\s+pc)\b/i.test(last)){
      return `I can’t remote into your machine in this prototype, but I can give you **step-by-step** fixes so it feels close. If it’s stubborn, hit **Create ticket** and we’ll escalate.`;
    }

    // Topical helpers
    if (/vpn|wireguard|openvpn/i.test(last)){
      return `**VPN quick setup**
1. Install the client (WireGuard/OpenVPN)
2. Import your config (.conf/.ovpn)
3. Click **Connect**
Need OS-specific steps? Say **Windows**, **macOS**, or **Linux**.`;
    }
    if (/outlook|mail/i.test(last)){
      return `Try these:
- Restart Outlook
- Check **Account → Sync settings**
- Confirm you’re signed into MFA
Say **not fixed** if errors persist.`;
    }
    if (/wifi|wi-?fi|network/i.test(last)){
      return `Let’s stabilize Wi-Fi:

1. **Speedtest** — is it below your plan?
2. **Power-cycle router** (off 30s, back on)
3. Avoid **interference** (microwaves, BT speakers)
4. Change **channel** (crowded area?)
5. **Update router firmware**
6. Disconnect unused devices
7. Try **Ethernet** if possible

Reply **not fixed** if it’s still unstable.`;
    }

    // Friendly default
    return `Tell me your IT issue (e.g., *Teams mic not working on Mac*), and I’ll walk you through the quickest fixes.`;
  }

  // ─────────────────────────── backend: tickets ────────────────────────────
  function serializeChatForTicket(chatMessages){
    return (chatMessages || []).map(m => ({ role: m.role, content: m.content }));
  }

  async function createTicket({ subject, description, email, chatMessages }){
    const payload = {
      subject,
      description,
      email: email || '',
      chat: serializeChatForTicket(chatMessages)
    };

    // Add Authorization header if a Supabase token is present
    const headers = { 'Content-Type': 'application/json' };
    if (window.SUPABASE_TOKEN) {
      headers.Authorization = `Bearer ${window.SUPABASE_TOKEN}`;
    }

    const r = await fetch('/.netlify/functions/create-ticket', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || 'Ticket not created');
    return data.id;
  }

  // ───────────────────── ticket CTA gating (when to offer) ─────────────────
  function shouldOfferTicket(chat){
    const userLast = [...chat.messages].reverse().find(m => m.role === 'user')?.content || '';
    const saidNotFixed = /\b(not\s+fixed|still\s+not|doesn'?t\s+work|no\s+luck)\b/i.test(userLast);
    const softAck      = /\b(ok|okay|hmm|still|same|nope)\b/i.test(userLast);
    const assistantReplies = chat.messages.filter(m => m.role === 'assistant').length;
    return (saidNotFixed && assistantReplies >= 1) ||
           (softAck && assistantReplies >= 2);
  }

  function insertTicketCTA(){
    if (document.getElementById(ticketBtnRowId)) return;
    const row = document.createElement('div');
    row.id = ticketBtnRowId;
    row.style.marginTop = '8px';
    row.innerHTML = `
      <button class="pill pill--primary" id="openTicketModalBtn">Issue not fixed? Create ticket</button>
    `;
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    $('#openTicketModalBtn').onclick = () => openTicketModal();

    // Make sure CTA isn't hidden under the input on mobile
    try { row.scrollIntoView({ block: 'nearest' }); } catch {}
  }

  // ─────────────────────────────── events ──────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    if (!currentId) newChat(text.slice(0, 40));
    const chat = currentChat();

    chat.messages.push({ role: 'user', content: text });
    renderMessages();
    input.value = '';

    // placeholder bubble while waiting
    const bubble = appendMsg({ role: 'assistant', meta: 'TriKash AI' });
    bubble.innerHTML = '<em>Thinking…</em>';

    const reply = await sendToModel(chat.messages.map(m => ({ role: m.role, content: m.content })));
    chat.messages.push({ role: 'assistant', content: reply, meta: 'TriKash AI' });
    chat.offers = (chat.offers || 0) + 1;

    // update title on first user message
    if (chat.title === 'New chat' && chat.messages[0]?.role === 'user'){
      chat.title = chat.messages[0].content.slice(0, 40);
      renderHistory();
    }

    // final render in the same bubble (typewriter optional)
    if (TYPEWRITER){
      bubble.innerHTML = '';
      await typeInto(bubble, mdToHtml(reply), TYPE_SPEED);
    } else {
      bubble.innerHTML = mdToHtml(reply);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // gate ticket CTA
    chat._showTicketCTA = shouldOfferTicket(chat);
    if (chat._showTicketCTA) insertTicketCTA();
  });

  newChatBtn.addEventListener('click', () => { newChat(); renderMessages(); });
  kbBtn.addEventListener('click', (e) => { e.preventDefault(); alert('Knowledge Hub — coming soon'); });

  // Tickets button blocked for now (roadmap)
  ticketsBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Tickets dashboard is coming soon — stay tuned!');
  });

  // ───────────────────────────── ticket modal ──────────────────────────────
  function openTicketModal(){
    $('#ticketModal').classList.add('show');
    $('#ticketEmail').focus();
    const chat = currentChat();
    const lastA = [...chat.messages].reverse().find(m => m.role === 'assistant')?.content || '';
    $('#ticketSummary').value = (lastA || '').slice(0, 800);
  }
  function closeTicketModal(){ $('#ticketModal').classList.remove('show'); }

  $('#ticketCancel').onclick = closeTicketModal;
  $('#ticketCreate').onclick = async () => {
    try{
      const chat = currentChat();
      const email = $('#ticketEmail').value.trim();
      const summary = $('#ticketSummary').value.trim();
      const lastUser = [...chat.messages].reverse().find(m => m.role === 'user')?.content || '';

      const subject = (chat.title || 'IT issue').slice(0, 120);
      const description = summary || lastUser || 'No description';

      const id = await createTicket({
        subject,
        description,
        email,
        chatMessages: chat?.messages || []
      });

      closeTicketModal();
      const conf = `Ticket **#${id}** created. Our team will follow up.\n\nSubject: **${subject}**`;
      chat.messages.push({ role:'assistant', content: conf, meta: 'TriKash AI' });
      renderMessages();
    } catch(err){
      alert('Error: ticket not created. Check function logs & env.');
    }
  };

  // ── MOBILE: keep latest messages visible & prevent CTA overlap ───────────
  function adjustBottomInset(){
    if (!form || !messagesEl) return;
    // give a little extra breathing room
    const inset = form.offsetHeight ? form.offsetHeight + 8 : 64;
    messagesEl.style.paddingBottom = inset + 'px';
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  window.addEventListener('focusin', adjustBottomInset);
  window.addEventListener('focusout', adjustBottomInset);
  window.addEventListener('resize', adjustBottomInset);
  window.addEventListener('orientationchange', adjustBottomInset);

  // ─────────────────────────────── boot ────────────────────────────────────
  newChat();
  renderMessages();
  // initial mobile padding adjust
  adjustBottomInset();
})();
