/* Rabisca — jogo de desenho em navegador.
 * O anfitrião mantém o estado da sala e distribui mensagens via PeerJS (topologia estrela).
 * Sem banco de dados. Para testar a interface sem conexões, use o modo demonstração.
 */
'use strict';

const $ = (s, root = document) => root.querySelector(s); const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const app = $('#app');
const headerInfo = $('#headerInfo');
const toastEl = $('#toast');

const COLORS = ['#262039', '#8058e8', '#ee699b', '#3299db', '#2dba93', '#efb43f', '#e76e43'];
const AVATAR_COLORS = ['#d5e7fb', '#ffe0e9', '#d8f5c7', '#eee0fc', '#ffeab7', '#c8f0eb'];
const VOTING_SECONDS = 30;
const sfx = window.RabiscaSfx;
let lastSoundPhase = 'home';
let lastCountdownSound = null;
let lastDrawingTick = null;
let lastVoteTick = null;

function playSound(kind, value) { sfx?.play(kind, value); }
function updateSoundButton() {
  const control = $('#soundButton');
  if (!control) return;
  const muted = sfx?.muted !== false;
  control.classList.toggle('is-muted', muted);
  control.setAttribute('aria-pressed', String(!muted));
  const label = muted ? 'Ativar efeitos sonoros' : 'Desativar efeitos sonoros';
  control.setAttribute('aria-label', label);
  control.title = label;
}
function syncPhaseSound(nextPhase) {
  if (nextPhase === lastSoundPhase) return;
  const prior = lastSoundPhase;
  lastSoundPhase = nextPhase;
  if (nextPhase === 'countdown') {
    lastCountdownSound = null;
    lastDrawingTick = null;
    lastVoteTick = null;
  } else if (nextPhase === 'drawing') {
    lastDrawingTick = null;
    if (prior === 'countdown') playSound('start');
  } else if (nextPhase === 'gallery') {
    lastVoteTick = null;
    playSound('gallery');
  } else if (nextPhase === 'results') {
    playSound('results');
  }
}


const TOPIC_CATEGORIES = [
  ['animais', 'Animais'],
  ['objetos', 'Objetos'],
  ['comidas', 'Comidas e bebidas'],
  ['natureza', 'Natureza e espaço'],
  ['lugares', 'Lugares'],
  ['transportes', 'Transportes'],
  ['profissoes', 'Profissões'],
  ['personagens', 'Personagens'],
  ['fantasia', 'Fantasia'],
  ['acoes', 'Ações'],
  ['cenas_engracadas', 'Cenas engraçadas'],
  ['esportes', 'Esportes'],
  ['jogos_e_cultura', 'Jogos, filmes e séries'],
  ['valorant', 'Valorant'],
  ['festas_e_tradicoes', 'Festas e tradições'],
  ['musica', 'Música']
];

const UI_ICONS = {
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  flask: '<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 7V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  thumbUp: '<path d="M7 10v12H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3ZM7 10l5-8c1.1-1.5 3.3-.8 3.3.9V9H20a2 2 0 0 1 2 2.4l-1.7 8A2 2 0 0 1 18.3 21H7"/>',
  thumbDown: '<path d="M7 14V2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3ZM7 14l5 8c1.1 1.5 3.3.8 3.3-.9V15H20a2 2 0 0 0 2-2.4l-1.7-8A2 2 0 0 0 18.3 3H7"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  rect: '<rect x="3" y="5" width="18" height="14" rx="2"/>',
  ellipse: '<circle cx="12" cy="12" r="8"/>',
  line: '<line x1="5" y1="19" x2="19" y2="5"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  pipette: '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
};

function uiIcon(name, extraClass = '') {
  return `<svg class="ui-icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI_ICONS[name] || ''}</svg>`;
}

const categoryIsValid = id => TOPIC_CATEGORIES.some(([key]) => key === id);
const cleanCustomTopics = text => [...new Set(String(text || '').split(/[\n,;]+/).map(s => s.trim().slice(0, 65)).filter(Boolean))].slice(0, 30);
const durationText = duration => duration === 0 ? 'Sem limite' : `${duration} segundos`;
const formatClock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

let topicsPromise;
let lastToastTimer;
let guestConnection = null;
let guestConnectionTimeout = null;
let peer = null;
let hostConnections = new Map();
let localDrawn = false;
let drawnPaths = [];
let activeStroke = null;
let undonePaths = [];
let paintTool = 'pencil';
let paintShape = 'rectangle';
let paintColor = COLORS[0];
let paintSize = 8;
let erasing = false;
let lastScreen = null;
let hostFinishing = false;
let endedTimer = false;
let roundUsedTopics = new Set();
let timerInterval;

/* Estado do Seletor de Cores Customizado (HSV) */
let pickerHSV = { h: 255, s: 68, v: 91 };
let colorPopoverOpen = false;

const state = {
  phase: 'home', selfId: null, nickname: '', room: '', isHost: false, demo: false,
  players: [], duration: 90, totalRounds: 5, categories: [], customTopics: [], round: 0,
  theme: '', deadline: 0, drawings: {}, votes: {}, scores: {}, votedCount: 0,
  localVote: null, results: [], submittedCount: 0, countdownUntil: 0, voteDeadline: 0
};

function escapeHTML(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function showToast(message) {
  clearTimeout(lastToastTimer);
  toastEl.textContent = message;
  toastEl.classList.add('show');
  lastToastTimer = setTimeout(() => toastEl.classList.remove('show'), 3100);
}

function shortName(name) { return (name || 'J').trim().slice(0, 1).toUpperCase(); }
function roundLabel() { return `Rodada ${String(state.round).padStart(2, '0')} de ${String(state.totalRounds).padStart(2, '0')}`; }
function connectedPlayers() { return state.players.filter(p => p.connected !== false); }
function selfPlayer() { return state.players.find(p => p.id === state.selfId); }

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, n => chars[n % chars.length]).join('');
}

function getNickname() { return ($('#nickname')?.value || '').trim().slice(0, 18); }
function rememberName(name) { try { localStorage.setItem('rabisca_name', name); } catch (_) {} }
function getRememberedName() { try { return localStorage.getItem('rabisca_name') || ''; } catch (_) { return ''; } }

async function loadTopics() {
  // O catálogo já acompanha o jogo como JavaScript e funciona inclusive em file://.
  // Evita o fallback antigo (10 palavras sem categoria) que fazia o sorteio falhar
  // quando o usuário selecionava categorias específicas.
  if (!topicsPromise) topicsPromise = Promise.resolve().then(async () => {
    let catalog = window.RABISCA_TOPICS_DATA;
    if (!Array.isArray(catalog?.temas)) {
      const response = await fetch('./temas_desenho_ptbr.json?v=12', { cache: 'no-cache' });
      if (!response.ok) throw new Error('O arquivo de temas não foi encontrado.');
      catalog = await response.json();
    }
    if (!Array.isArray(catalog.temas)) throw new Error('O catálogo de temas está inválido.');
    const topics = catalog.temas.map(t => ({
      text: String(t.texto || '').trim(),
      category: String(t.categoria || '').trim()
    })).filter(t => t.text && categoryIsValid(t.category));
    if (!topics.length) throw new Error('O catálogo de temas está vazio.');
    const availableCategories = new Set(topics.map(t => t.category));
    const missingCategories = TOPIC_CATEGORIES.map(([id]) => id).filter(id => !availableCategories.has(id));
    if (missingCategories.length) throw new Error(`Categorias sem temas: ${missingCategories.join(', ')}`);
    return topics;
  }).catch(error => {
    topicsPromise = null; // Permite uma nova tentativa depois de um erro transitório.
    throw error;
  });
  return topicsPromise;
}

async function chooseTheme() {
  const all = await loadTopics();
  const filtered = state.categories.length ? all.filter(t => state.categories.includes(t.category)) : all;
  const candidates = [...new Set([...filtered.map(t => t.text), ...state.customTopics])];
  if (!candidates.length) throw new Error('Nenhum tema disponível nas categorias escolhidas');
  if (roundUsedTopics.size >= candidates.length) roundUsedTopics.clear();
  const available = candidates.filter(t => !roundUsedTopics.has(t));
  if (!available.length) roundUsedTopics.clear();
  const pool = available.length ? available : candidates;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  roundUsedTopics.add(chosen);
  return chosen;
}

function resetRoom({ name, room, demo = false, isHost = false, id }) {
  state.phase = 'lobby'; state.selfId = id; state.nickname = name; state.room = room;
  state.isHost = isHost; state.demo = demo; state.players = [{ id, name, connected: true }];
  state.duration = 90; state.totalRounds = 5; state.categories = []; state.customTopics = []; state.round = 0;
  state.theme = ''; state.deadline = 0; state.countdownUntil = 0; state.voteDeadline = 0; state.drawings = {}; state.votes = {};
  state.scores = {}; state.localVote = null; state.results = [];
  state.submittedCount = 0;
  localDrawn = false; drawnPaths = []; undonePaths = []; lastScreen = null;
  hostFinishing = false; endedTimer = false; roundUsedTopics.clear();
}

function closeTransport() {
  clearTimeout(guestConnectionTimeout);
  try { guestConnection?.close(); } catch (_) {}
  guestConnection = null;
  try { peer?.destroy(); } catch (_) {}
  peer = null;
  hostConnections.clear();
}

