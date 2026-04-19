/* bpm-chat.js — Drop-in chat widget for any BPM Basketball page
   Usage: <script src="/bpm-chat.js"></script>
   That's it. The widget creates itself. */

(function(){
'use strict';

var ENDPOINT = '/api/bpm-chat';
var messages = [];
var isOpen = false;
var isLoading = false;
var lang = (localStorage.getItem('lc-lang') || 'en');

var t = {
  en: {
    greeting: "Basketball is a braking sport. BPM measures yours. Ask me anything — drills, The Brake, Reaction Lights, pricing, or how any of it works.",
    placeholder: 'Ask me anything...',
    quickDrills: 'What are the drills?',
    quickFree: 'What\'s free?',
    quickProgram: 'For my program',
    quickPricing: 'Pricing',
    quickReport: 'The Brake',
    quickStart: 'How to start',
    powered: 'BPM Basketball™',
    error: 'Something went wrong. Try again.',
    title: 'BPM BASKETBALL'
  },
  es: {
    greeting: "El baloncesto es un deporte de frenado. BPM mide el tuyo. Pregúntame lo que quieras — drills, The Brake, Reaction Lights, precios, o cómo funciona todo.",
    placeholder: 'Pregúntame lo que sea...',
    quickDrills: '¿Qué drills hay?',
    quickFree: '¿Qué es gratis?',
    quickProgram: 'Para mi programa',
    quickPricing: 'Precios',
    quickReport: 'The Brake',
    quickStart: 'Cómo empezar',
    powered: 'BPM Basketball™',
    error: 'Algo falló. Intenta de nuevo.',
    title: 'BPM BASKETBALL'
  }
};

function tx(key) { return (t[lang] && t[lang][key]) || t.en[key] || key; }

// Watch for language changes
var langCheck = setInterval(function(){
  var nl = localStorage.getItem('lc-lang') || 'en';
  if (nl !== lang) { lang = nl; updateLangUI(); }
}, 1000);

function updateLangUI() {
  var ph = document.getElementById('hc-input');
  if (ph) ph.placeholder = tx('placeholder');
  var pw = document.getElementById('hc-powered');
  if (pw) pw.textContent = tx('powered');
  var en = document.getElementById('hcLangEN');
  var es = document.getElementById('hcLangES');
  if (en) en.classList.toggle('active', lang === 'en');
  if (es) es.classList.toggle('active', lang === 'es');
}

window.setHcLang = function(l) {
  lang = l;
  try { localStorage.setItem('lc-lang', l); } catch(e) {}
  updateLangUI();
  if (typeof setLang === 'function') setLang(l);
  var firstMsg = document.querySelector('#hc-messages .hc-msg.bot');
  if (firstMsg && messages.length > 0 && messages[0].role === 'assistant') {
    var newGreeting = tx('greeting');
    messages[0].content = newGreeting;
    firstMsg.innerHTML = formatText(newGreeting);
  }
};

// Inject styles
var style = document.createElement('style');
style.textContent = `
#hc-fab{position:fixed;bottom:20px;right:20px;z-index:9998;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,#FFD700,#FF6B35);box-shadow:0 4px 20px rgba(255,215,0,.4),0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:1.6rem;transition:all .3s;animation:hcBounce 2s ease-in-out infinite}
#hc-fab:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(255,215,0,.5)}
#hc-fab:active{transform:scale(.95)}
#hc-fab.open{animation:none;border-radius:50%;background:linear-gradient(135deg,#333,#222)}
@keyframes hcBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
#hc-badge{position:absolute;top:-2px;right:-2px;width:14px;height:14px;background:#22c55e;border-radius:50%;border:2px solid #0a0a0f;animation:hcPulse 2s ease-in-out infinite}
@keyframes hcPulse{0%,100%{opacity:.6;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
#hc-panel{position:fixed;bottom:86px;right:16px;width:340px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100dvh - 120px);background:#0d0d14;border:1px solid rgba(255,215,0,.12);border-radius:20px;z-index:9999;display:none;flex-direction:column;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.03)}
#hc-panel.open{display:flex;animation:hcSlideUp .35s cubic-bezier(.4,0,.2,1)}
@keyframes hcSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
#hc-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:rgba(255,215,0,.04);border-bottom:1px solid rgba(255,215,0,.08)}
#hc-header-left{display:flex;align-items:center;gap:10px}
#hc-header-icon{font-size:1.4rem}
#hc-header-title{font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:3px;color:#FFD700}
#hc-header-dot{width:7px;height:7px;background:#22c55e;border-radius:50%;animation:hcPulse 2s ease-in-out infinite}
#hc-close{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:var(--white,#fff);font-size:1rem;font-weight:700;cursor:pointer;padding:6px 10px;border-radius:8px;transition:all .2s;line-height:1}
#hc-close:hover{background:rgba(255,255,255,.15);color:#fff}
#hc-header-right{display:flex;align-items:center;gap:6px}
#hc-lang-toggle{display:flex;gap:2px}
.hc-lang-btn{padding:4px 8px;border:1px solid rgba(255,255,255,.1);background:transparent;color:rgba(255,255,255,.4);border-radius:4px;font-size:.55rem;font-weight:700;cursor:pointer;transition:all .2s;font-family:'Outfit',sans-serif}
.hc-lang-btn.active{border-color:#FFD700;color:#FFD700}
#hc-messages{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:rgba(255,215,0,.15) transparent}
#hc-messages::-webkit-scrollbar{width:4px}
#hc-messages::-webkit-scrollbar-thumb{background:rgba(255,215,0,.15);border-radius:2px}
.hc-msg{max-width:88%;padding:10px 14px;border-radius:14px;font-size:.82rem;line-height:1.55;font-family:'Outfit',sans-serif;word-wrap:break-word;animation:hcFadeIn .3s ease}
@keyframes hcFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.hc-msg.bot{align-self:flex-start;background:rgba(255,255,255,.06);color:rgba(255,255,255,.88);border-bottom-left-radius:4px}
.hc-msg.user{align-self:flex-end;background:linear-gradient(135deg,rgba(255,215,0,.15),rgba(255,107,53,.1));color:#fff;border-bottom-right-radius:4px;border:1px solid rgba(255,215,0,.12)}
.hc-msg.bot a{color:#FFD700;text-decoration:underline}
.hc-typing{align-self:flex-start;padding:10px 16px;display:flex;gap:4px;animation:hcFadeIn .3s ease}
.hc-typing span{width:6px;height:6px;background:rgba(255,215,0,.4);border-radius:50%;animation:hcDot 1.2s ease-in-out infinite}
.hc-typing span:nth-child(2){animation-delay:.15s}
.hc-typing span:nth-child(3){animation-delay:.3s}
@keyframes hcDot{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}
#hc-quick{display:none}
#hc-input-wrap{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.3)}
#hc-input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 14px;color:#fff;font-size:.82rem;font-family:'Outfit',sans-serif;outline:none;transition:border-color .2s}
#hc-input:focus{border-color:rgba(255,215,0,.3)}
#hc-input::placeholder{color:rgba(255,255,255,.25)}
#hc-send{width:38px;height:38px;border-radius:50%;border:none;background:linear-gradient(135deg,#FFD700,#FF6B35);color:#0a0a0f;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
#hc-send:hover{transform:scale(1.08)}
#hc-send:active{transform:scale(.95)}
#hc-send:disabled{opacity:.3;cursor:not-allowed;transform:none}
#hc-powered{text-align:center;padding:6px;font-size:.5rem;color:rgba(255,255,255,.15);letter-spacing:1.5px;font-family:'Bebas Neue',sans-serif}
@media(max-width:420px){
#hc-panel{position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100dvh;max-height:100dvh;border-radius:0;border:none;z-index:10000}
#hc-fab{bottom:16px;right:16px;width:52px;height:52px;font-size:1.4rem}
#hc-header{padding:16px 18px;padding-top:calc(16px + env(safe-area-inset-top))}
#hc-header-title{font-size:1.2rem;letter-spacing:4px}
.hc-msg{font-size:.95rem;line-height:1.65;padding:12px 16px;max-width:92%}
#hc-input{font-size:.95rem;padding:12px 16px;border-radius:14px}
#hc-send{width:44px;height:44px;font-size:1.1rem}
#hc-input-wrap{padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom))}
#hc-messages{padding:16px 16px 10px}
#hc-powered{font-size:.55rem;padding:8px}
}
`;
document.head.appendChild(style);

// Create FAB
var fab = document.createElement('button');
fab.id = 'hc-fab';
fab.innerHTML = '🏀<div id="hc-badge"></div>';
fab.onclick = toggleChat;
document.body.appendChild(fab);

// Create Panel
var panel = document.createElement('div');
panel.id = 'hc-panel';
panel.innerHTML = `
<div id="hc-header">
<div id="hc-header-left"><span id="hc-header-icon">🏀</span><a href="/" id="hc-header-title" style="text-decoration:none;color:inherit">${tx('title')}</a><span id="hc-header-dot"></span></div>
<div id="hc-header-right"><div id="hc-lang-toggle"><button class="hc-lang-btn" id="hcLangEN" onclick="setHcLang('en')">EN</button><button class="hc-lang-btn" id="hcLangES" onclick="setHcLang('es')">ES</button></div><button id="hc-close" onclick="document.getElementById('hc-fab').click()">✕</button></div>
</div>
<div id="hc-messages"></div>
<div id="hc-input-wrap">
<input id="hc-input" type="text" placeholder="${tx('placeholder')}" autocomplete="off">
<button id="hc-send" disabled>➤</button>
</div>
<div id="hc-powered">${tx('powered')}</div>
`;
document.body.appendChild(panel);

var messagesEl = document.getElementById('hc-messages');
var inputEl = document.getElementById('hc-input');
var sendBtn = document.getElementById('hc-send');

function toggleChat() {
  isOpen = !isOpen;
  panel.classList.toggle('open', isOpen);
  fab.classList.toggle('open', isOpen);
  fab.innerHTML = isOpen ? '✕' : '🏀<div id="hc-badge"></div>';
  if (isOpen && messages.length === 0) {
    showGreeting();
  }
  if (isOpen) {
    updateLangUI();
    setTimeout(function() { inputEl.focus(); }, 300);
  }
}

function showGreeting() {
  addBotMessage(tx('greeting'));
}

function addBotMessage(text) {
  messages.push({ role: 'assistant', content: text });
  var div = document.createElement('div');
  div.className = 'hc-msg bot';
  div.innerHTML = formatText(text);
  messagesEl.appendChild(div);
  scrollToBottom();
}

function addUserMessage(text) {
  messages.push({ role: 'user', content: text });
  var div = document.createElement('div');
  div.className = 'hc-msg user';
  div.textContent = text;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function showTyping() {
  var div = document.createElement('div');
  div.className = 'hc-typing';
  div.id = 'hc-typing';
  div.innerHTML = '<span></span><span></span><span></span>';
  messagesEl.appendChild(div);
  scrollToBottom();
}

function hideTyping() {
  var el = document.getElementById('hc-typing');
  if (el) el.remove();
}

function formatText(text) {
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
  text = text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

function scrollToBottom() {
  setTimeout(function() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, 50);
}

async function sendMessage(text) {
  if (!text || !text.trim() || isLoading) return;
  text = text.trim();
  addUserMessage(text);
  inputEl.value = '';
  sendBtn.disabled = true;
  isLoading = true;
  showTyping();

  var apiMessages = [];
  for (var i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user' || (messages[i].role === 'assistant' && i > 0)) {
      apiMessages.push({ role: messages[i].role, content: messages[i].content });
    }
  }

  try {
    var resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages, lang: lang })
    });

    hideTyping();

    if (!resp.ok) throw new Error('API error');

    var data = await resp.json();
    if (data.reply) {
      addBotMessage(data.reply);
    } else {
      addBotMessage(tx('error'));
    }
  } catch (err) {
    hideTyping();
    addBotMessage(tx('error'));
    console.error('BPM chat error:', err);
  }

  isLoading = false;
  sendBtn.disabled = !inputEl.value.trim();
}

inputEl.addEventListener('input', function() {
  sendBtn.disabled = !inputEl.value.trim() || isLoading;
});

inputEl.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(inputEl.value);
  }
});

sendBtn.addEventListener('click', function() {
  sendMessage(inputEl.value);
});

})();
