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

  // state
  let chats = [];
  let currentId = null;

  // ===== modal (for ticket) =====
  let modal;
  function ensureModal(){
    if (modal) return modal;
    modal = document.createElement('div');
    modal.innerHTML = `
      <div id="ticketModal" style="position:fixed; inset:0; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.55); z-index:50">
        <div style="width:min(640px,92vw); background:rgba(255,255,255,.06); border:1px solid var(--stroke); border-radius:12px; padding:16px">
          <h3 style="margin:0 0 12px; color:#fff">Create Ticket</h3>
          <form id="ticketForm" style="display:grid; gap:10px">
            <input id="tEmail" type="email" placeholder="Email (optional)" style="border:1px solid var(--stroke); background:rgba(255,255,255,.04); color:#fff; border-radius:10px; padding:10px">
            <input id="tSubject" placeholder="Subject" required style="border:1px solid var(--stroke); background:rgba(255,255,255,.04); color:#fff; border-radius:10px; padding:10px">
            <textarea id="tDesc" placeholder="Describe the issue" rows="6" required style="border:1px solid var(--stroke); background:rgba(255,255,255,.04); color:#fff; border-radius:10px; padding:10px"></textarea>
            <div style="display:flex; gap:8px; justify-content:flex-end">
              <button type="button" id="tCancel" class="pill pill--secondary">Cancel</button>
              <button type="submit" class="pill pill--primary">Create Ticket</button>
            </div>
          </form>
          <div id="tMsg" style="margin-top:8px; color:var(--text-dim)"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    return modal;
  }
  function openTicketModal(prefill){
    ensureModal();
    $('#ticketModal').style.display = 'flex';
    $('#tSubject').value = prefill.subject || '';
    $('#tDesc').value = prefill.description || '';
    $('#tEmail').value = prefill.email || '';
    $('#tCancel').onclick = () => ($('#ticketModal').style.display = 'none');
    $('#ticketForm').onsubmit = async (e) => {
      e.preventDefault();
      $('#tMsg').textContent = 'Creating…';
      try{
        const payload = {
          subject: $('#tSubject').value.trim(),
          description: $('#tDesc').value.trim(),
          email: $('#tEmail').value.trim() || null,
          chat: currentChat()?.messages || []
        };
        const r = await fetch('/.netlify/functions/create-ticket', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        const data = await r.json();
        if (!r.ok || !data.ok) throw new Error(data?.error || 'Failed');
        $('#tMsg').textContent = `Ticket created: ${data.id}`;
        // Drop a bot message with a link to tickets page
        const chat = currentChat();
        chat.messages.push({
          role:'assistant',
          content:`Ticket created: ${data.id}. You can view it on the Tickets page.`,
          meta:'StrataMind AI'
        });
        renderMessages();
        setTimeout(() => { $('#ticketModal').style.display = 'none'; }, 800);
      }catch(err){
        $('#tMsg').textContent = 'Error: ' + err.message;
      }
    };
  }

  function newChat(initial) {
    const id = 'c_' + Date.now();
    chats.unshift({ id, title: (initial || 'New chat'), messages: [], tries: 0 });
    currentId = id;
    renderHistory();
  }
  function currentChat() { return chats.find(c => c.id === currentId); }

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

  // simple markdown-to-HTML (bold/italics/inline code)
  function mdLite(s){
    return escapeHTML(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function renderMessages() {
    const chat = currentChat();
    messagesEl.innerHTML = '';
    (chat?.messages || []).forEach(m => {
      const div = document.createElement('div');
      div.className = 'msg ' + (m.role === 'user' ? 'user' : 'bot');
      div.innerHTML = `<div>${mdLite(m.content)}</div>` + (m.meta ? `<small>${m.meta}</small>` : '');
      messagesEl.appendChild(div);
    });

    // Escalation CTA (only after 2 assistant replies)
    const botCount = (chat?.messages || []).filter(m => m.role === 'assistant').length;
    if (botCount >= 2) {
      const cta = document.createElement('div');
      cta.style.cssText = 'align-self:flex-start; margin-top:2px;';
      cta.innerHTML = `
        <button id="notFixedBtn" class="pill pill--secondary">Issue not fixed? Create ticket</button>
      `;
      messagesEl.appendChild(cta);
      $('#notFixedBtn', cta).onclick = () => {
        const firstUser = (chat?.messages || []).find(m => m.role === 'user')?.content || 'IT issue';
        openTicketModal({
          subject: firstUser.slice(0, 80),
          description: (chat?.messages || []).map(m => `${m.role}: ${m.content}`).join('\n')
        });
      };
    }

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHTML(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])) }

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
    if (/vpn|wireguard|openvpn/i.test(last)) return "**Check VPN config** → 1) Install client, 2) import config, 3) connect. Tell me your OS for exact steps.";
    if (/outlook|mail/i.test(last)) return "**Try**: restart Outlook, check account → sync, ensure MFA is signed in. Need step-by-step?";
    return "I'll suggest self-service steps first. Tell me your issue (e.g., *Teams mic not working on Mac*). If it’s not fixed, we’ll create a ticket.";
  }

  // events
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (!currentId) newChat(text.slice(0, 40));

    const chat = currentChat();
    chat.messages.push({ role:'user', content:text });
    renderMessages();
    input.value = '';

    const reply = await sendToModel(chat.messages.map(m => ({role:m.role, content:m.content})));
    chat.messages.push({ role:'assistant', content:reply, meta:'StrataMind AI' });

    if (chat.title === 'New chat' && chat.messages[0]?.role === 'user'){
      chat.title = chat.messages[0].content.slice(0, 40);
      renderHistory();
    }
    renderMessages();
  });

  newChatBtn.addEventListener('click', () => newChat());
  kbBtn.addEventListener('click', (e) => { e.preventDefault(); alert('Knowledge Hub — coming soon'); });
  ticketsBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.href = './tickets.html'; });

  // boot
  newChat();
  renderMessages();
})();