function leaveRoom(force = false) {
  const leaveModal = $('#leaveModal');
  if (!force && state.phase !== 'home' && state.phase !== 'results') {
    if (leaveModal) {
      const desc = $('#leaveDesc');
      if (desc) {
        desc.textContent = state.phase === 'lobby'
          ? 'Se você sair agora, a sua conexão com a sala de espera será encerrada.'
          : 'A partida está em andamento. Se você sair agora, perderá o progresso desta rodada.';
      }
      leaveModal.showModal();
      return;
    }
  }
  if (leaveModal?.open) leaveModal.close();
  showHome();
}

function showHome() {
  if (state.phase !== 'home') closeTransport();
  state.phase = 'home'; state.isHost = false; state.demo = false; lastScreen = null;
  paintColor = COLORS[0]; erasing = false; paintTool = 'pencil';
  toggleColorPopover(false);
  render();
}

function render() {
  syncPhaseSound(state.phase);
  let screen = state.phase;
  if (screen === 'drawing' && localDrawn) screen = 'waiting';
  if (screen === 'ending') screen = 'waiting';
  if (screen === lastScreen) { updateLiveUI(); return; }
  lastScreen = screen;
  if (screen !== 'drawing') toggleColorPopover(false);
  const playing = screen !== 'home' && screen !== 'connecting';
  headerInfo.textContent = playing ? `Sala de ${state.isHost ? state.nickname : (state.players[0]?.name || 'amigo')}` : 'Um tema, mil rabiscos';
  const homeButton = $('#homeButton');
  if (homeButton) homeButton.hidden = !playing || screen === 'results';
  document.body.classList.toggle('drawing-mode', screen === 'drawing');
  document.body.classList.toggle('home-mode', screen === 'home');
  document.body.classList.toggle('game-mode', !['home', 'connecting'].includes(screen));
  document.body.classList.toggle('gallery-mode', screen === 'gallery');
  document.body.classList.toggle('results-mode', screen === 'results');
  document.body.classList.toggle('lobby-mode', screen === 'lobby');
  document.body.classList.toggle('countdown-mode', screen === 'countdown');
  if (screen === 'home') renderHome();
  else if (screen === 'connecting') renderConnecting();
  else if (screen === 'lobby') renderLobby();
  else if (screen === 'countdown') renderCountdown();
  else if (screen === 'drawing') renderDrawing();
  else if (screen === 'waiting') renderWaiting();
  else if (screen === 'gallery') renderGallery();
  else if (screen === 'results') renderResults();
  updateLiveUI();
}

function demoBanner() {
  return state.demo ? `<div class="demo-banner">${uiIcon('flask')}<span>Demonstração: os outros jogadores e desenhos são simulados.</span></div>` : '';
}

function renderHome() {
  const lastName = escapeHTML(getRememberedName());
  app.innerHTML = `
    <section class="home-layout animate-screen">
      <div class="hero-copy">
        <span class="eyebrow">${uiIcon('sparkles')}<span>O minigame de desenhar com amigos</span></span>
        <h1 class="hero-title">Um tema.<br/>Mil <em>rabiscos.</em></h1>
        <p class="hero-desc">O jogo escolhe o que desenhar. Todo mundo recebe a mesma ideia. Depois, é descobrir quem fez o quê.</p>
        <div class="feature-row">
          <span class="feature-chip">${uiIcon('palette')}<span>Um tema para todos</span></span>
          <span class="feature-chip">${uiIcon('users')}<span>Até 10 jogadores</span></span>
        </div>
        <span class="preview-sticker">${uiIcon('sparkles')}<span>Criatividade duvidosa é bem-vinda!</span></span>
      </div>
      <section class="card entry-card" aria-label="Entrar no jogo">
        <div class="card-kicker">A diversão começa aqui</div>
        <h2 class="entry-title">Bora desenhar?</h2>
        <p class="card-text">Escolha um apelido para seus amigos reconhecerem seus rabiscos.</p>
        <label class="input-label" for="nickname">Seu apelido</label>
        <input id="nickname" class="field" maxlength="18" placeholder="Como quer ser chamado?" value="${lastName}" autocomplete="nickname" />
        <button type="button" id="createRoom" class="btn btn-primary btn-full" style="margin-top:14px">${uiIcon('plus')}<span>Criar sala</span></button>
        <div class="divider-line" role="presentation"></div>
        <label class="input-label" for="roomInput">Já tem um código de sala?</label>
        <div class="join-row">
          <input id="roomInput" class="field" maxlength="5" placeholder="ABCDE" autocapitalize="characters" autocomplete="off" aria-label="Código da sala"/>
          <button type="button" id="joinRoom" class="btn btn-secondary">${uiIcon('login')}<span>Entrar</span></button>
        </div>
        <button type="button" id="testGame" class="demo-link">${uiIcon('flask')}<span>Experimentar antes de jogar</span></button>
      </section>
    </section>`;
  const params = new URLSearchParams(location.search);
  if (params.get('s')) $('#roomInput').value = params.get('s').slice(0, 5).toUpperCase();
  $('#createRoom').onclick = createRoom;
  $('#joinRoom').onclick = joinRoom;
  $('#testGame').onclick = startDemo;
  $('#roomInput').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
  $('#nickname').addEventListener('keydown', e => { if (e.key === 'Enter') createRoom(); });
}

function renderConnecting() {
  app.innerHTML = `
    <div class="card main-panel center-state animate-screen">
      <div class="state-graphic state-graphic-Wait" aria-hidden="true">
        <svg class="spinner-svg" viewBox="0 0 64 64" fill="none" stroke="#355536" stroke-width="4" stroke-linecap="round">
          <circle cx="32" cy="32" r="20" stroke-opacity="0.22"/>
          <path d="M32 12a20 20 0 0 1 20 20"/>
        </svg>
      </div>
      <h1 class="state-title">Conectando…</h1>
      <p class="state-desc">Preparando a sua sala. Verifique sua conexão se demorar.</p>
    </div>`;
}

function settingControl(key, label, choices) {
  const selected = choices.find(([n]) => n === state[key]);
  const disabled = !state.isHost;
  return `<div class="setting-card"><span class="setting-label">${label}</span>
    <div class="setting-choice"><button type="button" class="setting-trigger" id="${key}Trigger" data-setting="${key}" aria-expanded="false" aria-haspopup="true" ${disabled ? 'disabled' : ''}>
      <span id="${key}Value">${selected?.[1] || ''}</span><span class="chevron" aria-hidden="true"></span></button>
    <div class="setting-menu" id="${key}Menu" hidden role="group" aria-label="${label}">
    ${choices.map(([value, text]) => `<button type="button" data-setting-value="${key}" data-value="${value}" class="setting-option ${value === state[key] ? 'current' : ''}">${text}</button>`).join('')}</div></div></div>`;
}

function bindLobbySettings() {
  $$('.setting-trigger').forEach(trigger => trigger.onclick = () => {
    const id = trigger.dataset.setting, menu = $(`#${id}Menu`);
    const open = menu.hidden;
    $$('.setting-menu').forEach(other => { other.hidden = true; });
    $$('.setting-trigger').forEach(other => other.setAttribute('aria-expanded', 'false')); menu.hidden = !open; trigger.setAttribute('aria-expanded', String(open)); }); $$
('.setting-option').forEach(button => button.onclick = () => {
    const key = button.dataset.settingValue;
    state[key] = Number(button.dataset.value);
    $(`#${key}Value`).textContent = button.textContent;
    $(`#${key}Menu`).hidden = true;
    $(`#${key}Trigger`).setAttribute('aria-expanded', 'false');
    $(`#${key}Menu`).querySelectorAll('.setting-option').forEach(option => option.classList.toggle('current', option === button));
    broadcastState();
  });
}

function topicSelection() {
  const selected = state.categories;
  return `<section class="topics-panel" aria-label="Escolher categorias de temas">
      <div class="topics-heading"><div><h2>Temas da partida</h2><p>O jogo sorteia dentro das categorias escolhidas.</p></div><span class="topics-summary" id="topicsSummary">${selected.length ? selected.length + (selected.length === 1 ? ' categoria' : ' categorias') : 'Todas as categorias'}</span></div>
      <div class="category-picker" role="group" aria-label="Categorias de temas">
        <button type="button" class="category-chip ${!selected.length ? 'selected' : ''}" data-category="all" aria-pressed="${!selected.length}" ${!state.isHost ? 'disabled' : ''}>Todas</button>
        ${TOPIC_CATEGORIES.map(([id, name]) => `<button type="button" class="category-chip ${selected.includes(id) ? 'selected' : ''}" data-category="${id}" aria-pressed="${selected.includes(id)}" ${!state.isHost ? 'disabled' : ''}>${escapeHTML(name)}</button>`).join('')}
      </div>
      <label class="custom-label" for="customTopics">Temas personalizados <span>opcional</span></label>
      <textarea id="customTopics" class="custom-topics" rows="2" maxlength="1500" placeholder="Ex.: Bob Esponja, Pikachu, Shrek" ${!state.isHost ? 'disabled' : ''}>${escapeHTML(state.customTopics.join(', '))}</textarea>
      <p class="custom-hint">Separe por vírgulas. Eles entram no sorteio junto das categorias.</p>
    </section>`;
}

