(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
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

  /* ---------------------------
   * Helpers: rendering & typing
   * --------------------------- */

  // Render assistant markdown safely
  function renderMarkdown(md) {
    // Configure marked (optional tweaks)
    marked.setOptions({
      breaks: true,
      gfm: true
    });
    const html = marked.parse(md || '');
    return DOMPurify.sanitize(html);
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  // Create a message DOM node
  function createMessageNode(role, content, meta) {
    const div = document.createElement('div');
    div.className = 'msg ' + (role === 'user' ? 'user' : 'bot');

    const body = document.createElement('div');

    if (role === 'assistant') {
      body.innerHTML = renderMarkdown(content);
    } else {
      // user: render as plain text (no markdown)
      body.textContent = content;
    }

    div.appendChild(body);

    if (meta) {
      const sm = document.createElement('small');
      sm.textContent = meta;
      div.appendChild(sm);
    }

    return div;
  }

  // Typing effect for assistant (progressively renders markdown)
  async function typeAssistantMessage(container, fullText) {
    // We’ll re-render markdown in chunks (cheap enough for short replies)
    const body = container.querySelector('div');
    if (!body) return;

    let i = 0;
    const len = fullText.length;

    // speed: ~30–45 chars per frame chunk
    const chunk = () => {
      // Add a variable chunk to feel natural
      const step = 30 + Math.floor(Math.random() * 15);
      i = Math.min(len, i + step);

      // Re-render the partial markdown safely
      body.innerHTML = renderMarkdown(fullText.slice(0, i));

      messagesEl.scrollTop = messagesEl.scrollHeight;

      if (i < len) {
        requestAnimationFrame(chunk);
      }
    };

    requestAnimationFrame(chunk);
  }

  /* ---------------------------
   * Chat state management
   * --------------------------- */

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
      const node = createMessageNode(m.role, m.content, m.meta);
      messagesEl.appendChild(node);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  /* ---------------------------
   * Model calls
   * --------------------------- */

  async function sendToModel(messages) {
    // Try Netlify function; fall back to mock if not configured
    if (window.USE_MOCK) return mockReply(messages);

    try {
      const r = await fetch('/.netlify/functions/chat-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });
      if (!r.ok) throw new Error('proxy unavailable');
      const data = await r.json();
      return data.reply || '(No reply)';
    } catch (e) {
      console.warn('Falling back to mock:', e.message);
      return mockReply(messages);
    }
  }

  function mockReply(messages) {
    const last = messages[messages.length - 1]?.content || '';
    if (/vpn|wireguard|openvpn/i.test(last)) {
      return [
        "**VPN Setup (Quick):**",
        "1. Install your VPN client.",
        "2. Import the config file (or login).",
        "3. Click **Connect**.",
        "",
        "_Tell me your OS and client (e.g., Windows + WireGuard) and I'll give exact steps._"
      ].join('\n');
    }
    if (/outlook|mail/i.test(last)) {
      return [
        "**Outlook fix checklist:**",
        "- Restart Outlook",
        "- Check **File → Account Settings**",
        "- Verify **Work/School account** is signed in (MFA OK)",
        "- **Send/Receive** → Update folders",
        "",
        "_Want exact steps for Windows or macOS?_"
      ].join('\n');
    }
    return "I’m running in demo mode. Tell me your issue (e.g., **Teams mic not working on Mac**) and I’ll guide you step-by-step.";
  }

  /* ---------------------------
   * Events
   * --------------------------- */

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (!currentId) newChat(text.slice(0, 40));

    const chat = currentChat();

    // Add user message
    const userMsg = { role: 'user', content: text };
    chat.messages.push(userMsg);
    // Render just the new user message quickly
    messagesEl.appendChild(createMessageNode('user', text));
    messagesEl.scrollTop = messagesEl.scrollHeight;
    input.value = '';

    // Ask model
    const reply = await sendToModel(chat.messages.map(m => ({ role: m.role, content: m.content })));

    // Add assistant placeholder first (so we can type into it)
    const assistantMsg = { role: 'assistant', content: reply, meta: 'StrataMind AI' };
    chat.messages.push(assistantMsg);

    // Title update (first user message)
    if (chat.title === 'New chat' && chat.messages[0]?.role === 'user') {
      chat.title = chat.messages[0].content.slice(0, 40);
      renderHistory();
    }

    // Create assistant node and animate typing
    const node = createMessageNode('assistant', '', 'StrataMind AI'); // empty content to start typing
    messagesEl.appendChild(node);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    await typeAssistantMessage(node, reply);
  });

  newChatBtn.addEventListener('click', () => newChat());
  kbBtn.addEventListener('click', (e) => { e.preventDefault(); alert('Knowledge Hub — coming soon'); });
  ticketsBtn.addEventListener('click', (e) => { e.preventDefault(); alert('Tickets — coming soon'); });

  // boot
  newChat();
  renderMessages();
})();
