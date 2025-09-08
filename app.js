// app.js
(() => {
  const $ = (sel, root=document) => root.querySelector(sel);

  const historyEl = $('#history');
  const messagesEl = $('#messages');
  const form = $('#chatForm');
  const input = $('#input');
  const newChatBtn = $('#newChatBtn');
  const kbBtn = $('#kbBtn');
  const ticketsBtn = $('#ticketsBtn');
  const ticketBtnRowId = 'ticket-cta-row';

  let chats = [];
  let currentId = null;

  // ---------- utils ----------
  const escapeHTML = (s) => s.replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));

  // very small markdown ( **bold**, *italics*, `code`, numbered/bullet lists )
// replaces the old mdToHtml
  function mdToHtml(src){
  // escape first
  const esc = (s) => s.replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
  const lines = (src || '').split(/\r?\n/);

  let html = '';
  let openList = null; // 'ul' | 'ol' | null

  const closeList = () => {
    if (openList) { html += `</${openList}>`; openList = null; }
  };

  for (let raw of lines){
    const line = raw.trimRight();

    // Headings ### ## #
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))){
      closeList();
      const level = Math.min(m[1].length, 3); // clamp to h3 for bubble scale
      html += `<h${level}>${esc(m[2])}</h${level}>`;
      continue;
    }

    // Ordered list  `1. foo`
    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))){
      if (openList && openList !== 'ol'){ closeList(); }
      if (!openList){ html += '<ol>'; openList = 'ol'; }
      html += `<li>${esc(m[1])}</li>`;
      continue;
    }

    // Unordered list `- foo` or `* foo`
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))){
      if (openList && openList !== 'ul'){ closeList(); }
      if (!openList){ html += '<ul>'; openList = 'ul'; }
      html += `<li>${esc(m[1])}</li>`;
      continue;
    }

    // Blank line ends list
    if (line.trim() === ''){
      closeList();
      html += '<br>';
      continue;
    }

    // Normal paragraph line; close any list first
    closeList();
    // inline styles: **bold**, *em*, `code`
    let t = esc(line)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    html += `<p>${t}</p>`;
  }
  closeList();
  return html;
}

  async function typeInto(el, html, delay=8){
    // simple typewriter for HTML strings
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    el.innerHTML = '';
    const walk = async (node) => {
      if (node.nodeType === 3){ // text
        const t = node.nodeValue;
        for (let i=0;i<t.length;i++){
          el.insertAdjacentText('beforeend', t[i]);
          await new Promise(r => setTimeout(r, delay));
        }
        return;
      }
      const clone = node.cloneNode(false);
      el.appendChild(clone);
      for (const child of [...node.childNodes]){
        await walk(child);
      }
    };
    for (const child of [...tmp.childNodes]){ await walk(child); }
  }

  // ---------- state ----------
  function newChat(initial) {
    const id = 'c_' + Date.now();
    chats.unshift({ id, title: (initial || 'New chat'), messages: [], offers: 0 });
    currentId = id;
    renderHistory();
  }
  const currentChat = () => chats.find(c => c.id === currentId);

  function renderHistory() {
    historyEl.innerHTML = '';
    chats.forEach(c => {
      const div = document.createElement('div');
      div.className = 'history-item' + (c.id === currentId ? ' active' : '');
      div.textContent = c.title.slice(0, 48);
      div.onclick = () => { currentId = c.id; renderHistory(); renderMessages(); };
      historyEl.appendChild(div);
    });
  }

  function appendMsg({role, html, meta}){
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
      const bubble = appendMsg({role: m.role, meta: m.meta});
      bubble.innerHTML = mdToHtml(m.content);
    });
    // ticket CTA row (if previously inserted)
    if (chat?._showTicketCTA) insertTicketCTA();
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ---------- backend (model) ----------
  async function sendToModel(messages){
    if (window.USE_MOCK) return mockReply(messages);
    try{
      const r = await fetch('/.netlify/functions/chat-proxy', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
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

  function mockReply(messages){
    const last = messages[messages.length-1]?.content || '';
    if (/vpn|wireguard|openvpn/i.test(last)) {
      return `**VPN quick setup**
1. Install client (WireGuard/OpenVPN)
2. Import your config (.conf/.ovpn)
3. Click **Connect**
Need OS-specific steps? Tell me Windows/macOS/Linux.`;
    }
    if (/outlook|mail/i.test(last)) {
      return `Try these:
- Restart Outlook
- Check **Account > Sync settings**
- Ensure you’re signed into MFA
Say **not fixed** if you still see errors.`;
    }
    if (/wifi|wi-?fi|network/i.test(last)){
      return `Let’s stabilize Wi-Fi:

1. **Speedtest** (is it below your plan?)
2. **Power-cycle router** (off 30s, back on)
3. Move away from **interference** (microwave, BT speakers)
4. Change **channel** (crowded area?)
5. **Update router firmware**
6. Disconnect unused devices
7. Try **Ethernet** if possible

Reply **not fixed** if it’s still unstable.`;
    }
    return `Tell me your issue (e.g., *Teams mic not working on Mac*), and I’ll walk you through fixes.`;
  }

  // ---------- backend (tickets) ----------
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

    const r = await fetch('/.netlify/functions/create-ticket', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(()=> ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || 'Ticket not created');
    return data.id;
  }

  // ---------- ticket CTA gating ----------
function shouldOfferTicket(chat){
  const userLast = [...chat.messages].reverse().find(m => m.role === 'user')?.content || '';

  const saidNotFixed = /\b(not\s+fixed|still\s+not|doesn'?t\s+work|no\s+luck)\b/i.test(userLast);
  const softAck     = /\b(ok|okay|hmm|still|same|nope)\b/i.test(userLast);

  const assistantReplies = chat.messages.filter(m => m.role === 'assistant').length;

  // show if user says "not fixed" after at least one reply,
  // OR if they've had 2+ assistant replies and they acknowledge but don't confirm success
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
  }

  // ---------- events ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (!currentId) newChat(text.slice(0, 40));
    const chat = currentChat();

    chat.messages.push({ role:'user', content:text });
    renderMessages();
    input.value = '';

    // assistant “typing”
    const typingBubble = appendMsg({role:'assistant', meta:'StrataMind AI'});
    await typeInto(typingBubble, mdToHtml('…'), 15);

    const reply = await sendToModel(chat.messages.map(m => ({role:m.role, content:m.content})));
    chat.messages.push({ role:'assistant', content:reply, meta:'StrataMind AI' });
    chat.offers = (chat.offers||0) + 1;

    // update title on first user msg
    if (chat.title === 'New chat' && chat.messages[0]?.role === 'user'){
      chat.title = chat.messages[0].content.slice(0, 40);
      renderHistory();
    }

    // replace the typing bubble with final content (keep position smooth)
    typingBubble.innerHTML = '';
    await typeInto(typingBubble, mdToHtml(reply), 3);

    // ticket CTA only when user said it's not fixed + we already tried at least once
    chat._showTicketCTA = shouldOfferTicket(chat);
    if (chat._showTicketCTA) insertTicketCTA();
  });

  newChatBtn.addEventListener('click', () => { newChat(); renderMessages(); });
  kbBtn.addEventListener('click', (e) => { e.preventDefault(); alert('Knowledge Hub — coming soon'); });
  ticketsBtn.addEventListener('click', (e) => { e.preventDefault(); alert('Tickets — coming soon'); });

  // ---------- ticket modal ----------
  function openTicketModal(){
    $('#ticketModal').classList.add('show');
    $('#ticketEmail').focus();
    // pre-fill summary from last assistant reply
    const chat = currentChat();
    const lastA = [...chat.messages].reverse().find(m => m.role==='assistant')?.content || '';
    $('#ticketSummary').value = lastA.slice(0, 800);
  }
  function closeTicketModal(){ $('#ticketModal').classList.remove('show'); }

  $('#ticketCancel').onclick = closeTicketModal;
  $('#ticketCreate').onclick = async () => {
    try{
      const chat = currentChat();
      const email = $('#ticketEmail').value.trim();
      const summary = $('#ticketSummary').value.trim();
      const lastUser = [...chat.messages].reverse().find(m => m.role==='user')?.content || '';

      const subject = (chat.title || 'IT issue').slice(0, 120);
      const description = summary || lastUser || 'No description';

      // use server function wrapper (stores JSONB chat)
      const id = await createTicket({
        subject,
        description,
        email,
        chatMessages: chat?.messages || []
      });

      closeTicketModal();
      const conf = `Ticket **#${id}** created. Our team will follow up.\n\nSubject: **${subject}**`;
      chat.messages.push({ role:'assistant', content: conf, meta:'StrataMind AI' });
      renderMessages();
    }catch(err){
      alert('Error: ticket not created. Check function logs & env.');
    }
  };

  // boot
  newChat();
  renderMessages();
})();