// Atualiza somente o estado visual das categorias, sem recriar o lobby.
// Isso preserva foco, campos preenchidos, scroll e as animações da tela.
function syncTopicSelectionUI() {
  if (state.phase !== 'lobby') return;
  const selected = state.categories;
  $$('.category-chip').forEach(button => {
    const id = button.dataset.category;
    const active = id === 'all' ? selected.length === 0 : selected.includes(id);
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const summary = $('#topicsSummary');
  if (summary) summary.textContent = selected.length
    ? `${selected.length} ${selected.length === 1 ? 'categoria' : 'categorias'}`
    : 'Todas as categorias';
  // Os convidados recebem as configurações em tempo real sem remontar o DOM.
  const input = $('#customTopics');
  if (input && !state.isHost && document.activeElement !== input) {
    const incoming = state.customTopics.join(', ');
    if (input.value !== incoming) input.value = incoming;
  }
}

function bindTopicSelection() {
  $$('.category-chip').forEach(button => button.onclick = () => {
    if (!state.isHost) return;
    const id = button.dataset.category;
    if (id === 'all') state.categories = [];
    else if (categoryIsValid(id)) {
      if (state.categories.includes(id)) {
        state.categories = state.categories.filter(x => x !== id);
      } else state.categories = [...state.categories, id];
    }
    roundUsedTopics.clear();
    syncTopicSelectionUI();
    broadcastState();
  });
  const input = $('#customTopics');
  if (input && state.isHost) input.onchange = () => {
    const topics = cleanCustomTopics(input.value);
    if (JSON.stringify(topics) !== JSON.stringify(state.customTopics)) {
      state.customTopics = topics; roundUsedTopics.clear(); broadcastState();
    }
    input.value = topics.join(', ');
  };
}

function renderLobby() {
  const host = state.isHost;
  const players = connectedPlayers();
  const count = players.length;
  app.innerHTML = `<section class="card main-panel lobby-panel animate-screen">
    ${demoBanner()}
    <div class="panel-top">
      <div><div class="card-kicker">Prontos para rabiscar?</div><h1 class="panel-title">Sala de espera</h1><p class="panel-desc">Compartilhe o código e prepare seus rabiscos.</p></div>
      <div class="room-code"><div class="room-code-text"><span class="room-code-label">CÓDIGO DA SALA</span><div class="room-code-value">${escapeHTML(state.room)}</div></div><button class="icon-btn" id="copyInvite" aria-label="Copiar link de convite" title="Copiar link de convite">${uiIcon('copy')}</button></div>
    </div>
    <div class="player-title"><span>Jogadores</span><span class="muted" id="playerCount">${count} de 10</span></div>
    <div class="players-grid" id="playersGrid">${playerTiles(players)}</div>
    <div class="settings-grid">
      ${settingControl('duration', 'Tempo para desenhar', [[60, '60 segundos'], [90, '90 segundos'], [120, '120 segundos'], [0, 'Sem limite']])}
      ${settingControl('totalRounds', 'Rodadas', [[3, '3 rodadas'], [5, '5 rodadas'], [8, '8 rodadas']])}
    </div>
    ${topicSelection()}
    <div class="bottom-actions"><span class="status-note">${host ? 'Você inicia a partida quando estiverem prontos.' : 'Aguardando quem criou a sala.'}</span>${host ? `<button type="button" id="startRound" class="btn btn-primary">${uiIcon('play')}<span>Começar partida</span></button>` : `<button type="button" class="btn btn-secondary" disabled>${uiIcon('clock')}<span>Aguardando partida</span></button>`}</div>
  </section>`;
  $('#copyInvite').onclick = copyInvite;
  if (host) { bindLobbySettings(); bindTopicSelection(); $('#startRound').onclick = startRound; }
}

function playerTiles(players) {
  const tiles = players.map((p, i) => `
    <div class="player-tile" style="--stagger:${i}">
      <div class="avatar" style="background:${AVATAR_COLORS[i % AVATAR_COLORS.length]}">${escapeHTML(shortName(p.name))}</div>
      <span class="player-name" title="${escapeHTML(p.name)}">${escapeHTML(p.name)}${p.id === state.selfId ? ' <strong class="self-tag">você</strong>' : ''}</span>
    </div>`).join('');
  return tiles + Array.from({ length: Math.max(0, 10 - players.length) }, (_, i) => `
    <div class="player-tile empty-tile ${i ? 'empty-tile-extra' : ''}" aria-label="Vaga disponível">
      <span class="placeholder" aria-hidden="true">${uiIcon('userPlus')}</span>
      ${i ? '' : '<span class="player-name">Lugar livre</span>'}
    </div>`).join('');
}

/* Ícones das ferramentas de desenho padronizados (Lucide 24x24, traço consistente) */
const DRAW_ICONS = {
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/>',
  fill: '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>',
  shapes: '<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  clear: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'
};

function toolIcon(name) {
  return `<svg class="draw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DRAW_ICONS[name]}</svg>`;
}

function toolButton(key, label, icon = key) {
  return `<button type="button" class="draw-tool ${paintTool === key ? 'active' : ''}" data-tool="${key}" aria-pressed="${paintTool === key}">${toolIcon(icon)}<span>${label}</span></button>`;
}

/* Funções utilitárias de conversão de cor (HSV <-> RGB <-> HEX) */
function hsvToRgb(h, s, v) {
  s /= 100; v /= 100;
  const k = (n) => (n + h / 60) % 6;
  const f = (n) => v - v * s * Math.max(0, Math.min(k(n), 4 - k(n), 1));
  return [Math.round(255 * f(5)), Math.round(255 * f(3)), Math.round(255 * f(1))];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
}

function hexToRGB(hex) {
  const clean = String(hex || '#000000').replace('#', '');
  if (clean.length === 3) {
    return [parseInt(clean[0] + clean[0], 16), parseInt(clean[1] + clean[1], 16), parseInt(clean[2] + clean[2], 16)];
  }
  return [parseInt(clean.slice(0, 2), 16) || 0, parseInt(clean.slice(2, 4), 16) || 0, parseInt(clean.slice(4, 6), 16) || 0];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

function renderDrawing() {
  localDrawn = false;
  drawnPaths = []; undonePaths = []; activeStroke = null; paintColor = COLORS[0]; paintSize = 8; paintTool = 'pencil'; paintShape = 'rectangle'; erasing = false;
  colorPopoverOpen = false;
  pickerHSV = rgbToHsv(...hexToRGB(paintColor));

  /* Remove qualquer instância antiga do popover no body antes de renderizar */
  $$('#colorPopover').forEach(el => el.remove());

  app.innerHTML = `<section class="card drawing-panel animate-screen">
    ${demoBanner()}
    <div class="drawing-layout">
      <aside class="draw-sidebar" aria-label="Ferramentas de desenho">
        <div class="sidebar-scroll">
          ${toolButton('pencil', 'Lápis')}
          ${toolButton('eraser', 'Borracha')}
          <div class="size-card"><label for="brushSize">Tamanho <span id="brushValue">8</span></label><input type="range" id="brushSize" min="2" max="40" value="8" aria-label="Tamanho do traço" /></div>
          <button type="button" class="draw-tool" id="undo" ${drawnPaths.length ? '' : 'disabled'}>${toolIcon('undo')}<span>Desfazer</span></button>
          <button type="button" class="draw-tool" id="redo" disabled>${toolIcon('redo')}<span>Refazer</span></button>
          ${toolButton('fill', 'Preencher')}
          ${toolButton('shapes', 'Formas')}
          <div class="shape-choices" id="shapeChoices" hidden>
            <button type="button" class="shape-choice active" data-shape="rectangle">${uiIcon('rect')}<span>Retângulo</span></button>
            <button type="button" class="shape-choice" data-shape="ellipse">${uiIcon('ellipse')}<span>Círculo</span></button>
            <button type="button" class="shape-choice" data-shape="line">${uiIcon('line')}<span>Linha</span></button>
          </div>
          <div class="sidebar-colors">
            <div class="colors-label">Cores</div>
            <div class="swatches" role="group" aria-label="Cores do desenho">
              ${COLORS.map((color, i) => `<button type="button" class="swatch" style="background:${color}" data-color="${color}" aria-label="Cor ${i + 1}" aria-pressed="${i === 0 ? 'true' : 'false'}"></button>`).join('')}
              <button type="button" class="color-picker-plus" id="customColorBtn" title="Escolher cor personalizada" aria-label="Abrir seletor de cores" aria-expanded="false">
                <span class="plus-badge" aria-hidden="true">${uiIcon('plus')}</span>
              </button>
            </div>

            <!-- Popover Customizado do Seletor de Cores -->
            <div class="color-popover" id="colorPopover" hidden role="dialog" aria-label="Seletor de cor personalizada">
              <div class="cp-head">
                <span class="cp-title">Cor personalizada</span>
                <button type="button" class="cp-close" id="cpClose" aria-label="Fechar seletor">${uiIcon('close')}</button>
              </div>
              <div class="cp-sat-area" id="cpSatArea">
                <div class="cp-sat-white"></div>
                <div class="cp-sat-black"></div>
                <div class="cp-sat-thumb" id="cpSatThumb"></div>
              </div>
              <div class="cp-controls-row">
                ${window.EyeDropper ? `<button type="button" class="cp-pipette-btn" id="cpPipette" title="Conta-gotas" aria-label="Capturar cor da tela">${uiIcon('pipette')}</button>` : ''}
                <div class="cp-preview-swatch" id="cpPreviewSwatch"></div>
                <div class="cp-hue-wrap">
                  <input type="range" id="cpHueSlider" class="cp-hue-slider" min="0" max="360" value="${pickerHSV.h}" aria-label="Matiz da cor" />
                </div>
              </div>
              <div class="cp-rgb-row">
                <div class="cp-field-group cp-hex-group">
                  <input type="text" id="cpHexInput" class="cp-input" maxlength="7" value="${paintColor}" aria-label="Código Hex" />
                  <span>HEX</span>
                </div>
                <div class="cp-field-group">
                  <input type="number" id="cpR" class="cp-input" min="0" max="255" value="38" aria-label="Vermelho (R)" />
                  <span>R</span>
                </div>
                <div class="cp-field-group">
                  <input type="number" id="cpG" class="cp-input" min="0" max="255" value="32" aria-label="Verde (G)" />
                  <span>G</span>
                </div>
                <div class="cp-field-group">
                  <input type="number" id="cpB" class="cp-input" min="0" max="255" value="57" aria-label="Azul (B)" />
                  <span>B</span>
                </div>
              </div>
            </div>
          </div>
          <button type="button" class="draw-tool clear-tool" id="clearCanvas">${toolIcon('clear')}<span>Limpar tudo</span></button>
        </div>
      </aside>
      <div class="drawing-main">
        <div class="game-top"><div><div class="theme-lead">Desenhe isto</div><h1 class="theme-word animate-theme">${escapeHTML(state.theme)}</h1></div><div class="round-meta"><span>${roundLabel()}</span><div id="timer" class="timer">${state.duration === 0 ? '' : formatClock(state.duration)}</div></div></div>
        <div class="timer-progress" id="drawingProgress" ${state.duration === 0 ? 'hidden' : ''}><div class="timer-fill" id="timerFill"></div></div>
        <div class="canvas-container"><canvas id="drawCanvas" class="draw-canvas" width="900" height="520" aria-label="Área de desenho"></canvas></div>
        <div class="canvas-cta"><span id="drawCount">${connectedPlayers().length} pessoas desenhando</span><button type="button" class="btn btn-primary" id="submitDrawing">${uiIcon('send')}<span>Entregar desenho</span></button></div>
      </div>
    </div>
  </section>`;

  initCanvas();
  initCustomColorPicker();

  $$('.draw-tool[data-tool]').forEach(button => button.onclick = () => { paintTool = button.dataset.tool; syncDrawingToolbar(); });
  $$('.swatch').forEach(button => button.onclick = () => {
    paintColor = button.dataset.color;
    pickerHSV = rgbToHsv(...hexToRGB(paintColor));
    if (paintTool === 'eraser') paintTool = 'pencil';
    toggleColorPopover(false);
    syncDrawingToolbar();
  });
  $$('.shape-choice').forEach(button => button.onclick = () => { paintShape = button.dataset.shape; syncDrawingToolbar(); });
  $('#brushSize').oninput = e => { paintSize = Number(e.target.value); $('#brushValue').textContent = paintSize; };
  $('#undo').onclick = undoDrawing;
  $('#redo').onclick = redoDrawing;
  $('#clearCanvas').onclick = () => { if (!drawnPaths.length) return; pushDrawAction({ kind: 'clear' }); redrawCanvas(); };
  $('#submitDrawing').onclick = submitOwnDrawing;
  syncDrawingToolbar();
}

function toggleColorPopover(force) {
  const popover = $('#colorPopover');
  const btn = $('#customColorBtn');
  if (!popover) {
    colorPopoverOpen = false;
    return;
  }
  colorPopoverOpen = typeof force === 'boolean' ? force : !colorPopoverOpen;
  popover.hidden = !colorPopoverOpen;
  if (btn) btn.setAttribute('aria-expanded', String(colorPopoverOpen));
  if (colorPopoverOpen) {
    pickerHSV = rgbToHsv(...hexToRGB(paintColor));
    updateColorPickerUI();
    positionColorPopover();
  }
}

function positionColorPopover() {
  const popover = $('#colorPopover');
  const btn = $('#customColorBtn');
  if (!popover || !btn || popover.hidden) return;

  const btnRect = btn.getBoundingClientRect();
  const colorsCardRect = $('.sidebar-colors')?.getBoundingClientRect() || btnRect;
  const sidebarRect = $('.draw-sidebar')?.getBoundingClientRect() || colorsCardRect;
  const popWidth = popover.offsetWidth || 248;
  const popHeight = popover.offsetHeight || 268;

  let left;
  let top;

  if (window.innerWidth > 740) {
    /* Desktop: abre à direita do cartão de Cores, alinhado com a base da paleta */
    left = sidebarRect.right + 12;
    top = colorsCardRect.bottom - popHeight;
  } else {
    /* Mobile: abre acima do botão + da barra de ferramentas inferior */
    left = btnRect.left + (btnRect.width / 2) - (popWidth / 2);
    top = colorsCardRect.top - popHeight - 10;
    if (top < 12) {
      top = btnRect.bottom + 10;
    }
  }

  left = Math.max(12, Math.min(left, window.innerWidth - popWidth - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - popHeight - 12));

  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
}

function updateColorPickerUI() {
  const satArea = $('#cpSatArea');
  const satThumb = $('#cpSatThumb');
  const hueSlider = $('#cpHueSlider');
  const preview = $('#cpPreviewSwatch');
  const hexInput = $('#cpHexInput');
  const rInput = $('#cpR'), gInput = $('#cpG'), bInput = $('#cpB');
  if (!satArea) return;

  const [r, g, b] = hsvToRgb(pickerHSV.h, pickerHSV.s, pickerHSV.v);
  const hex = rgbToHex(r, g, b);

  satArea.style.backgroundColor = `hsl(${pickerHSV.h}, 100%, 50%)`;
  satThumb.style.left = `${pickerHSV.s}%`;
  satThumb.style.top = `${100 - pickerHSV.v}%`;
  satThumb.style.backgroundColor = hex;

  if (hueSlider) hueSlider.value = String(pickerHSV.h);
  if (preview) preview.style.backgroundColor = hex;
  if (hexInput && document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
  if (rInput && document.activeElement !== rInput) rInput.value = String(r);
  if (gInput && document.activeElement !== gInput) gInput.value = String(g);
  if (bInput && document.activeElement !== bInput) bInput.value = String(b);
}

function applyPickerHSV() {
  const [r, g, b] = hsvToRgb(pickerHSV.h, pickerHSV.s, pickerHSV.v);
  paintColor = rgbToHex(r, g, b);
  if (paintTool === 'eraser') paintTool = 'pencil';
  updateColorPickerUI();
  syncDrawingToolbar();
}

function initCustomColorPicker() {
  const popover = $('#colorPopover');
  const btn = $('#customColorBtn');
  const closeBtn = $('#cpClose');
  const satArea = $('#cpSatArea');
  const hueSlider = $('#cpHueSlider');
  const hexInput = $('#cpHexInput');
  const rInput = $('#cpR'), gInput = $('#cpG'), bInput = $('#cpB');
  const pipetteBtn = $('#cpPipette');

  if (!popover || !btn || !satArea) return;

  /* Move o popover para o document.body para nunca sofrer offset de transform nem corte de overflow */
  if (popover.parentElement !== document.body) {
    document.body.appendChild(popover);
  }

  btn.onclick = (e) => {
    e.stopPropagation();
    toggleColorPopover();
  };
  if (closeBtn) closeBtn.onclick = () => toggleColorPopover(false);

  const sidebarScroll = $('.sidebar-scroll');
  if (sidebarScroll) {
    sidebarScroll.addEventListener('scroll', () => {
      if (colorPopoverOpen) positionColorPopover();
    }, { passive: true });
  }

  let draggingSat = false;
  const updateSatFromEvent = (ev) => {
    const rect = satArea.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, ev.clientY - rect.top));
    pickerHSV.s = Math.round((x / rect.width) * 100);
    pickerHSV.v = Math.round(100 - (y / rect.height) * 100);
    applyPickerHSV();
  };

  satArea.onpointerdown = (ev) => {
    ev.preventDefault();
    draggingSat = true;
    satArea.setPointerCapture(ev.pointerId);
    updateSatFromEvent(ev);
  };
  satArea.onpointermove = (ev) => {
    if (!draggingSat) return;
    ev.preventDefault();
    updateSatFromEvent(ev);
  };
  const stopSat = () => { draggingSat = false; };
  satArea.onpointerup = stopSat;
  satArea.onpointercancel = stopSat;

  if (hueSlider) {
    hueSlider.oninput = (e) => {
      pickerHSV.h = Number(e.target.value);
      applyPickerHSV();
    };
  }

  if (hexInput) {
    hexInput.oninput = (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        paintColor = val.toLowerCase();
        pickerHSV = rgbToHsv(...hexToRGB(paintColor));
        if (paintTool === 'eraser') paintTool = 'pencil';
        updateColorPickerUI();
        syncDrawingToolbar();
      }
    };
  }

  const onRgbChange = () => {
    const r = Math.max(0, Math.min(255, Number(rInput.value) || 0));
    const g = Math.max(0, Math.min(255, Number(gInput.value) || 0));
    const b = Math.max(0, Math.min(255, Number(bInput.value) || 0));
    pickerHSV = rgbToHsv(r, g, b);
    applyPickerHSV();
  };
  [rInput, gInput, bInput].forEach(inp => { if (inp) inp.oninput = onRgbChange; });

  if (pipetteBtn && window.EyeDropper) {
    pipetteBtn.onclick = async () => {
      try {
        const dropper = new window.EyeDropper();
        const result = await dropper.open();
        if (result?.sRGBHex) {
          paintColor = result.sRGBHex.toLowerCase();
          pickerHSV = rgbToHsv(...hexToRGB(paintColor));
          if (paintTool === 'eraser') paintTool = 'pencil';
          updateColorPickerUI();
          syncDrawingToolbar();
        }
      } catch (_) {}
    };
  }
}

function syncDrawingToolbar() {
  $$('.draw-tool[data-tool]').forEach(b => { const on = paintTool === b.dataset.tool; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  $$('.swatch').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === paintColor)));
  const plus = $('#customColorBtn');
  if (plus) {
    const isCustom = !COLORS.includes(paintColor);
    plus.classList.toggle('custom-active', isCustom);
    plus.style.setProperty('--picked-color', paintColor);
  }
  $$('.shape-choice').forEach(b => b.classList.toggle('active', b.dataset.shape === paintShape));
  const shapeChoices = $('#shapeChoices'); if (shapeChoices) shapeChoices.hidden = paintTool !== 'shapes';
  if ($('#undo')) $('#undo').disabled = !drawnPaths.length;
  if ($('#redo')) $('#redo').disabled = !undonePaths.length;
  if ($('#clearCanvas')) $('#clearCanvas').disabled = !drawnPaths.length;
}

