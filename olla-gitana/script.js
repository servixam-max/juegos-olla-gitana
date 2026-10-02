/**
 * Olla Gitana: El Juego - Visual & Gameplay Overhaul v6
 * Author: Subagent (OpenClaw)
 * Date: 2026-02-16
 */

// --- CONFIGURATION ---
const CONFIG = {
    GAME_WIDTH: window.innerWidth,
    GAME_HEIGHT: window.innerHeight,
    PLAYER_WIDTH: 100,
    PLAYER_HEIGHT: 70, 
    POT_MARGIN: 10, // margen inferior de la olla (se recalcula en resize)
    ITEM_SIZE: 55, // Slightly larger
    SPAWN_RATE: 70,
    LEVEL_THRESHOLD: 200,
    MAX_LIVES: 3,
    MAX_LEVELS: 20,
    
    DIFFICULTY: {
        easy: { speed: 1.5, accel: 0.2, prefix: '[E]', label: 'FÁCIL 🐢', 
            classes: 'from-green-400 to-green-600 shadow-[0_6px_0_#15803d] active:shadow-[0_2px_0_#15803d]' },
        normal: { speed: 3, accel: 0.5, prefix: '[N]', label: 'NORMAL 🥘', 
            classes: 'from-blue-400 to-blue-600 shadow-[0_6px_0_#1d4ed8] active:shadow-[0_2px_0_#1d4ed8]' },
        hard: { speed: 5.5, accel: 0.8, prefix: '[H]', label: 'DIFÍCIL 🔥', 
            classes: 'from-red-400 to-red-600 shadow-[0_6px_0_#b91c1c] active:shadow-[0_2px_0_#b91c1c]' }
    }
};

// --- ASSETS ---
const PUMPKIN_KEY = 'TOTANERA';
const ZARANGOLLO_KEY = 'ZARANGOLLO';
const MUSHROOM_KEY = '🍄';
const LEMON_KEY = '🍋';

