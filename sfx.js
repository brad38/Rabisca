/* Rabisca — efeitos sonoros sintetizados localmente (Web Audio API).
   Sem música de fundo, sem arquivos de terceiros, sem dependências.
   O navegador só libera áudio após a primeira interação do jogador. */
(() => {
  'use strict';
  const STORAGE_KEY = 'rabisca_sfx_muted';
  let muted = false;
  try { muted = localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) {}
  let context = null;
  let output = null;
  const supported = Boolean(window.AudioContext || window.webkitAudioContext);
  const active = new Set();

  function init() {
    if (!supported) return null;
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        context = new Audio();
        output = context.createGain();
        output.gain.value = 0.43;
        output.connect(context.destination);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    } catch (_) { return null; }
  }

  function note(frequency, offset = 0, duration = 0.08, volume = 0.2, type = 'sine', endFrequency = frequency) {
    if (!context || !output) return;
    const t = context.currentTime + offset;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(30, frequency), t);
    if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), t + duration);
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + Math.min(0.013, duration * 0.18));
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); active.delete(oscillator); };
    active.add(oscillator);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.012);
  }

  function play(kind, value) {
    if (muted || document.hidden || !init()) return false;
    // Ganhos conservadores: sons curtos, sem áudio contínuo nem música.
    switch (kind) {
      case 'click':
        note(510, 0, .055, .075, 'sine', 360); break;
      case 'join':
        note(523.25, 0, .14, .17, 'sine');
        note(783.99, .105, .22, .14, 'triangle'); break;
      case 'countdown': {
        const n = Math.max(1, Math.min(3, Number(value) || 3));
        note([880, 730, 600][n - 1], 0, .125, .22, 'sine');
        break;
      }
      case 'start':
        note(523.25, 0, .18, .16, 'triangle');
        note(659.25, .10, .18, .16, 'triangle');
        note(783.99, .20, .26, .20, 'sine'); break;
      case 'lastSeconds':
        note(790, 0, .07, .11, 'sine'); break;
      case 'voteSeconds':
        note(600, 0, .055, .07, 'sine'); break;
      case 'submit':
        note(450, 0, .13, .13, 'triangle', 640);
        note(790, .1, .21, .17, 'sine'); break;
      case 'gallery':
        note(520, 0, .22, .16, 'triangle', 650);
        note(780, .10, .24, .13, 'sine');
        note(1046.5, .20, .33, .14, 'sine'); break;
      case 'vote':
        note(730, 0, .09, .14, 'sine');
        note(980, .055, .16, .11, 'triangle'); break;
      case 'unvote':
        note(640, 0, .09, .10, 'sine', 420); break;
      case 'results':
        note(523.25, 0, .24, .13, 'triangle');
        note(659.25, .09, .26, .14, 'triangle');
        note(783.99, .18, .35, .16, 'sine');
        note(1046.5, .32, .46, .12, 'sine'); break;
      case 'enabled':
        note(659.25, 0, .10, .14, 'sine');
        note(987.77, .07, .18, .15, 'sine'); break;
      default: return false;
    }
    return true;
  }

  function setMuted(value) {
    muted = Boolean(value);
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch (_) {}
    if (output && context) output.gain.setTargetAtTime(muted ? 0 : .43, context.currentTime, .015);
    return muted;
  }

  window.RabiscaSfx = Object.freeze({
    play, unlock: init, setMuted,
    get muted() { return muted; },
    get supported() { return supported; }
  });
})();