function pushDrawAction(action) { drawnPaths.push(action); undonePaths = []; syncDrawingToolbar(); }
function undoDrawing() { if (!drawnPaths.length) return; undonePaths.push(drawnPaths.pop()); redrawCanvas(); syncDrawingToolbar(); }
function redoDrawing() { if (!undonePaths.length) return; drawnPaths.push(undonePaths.pop()); redrawCanvas(); syncDrawingToolbar(); }

function drawStroke(ctx, path) {
  const points = path.points || []; if (!points.length) return;
  ctx.beginPath(); ctx.strokeStyle = path.color; ctx.lineWidth = path.size; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 1) ctx.lineTo(points[0].x + .01, points[0].y + .01);
  for (const pt of points.slice(1)) ctx.lineTo(pt.x, pt.y);
  ctx.stroke();
}

function drawShape(ctx, shape) {
  const { x1, y1, x2, y2, color, size } = shape;
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (shape.shape === 'rectangle') ctx.rect(x1, y1, x2 - x1, y2 - y1);
  else if (shape.shape === 'line') { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
  else if (shape.shape === 'ellipse') { const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2; ctx.ellipse(cx, cy, Math.max(.1, Math.abs(x2 - x1) / 2), Math.max(.1, Math.abs(y2 - y1) / 2), 0, 0, Math.PI * 2); }
  ctx.stroke();
}

function floodFill(ctx, x, y, color) {
  const width = ctx.canvas.width, height = ctx.canvas.height;
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const image = ctx.getImageData(0, 0, width, height), data = image.data;
  const start = (y * width + x) * 4, target = [...data.slice(start, start + 4)], newColor = [...hexToRGB(color), 255];
  if (target.every((v, i) => v === newColor[i])) return;
  const matches = (i) => data[i] === target[0] && data[i + 1] === target[1] && data[i + 2] === target[2] && data[i + 3] === target[3];
  const mark = (i) => { data[i] = newColor[0]; data[i + 1] = newColor[1]; data[i + 2] = newColor[2]; data[i + 3] = 255; };
  const queue = new Int32Array(width * height); let head = 0, tail = 0;
  const index = y * width + x; queue[tail++] = index; mark(index * 4);
  while (head < tail) {
    const point = queue[head++], px = point % width, py = (point - px) / width;
    if (px > 0) { const next = point - 1; if (matches(next * 4)) { mark(next * 4); queue[tail++] = next; } }
    if (px < width - 1) { const next = point + 1; if (matches(next * 4)) { mark(next * 4); queue[tail++] = next; } }
    if (py > 0) { const next = point - width; if (matches(next * 4)) { mark(next * 4); queue[tail++] = next; } }
    if (py < height - 1) { const next = point + width; if (matches(next * 4)) { mark(next * 4); queue[tail++] = next; } }
  }
  ctx.putImageData(image, 0, 0);
}

function initCanvas() {
  const canvas = $('#drawCanvas');
  canvas.style.touchAction = 'none';
  redrawCanvas();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const getPos = ev => { const r = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(canvas.width, (ev.clientX - r.left) * canvas.width / r.width)), y: Math.max(0, Math.min(canvas.height, (ev.clientY - r.top) * canvas.height / r.height)) }; };
  canvas.onpointerdown = ev => {
    if (colorPopoverOpen) toggleColorPopover(false);
    if (localDrawn || state.phase !== 'drawing' || activeStroke) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ev.preventDefault(); canvas.setPointerCapture(ev.pointerId);
    const pt = getPos(ev);
    if (paintTool === 'fill') { pushDrawAction({ kind: 'fill', ...pt, color: paintColor }); redrawCanvas(); return; }
    if (paintTool === 'shapes') activeStroke = { kind: 'shape', shape: paintShape, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, color: paintColor, size: paintSize };
    else activeStroke = { kind: 'stroke', color: paintTool === 'eraser' ? '#ffffff' : paintColor, size: paintTool === 'eraser' ? paintSize * 2.5 : paintSize, points: [pt] };
    if (activeStroke.kind === 'stroke') drawStroke(ctx, activeStroke);
  };
  canvas.onpointermove = ev => {
    if (!activeStroke) return;
    ev.preventDefault(); const pt = getPos(ev);
    if (activeStroke.kind === 'shape') { activeStroke.x2 = pt.x; activeStroke.y2 = pt.y; redrawCanvas(); drawShape(ctx, activeStroke); }
    else {
      const previous = activeStroke.points[activeStroke.points.length - 1];
      activeStroke.points.push(pt);
      ctx.beginPath(); ctx.strokeStyle = activeStroke.color; ctx.lineWidth = activeStroke.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.moveTo(previous.x, previous.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
    }
  };
  const end = ev => {
    if (!activeStroke) return;
    if (ev) ev.preventDefault();
    if (ev && activeStroke.kind === 'shape') { const pt = getPos(ev); activeStroke.x2 = pt.x; activeStroke.y2 = pt.y; }
    const completed = activeStroke; activeStroke = null; pushDrawAction(completed); redrawCanvas();
  };
  canvas.onpointerup = end; canvas.onpointercancel = end; canvas.onlostpointercapture = end;
}