const ASSETS = {
    GOOD_BASE: [PUMPKIN_KEY, '🍐', '🌿'],
    BAD_BASE: ['💊', '💉'],
    GOOD_EXTRAS: ['🧆', '🌶️', '🥔', '🥖', '🥕', '🧅', '🧄', '🍅', '🍆', '🌽', '🍄', '🥦', '🥒', '🥬', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥗', '🍲', '🥣'],
    BAD_EXTRAS: ['🚬', '💩', '💀', '💣', '🦠', '🧫', '🩸', '🦴', '🕷️', '🦂', '🦟', '🪰', '🪳', '🐜', '🐌', '🐛', '🤢', '🤮', '👺', '👹'],

    BACKGROUNDS: {
        START: "url('background.jpg')",
        GAME: [
            "url('bg_1.jpg')", "url('bg_2.jpg')", "url('bg_3.jpg')", "url('bg_4.jpg')", "url('bg_5.jpg')",
            "url('bg_6.jpg')", "url('bg_7.jpg')", "url('bg_8.jpg')", "url('bg_9.jpg')", "url('bg_10.jpg')",
            "url('bg_11.jpg')", "url('bg_12.jpg')", "url('bg_13.jpg')", "url('bg_14.jpg')"
        ]
    },

    TEXTS: {
        LEVEL_UP: [
            "¡Acho, qué bueno!", "¡Picoesquina!", "¡Vaya tela!", "¡Ole tu pijo!", 
            "¡Menudo estropicio!", "¡Arrea!", "¡Zarangollo Power!", "¡Gusa!", 
            "¡Llimón!", "¡Paparajote!", "¡Zagala, dale!", "¡A la fresca!", 
            "¡Sobaquillo!", "¡Encaramarse!", "¡Esclafarse!", "¡Follonero!", 
            "¡Emperifollá!", "¡Miaja!", "¡Panizo!", "¡Tira p'alante!"
        ],
        GAME_OVER: ["¡Ojete calor!", "¡Menudo pijo!", "¡Gambitero!", "¡Te has 'quedao' pajarito!", "¡Acho, pijo, huevo!", "¡Se te ha ido la olla!"],
        GOOD_HIT: ["¡Toma!", "¡Ole!", "¡Acho!", "¡Dale!", "¡Rico!", "¡Ñam!", "¡Sabor!", "¡Murcia!", "¡Huerta!", "¡Fresco!"]
    }
};

// --- VISUAL FX ENGINE ---
// cache de fonts por tamaño (evita generar strings cada frame)
const FONT_CACHE = {};
const VFX = {
    particles: [],
    foregroundClouds: [],
    floatingTexts: [],

    init: function() {
        this.particles = [];
        this.foregroundClouds = [];
        this.floatingTexts = [];
    },

    spawnConfetti: function(x, y) {
        const colors = ['#FFD700', '#FF4500', '#32CD32', '#1E90FF', '#FF69B4'];
        const n = PERF.lowQuality ? 10 : 20; // menos confeti en gama baja
        for (let i = 0; i < n; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 1.5) * 15,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1.0,
                decay: 0.02 + Math.random() * 0.02,
                type: 'confetti',
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.2
            });
        }
    },

    spawnSmoke: function(x, y) {
        const n = PERF.lowQuality ? 5 : 10;
        for (let i = 0; i < n; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 5,
                vy: -Math.random() * 5,
                size: Math.random() * 20 + 10,
                life: 1.0,
                decay: 0.015,
                type: 'smoke'
            });
        }
    },

    spawnText: function(x, y, text, color = '#FFF', size = 30) {
        this.floatingTexts.push({
            x: x,
            y: y,
            text: text,
            color: color,
            size: size,
            life: 1.0,
            vy: -2
        });
    },

    update: function() {
        // Spawn Fire (Constant at bottom) - Reduced intensity
        if(state.isRunning && !state.isPaused) {
            // menos partículas en calidad baja (shadowBlur + muchos draw calls cargan la GPU)
            const fireCount = PERF.lowQuality ? 1 : 2;
            const cap = PERF.lowQuality ? 60 : 140;
            if (this.particles.length < cap) {
                for(let i=0; i<fireCount; i++) {
                    this.particles.push({
                        x: Math.random() * CONFIG.GAME_WIDTH,
                        y: CONFIG.GAME_HEIGHT,
                        vx: (Math.random() - 0.5) * 1.5,
                        vy: -1 - Math.random() * 2, // Slower Upward
                        size: Math.random() * 6 + 3, // Smaller
                        life: 0.8, // Shorter life
                        decay: 0.03 + Math.random() * 0.03,
                        type: 'fire',
                        color: Math.random() > 0.5 ? 'rgba(255, 69, 0, 0.5)' : 'rgba(255, 215, 0, 0.5)' // Lower Opacity
                    });
                }
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;

            if (p.type === 'confetti') {
                p.vy += 0.5; // Gravity
                p.rotation += p.rotSpeed;
            } else if (p.type === 'smoke') {
                p.size += 0.5; // Expand
                p.vy *= 0.95; // Slow down
            } else if (p.type === 'fire') {
                p.size *= 0.95; // Shrink
                p.x += Math.sin(state.frames * 0.1 + p.y * 0.01) * 0.5; // Wiggle
            }

            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // Update floating texts
        if (!this.floatingTexts) this.floatingTexts = [];
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            let t = this.floatingTexts[i];
            t.y += t.vy;
            t.life -= 0.02;
            if (t.life <= 0) this.floatingTexts.splice(i, 1);
        }

        // Update clouds
        for(let cloud of this.foregroundClouds) {
            cloud.x -= cloud.speed;
            if(cloud.x + cloud.size < 0) {
                cloud.x = CONFIG.GAME_WIDTH + cloud.size;
                cloud.y = CONFIG.GAME_HEIGHT - Math.random() * 150;
            }
        }
    },

    draw: function(ctx) {
        // Draw Particles
        for (let p of this.particles) {
            ctx.save();
            ctx.globalAlpha = p.life;
            if (p.type === 'confetti') {
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
            } else if (p.type === 'smoke') {
                ctx.fillStyle = `rgba(100, 100, 100, ${p.life * 0.5})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'fire') {
                if (!PERF.lowQuality) {
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = p.color;
                }
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // Draw Floating Texts
        for (let i = 0; i < this.floatingTexts.length; i++) {
            const t = this.floatingTexts[i];
            ctx.save();
            ctx.globalAlpha = t.life;
            ctx.fillStyle = t.color;
            // font cacheado (crear el string cada frame con template literal no es gratis)
            const key = t.size | 0;
            let f = FONT_CACHE[key];
            if (!f) f = FONT_CACHE[key] = `bold ${key}px 'Luckiest Guy', sans-serif`;
            ctx.font = f;
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillText(t.text, t.x, t.y);
            ctx.restore();
        }

        // Draw Foreground Clouds (Fog) - Removed
    }
};

// --- AUDIO ENGINE ---
const AudioEngine = {
    ctx: null,
    musicElement: null,
    badHitElement: null, 
    levelUpSpecialElement: null,
    isMusicEnabled: false,

    init: function() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) this.ctx = new AudioContext();
        }
        
        // Prevent multiple initializations of music element reference
        if (!this.musicElement) {
             this.musicElement = document.getElementById('bgMusic');
        }

        if (!this.badHitElement) {
            this.badHitElement = new Audio('hit.mp3'); 
            this.badHitElement.volume = 0.8;
        }

        if (!this.levelUpSpecialElement) {
            this.levelUpSpecialElement = new Audio('levelup_special.mp3');
            this.levelUpSpecialElement.volume = 1.0;
            this.levelUpSpecialElement.load(); // Preload
        }
    },

    toggleMusic: function() {
        if (!this.musicElement) this.init();
        
        if (this.musicElement.paused) {
            this.musicElement.play().then(() => {
                this.isMusicEnabled = true;
                this.updateUI(true);
            }).catch(e => console.warn("Audio blocked:", e));
        } else {
            this.musicElement.pause();
            this.isMusicEnabled = false;
            this.updateUI(false);
        }
    },

    ensureMusicPlaying: function() {
        // si el jugador apagó el sonido en otro juego, no le arrancamos la música
        if (window.__arcadeSoundOff) return;
        if (this.musicElement && this.musicElement.paused) {
            this.musicElement.play().then(() => {
                this.isMusicEnabled = true;
                this.updateUI(true);
            }).catch(e => console.log("Autoplay blocked until interaction"));
        }
    },

    updateUI: function(isPlaying) {
        const hudBtn = document.getElementById('musicToggle');
        const startBtn = document.getElementById('startMusicToggle');
        
        const icon = isPlaying ? "🔊" : "🔇";
        const colorClass = isPlaying ? "bg-gray-800/90" : "bg-red-500";

        if (hudBtn) {
            hudBtn.innerText = icon;
            hudBtn.className = `pointer-events-auto text-white rounded-full w-10 h-10 flex items-center justify-center border-2 border-gray-500 hover:bg-gray-700 transition-colors shadow-lg ml-2 ${colorClass}`;
        }
        if (startBtn) {
            startBtn.innerHTML = `<span>${isPlaying ? '🔊' : '🎵'}</span> ${isPlaying ? 'Música: ON' : 'Música: OFF'}`;
            if (isPlaying) {
                startBtn.classList.remove('bg-purple-600', 'hover:bg-purple-500', 'animate-pulse');
                startBtn.classList.add('bg-green-600', 'hover:bg-green-500');
            } else {
                startBtn.classList.remove('bg-green-600', 'hover:bg-green-500');
                startBtn.classList.add('bg-purple-600', 'hover:bg-purple-500');
            }
        }
    },

    /* ---------- Síntesis mejorada (2026-09) ----------
       Antes: un solo oscilador con envelope duro (sonaba sintético).
       Ahora: 2 osciladores desafinados + filtro + envolvente ADSR suave. */
    _blip: function(opts) {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        const {
            type = 'triangle', f0 = 880, f1 = null, dur = 0.22, vol = 0.16,
            detune = 6, filter = 2600, q = 1, second = null, delay = 0
        } = opts || {};
        const t0 = this.ctx.currentTime + delay;
        const out = this.ctx.createGain();
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = filter; lp.Q.value = q;
        lp.connect(out); out.connect(this.ctx.destination);
        // envolvente: ataque corto, caída exponencial (suena a instrumento, no a pitido)
        out.gain.setValueAtTime(0.0001, t0);
        out.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
        out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        const mk = (freq, det) => {
            const o = this.ctx.createOscillator();
            o.type = type; o.frequency.setValueAtTime(freq, t0);
            if (det) o.detune.value = det;
            if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur * 0.9);
            o.connect(lp); o.start(t0); o.stop(t0 + dur + 0.03);
            return o;
        };
        mk(f0, 0);
        if (detune) mk(f0, detune);
        if (second) setTimeout(() => this._blip(second), (delay + second.at) * 1000);
    },

    playTone: function(type) {
        if (!this.ctx) this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});

        if (type === 'good') {
            // nota musical corta y dulce (sabor a "coger fruta")
            this._blip({ type: 'triangle', f0: 660, f1: 990, dur: 0.16, vol: 0.13, filter: 3200, detune: 8 });
        } else if (type === 'heart') {
            // arpegio ascendente de 3 notas
            this._blip({ type: 'triangle', f0: 784, dur: 0.16, vol: 0.13, filter: 2800 });
            this._blip({ type: 'triangle', f0: 988, dur: 0.18, vol: 0.12, filter: 2800, delay: 0.10 });
            this._blip({ type: 'triangle', f0: 1319, dur: 0.24, vol: 0.11, filter: 2800, delay: 0.20 });
        } else if (type === 'levelup') {
            // fanfarria corta al subir de nivel
            [0, .10, .20, .32].forEach((d, i) => {
                const f = [523, 659, 784, 1046][i];
                this._blip({ type: 'square', f0: f, dur: i === 3 ? 0.35 : 0.16, vol: 0.085, filter: 2200, delay: d, detune: 4 });
            });
        } else if (type === 'zen') {
            this._blip({ type: 'sine', f0: 523, dur: 0.3, vol: 0.12, filter: 1800, second: { at: 0.18, type: 'sine', f0: 784, dur: 0.4, vol: 0.09 } });
        } else if (type === 'bad') {
            // SIEMPRE el audio del usuario (regla del proyecto)
            if (this.badHitElement) {
                this.badHitElement.currentTime = 0;
                this.badHitElement.play().catch(() => this.playSynthBad());
            } else {
                this.playSynthBad();
            }
        }
    },

    playLevelUp: function(level) {
        const specialLevels = [5, 10, 15, 20];
        if (specialLevels.includes(level)) {
             if (this.levelUpSpecialElement) {
                this.levelUpSpecialElement.currentTime = 0;
                this.levelUpSpecialElement.play().catch(console.warn);
             }
        }
    },

    playSynthBad: function() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        const now = this.ctx.currentTime;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
};

// --- STATE ---
let state = {
    isRunning: false,
    isPaused: false,
    score: 0,
    lives: CONFIG.MAX_LIVES,
    level: 1,
    speed: 0, 
    acceleration: 0,
    difficulty: 'normal',
    frames: 0,
    items: [],
    playerX: CONFIG.GAME_WIDTH / 2 - CONFIG.PLAYER_WIDTH / 2,
    lastPlayerX: CONFIG.GAME_WIDTH / 2 - CONFIG.PLAYER_WIDTH / 2,
    playerVelocity: 0,
    heartSpawnedForLevel: false,
    lastBgIndex: -1,
    levelUpPause: false, // New state for Level Up pause
    isDragging: false // For Pot Feedback
};

let currentDiffIndex = 1; // 0: Easy, 1: Normal, 2: Hard
const difficultyKeys = ['easy', 'normal', 'hard'];

// --- DOM ELEMENTS ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
// cachés de render (se invalidan al cambiar tamaño/DPR)
let POT_GRAD = null, POT_GRAD_X = -999, POT_GRAD_Y = -999;
let HEART_GRAD = null, HEART_GRAD_X = -999, HEART_GRAD_Y = -999, HEART_GRAD_SIZE = -1;
let ZAR_GRAD = null, ZAR_GRAD_X = -999, ZAR_GRAD_Y = -999, ZAR_GRAD_SIZE = -1;
let PUMP_GRAD = null, PUMP_GRAD_X = -999, PUMP_GRAD_Y = -999, PUMP_GRAD_SIZE = -1;
let SPOT_GRAD = null, SPOT_GRAD_X = -999, SPOT_GRAD_Y = -999, SPOT_GRAD_W = -1, SPOT_GRAD_H = -1;
function invalidateRenderCaches() {
    POT_GRAD = null; HEART_GRAD = null; ZAR_GRAD = null; PUMP_GRAD = null; SPOT_GRAD = null;
}
const hud = document.getElementById('hud');
const scoreDisplay = document.getElementById('scoreDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const levelDisplay = document.getElementById('levelDisplay');
const musicToggle = document.getElementById('musicToggle');
// respetar el sonido que el jugador ya eligió en otros juegos
try {
    const pr0 = ollaPrefsArcade();
    if (pr0.sound === false) { AudioEngine.isMusicEnabled = false; window.__arcadeSoundOff = true; setTimeout(() => AudioEngine.updateUI && AudioEngine.updateUI(false), 60); }
} catch (e) {}
const startMusicToggle = document.getElementById('startMusicToggle');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const pauseScreen = document.getElementById('pauseScreen');
const rankingScreen = document.getElementById('rankingScreen');
const victoryScreen = document.getElementById('victoryScreen'); // New
const levelUpMsg = document.getElementById('levelUpMsg');
const newLevelNum = document.getElementById('newLevelNum');
const finalScoreDisplay = document.getElementById('finalScore');
const finalScoreVictoryDisplay = document.getElementById('finalScoreVictory'); // New
const leaderboardBody = document.getElementById('leaderboardBody');
const fullLeaderboardBody = document.getElementById('fullLeaderboardBody');
const submitScoreBtn = document.getElementById('submitScoreBtn');
const submitScoreBtnVictory = document.getElementById('submitScoreBtnVictory'); // New
const playerNameInput = document.getElementById('playerName');
const playerNameInputVictory = document.getElementById('playerNameVictory'); // New
const backToMenuBtn = document.getElementById('backToMenuBtn'); // New
const instructionsModal = document.getElementById('instructionsModal');
const difficultyToggle = document.getElementById('difficultyToggle');

// --- RESIZE ---
function getPotMargin(h) {
    // En vertical, la barra de gestos/toolbar del móvil tapa el borde inferior:
    // subimos la olla un % de la pantalla para que se vea entera (60-110 px)
    if (h < window.innerWidth) return 12;                 // apaisado: casi pegada abajo
    return Math.round(Math.min(110, Math.max(60, h * 0.09)));
}

function resize() {
    const w = window.innerWidth;
    const h = Math.round((window.visualViewport && window.visualViewport.height) || window.innerHeight);
    // DPR adaptativo: renderiza a resolución de CSS escalada (los móviles gama baja
    // no pueden rellenar 1170x2532 píxeles a 60fps)
    const scale = (typeof PERF !== 'undefined' && PERF.scale) ? PERF.scale : 1;
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    // si se renderiza por debajo de la resolución CSS, mejor suavizado que píxeles duros
    canvas.style.imageRendering = scale < 1 ? 'auto' : 'pixelated';
    CONFIG.GAME_WIDTH = w;
    CONFIG.GAME_HEIGHT = h;
    CONFIG.POT_MARGIN = getPotMargin(h);
    if (state.playerX > CONFIG.GAME_WIDTH - CONFIG.PLAYER_WIDTH) {
        state.playerX = CONFIG.GAME_WIDTH - CONFIG.PLAYER_WIDTH;
    }
}
window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));
resize();

// --- BACKGROUNDS ---
function setBackground(type) {
    let bg;
    if (type === 'start' || type === 'gameover') {
        bg = ASSETS.BACKGROUNDS.START;
    } else {
        // Pick random game bg avoiding repetition
        let idx;
        const bgs = ASSETS.BACKGROUNDS.GAME;
        do {
            idx = Math.floor(Math.random() * bgs.length);
        } while (idx === state.lastBgIndex && bgs.length > 1);
        
        state.lastBgIndex = idx;
        bg = bgs[idx];
    }
    document.body.style.backgroundImage = bg;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
}

// --- RENDIMIENTO (móviles de gama baja/media) ---
// DPR adaptativo: si el FPS baja de ~50 se reduce la resolución de render
// (0.75x) y se recupera (1x/1.5x/2x) cuando el FPS vuelve a subir.
var PERF = {
    levels: [0.75, 1, 1.5, 2],
    idx: 1,          // nivel actual (1 = DPR 1)
    maxIdx: 1,       // tope según pantalla (nunca más nítido que la pantalla)
    scale: 1,
    fps: 60,
    frames: 0,
    acc: 0,
    last: 0,
    low: 0,          // ventanas seguidas con FPS bajo
    high: 0,         // ventanas seguidas con FPS alto
    lowQuality: false, // modo efectos reducidos
    changes: []      // historial para QA
};
function perfInit() {
    const dpr = window.devicePixelRatio || 1;
    PERF.maxIdx = dpr >= 2 ? 3 : (dpr >= 1.5 ? 2 : 1);
    PERF.idx = Math.min(1, PERF.maxIdx);
    PERF.scale = PERF.levels[PERF.idx];
    if (navigator.deviceMemory && navigator.deviceMemory <= 4 && PERF.idx > 0) {
        // móviles con poca RAM: arranca ya en calidad ligera
        PERF.idx = 0; PERF.scale = PERF.levels[0];
    }
}
function applyPerfScale() {
    PERF.scale = PERF.levels[PERF.idx];
    PERF.changes.push({ t: Date.now(), idx: PERF.idx, scale: PERF.scale, fps: Math.round(PERF.fps) });
    if (PERF.changes.length > 40) PERF.changes.shift();
    if (typeof invalidateRenderCaches === 'function') invalidateRenderCaches();
    if (typeof resize === 'function') resize();
}
function perfTick(tsMs) {
    if (!tsMs || PERF.last === 0) { PERF.last = tsMs || 0; return; }
    const d = tsMs - PERF.last;
    PERF.last = tsMs;
    if (d <= 0 || d > 1000) return;
    PERF.acc += d; PERF.frames++;
    if (PERF.frames >= 50) {
        const fps = 1000 / (PERF.acc / PERF.frames);
        PERF.fps = fps; PERF.frames = 0; PERF.acc = 0;
        if (fps < 50) {
            PERF.low++; PERF.high = 0;
            if (PERF.low >= 3 && PERF.idx > 0) { PERF.idx--; PERF.low = 0; applyPerfScale(); }
        } else if (fps > 56) {
            PERF.high++; PERF.low = 0;
            if (PERF.high >= 8 && PERF.idx < PERF.maxIdx) { PERF.idx++; PERF.high = 0; applyPerfScale(); }
        } else { PERF.low = 0; PERF.high = 0; }
        // efectos reducidos con histéresis (evita parpadeos de calidad)
        if (fps < 50) PERF.lowQuality = true;
        else if (fps > 57) PERF.lowQuality = false;
    }
}

// --- GAME LOGIC ---
function getItemPool() {
    const goodCount = Math.min(ASSETS.GOOD_EXTRAS.length, state.level - 1);
    const badCount = Math.min(ASSETS.BAD_EXTRAS.length, state.level - 1);
    const currentGood = [...ASSETS.GOOD_BASE, ...ASSETS.GOOD_EXTRAS.slice(0, goodCount)];
    const currentBad = [...ASSETS.BAD_BASE, ...ASSETS.BAD_EXTRAS.slice(0, badCount)];
    return { good: currentGood, bad: currentBad };
}

function handleInput(x) {
    if (state.isPaused || !state.isRunning || state.levelUpPause) return;
    let targetX = x - CONFIG.PLAYER_WIDTH / 2;
    state.playerX = Math.max(0, Math.min(CONFIG.GAME_WIDTH - CONFIG.PLAYER_WIDTH, targetX));
}

// Event Listeners for Interaction Feedback
canvas.addEventListener('mousedown', e => {
    state.isDragging = true;
    handleInput(e.clientX);
});
canvas.addEventListener('mousemove', e => {
    if (state.isDragging) handleInput(e.clientX);
});
canvas.addEventListener('mouseup', () => {
    state.isDragging = false;
});
canvas.addEventListener('mouseleave', () => {
    state.isDragging = false;
});

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    state.isDragging = true;
    handleInput(e.touches[0].clientX);
}, { passive: false });
canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (state.isDragging) handleInput(e.touches[0].clientX);
}, { passive: false });
canvas.addEventListener('touchend', () => {
    state.isDragging = false;
});

function drawPot(x, y, w, h) {
    ctx.save();
    
    // Squash & Stretch Calculation
    // Velocity is mostly difference between frames. 
    // If moving fast, stretch width (scaleX > 1), squash height (scaleY < 1).
    const stretchFactor = Math.min(Math.abs(state.playerVelocity) * 0.005, 0.3);
    
    // Touch Interaction Scale (1.1x when dragging/touching)
    const interactionScale = state.isDragging ? 1.1 : 1.0;

    const scaleX = (1 + stretchFactor) * interactionScale;
    const scaleY = (1 - stretchFactor) * interactionScale;
    
    // Pivot around bottom center
    const centerX = x + w/2;
    const bottomY = y + h;
    
    const tilt = Math.max(-0.16, Math.min(0.16, -state.playerVelocity * 0.004));
    ctx.translate(centerX, bottomY);
    ctx.rotate(tilt);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-centerX, -bottomY);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h - 5, w/2, 10, 0, 0, Math.PI*2);
    ctx.fill();

    // Body - Shiny Metal (gradiente cacheado por posición: crearlo cada frame
    // cuesta caro en gama baja; solo se recrea cuando la olla se mueve)
    let grad = POT_GRAD;
    if (!grad || Math.abs(POT_GRAD_X - x) > 1 || Math.abs(POT_GRAD_Y - y) > 1) {
        grad = POT_GRAD = ctx.createLinearGradient(x, y, x + w, y + h);
        grad.addColorStop(0, '#333');
        grad.addColorStop(0.5, '#666');
        grad.addColorStop(1, '#222');
        POT_GRAD_X = x; POT_GRAD_Y = y;
    }
    ctx.fillStyle = grad;
    
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 10);
    ctx.lineTo(x + w - 10, y + 10);
    ctx.quadraticCurveTo(x + w, y + h, x + w/2, y + h);
    ctx.quadraticCurveTo(x, y + h, x + 10, y + 10);
    ctx.fill();
    // Rim
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + 10, w/2 - 5, 8, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
    // Handles
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#222';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 20);
    ctx.quadraticCurveTo(x - 15, y + 25, x + 12, y + 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - 12, y + 20);
    ctx.quadraticCurveTo(x + w + 15, y + 25, x + w - 12, y + 40);
    ctx.stroke();
    
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.ellipse(x + w/2 - 10, y + h/2, w/4, h/3, -0.2, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
}

// badge ZEN: visible solo durante la partida
function hideZenBadge() {
    const zb = document.getElementById('zenBadgeArcade');
    if (zb) zb.style.display = 'none';
}

function startGame(difficulty) {
    AudioEngine.init();
    AudioEngine.ensureMusicPlaying();
    VFX.init();
    
    const settings = CONFIG.DIFFICULTY[difficulty];
    
    state = {
        isRunning: true,
        isPaused: false,
        score: 0,
        lives: CONFIG.MAX_LIVES,
        level: 1,
        speed: settings.speed,
        acceleration: settings.accel,
        difficulty: difficulty,
        frames: 0,
        items: [],
        playerX: canvas.width / 2 - CONFIG.PLAYER_WIDTH / 2,
        lastPlayerX: canvas.width / 2 - CONFIG.PLAYER_WIDTH / 2,
        playerVelocity: 0,
        heartSpawnedForLevel: false,
        lastBgIndex: -1,
        combo: 0,
        levelUpPause: false,
        lemonSpawnedForLevel: false,
        timeFreeze: 0, // Timer for slow motion
        originalSpeed: 0, // Store speed before slow motion
        isDragging: false, // Reset drag state
        countdown: 0,
        zenMode: ZEN_ARCADE,
        __loopOn: true,
        __lastT: 0,
        __spawnAcc: 0,
        __freezeAcc: 0,
        lemonFreeze: 0
    };

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    rankingScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    
    setBackground('game');
    updateHUD();
// badge ZEN visible durante la partida
if (state.zenMode) {
    let zb = document.getElementById('zenBadgeArcade');
    if (!zb) {
        zb = document.createElement('div');
        zb.id = 'zenBadgeArcade';
        zb.style.cssText = 'position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:40;background:rgba(16,185,129,.92);border:2px solid #fff;border-radius:999px;padding:3px 12px;font-size:11px;font-weight:900;letter-spacing:.06em;color:#fff';
        zb.textContent = '🧘 MODO ZEN';
        document.body.appendChild(zb);
    }
    zb.style.display = 'block';
} else {
    hideZenBadge();
}
    try { logros.check('primera'); logros.count('partidas10'); } catch (e) {}
    // Cuenta atrás: el juego empezaba de golpe y caía fruta enseguida
    state.countdown = 3.0;
    state.items = [];
    window.__arcadeGen = (window.__arcadeGen || 0) + 1; // invalida loops de partidas anteriores
    state.__gen = window.__arcadeGen;
    const gen = state.__gen;
    requestAnimationFrame((t) => gameLoop(t, gen));
}

function togglePause() {
    if (!state.isRunning || state.levelUpPause) return;
    state.isPaused = !state.isPaused;
    if (state.isPaused) {
        pauseScreen.classList.remove('hidden');
    } else {
        pauseScreen.classList.add('hidden');
        if (!state.__loopOn) { state.__loopOn = true; const gen = state.__gen; requestAnimationFrame((t) => gameLoop(t, gen)); }
    }
}

function gameLoop(ts, gen) {
    if (!state.isRunning || state.isPaused) { state.__loopOn = false; return; }
    if (gen !== undefined && gen !== window.__arcadeGen) return; // callback de una partida vieja: no reencolar
    if (state.__gen !== window.__arcadeGen) return; // loop de una partida vieja: no duplicar

    // Delta-time: sin esto el juego corría el DOBLE de rápido en pantallas de 120Hz
    const now = (ts && typeof ts === 'number') ? ts : performance.now();
    let dt = state.__lastT ? (now - state.__lastT) / 16.6667 : 1;
    state.__lastT = now;
    dt = Math.max(0.25, Math.min(3, dt));
    state.dt = dt;
    perfTick(now); // FPS meter + DPR adaptativo

    if (state.countdown > 0) {
        // cuenta atrás 3·2·1 antes de que caiga nada
        const before = Math.ceil(state.countdown);
        state.countdown -= dt / 60;
        const after = Math.ceil(state.countdown);
        if (after !== before && after > 0) AudioEngine.playTone('good');
        if (after === 0) AudioEngine.playTone('heart');
        draw();
        drawCountdown(Math.max(1, after));
        state.frames++;
        requestAnimationFrame((t) => gameLoop(t, gen));
        return;
    }

    if (!state.levelUpPause) {
        update(dt);
    } else if (state.levelUpTimer > 0) {
        // el cartel de subida de nivel se cierra con el reloj del juego,
        // así nunca se queda pegado si el navegador congela los timers
        state.levelUpTimer -= dt / 60;
        if (state.levelUpTimer <= 0) { endLevelUpPause(); }
    }

    // Even if paused by level up, we might want to draw (or just freeze)
    // But since we want to "PAUSE the spawning/movement", we skip update() but call draw()
    // to keep rendering frame.
    draw();
    
    state.frames++;
    requestAnimationFrame((t) => gameLoop(t, gen));
}

function drawCountdown(n) {
    const ctx2 = canvas.getContext('2d');
    const t = 1 - ((3 - Math.max(1, n)) % 1);          // 0..1 para el pulso
    ctx2.save();
    ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
    ctx2.globalAlpha = 0.9;
    ctx2.font = `900 ${Math.round(CONFIG.GAME_HEIGHT * 0.16 * (1 + t * 0.15))}px system-ui`;
    ctx2.lineWidth = 8; ctx2.strokeStyle = 'rgba(0,0,0,.6)';
    ctx2.strokeText(String(n), CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT * 0.44);
    ctx2.fillStyle = '#facc15';
    ctx2.fillText(String(n), CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT * 0.44);
    ctx2.font = `900 ${Math.round(CONFIG.GAME_HEIGHT * 0.028)}px system-ui`;
    ctx2.fillStyle = 'rgba(255,255,255,.9)';
    ctx2.strokeText('¡PREPARAO!', CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT * 0.44 + CONFIG.GAME_HEIGHT * 0.11);
    ctx2.fillText('¡PREPARAO!', CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT * 0.44 + CONFIG.GAME_HEIGHT * 0.11);
    ctx2.restore();
}

function update(dt = 1) {
    // Update physics variables
    state.playerVelocity = (state.playerX - state.lastPlayerX) / dt;
    state.lastPlayerX = state.playerX;
    state.__spawnAcc = (state.__spawnAcc || 0) + dt;
    state.__freezeAcc = (state.__freezeAcc || 0) + dt;

    const spawnRate = Math.max(20, CONFIG.SPAWN_RATE - (state.level * 2));
    // la pausa del limón congela solo el spawn, no el control del jugador
    if (state.lemonFreeze > 0) {
        state.lemonFreeze -= dt / 60;
        state.__spawnAcc = 0; // no acumular: si no, al reanudar saldrían en tromba
    } else {
        while (state.__spawnAcc >= spawnRate) { state.__spawnAcc -= spawnRate; spawnItem(); }
    }

    const potTop = CONFIG.GAME_HEIGHT - CONFIG.PLAYER_HEIGHT - CONFIG.POT_MARGIN;
    const potLeft = state.playerX + 10;
    const potRight = state.playerX + CONFIG.PLAYER_WIDTH - 10;

    // Time Freeze Logic
    let speedMult = 1.0;
    if(state.timeFreeze > 0) {
        speedMult = 0.5;
        state.timeFreeze -= dt;
        if (Math.floor(state.timeFreeze) % 60 === 0) VFX.spawnText(state.playerX, potTop - 50, "❄️", '#fff', 30);
    }

    for (let i = state.items.length - 1; i >= 0; i--) {
        let item = state.items[i];
        const prevY = item.y;
        item.y += item.speed * speedMult * dt;

        // Bobbing Animation Update (sway)
        item.bobOffset = Math.sin(state.frames * 0.05) * 2; 

        // Colisión con "barrido": los items rápidos (zarangollo a nivel alto)
        // cruzaban la ventana de captura en un solo frame y NO contaban.
        // Ahora vale si el centro del item atraviesa la boca de la olla entre frames.
        const itemCenterY = item.y + item.size/2;
        const prevCenterY = prevY + item.size/2;
        const catchBottom = potTop + 20 + item.size/2; // la ventana clásica de 20px
        if (
            itemCenterY > potTop &&
            prevCenterY < catchBottom &&
            item.x + item.size/2 > potLeft &&
            item.x + item.size/2 < potRight
        ) {
            const result = handleCollision(item, i);
            if(result === true) break; // Lemon cleared items
            continue;
        }
        if (item.y > CONFIG.GAME_HEIGHT) {
            // Missed a good item -> reset combo
            if (item.type === 'good' || item.type === 'zarangollo') {
                 if ((state.combo || 0) > 0) {
                     state.combo = 0;
                     updateHUD(); // el chip del combo se quedaba pegado en pantalla
                 }
            }
            state.items.splice(i, 1);
        }
    }

    VFX.update();
}

let ZEN_ARCADE = false;   // se conserva entre partidas (el state se resetea)

function spawnItem() {
    if (state.level % 5 === 0 && !state.heartSpawnedForLevel && Math.random() < 0.15) {
        state.items.push({
            x: Math.random() * (CONFIG.GAME_WIDTH - CONFIG.ITEM_SIZE),
            y: -CONFIG.ITEM_SIZE,
            size: CONFIG.ITEM_SIZE,
            type: 'heart',
            text: '❤️', 
            speed: state.speed * 1.1,
            bobOffset: 0
        });
        state.heartSpawnedForLevel = true;
        return;
    }

    // Giant Lemon (Screen Clear) - Every 4 levels
    if (state.level % 4 === 0 && !state.lemonSpawnedForLevel && Math.random() < 0.20) {
        state.items.push({
            x: Math.random() * (CONFIG.GAME_WIDTH - CONFIG.ITEM_SIZE * 2),
            y: -CONFIG.ITEM_SIZE * 2,
            size: CONFIG.ITEM_SIZE * 2.0, // Scale 2.0
            type: 'lemon',
            text: LEMON_KEY,
            speed: state.speed * 0.8, // Slower due to size
            bobOffset: 0
        });
        state.lemonSpawnedForLevel = true;
        return;
    }

    // Zarangollo Supremo (5% chance)
    if (Math.random() < 0.05) {
        state.items.push({
            x: Math.random() * (CONFIG.GAME_WIDTH - CONFIG.ITEM_SIZE),
            y: -CONFIG.ITEM_SIZE,
            size: CONFIG.ITEM_SIZE * 1.3,
            type: 'zarangollo',
            text: ZARANGOLLO_KEY,
            speed: state.speed * 1.5, // Faster!
            bobOffset: 0
        });
        return;
    }

    // Mushroom (Time Freeze) - 3% chance
    if (Math.random() < 0.03) {
        state.items.push({
            x: Math.random() * (CONFIG.GAME_WIDTH - CONFIG.ITEM_SIZE),
            y: -CONFIG.ITEM_SIZE,
            size: CONFIG.ITEM_SIZE,
            type: 'mushroom',
            text: MUSHROOM_KEY,
            speed: state.speed,
            bobOffset: 0
        });
        return;
    }

    const pool = getItemPool();
    const isBad = !state.zenMode && Math.random() < 0.3;   // en ZEN no caen porquerías
    const sourceArray = isBad ? pool.bad : pool.good;
    // Ensure randomization
    const text = sourceArray[Math.floor(Math.random() * sourceArray.length)];
    const x = Math.random() * (CONFIG.GAME_WIDTH - CONFIG.ITEM_SIZE);
    
    state.items.push({
        x: x, y: -CONFIG.ITEM_SIZE, size: CONFIG.ITEM_SIZE,
        type: isBad ? 'bad' : 'good', text: text,
        speed: state.speed + (Math.random() * 1.5),
        bobOffset: 0
    });
}

function handleCollision(item, index) {
    const cx = item.x + item.size / 2;
    const cy = item.y + item.size / 2;

    state.items.splice(index, 1);
    
    // Calculate Combo Multiplier
    const currentCombo = state.combo || 0;
    const multiplier = 1 + (currentCombo * 0.2); 
    
    if (item.type === 'heart') {
        state.lives++;
        if (state.lives > 5) state.lives = 5; 
        state.combo = (state.combo || 0) + 1;
        AudioEngine.playTone('heart');
        VFX.spawnConfetti(cx, cy); 
        VFX.spawnText(cx, cy - 50, "¡VIDA EXTRA!", '#ff4d4d', 30);
        updateHUD();
        return;
    }

    if (item.type === 'lemon') {
        // Screen Clear Bomb
        state.items = []; // Remove all active items
        state.score += 500;
        AudioEngine.playTone('good');
        
        // Visuals
        VFX.spawnConfetti(cx, cy);
        VFX.spawnText(CONFIG.GAME_WIDTH/2, CONFIG.GAME_HEIGHT/2, "¡COPÓN QUÉ RICO!", '#FFD700', 60);
        
        // Pausa el spawn unos segundos: por reloj del juego, no por setTimeout
        // (el setTimeout real se quedaba colgado y congelaba la partida)
        state.lemonFreeze = 2.0;
        updateHUD(); // los +500 no se veían en el marcador hasta el siguiente bocado
        
        document.body.classList.add('flash-screen');
        setTimeout(() => document.body.classList.remove('flash-screen'), 500);
        return true; // Signal to stop loop
    }

    if (item.type === 'mushroom') {
        // Slow Motion
        state.timeFreeze = 300; // 5 seconds (60fps * 5)
        AudioEngine.playTone('good');
        VFX.spawnConfetti(cx, cy);
        VFX.spawnText(cx, cy - 50, "¡RELAX!", '#e74c3c', 40);
        return;
    }

    if (item.type === 'zarangollo') {
        const pts = Math.floor(50 * multiplier);
        state.score += pts;
        state.combo = (state.combo || 0) + 1;
        AudioEngine.playTone('good');
        VFX.spawnConfetti(cx, cy);
        VFX.spawnText(cx, cy - 50, `¡ZARANGOLLO! +${pts}`, '#FFD700', 40);
        try { logros.count('zarangollo10'); logros.set('combo10', state.combo); logros.set('combo25', state.combo); } catch (e) {}
        if (state.combo > 1) VFX.spawnText(cx, cy - 80, `COMBO x${multiplier.toFixed(1)}`, '#FFD700', 30);
        checkLevelUp();
    } else if (item.type === 'good') {
        const pts = Math.floor(10 * multiplier);
        state.score += pts;
        state.combo = (state.combo || 0) + 1;
        popScoreHUD();
        try { logros.count('items50'); logros.set('combo10', state.combo); logros.set('combo25', state.combo); } catch (e) {}
        AudioEngine.playTone('good');
        VFX.spawnConfetti(cx, cy);
        
        if (state.combo > 1) {
             const phrases = ASSETS.TEXTS.GOOD_HIT;
             // Ensure random pick
             const phrase = phrases[Math.floor(Math.random() * phrases.length)];
             VFX.spawnText(cx, cy - 30, `${phrase} x${multiplier.toFixed(1)}`, '#ffff00', 25 + Math.min(20, state.combo * 2));
        }
        // popup de puntos con el color del combo (sube más alto y más grande con la racha)
        VFX.spawnText(cx, cy - 70, `+${pts}`, multiplier >= 3 ? '#f97316' : multiplier >= 2 ? '#facc15' : '#ffffff', 20 + Math.min(14, state.combo));
        
        checkLevelUp();
    } else {
        state.lives--;
        state.combo = 0; 
        AudioEngine.playTone('bad');
        VFX.spawnSmoke(cx, cy);
        VFX.spawnText(cx, cy - 30, "¡PUAJ!", '#555', 40);
        document.body.classList.add('shake-screen');
        setTimeout(() => document.body.classList.remove('shake-screen'), 500);
        if (state.lives <= 0) gameOver();
    }
    updateHUD();
}

function checkLevelUp() {
    const projectedLevel = Math.floor(state.score / CONFIG.LEVEL_THRESHOLD) + 1;
    
    // Check Victory (Level 21 triggers Win)
    if (projectedLevel > CONFIG.MAX_LEVELS) {
        victory();
        return;
    }

    if (projectedLevel > state.level) {
        state.level = projectedLevel;
        state.speed += state.acceleration; 
        state.heartSpawnedForLevel = false;
        state.lemonSpawnedForLevel = false;
        setBackground('game'); 
        AudioEngine.playLevelUp(state.level);
        AudioEngine.playTone('levelup');
        showLevelUpParams();
    }
}

function victory() {
    state.isRunning = false;
    hud.classList.add('hidden');
    hideZenBadge();
    victoryScreen.classList.remove('hidden');
    
    // Play special victory audio
    if (AudioEngine.levelUpSpecialElement) {
        AudioEngine.levelUpSpecialElement.currentTime = 0;
        AudioEngine.levelUpSpecialElement.play().catch(console.warn);
    }
    
    finalScoreVictoryDisplay.innerText = state.score;
    try {
        logros.set('puntos1k', state.score); logros.set('puntos5k', state.score);
        logros.set('nivel5', state.level); logros.set('nivel10', state.level);
        if (state.lives === CONFIG.MAX_LIVES) logros.check('sinfallo');
        if (state.zenMode) logros.check('zenpartida');
    } catch (e) {}
    try { const pr = ollaPrefsArcade(); if (pr.name && playerNameInputVictory) playerNameInputVictory.value = pr.name; } catch (e) {}
    
    submitScoreBtnVictory.disabled = false;
    submitScoreBtnVictory.classList.remove('opacity-50', 'cursor-not-allowed');
    document.getElementById('submitMsgVictory').innerText = "";
    
    // Massive Confetti
    for(let i=0; i<10; i++) {
        setTimeout(() => {
            VFX.spawnConfetti(Math.random() * CONFIG.GAME_WIDTH, Math.random() * CONFIG.GAME_HEIGHT);
        }, i * 200);
    }
}

function showLevelUpParams() {
    newLevelNum.innerText = state.level;
    const container = document.getElementById('levelUpMsg');
    const msgBox = container.firstElementChild;
    
    // Pick unique message (avoid repeating last one if possible)
    let msg;
    const msgs = ASSETS.TEXTS.LEVEL_UP;
    msg = msgs[Math.floor(Math.random() * msgs.length)];
    
    msgBox.querySelector('h2').innerText = msg;
    container.classList.remove('hidden');
    msgBox.classList.remove('scale-0');
    msgBox.classList.add('scale-100');
    
    // PAUSE GAMEPLAY LOGIC
    state.levelUpPause = true;
    state.levelUpTimer = 3.0; // en segundos de reloj del juego (lo consume update())

    setTimeout(() => {
        msgBox.classList.remove('scale-100');
        msgBox.classList.add('scale-0');
        setTimeout(() => { container.classList.add('hidden'); }, 300);
    }, 3000); // 3 seconds
}

// Cierra el cartel de subida de nivel y reanuda (reloj del juego)
function endLevelUpPause() {
    const container = document.getElementById('levelUpMsg');
    const msgBox = container.firstElementChild;
    msgBox.classList.remove('scale-100');
    msgBox.classList.add('scale-0');
    setTimeout(() => { container.classList.add('hidden'); }, 300);
    state.levelUpPause = false;
}

function drawHeart(x, y, size) {
    ctx.save();
    if (!PERF.lowQuality) { ctx.shadowColor = 'white'; ctx.shadowBlur = 10; }
    // gradiente cacheado por posición+tamaño (antes se creaba en cada frame)
    let grad = HEART_GRAD;
    if (!grad || Math.abs(HEART_GRAD_X - x) > 1 || Math.abs(HEART_GRAD_Y - y) > 1 || HEART_GRAD_SIZE !== size) {
        grad = HEART_GRAD = ctx.createRadialGradient(x + size/2, y + size/3, size/4, x + size/2, y + size/2, size);
        grad.addColorStop(0, '#ff4d4d');
        grad.addColorStop(1, '#990000');
        HEART_GRAD_X = x; HEART_GRAD_Y = y; HEART_GRAD_SIZE = size;
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    const topCurveHeight = size * 0.3;
    ctx.moveTo(x + size / 2, y + size / 5);
    ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + topCurveHeight);
    ctx.bezierCurveTo(x, y + (size + topCurveHeight) / 2, x + size / 2, y + (size + topCurveHeight) / 2, x + size / 2, y + size);
    ctx.bezierCurveTo(x + size / 2, y + (size + topCurveHeight) / 2, x + size, y + (size + topCurveHeight) / 2, x + size, y + topCurveHeight);
    ctx.bezierCurveTo(x + size, y, x + size / 2, y, x + size / 2, y + size / 5);
    ctx.fill();
    ctx.restore();
}

function drawZarangollo(x, y, size) {
    ctx.save();
    const centerX = x + size/2;
    const centerY = y + size/2;
    const pulse = Math.sin(state.frames * 0.1) * 0.1 + 1; // Pulse scale 0.9 to 1.1

    ctx.translate(centerX, centerY);
    ctx.scale(pulse, pulse);
    ctx.translate(-centerX, -centerY);

    // Glow (shadowBlur es carísimo en móvil: se recorta en calidad baja)
    if (!PERF.lowQuality) {
        ctx.shadowColor = '#FFD700'; // Gold
        ctx.shadowBlur = 20 + Math.sin(state.frames * 0.2) * 10; // Dynamic blur
    }

    // Plate Body (Golden) — gradiente cacheado por posición+tamaño
    let grad = ZAR_GRAD;
    if (!grad || Math.abs(ZAR_GRAD_X - x) > 1 || Math.abs(ZAR_GRAD_Y - y) > 1 || ZAR_GRAD_SIZE !== size) {
        grad = ZAR_GRAD = ctx.createRadialGradient(centerX, centerY, size/4, centerX, centerY, size/2);
        grad.addColorStop(0, '#FFFACD'); // LemonChiffon center
        grad.addColorStop(0.5, '#FFD700'); // Gold middle
        grad.addColorStop(1, '#DAA520'); // GoldenRod edge
        ZAR_GRAD_X = x; ZAR_GRAD_Y = y; ZAR_GRAD_SIZE = size;
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size/2, 0, Math.PI*2);
    ctx.fill();

    // Rim/Border
    ctx.strokeStyle = '#B8860B'; // Dark GoldenRod
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size/2 - 2, 0, Math.PI*2);
    ctx.stroke();

    // Inner details (Food texture) - posiciones FIJAS (antes usaban Math.random()
    // en cada frame: las motas bailaban y parpadeaban sin parar)
    ctx.fillStyle = '#8B4513'; // SaddleBrown spots (onion/egg bits)
    const rnd = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    for(let i=0; i<5; i++) {
        const spotX = centerX + (rnd(i) - 0.5) * size * 0.6;
        const spotY = centerY + (rnd(i + 40) - 0.5) * size * 0.6;
        ctx.beginPath();
        ctx.arc(spotX, spotY, size/15, 0, Math.PI*2);
        ctx.fill();
    }
    
    // Shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(centerX - size/4, centerY - size/4, size/6, size/10, -0.5, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
}

// Custom Totanera Pumpkin Drawing
function drawPumpkin(x, y, size) {
    ctx.save();
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + size/2, y + size - 2, size/2.5, size/10, 0, 0, Math.PI*2);
    ctx.fill();

    // Body (Green/Orange mottled)
    const centerX = x + size/2;
    const centerY = y + size/2 + 5;
    const rx = size/2;
    const ry = size/2.5; // Flattened
    
    // Main Body Gradient (Green bottom, Orange top/spots) — cacheado por posición+tamaño
    let grad = PUMP_GRAD;
    if (!grad || Math.abs(PUMP_GRAD_X - x) > 1 || Math.abs(PUMP_GRAD_Y - y) > 1 || PUMP_GRAD_SIZE !== size) {
        grad = PUMP_GRAD = ctx.createRadialGradient(centerX, centerY - 10, 5, centerX, centerY, size/2);
        grad.addColorStop(0, '#e67e22'); // Orange center/top
        grad.addColorStop(0.6, '#d35400');
        grad.addColorStop(1, '#2d4d20'); // Greenish bottom (Totanera style)
        PUMP_GRAD_X = x; PUMP_GRAD_Y = y; PUMP_GRAD_SIZE = size;
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, rx, ry, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Ribs (Bezier lines)
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Center rib
    ctx.ellipse(centerX, centerY, rx * 0.2, ry, 0, 0, Math.PI*2);
    ctx.stroke();
    // Side ribs
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, rx * 0.6, ry * 0.95, 0, 0, Math.PI*2);
    ctx.stroke();
    
    // Stem
    ctx.fillStyle = '#3e2723';
    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY - ry + 5);
    ctx.quadraticCurveTo(centerX, centerY - ry - 15, centerX + 10, centerY - ry - 10);
    ctx.lineTo(centerX + 8, centerY - ry);
    ctx.lineTo(centerX - 5, centerY - ry + 5);
    ctx.fill();

    ctx.restore();
}

function drawSpotlight() {
    // Spotlight Effect centered on Pot
    const centerX = state.playerX + CONFIG.PLAYER_WIDTH / 2;
    const centerY = CONFIG.GAME_HEIGHT - CONFIG.POT_MARGIN - CONFIG.PLAYER_HEIGHT / 2;

    // Gradiente cacheado (se recreaba en cada frame y es de pantalla completa)
    let grad = SPOT_GRAD;
    if (!grad || Math.abs(SPOT_GRAD_X - centerX) > 2 || Math.abs(SPOT_GRAD_Y - centerY) > 2 ||
        SPOT_GRAD_W !== CONFIG.GAME_WIDTH || SPOT_GRAD_H !== CONFIG.GAME_HEIGHT) {
        grad = SPOT_GRAD = ctx.createRadialGradient(centerX, centerY, 100, centerX, centerY, 800);
        grad.addColorStop(0, 'rgba(0,0,0,0)'); // Clear center
        grad.addColorStop(0.4, 'rgba(0,0,0,0.1)'); 
        grad.addColorStop(1, 'rgba(0,0,0,0.7)'); // Dark edges
        SPOT_GRAD_X = centerX; SPOT_GRAD_Y = centerY;
        SPOT_GRAD_W = CONFIG.GAME_WIDTH; SPOT_GRAD_H = CONFIG.GAME_HEIGHT;
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
}

function draw() {
    // transform: dibujamos en unidades CSS; el canvas puede estar a menos resolución (PERF.scale)
    const s = (typeof PERF !== 'undefined' && PERF.scale) ? PERF.scale : 1;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
    drawPot(state.playerX, CONFIG.GAME_HEIGHT - CONFIG.PLAYER_HEIGHT - CONFIG.POT_MARGIN, CONFIG.PLAYER_WIDTH, CONFIG.PLAYER_HEIGHT);
    
    ctx.font = `${CONFIG.ITEM_SIZE}px serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    for (let item of state.items) {
        // Apply bobbing offset
        const renderX = item.x + (item.bobOffset || 0);

        if (item.type === 'heart') {
            drawHeart(renderX, item.y, item.size);
        } else if (item.type === 'zarangollo') {
            drawZarangollo(renderX, item.y, item.size);
        } else if (item.text === PUMPKIN_KEY) {
            drawPumpkin(renderX, item.y, item.size);
        } else {
            // Apply visual polish to emojis
            const lq = PERF.lowQuality;
            if (item.type === 'good' && !lq) {
                ctx.save();
                // Glow for Good items
                ctx.shadowColor = 'gold';
                ctx.shadowBlur = 15;
            } else {
                ctx.save();
            }

            // Sway rotation
            const rot = (item.bobOffset || 0) * 0.05;
            ctx.translate(renderX + item.size/2, item.y + item.size/2);
            ctx.rotate(rot);
            ctx.translate(-(renderX + item.size/2), -(item.y + item.size/2));

            // ctx.filter (drop-shadow por emoji) es carísimo en móvil: se omite en calidad baja
            if (!lq) ctx.filter = 'drop-shadow(0px 4px 2px rgba(0,0,0,0.3)) saturate(1.2)';
            ctx.fillText(item.text, renderX, item.y);
            ctx.restore();
        }
    }

    // floating texts: reusa tamaño de fuente cacheado por tamaño (evita crear strings por frame)
    VFX.draw(ctx);
    drawSpotlight();
}

// HUD juice: el marcador da un salto al coger algo bueno
function popScoreHUD() {
    const chip = scoreDisplay && scoreDisplay.parentElement;
    if (!chip) return;
    chip.classList.remove('hud-pop');
    // reinicia la animación (forzando reflow)
    void chip.offsetWidth;
    chip.classList.add('hud-pop');
}

function updateHUD() {
    scoreDisplay.innerText = state.score;
    livesDisplay.innerText = state.lives;
    levelDisplay.innerText = state.level;
    // barra de progreso al siguiente nivel (antes no había forma de ver cuánto faltaba)
    const bar = document.getElementById('levelProgressBar');
    if (bar) {
        const prevThreshold = (state.level - 1) * CONFIG.LEVEL_THRESHOLD;
        const pct = Math.max(0, Math.min(100, ((state.score - prevThreshold) / CONFIG.LEVEL_THRESHOLD) * 100));
        bar.style.width = pct.toFixed(1) + '%';
    }
    // combo visible (antes no se veía en ningún sitio)
    const chip = document.getElementById('comboChip');
    const disp = document.getElementById('comboDisplay');
    if (chip && disp) {
        const c = state.combo || 0;
        const mult = 1 + c * 0.2;
        if (c > 1) {
            chip.classList.remove('opacity-0');
            disp.innerText = `x${mult.toFixed(1)}`;
            chip.className = chip.className.replace(/bg-\S+/, c >= 10 ? 'bg-red-600/95' : c >= 5 ? 'bg-purple-600/95' : 'bg-purple-600/90');
        } else {
            chip.classList.add('opacity-0');
        }
    }
}


// Preferencias del jugador (nombre) — compartidas con los otros juegos del sitio
const PREFS_KEY_ARCADIA = 'olla_prefs_v1';
function ollaPrefsArcade() { try { return JSON.parse(localStorage.getItem(PREFS_KEY_ARCADIA) || '{}'); } catch (e) { return {}; } }
function savePrefArcade(name, sound, extra) { try { const p = ollaPrefsArcade(); if (name) p.name = name; if (sound !== undefined) p.sound = sound; if (extra) Object.assign(p, extra); localStorage.setItem(PREFS_KEY_ARCADIA, JSON.stringify(p)); } catch (e) {} }

function updateArcadeBest() {
    const node = document.getElementById('arcadeBest');
    if (!node) return;
    // récord PERSONAL = partidas guardadas en este dispositivo (no el top global)
    try {
        const rows = JSON.parse(localStorage.getItem(MOCK_DB_KEY) || '[]');
        const best = rows.reduce((m, r) => Math.max(m, r.score || 0), 0);
        node.textContent = best ? `🏆 Tu récord: ${best} puntos` : '';
    } catch (e) {}
}

function gameOver() {
    state.isRunning = false;
    hud.classList.add('hidden');
    hideZenBadge();
    gameOverScreen.classList.remove('hidden');
    setBackground('gameover');
    
    gameOverScreen.querySelector('h1').innerText = ASSETS.TEXTS.GAME_OVER[Math.floor(Math.random() * ASSETS.TEXTS.GAME_OVER.length)];
    finalScoreDisplay.innerText = state.score;
    
    updateArcadeBest();
    try {
        logros.set('puntos1k', state.score); logros.set('puntos5k', state.score);
        logros.set('nivel5', state.level); logros.set('nivel10', state.level);
        if (state.lives === CONFIG.MAX_LIVES) logros.check('sinfallo');
        if (state.zenMode) logros.check('zenpartida');
    } catch (e) {}
    submitScoreBtn.disabled = false;
    submitScoreBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    document.getElementById('submitMsg').innerText = "";
    try { const pr = ollaPrefsArcade(); if (pr.name && playerNameInput) playerNameInput.value = pr.name; } catch (e) {}
    
    // Load top 5 for current difficulty
    loadLeaderboard(state.difficulty, leaderboardBody, 5);
}

// --- SUPABASE & LEADERBOARD (ranking en este PC: API local con respaldo localStorage) ---
const SUPABASE_URL = ""; // nube original muerta; el ranking real usa la API del servidor
const SUPABASE_KEY = "";
const MOCK_DB_KEY = 'olla_gitana_scores_v4';
const API_BASE = (function () {
    const p = location.pathname;                      // '/juegos-olla/olla-gitana/…' o '/…'
    const i = p.indexOf('/olla-gitana');
    const base = i >= 0 ? p.slice(0, i) : '/';
    return base.replace(/\/$/, '') + '/api';
})();

async function getScores(difficulty) {
    const prefix = CONFIG.DIFFICULTY[difficulty].prefix;
    // 1) API del servidor
    try {
        const res = await fetch(`${API_BASE}/top?game=arcade&diff=${encodeURIComponent(difficulty)}&limit=100`, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            const list = (data.scores || []).map(s => ({ name: s.name, score: s.score }));
            if (list.length) return list;
        }
    } catch (e) { console.warn("API no disponible", e); }
    // 2) respaldo local del navegador
    let scores = JSON.parse(localStorage.getItem(MOCK_DB_KEY) || "[]");
    return scores
        .filter(s => s.diff === difficulty)
        .sort((a,b) => b.score - a.score)
        .slice(0, 100);
}

async function saveScore(name, score) {
    const diffKey = state.difficulty;
    const prefix = CONFIG.DIFFICULTY[diffKey].prefix;
    // respaldo local primero
    let scores = JSON.parse(localStorage.getItem(MOCK_DB_KEY) || "[]");
    scores.push({ name, score, diff: diffKey });
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(scores.slice(-200)));
    // y al servidor
    try {
        const res = await fetch(`${API_BASE}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game: 'arcade', diff: diffKey, name: `${prefix} ${name}`.trim(), score })
        });
        return res.ok;
    } catch (e) { return false; }
}

async function loadLeaderboard(difficulty, targetElement, limit = 100) {
    targetElement.innerHTML = '<tr><td colspan="3" class="text-center py-4">Cargando...</td></tr>';
    const scores = await getScores(difficulty);
    const displayScores = scores.slice(0, limit);
    
    if (displayScores.length === 0) {
        targetElement.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-500">Aún no hay zagales aquí.</td></tr>';
        return;
    }

    targetElement.innerHTML = displayScores.map((s, i) => `
        <tr class="${i < 3 ? 'text-yellow-400 font-bold' : ''} hover:bg-white/5 transition-colors">
            <td class="p-2">${i + 1}</td>
            <td class="p-2 max-w-[9rem] truncate" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</td>
            <td class="p-2 text-right font-mono">${escapeHtml(s.score)}</td>
        </tr>
    `).join('');
}

// Los nombres vienen del ranking (local o del servidor): nunca inyectar HTML tal cual
function escapeHtml(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// --- EVENT LISTENERS ---
// Difficulty Toggle
function updateDifficultyUI() {
    const key = difficultyKeys[currentDiffIndex];
    const conf = CONFIG.DIFFICULTY[key];
    
    difficultyToggle.innerText = conf.label; 
    
    // Reset base classes then add dynamic ones
    difficultyToggle.className = `w-full bg-gradient-to-b border-4 border-white rounded-full py-4 hover:translate-y-1 transition-all transform hover:scale-105 font-game text-xl md:text-2xl uppercase tracking-wide text-white ${conf.classes}`;
}

difficultyToggle.addEventListener('click', () => {
    currentDiffIndex = (currentDiffIndex + 1) % difficultyKeys.length;
    updateDifficultyUI();
});

// Start Button
document.getElementById('btnStartGame').addEventListener('click', () => {
    const diff = difficultyKeys[currentDiffIndex];
    startGame(diff);
});

// Instructions Modal
document.getElementById('btnInstructions').addEventListener('click', () => {
    instructionsModal.classList.remove('hidden');
});
const closeInst = () => instructionsModal.classList.add('hidden');
document.getElementById('closeInstructionsBtn').addEventListener('click', closeInst);
document.getElementById('closeInstructionsBtnBottom').addEventListener('click', closeInst);


document.getElementById('restartBtn').addEventListener('click', () => startGame(state.difficulty));
document.getElementById('resumeBtn').addEventListener('click', togglePause);
// Modo ZEN del arcade
const zenArcade = document.getElementById('zenCheckArcade');
if (zenArcade) {
    try { const pr = ollaPrefsArcade(); if (pr.zenArcade) { zenArcade.checked = true; ZEN_ARCADE = true; state.zenMode = true; } } catch (e) {}
    zenArcade.addEventListener('change', () => {
        ZEN_ARCADE = zenArcade.checked;
        state.zenMode = ZEN_ARCADE;
        try { savePrefArcade(undefined, undefined, { zenArcade: state.zenMode }); } catch (e) {}
        if (state.zenMode) AudioEngine.playTone('zen');
    });
}
// botón de pausa explícito (antes solo se pausaba tocando el HUD: poco claro)
const pauseBtnEl = document.getElementById('pauseBtn');
if (pauseBtnEl) pauseBtnEl.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
// Los chips del HUD (vidas/nivel/puntos) ya NO pausan la partida al tocarlos:
// parecían botones y congelaban el juego sin querer
[hud, scoreDisplay, livesDisplay, levelDisplay].forEach((el) => {
    if (!el) return;
    const chip = el.closest ? el.closest('div') : null;
    (chip || el).addEventListener('click', (e) => { e.stopPropagation(); });
});

// Ranking Screen Logic
document.getElementById('btnLogrosArcade').addEventListener('click', () => { try { logros.panel(); } catch (e) {} });
document.getElementById('rankingBtn').addEventListener('click', () => {
    rankingScreen.classList.remove('hidden');
    loadLeaderboard('easy', fullLeaderboardBody); // Default view
    updateTabs('easy');
});

document.getElementById('closeRankingBtn').addEventListener('click', () => {
    rankingScreen.classList.add('hidden');
});

// Ranking Tabs
const tabs = document.querySelectorAll('.ranking-tab');
tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        const diff = e.target.getAttribute('data-diff');
        updateTabs(diff);
        loadLeaderboard(diff, fullLeaderboardBody);
    });
});

function updateTabs(activeDiff) {
    tabs.forEach(tab => {
        const diff = tab.getAttribute('data-diff');
        const isActive = diff === activeDiff;
        
        // Reset classes
        tab.className = 'ranking-tab flex-1 py-3 rounded-t-xl font-bold uppercase text-sm border-x-2 border-t-2 transition-all transform';
        
        if (isActive) {
            tab.classList.add('text-white', 'shadow-lg', 'translate-y-1', 'border-white/20');
            if (diff === 'easy') tab.classList.add('bg-green-600');
            if (diff === 'normal') tab.classList.add('bg-blue-600');
            if (diff === 'hard') tab.classList.add('bg-red-600');
        } else {
            tab.classList.add('bg-gray-700', 'text-gray-400', 'border-transparent', 'hover:bg-gray-600');
        }
    });
    
    // Border color of container
    const container = rankingScreen.querySelector('.border-4');
    container.classList.remove('border-green-600', 'border-blue-600', 'border-red-600', 'border-yellow-500');
    if (activeDiff === 'easy') container.classList.add('border-green-600');
    else if (activeDiff === 'normal') container.classList.add('border-blue-600');
    else if (activeDiff === 'hard') container.classList.add('border-red-600');
    else container.classList.add('border-yellow-500');
}

// Music Controls
function handleMusicToggle(e) {
    e.stopPropagation();
    AudioEngine.toggleMusic();
    try { savePrefArcade(undefined, AudioEngine.isMusicEnabled); } catch (err) {}
}
musicToggle.addEventListener('click', handleMusicToggle);
startMusicToggle.addEventListener('click', handleMusicToggle);

submitScoreBtn.addEventListener('click', () => {
    const val = playerNameInput.value.trim(); // Allow mixed case and special chars
    if (val) {
        savePrefArcade(val);
        saveScore(val, state.score).then((ok) => {
            loadLeaderboard(state.difficulty, leaderboardBody, 5);
            document.getElementById('submitMsg').innerText = ok ? "¡Guardado!" : "Guardado en este dispositivo (servidor no disponible)";
            submitScoreBtn.disabled = true;
            submitScoreBtn.classList.add('opacity-50', 'cursor-not-allowed');
        });
    }
});

submitScoreBtnVictory.addEventListener('click', () => {
    const val = playerNameInputVictory.value.trim();
    if (val) {
        savePrefArcade(val);
        saveScore(val, state.score).then((ok) => {
            document.getElementById('submitMsgVictory').innerText = ok ? "¡Guardado!" : "Guardado en este dispositivo (servidor no disponible)";
            submitScoreBtnVictory.disabled = true;
            submitScoreBtnVictory.classList.add('opacity-50', 'cursor-not-allowed');
        });
    }
});

document.getElementById('restartBtnVictory').addEventListener('click', () => {
    victoryScreen.classList.add('hidden');
    startGame(state.difficulty);
});

// --- COMPARTIR (WhatsApp / share nativo) ---
function compartirArcade(score, contexto) {
    const diffLabel = (CONFIG.DIFFICULTY[state.difficulty] || {}).label || 'Normal 🥘';
    const zen = state.zenMode ? ' en modo ZEN 🧘' : '';
    const txt = contexto === 'victory'
        ? `¡Me he pasado OLLA GITANA: EL JUEGO 🥘! ${score} puntos en ${diffLabel}${zen}. ¿Te atreves?`
        : `He hecho ${score} puntos en OLLA GITANA: EL JUEGO 🥘 (${diffLabel}${zen}). ¿Juegas tú?`;
    const url = location.href.split('?')[0];
    if (navigator.share) { navigator.share({ title: 'Olla Gitana: El Juego 🥘', text: txt, url }).catch(() => {}); return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(txt + '\n\n' + url), '_blank');
}
const shareBtnArcade = document.getElementById('shareBtnArcade');
if (shareBtnArcade) shareBtnArcade.addEventListener('click', () => compartirArcade(state.score, 'gameover'));
const shareBtnVictory = document.getElementById('shareBtnVictory');
if (shareBtnVictory) shareBtnVictory.addEventListener('click', () => compartirArcade(state.score, 'victory'));

backToMenuBtn.addEventListener('click', () => {
    updateArcadeBest();
    state.isRunning = false;
    hud.classList.add('hidden');
    hideZenBadge();
    pauseScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    setBackground('start');
});

// Prevent Context Menu
window.addEventListener('contextmenu', e => e.preventDefault());

// --- CONTROLES DE TECLADO (escritorio) ---
// Antes el juego era 100% ratón/táctil: en un PC no respondía a las flechas ni a la barra espaciadora.
const KEY_STEP = 46;
window.addEventListener('keydown', e => {
    if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        if (state.isRunning && !state.isPaused && !state.levelUpPause) { handleInput(state.playerX + CONFIG.PLAYER_WIDTH/2 - KEY_STEP); e.preventDefault(); }
    } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        if (state.isRunning && !state.isPaused && !state.levelUpPause) { handleInput(state.playerX + CONFIG.PLAYER_WIDTH/2 + KEY_STEP); e.preventDefault(); }
    } else if (k === 'p' || k === 'P' || k === 'Escape') {
        if (state.isRunning) { togglePause(); e.preventDefault(); }
    } else if (k === ' ') {
        if (state.isRunning && state.isPaused) { togglePause(); e.preventDefault(); }
    } else if (k === 'm' || k === 'M') {
        AudioEngine.toggleMusic(); try { savePrefArcade(undefined, AudioEngine.isMusicEnabled); } catch (err) {}
        e.preventDefault();
    }
});

// Pausa táctil: "Toca la pantalla pa' volver" era mentira (solo el botón SEGUIR reanudaba)
pauseScreen.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('#resumeBtn')) return; // el botón ya tiene su handler
    if (state.isPaused) togglePause();
});
// en táctil el click sintético no siempre llega (touch-action:none en el body)
pauseScreen.addEventListener('touchend', (e) => {
    if (e.target.closest && e.target.closest('#resumeBtn')) return;
    if (state.isPaused) { e.preventDefault(); togglePause(); }
}, { passive: false });

// Al volver a la pestaña: si estaba en juego, se pausa (antes seguía cayendo fruta sin verla)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.isRunning && !state.isPaused && !state.levelUpPause) togglePause();
});

// Init
updateDifficultyUI(); // Init button state
updateArcadeBest();   // el récord no se veía hasta acabar una partida
perfInit();           // DPR adaptativo según pantalla/RAM
resize();             // aplica la escala de render inicial
AudioEngine.init();
setBackground('start');
// exponer para QA (fps, escala de render)
window.__arcadePerf = () => ({ fps: PERF.fps, idx: PERF.idx, scale: PERF.scale, low: PERF.lowQuality, changes: PERF.changes.slice(), canvas: {w: canvas.width, h: canvas.height} });

// --- PRELOAD ---
function preloadImages() {
    const images = [
        ASSETS.BACKGROUNDS.START.replace(/url\(['"](.+)['"]\)/, '$1'),
        ...ASSETS.BACKGROUNDS.GAME.map(bg => bg.replace(/url\(['"](.+)['"]\)/, '$1'))
    ];
    
    images.forEach(src => {
        const img = new Image();
        img.src = src;
    });
    console.log("Backgrounds preloaded:", images.length);
}

preloadImages();
