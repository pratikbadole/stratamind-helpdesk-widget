(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const historyEl = $('#history');
  const messagesEl = $('#messages');
  const form = $('#chatForm');
  const input = $('#input');
  const newChatBtn = $('#newChatBtn');
  const kbBtn = $('#kbBtn');
  const ticketsBtn = $('#ticketsBtn');

  // simple in-memory state
  let chats = [];
  let currentId = null;

  function newChat(initial) {
    const id = 'c_' + Date.now();
    chats.unshift({ id, title: (initial || 'New chat'), messages: [] });
    currentId = id;
    renderHistory();
  }

  function currentChat() {
    return chats.find(c => c.id === currentId);
  }

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

  function renderMessages() {
    const chat = currentChat();
    messagesEl.innerHTML = '';
    (chat?.messages || []).forEach(m => {
      const div = document.createElement('div');
      div.className = 'msg ' + (m.role === 'user' ? 'user' : 'bot');
      div.innerHTML = `<div>${escapeHTML(m.content)}</div>` + (m.meta ? `<small>${m.meta}</small>` : '');
      messagesEl.appendChild(div);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHTML(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }

  async function sendToModel(messages){
    // Try Netlify function; fall back to mock if not configured
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
    // tiny heuristic
    if (/vpn|wireguard|openvpn/i.test(last)) return "To set up VPN: 1) Install the client, 2) Import your config, 3) Connect. I can tailor steps if you tell me your OS.";
    if (/outlook|mail/i.test(last)) return "Try: restart Outlook, check account > sync settings, and ensure MFA is signed in. Want the exact steps?";
    return "I’m running in demo mode. Tell me your issue (e.g., “Teams mic not working on Mac”), and I’ll guide you step-by-step.";
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

    // title update (first user message)
    if (chat.title === 'New chat' && chat.messages[0]?.role === 'user'){
      chat.title = chat.messages[0].content.slice(0, 40);
      renderHistory();
    }
    renderMessages();
  });

  newChatBtn.addEventListener('click', () => newChat());
  kbBtn.addEventListener('click', (e) => { e.preventDefault(); alert('Knowledge Hub — coming soon'); });
  ticketsBtn.addEventListener('click', (e) => { e.preventDefault(); alert('Tickets — coming soon'); });

  // boot
  newChat();
  renderMessages();
})();