function redrawCanvas() {
  const canvas = $('#drawCanvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const action of drawnPaths) {
    if (action.kind === 'clear' || action.clear) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    else if (action.kind === 'fill') floodFill(ctx, action.x, action.y, action.color);
    else if (action.kind === 'shape') drawShape(ctx, action);
    else drawStroke(ctx, action);
  }
}

function captureOwnDrawing() {
  const canvas = $('#drawCanvas');
  return canvas ? canvas.toDataURL('image/webp', .67) : '';
}

function submitOwnDrawing() {
  if (localDrawn || state.phase !== 'drawing') return;
  toggleColorPopover(false);
  const image = captureOwnDrawing();
  localDrawn = true;
  playSound('submit');
  if (state.isHost) hostReceiveDrawing(state.selfId, image);
  else if (guestConnection?.open) guestConnection.send({ type: 'submit', image });
  render();
}

function submittedCount() { return state.isHost ? Object.keys(state.drawings).length : state.submittedCount; }

function renderWaiting() {
  app.innerHTML = `<section class="card main-panel center-state animate-screen">
    ${demoBanner()}
    <div class="state-graphic state-graphic-check" aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none" stroke="#355536" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
        <path class="draw-check-path" d="m15 33 12 12 23-26"/>
      </svg>
    </div>
    <h1 class="state-title">Desenho entregue!</h1>
    <p class="state-desc">Seu rabisco está guardado. Quando todo mundo terminar, começa a galeria.</p>
    <span class="waiting-count" id="waitingCount">${submittedCount()} de ${connectedPlayers().length} desenhos recebidos</span>
  </section>`;
}

function sortedArt() {
  return Object.entries(state.drawings).map(([id, image]) => ({ id, image, player: state.players.find(p => p.id === id) })).filter(entry => entry.player).sort((a, b) => (a.id > b.id ? 1 : -1));
}

function selectedReaction(target, kind) {
  return !!(state.localVote && state.localVote.target === target && state.localVote.kind === kind);
}

function renderGallery() {
  const arts = sortedArt();
  app.innerHTML = `<section class="card main-panel animate-screen">${demoBanner()}<div class="panel-top"><div><div class="card-kicker">${roundLabel()}</div><h1 class="panel-title">A galeria está aberta!</h1><p class="panel-desc">O tema era <strong>${escapeHTML(state.theme)}</strong>. Curta ou dê dislike em um desenho. Não é possível avaliar o seu.</p></div><div class="room-code"><div><span class="room-code-label">AVALIAÇÕES</span><div class="room-code-value" id="votedCount">${state.votedCount} de ${state.demo ? 1 : connectedPlayers().length}</div></div></div></div>
    <div class="voting-clock"><span class="voting-clock-label">${uiIcon('clock')}<span>Tempo para votar</span></span><strong id="voteTimer">${formatClock(Math.max(0, Math.ceil((state.voteDeadline - Date.now()) / 1000)))}</strong></div><div class="timer-progress voting-progress"><div class="timer-fill" id="voteTimerFill"></div></div>
    <div class="gallery-grid gallery-count-${Math.min(10, arts.length)}">${arts.map((a, i) => {
      const owned = a.id === state.selfId;
      const liked = selectedReaction(a.id, 'like');
      const disliked = selectedReaction(a.id, 'dislike');
      const playerName = escapeHTML(a.player.name);
      return `<div class="art-card ${liked ? 'voted' : disliked ? 'disliked' : ''}" style="--stagger:${i}" data-player="${escapeHTML(a.id)}"><img src="${a.image}" alt="Desenho de ${playerName}"/><div class="art-info"><span class="art-name">${playerName}${owned ? ' <strong class="self-tag">você</strong>' : ''}</span>${owned ? '<span class="own-art-label">Seu desenho</span>' : `<div class="vote-actions" role="group" aria-label="Avaliar desenho de ${playerName}"><button type="button" class="vote-action vote-like ${liked ? 'selected' : ''}" data-reaction="like" aria-pressed="${liked}" aria-label="Gostei do desenho de ${playerName}" title="Gostei">${uiIcon('thumbUp')}<span>Gostei</span></button><button type="button" class="vote-action vote-dislike ${disliked ? 'selected' : ''}" data-reaction="dislike" aria-pressed="${disliked}" aria-label="Não gostei do desenho de ${playerName}" title="Não gostei">${uiIcon('thumbDown')}<span>Dislike</span></button></div>`}</div></div>`;
    }).join('')}</div>
    <div class="bottom-actions"><span class="status-note" id="voteHelp">${state.localVote ? 'Você pode trocar ou retirar sua avaliação até o tempo acabar.' : 'Escolha uma avaliação. É possível mudar ou cancelar.'}</span></div></section>`;
  $$('.gallery-grid .vote-action').forEach(btn => btn.onclick = () => castVote(btn.closest('.art-card')?.dataset.player, btn.dataset.reaction));
}

/* Atualiza apenas os botões de avaliação sem remontar a galeria e reiniciar animações. */
function syncGalleryVoteUI() {
  const locked = Date.now() >= state.voteDeadline;
  $$('.gallery-grid .art-card').forEach(card => {
    const target = card.dataset.player;
    if (!target) return;
    const liked = selectedReaction(target, 'like');
    const disliked = selectedReaction(target, 'dislike');
    card.classList.toggle('voted', liked);
    card.classList.toggle('disliked', disliked);
    $$('.vote-action', card).forEach(button => {
      const selected = button.dataset.reaction === 'like' ? liked : disliked;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = locked;
      button.title = selected ? 'Retirar avaliação' : button.dataset.reaction === 'like' ? 'Gostei' : 'Não gostei';
    });
  });
  const help = $('#voteHelp');
  if (help) help.textContent = locked ? 'Votação encerrada.' : state.localVote
    ? 'Você pode trocar ou retirar sua avaliação até o tempo acabar.'
    : 'Escolha uma avaliação. É possível mudar ou cancelar.';
}

function rankResults() {
  return sortedArt().map(a => {
    const reactions = Object.values(state.votes).filter(v => v?.target === a.id);
    const likes = reactions.filter(v => v.kind === 'like').length;
    const dislikes = reactions.filter(v => v.kind === 'dislike').length;
    return { id: a.id, name: a.player.name, image: a.image, likes, dislikes, net: likes - dislikes, score: state.scores[a.id] || 0 };
  }).sort((a, b) => b.net - a.net || b.likes - a.likes || a.dislikes - b.dislikes || a.name.localeCompare(b.name, 'pt-BR'));
}

function renderResults() {
  const rows = state.results.length ? state.results : rankResults();
  const leader = rows[0];
  const winningDrawing = leader?.net > 0 ? leader : null;
  const final = state.round >= state.totalRounds;
  const scoresSorted = [...state.players].map(p => ({ name: p.name, score: state.scores[p.id] || 0 })).sort((a, b) => b.score - a.score);
  app.innerHTML = `<section class="card main-panel animate-screen">${demoBanner()}<div class="panel-top"><div><div class="card-kicker">${roundLabel()}</div><h1 class="panel-title">${final ? 'Fim de jogo!' : 'Que obras de arte!'}</h1><p class="panel-desc">${final ? 'Hora de conferir a classificação final.' : 'Confira os resultados desta rodada.'}</p></div></div>
    <div class="result-banner"><div><div class="result-label">${final ? 'Partida concluída' : 'Melhor avaliado da rodada'}</div><div class="winner-name">${escapeHTML(final ? scoresSorted[0]?.name || 'Sem pontuação' : winningDrawing?.name || 'Sem vencedor nesta rodada')}</div><p class="result-sub">${final ? `${scoresSorted[0]?.score || 0} pontos no total` : `${leader?.likes || 0} gostei e ${leader?.dislikes || 0} dislikes`}</p></div><svg class="winner-svg" viewBox="0 0 90 90" fill="none" aria-hidden="true"><path d="M24 16h42v13c0 22-11 31-21 31S24 51 24 29V16Z" fill="#fee68d" stroke="#493d52" stroke-width="3"/><path d="M25 22H13v9c0 12 8 17 17 17M65 22h12v9c0 12-8 17-17 17" stroke="#493d52" stroke-width="3" stroke-linejoin="round"/><path d="M45 59v12M30 75h30" stroke="#493d52" stroke-width="4" stroke-linecap="round"/><path d="m45 24 4 7 8 1-6 6 1 9-7-4-7 4 1-9-6-6 8-1 4-7Z" fill="#fff5c5"/></svg></div>
    <div class="player-title">${final ? 'Placar final' : 'Desenhos da rodada'}</div>
    ${final ? `<div class="ranking-list">${scoresSorted.map((p, i) => `<div class="rank-row ${i === 0 ? 'rank-row-first' : ''}" style="--stagger:${i}"><span class="rank-player"><span class="rank-pos">${i + 1}º</span><span class="rank-name">${escapeHTML(p.name)}</span></span><strong class="rank-score">${p.score} pt</strong></div>`).join('')}</div>` : `<div class="gallery-grid gallery-count-${Math.min(10, rows.length)}">${rows.map((r, i) => `<div class="art-card" style="--stagger:${i}"><img src="${r.image}" alt="Desenho de ${escapeHTML(r.name)}"/><div class="art-info"><span class="art-name">${escapeHTML(r.name)}</span><span class="result-vote-totals"><span class="result-vote-like" title="Curtidas">${uiIcon('thumbUp')} ${r.likes}</span><span class="result-vote-dislike" title="Dislikes">${uiIcon('thumbDown')} ${r.dislikes}</span></span></div></div>`).join('')}</div>`}
    <div class="bottom-actions results-actions"><button type="button" id="homeResult" class="btn btn-secondary">${uiIcon('home')}<span>Tela inicial</span></button>${state.isHost ? `<button type="button" id="nextRound" class="btn btn-primary">${uiIcon(final ? 'refresh' : 'play')}<span>${final ? 'Jogar novamente' : 'Próxima rodada'}</span></button>` : '<span class="status-note">Aguardando a próxima rodada.</span>'}</div>
  </section>`;
  $('#homeResult').onclick = () => leaveRoom(true);
  if (state.isHost) $('#nextRound').onclick = () => { if (final) { state.round = 0; state.scores = {}; roundUsedTopics.clear(); } startRound(); };
}

function updateLiveUI() {
  if (state.phase === 'countdown') {
    const time = Math.max(0, Math.ceil((state.countdownUntil - Date.now()) / 1000));
    if (time >= 1 && time <= 3 && time !== lastCountdownSound) {
      lastCountdownSound = time;
      playSound('countdown', time);
    }
    const element = $('#countdownNumber');
    if (element && element.textContent !== String(time || 'JÁ!')) {
      element.textContent = String(time || 'JÁ!');
      element.classList.remove('pop'); void element.offsetWidth; element.classList.add('pop');
    }
    if (state.isHost && Date.now() >= state.countdownUntil) beginDrawingAfterCountdown();
  }
  if (state.phase === 'drawing' || state.phase === 'ending') {
    if (state.duration > 0) {
      const remaining = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
      if (remaining >= 1 && remaining <= 5 && remaining !== lastDrawingTick) {
        lastDrawingTick = remaining;
        if (!localDrawn) playSound('lastSeconds');
      }
      const timer = $('#timer'), timerFill = $('#timerFill');
      if (timer) { timer.textContent = formatClock(remaining); timer.classList.toggle('low', remaining <= 15); }
      if (timerFill) timerFill.style.width = `${Math.max(0, 100 * (state.deadline - Date.now()) / (state.duration * 1000))}%`;
      if (remaining === 0 && state.phase === 'drawing') {
        if (state.isHost && !endedTimer) {
          endedTimer = true;
          if (!localDrawn) submitOwnDrawing();
          if (state.phase !== 'drawing') return;
          state.phase = 'ending'; broadcastState(); render();
        } else if (!state.isHost && !localDrawn && guestConnection?.open) submitOwnDrawing();
      }
    } else {
      const timer = $('#timer'); if (timer) timer.textContent = '';
    }
  }
  if (state.phase === 'gallery') {
    const remaining = Math.max(0, Math.ceil((state.voteDeadline - Date.now()) / 1000));
    if (remaining >= 1 && remaining <= 5 && remaining !== lastVoteTick) {
      lastVoteTick = remaining;
      playSound('voteSeconds');
    }
    const timer = $('#voteTimer'), fill = $('#voteTimerFill');
    if (timer) { timer.textContent = formatClock(remaining); timer.classList.toggle('low', remaining <= 10); }
    if (fill) fill.style.width = `${Math.max(0, 100 * (state.voteDeadline - Date.now()) / (VOTING_SECONDS * 1000))}%`;
    if (remaining === 0) syncGalleryVoteUI();
    if (state.isHost && remaining === 0) finishVoting();
  }
  if (state.phase === 'lobby') {
    syncTopicSelectionUI();
    const count = $('#playerCount'), grid = $('#playersGrid');
    if (count) count.textContent = `${connectedPlayers().length} de 10`;
    if (grid) {
      const nextHTML = playerTiles(connectedPlayers());
      const rosterKey = JSON.stringify(connectedPlayers().map(p => [p.id, p.name]));
      if (grid.dataset.rosterKey !== rosterKey) {
        grid.innerHTML = nextHTML;
        grid.dataset.rosterKey = rosterKey;
      }
    }
    const duration = $('#durationValue'); if (duration) duration.textContent = durationText(state.duration);
    const rounds = $('#totalRoundsValue'); if (rounds) rounds.textContent = `${state.totalRounds} rodadas`;
    $$('.setting-option').forEach(button => {
      const key = button.dataset.settingValue;
      if (key === 'duration' || key === 'totalRounds') button.classList.toggle('current', Number(button.dataset.value) === state[key]);
    });
  }
  if (state.phase === 'drawing') {
    const count = $('#drawCount'); if (count) count.textContent = `${connectedPlayers().length} pessoas desenhando`;
  }
  const wait = $('#waitingCount'); if (wait) wait.textContent = `${submittedCount()} de ${connectedPlayers().length} desenhos recebidos`;
  const votes = $('#votedCount'); if (votes) votes.textContent = `${state.votedCount} de ${state.demo ? 1 : connectedPlayers().length}`;
}

async function copyInvite() {
  const url = `${location.origin}${location.pathname}?s=${encodeURIComponent(state.room)}`;
  const btn = $('#copyInvite');
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link de convite copiado!');
    if (btn) {
      btn.innerHTML = uiIcon('check', 'icon-pop');
      btn.classList.add('copied');
      setTimeout(() => {
        if ($('#copyInvite')) {
          $('#copyInvite').innerHTML = uiIcon('copy');
          $('#copyInvite').classList.remove('copied');
        }
      }, 1800);
    }
  } catch (_) {
    showToast(`Código da sala: ${state.room}`);
  }
}

function setConnecting() { state.phase = 'connecting'; lastScreen = null; render(); }

function createRoom() {
  const name = getNickname(); if (!name) { showToast('Escolha um apelido.'); $('#nickname')?.focus(); return; }
  rememberName(name);
  if (!window.Peer) { showToast('Não foi possível carregar a conexão. Experimente a demonstração.'); return; }
  hostConnections = new Map();
  const room = makeCode(); setConnecting();
  peer = new Peer(`rabisca-${room}`, { debug: 0 });
  peer.on('open', id => {
    resetRoom({ name, room, isHost: true, id });
    peer.on('connection', hostAcceptConnection);
    render(); showToast('Sala criada. Compartilhe o código com seus amigos.');
  });
  peer.on('error', err => { showToast(err.type === 'unavailable-id' ? 'Código já utilizado. Tente novamente.' : 'Não foi possível criar a sala.'); showHome(); });
  peer.on('disconnected', () => showToast('Sinalização desconectada. A sala pode ficar indisponível.'));
}

function joinRoom() {
  const name = getNickname(); const code = ($('#roomInput')?.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!name) { showToast('Escolha um apelido.'); $('#nickname')?.focus(); return; }
  if (code.length !== 5) { showToast('Informe um código de cinco caracteres.'); $('#roomInput')?.focus(); return; }
  if (!window.Peer) { showToast('Não foi possível carregar a conexão.'); return; }
  rememberName(name); setConnecting();
  peer = new Peer(undefined, { debug: 0 });
  peer.on('open', id => {
    resetRoom({ name, room: code, isHost: false, id }); state.phase = 'connecting';
    guestConnection = peer.connect(`rabisca-${code}`, { reliable: true });
    guestConnection.on('open', () => {
      clearTimeout(guestConnectionTimeout);
      guestConnection.send({ type: 'join', name });
    });
    guestConnection.on('data', onGuestData);
    guestConnection.on('close', () => { showToast('Conexão encerrada. Entre novamente com o código.'); showHome(); });
    guestConnection.on('error', () => { showToast('Não foi possível entrar na sala.'); showHome(); });
    guestConnectionTimeout = setTimeout(() => { if (state.phase === 'connecting') { showToast('Sala não encontrada ou conexão bloqueada.'); showHome(); } }, 13000);
  });
  peer.on('error', err => { showToast(err.type === 'peer-unavailable' ? 'Sala não encontrada.' : 'Falha na conexão.'); clearTimeout(guestConnectionTimeout); showHome(); });
}

function onGuestData(message) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'error') { showToast(message.reason || 'Não foi possível entrar.'); guestConnection?.close(); showHome(); return; }
  if (message.type === 'state') {
    clearTimeout(guestConnectionTimeout);
    const data = message.state || {};
    const oldPhase = state.phase;
    const previousConnected = connectedPlayers().length;
    const incomingPhase = data.phase || oldPhase;
    if (incomingPhase === 'ending' && oldPhase === 'drawing' && !localDrawn) submitOwnDrawing();
    if (incomingPhase === 'countdown' && oldPhase !== 'countdown') { localDrawn = false; state.localVote = null; }
    if (incomingPhase === 'drawing' && oldPhase !== 'drawing' && oldPhase !== 'waiting') { localDrawn = false; state.localVote = null; }
    state.phase = incomingPhase; state.players = data.players || [];
    state.duration = data.duration ?? 90; state.totalRounds = data.totalRounds || 5;
    state.categories = Array.isArray(data.categories) ? data.categories.filter(categoryIsValid) : [];
    state.customTopics = Array.isArray(data.customTopics) ? data.customTopics.filter(x => typeof x === 'string').slice(0, 30) : [];
    state.round = data.round || 0; state.theme = data.theme || ''; state.deadline = data.deadline || 0; state.countdownUntil = data.countdownUntil || 0; state.voteDeadline = data.voteDeadline || 0;
    state.drawings = data.drawings || {}; state.submittedCount = data.submittedCount || 0; state.votedCount = data.votedCount || 0;
    state.scores = data.scores || {}; state.results = data.results || [];
    if (oldPhase === 'connecting') lastScreen = null;
    if (incomingPhase === 'lobby' && (oldPhase === 'connecting' || connectedPlayers().length > previousConnected)) playSound('join');
    render();
  }
}

function hostAcceptConnection(conn) {
  conn.on('data', msg => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'join') {
      if (state.phase !== 'lobby') { conn.send({ type: 'error', reason: 'A partida já começou. Tente na próxima sala.' }); return; }
      if (connectedPlayers().length >= 10) { conn.send({ type: 'error', reason: 'Esta sala está cheia.' }); return; }
      const name = String(msg.name || '').trim().slice(0, 18);
      if (!name) return;
      hostConnections.set(conn.peer, conn);
      state.players = state.players.filter(p => p.id !== conn.peer);
      state.players.push({ id: conn.peer, name, connected: true });
      state.scores[conn.peer] = 0;
      playSound('join');
      broadcastState(); render();
    }
    if (msg.type === 'submit' && ['drawing', 'ending'].includes(state.phase) && hostConnections.has(conn.peer)) hostReceiveDrawing(conn.peer, msg.image);
    if (msg.type === 'vote' && state.phase === 'gallery' && hostConnections.has(conn.peer)) hostReceiveVote(conn.peer, msg.target);
  });
  conn.on('close', () => {
    hostConnections.delete(conn.peer);
    const player = state.players.find(p => p.id === conn.peer); if (player) player.connected = false;
    broadcastState(); render();
    if (['drawing', 'ending'].includes(state.phase) && allSubmitted()) showGallery();
  });
}

function exportPublicState() {
  return {
    phase: state.phase, players: state.players, duration: state.duration, totalRounds: state.totalRounds,
    categories: state.categories, customTopics: state.customTopics, voteDeadline: state.voteDeadline,
    round: state.round, theme: state.phase === 'countdown' ? '' : state.theme, deadline: state.deadline, countdownUntil: state.countdownUntil,
    drawings: (state.phase === 'gallery' || state.phase === 'results') ? state.drawings : {},
    submittedCount: Object.keys(state.drawings).length,
    votedCount: Object.keys(state.votes).length, scores: state.scores,
    results: state.phase === 'results' ? state.results : []
  };
}

function broadcastState() {
  if (!state.isHost || state.demo) return;
  const message = { type: 'state', state: exportPublicState() };
  for (const conn of hostConnections.values()) if (conn.open) try { conn.send(message); } catch (e) { console.warn('Falha ao sincronizar com jogador', e); }
}

async function startRound() {
  if (!state.isHost || hostFinishing) return;
  if (state.phase !== 'lobby' && state.phase !== 'results') return;
  hostFinishing = true;
  try {
    state.theme = await chooseTheme();
    state.round++;
    state.drawings = {}; state.submittedCount = 0; state.votes = {}; state.results = []; state.votedCount = 0; state.localVote = null; state.voteDeadline = 0;
    localDrawn = false; endedTimer = false;
    state.countdownUntil = Date.now() + 3000;
    state.deadline = 0;
    state.phase = 'countdown';
    if (state.demo) {
      for (const p of state.players) {
        if (p.id !== state.selfId) state.drawings[p.id] = makeDemoDrawing(p.name, state.theme, state.players.indexOf(p));
      }
    }
    lastScreen = null; broadcastState(); render();
    setTimeout(beginDrawingAfterCountdown, Math.max(0, state.countdownUntil - Date.now()));
  } catch (e) { showToast('Não foi possível carregar os temas. Verifique os arquivos do jogo.'); console.error('Falha no sorteio de temas:', e); }
  finally { hostFinishing = false; }
}

function beginDrawingAfterCountdown() {
  if (!state.isHost || state.phase !== 'countdown' || Date.now() < state.countdownUntil) return;
  state.phase = 'drawing'; state.countdownUntil = 0;
  state.deadline = state.duration > 0 ? Date.now() + state.duration * 1000 : 0;
  lastScreen = null; broadcastState(); render();
}

function renderCountdown() {
  app.innerHTML = `<section class="card main-panel countdown-screen animate-screen" aria-live="polite"><div class="countdown-content"><div class="countdown-tag">${roundLabel()}</div><h1>Prepare o lápis!</h1><p>O tema vai aparecer para todo mundo ao mesmo tempo.</p><div class="countdown-focus"><div class="countdown-number pop" id="countdownNumber" aria-label="Contagem regressiva">3</div></div><div class="countdown-caption">Valendo em instantes</div></div></section>`;
}

function allSubmitted() { return connectedPlayers().every(p => !!state.drawings[p.id]); }

function hostReceiveDrawing(id, image) {
  if (!['drawing', 'ending'].includes(state.phase) || typeof image !== 'string' || !/^data:image\/(webp|png|jpeg);base64,/.test(image) || image.length > 750000) return;
  if (state.drawings[id]) return;
  state.drawings[id] = image;
  broadcastState();
  if (allSubmitted()) showGallery();
}

function showGallery() {
  if (!state.isHost || !['drawing', 'ending'].includes(state.phase)) return;
  if (!allSubmitted()) return;
  state.phase = 'gallery'; state.localVote = null; state.voteDeadline = Date.now() + VOTING_SECONDS * 1000;
  endedTimer = false; broadcastState(); lastScreen = null; render();
}

function castVote(target, kind = 'like') {
  if (state.phase !== 'gallery' || Date.now() >= state.voteDeadline || !['like', 'dislike'].includes(kind) || target === state.selfId || !state.drawings[target]) return;
  const alreadySelected = selectedReaction(target, kind);
  const nextReaction = alreadySelected ? null : { target, kind };
  playSound(nextReaction ? 'vote' : 'unvote');
  state.localVote = nextReaction;
  if (state.isHost) hostReceiveVote(state.selfId, nextReaction);
  else if (guestConnection?.open) guestConnection.send({ type: 'vote', target: nextReaction });
  syncGalleryVoteUI();
  updateLiveUI();
}

function hostReceiveVote(voterId, reaction) {
  if (state.phase !== 'gallery' || Date.now() >= state.voteDeadline || !connectedPlayers().some(p => p.id === voterId)) return;
  // Compatibilidade com versões anteriores: um ID simples equivale a curtir.
  if (typeof reaction === 'string') reaction = { target: reaction, kind: 'like' };
  if (reaction !== null) {
    if (!reaction || typeof reaction !== 'object' || !['like', 'dislike'].includes(reaction.kind) ||
        typeof reaction.target !== 'string' || voterId === reaction.target || !state.drawings[reaction.target]) return;
  }
  if (reaction === null) delete state.votes[voterId];
  else state.votes[voterId] = { target: reaction.target, kind: reaction.kind };
  state.votedCount = Object.keys(state.votes).length;
  broadcastState();
}

function finishVoting() {
  if (!state.isHost || state.phase !== 'gallery' || Date.now() < state.voteDeadline) return;
  state.results = rankResults();
  if (state.results.length) { const high = state.results[0].net; for (const r of state.results) { if (r.net === high && high > 0) state.scores[r.id] = (state.scores[r.id] || 0) + 1; } }
  state.phase = 'results'; broadcastState(); lastScreen = null; render();
}

function startDemo() {
  const name = getNickname() || 'Você'; rememberName(name);
  resetRoom({ name, room: 'DEMO1', demo: true, isHost: true, id: 'demo-self' });
  state.players.push({ id: 'demo-lia', name: 'Lia', connected: true }, { id: 'demo-joao', name: 'João', connected: true }, { id: 'demo-bia', name: 'Bia', connected: true });
  render(); showToast('Modo demonstração: teste o desenho e a votação.');
}

function makeDemoDrawing(name, theme, index) {
  const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 520;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 900, 520);
  const palette = [['#ee8c9e', '#7455b9'], ['#f2b65b', '#43bca8'], ['#89bcea', '#fd919d'], ['#c7a2ec', '#6ca74f']];
  const [main, detail] = palette[index % palette.length];
  const cx = 420 + index * 18, cy = 260 - index * 10;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate((index - 2) * .075);
  ctx.fillStyle = main; ctx.strokeStyle = '#372a4a'; ctx.lineWidth = 9; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-110, -122); ctx.bezierCurveTo(-180, -94, -155, 66, -106, 115); ctx.bezierCurveTo(-40, 182, 113, 149, 129, 43); ctx.bezierCurveTo(144, -91, 53, -144, -110, -122); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-48, -30, 28, 40, 0, 0, Math.PI * 2); ctx.ellipse(49, -30, 28, 40, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#342641'; ctx.beginPath(); ctx.arc(-36, -20, 11, 0, Math.PI * 2); ctx.arc(38, -20, 11, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = detail; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 18, 56, .15, Math.PI - .2); ctx.stroke(); ctx.restore();
  return canvas.toDataURL('image/webp', .65);
}

timerInterval = setInterval(updateLiveUI, 210);
updateSoundButton();
// Desbloqueio de áudio pelo gesto do usuário (requisito dos navegadores).
// Não inicia reprodução automática nem adiciona música de fundo.
document.addEventListener('pointerdown', () => sfx?.unlock(), { passive: true });
document.addEventListener('keydown', () => sfx?.unlock(), { passive: true });
$('#soundButton').onclick = () => {
  const muted = sfx.setMuted(!sfx.muted);
  updateSoundButton();
  if (!muted) playSound('enabled');
  showToast(muted ? 'Efeitos sonoros desativados.' : 'Efeitos sonoros ativados.');
};
document.addEventListener('click', ev => {
  const button = ev.target.closest('button');
  if (!button || button.disabled || button.id === 'soundButton' || button.classList.contains('vote-action') ||
      ['submitDrawing', 'startRound', 'nextRound'].includes(button.id)) return;
  playSound('click');
}, { capture: true });
$('#brand').addEventListener('click', ev => ev.preventDefault());
$('#homeButton').onclick = () => leaveRoom();

/* Modal: Como jogar */
const helpModal = $('#helpModal');
$('#helpButton').onclick = () => helpModal.showModal();
$('#helpClose').onclick = () => helpModal.close();
$('#helpDone').onclick = () => helpModal.close();
helpModal.addEventListener('click', ev => { if (ev.target === helpModal) helpModal.close(); });

/* Modal: Confirmar saída para o início */
const leaveModal = $('#leaveModal');
if (leaveModal) {
  $('#leaveClose').onclick = () => leaveModal.close();
  $('#leaveCancel').onclick = () => leaveModal.close();
  $('#leaveConfirm').onclick = () => leaveRoom(true);
  leaveModal.addEventListener('click', ev => { if (ev.target === leaveModal) leaveModal.close(); });
}

document.addEventListener('click', ev => {
  if (colorPopoverOpen && !ev.target.closest('#colorPopover') && !ev.target.closest('#customColorBtn')) {
    toggleColorPopover(false);
  }
  if (ev.target.closest('.setting-choice')) return;
  $$('.setting-menu').forEach(menu => menu.hidden = true);
  $$('.setting-trigger').forEach(button => button.setAttribute('aria-expanded', 'false'));
});

window.addEventListener('resize', () => {
  if (colorPopoverOpen) positionColorPopover();
});

document.addEventListener('keydown', ev => {
  if (state.phase === 'drawing' && !localDrawn && (ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.target.closest('input,textarea,[contenteditable="true"]')) {
    const key = ev.key.toLowerCase();
    if (key === 'z' && ev.shiftKey) { ev.preventDefault(); redoDrawing(); return; }
    if (key === 'z') { ev.preventDefault(); undoDrawing(); return; }
    if (key === 'r' || key === 'y') { ev.preventDefault(); redoDrawing(); return; }
  }
  if (ev.key !== 'Escape') return;
  if (colorPopoverOpen) toggleColorPopover(false);
  $$('.setting-menu').forEach(menu => menu.hidden = true);
  $$('.setting-trigger').forEach(button => button.setAttribute('aria-expanded', 'false'));
});

showHome();