
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, GameState, Location, DifficultyLevel, HintedMove } from './types';
import { 
  createDeck, 
  canMoveToCascade, 
  canMoveToFoundation, 
  isSequence
} from './utils/gameLogic';
import { CardUI } from './components/CardUI';
import { RotateCcw, Undo2, Trophy, Clock, PlayCircle, Lightbulb, HelpCircle, X, ChevronRight, Sparkles, BrainCircuit, Rocket, Volume2, VolumeX, Ghost, Medal, Crown, Star, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';

const TUTORIAL_STEPS = [
  { title: "1. 游戏目标", content: "将所有花色的牌按 A → 2 → 3 ... → K 的顺序收集到右上角的“收纳位”。" },
  { title: "2. 中转位用法", content: "左上角位置可存放单张牌。腾空它们能让你移动更长的有序牌组。" },
  { title: "3. 规则进阶", content: "双击一张牌可以快速尝试将其放入收纳位。收纳位中的牌也可以再次移回场面。" }
];

const ACHIEVEMENTS = [
  { title: "纸牌魔术师", icon: <Sparkles className="text-yellow-400" /> },
  { title: "不败战神", icon: <Crown className="text-yellow-400" /> },
  { title: "极速清理者", icon: <Rocket className="text-orange-400" /> },
  { title: "空当宗师", icon: <Medal className="text-purple-400" /> }
];

const STORAGE_KEY = 'freecell_classic_save_v1';

// --- 音频引擎 ---
const playSound = (type: 'click' | 'move' | 'invalid' | 'win' | 'auto' | 'undo' | 'deal' | 'slide_many' | 'hint' | 'deadend', muted: boolean, options: { pitchScale?: number, cardCount?: number } = {}) => {
  if (muted) return;
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const now = ctx.currentTime;
  const { pitchScale = 1.0, cardCount = 1 } = options;

  const createNoiseBuffer = (duration: number) => {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    return buffer;
  };

  const playPaperFriction = (duration: number, volume: number, freq: number, q: number = 2, delay: number = 0) => {
    const source = ctx.createBufferSource();
    source.buffer = createNoiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, now + delay);
    filter.Q.setValueAtTime(q, now + delay);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(volume, now + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    source.start(now + delay);
  };

  const playOsc = (freq: number, oscType: OscillatorType, duration: number, volume: number, endFreq?: number, delay: number = 0) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = oscType;
    osc.frequency.setValueAtTime(freq * pitchScale, now + delay);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq * pitchScale, now + delay + duration);
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(volume, now + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now + delay); osc.stop(now + delay + duration);
  };

  switch (type) {
    case 'deal': playPaperFriction(0.12, 0.08, 3000, 1.5); playOsc(160, 'sine', 0.06, 0.04); break;
    case 'click': playOsc(800, 'sine', 0.03, 0.03, 400); break;
    case 'move': playPaperFriction(0.15, 0.06, 2500, 3); playOsc(220, 'sine', 0.08, 0.04); break;
    case 'slide_many':
      const layers = Math.min(cardCount, 6);
      for(let i = 0; i < layers; i++) playPaperFriction(0.18, 0.07, 1000 + (i * 200), 1, i * 0.035);
      playOsc(120, 'sine', 0.2, 0.05, 80, layers * 0.035);
      break;
    case 'auto':
      playOsc(400, 'sine', 0.25, 0.1, 3500);
      playOsc(4000, 'sine', 0.05, 0.03);
      break;
    case 'invalid': playOsc(130, 'sawtooth', 0.3, 0.045); playOsc(138.6, 'sawtooth', 0.3, 0.045); break;
    case 'win': [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => playOsc(f, 'sine', 1.5, 0.07), i * 110)); break;
    case 'undo': playOsc(600, 'sine', 0.15, 0.05, 150); break;
    case 'hint': playOsc(1318, 'sine', 0.4, 0.05); break;
    case 'deadend': playOsc(100, 'sine', 0.6, 0.04); break;
  }
};

const App: React.FC = () => {
  const [muted, setMuted] = useState(false);
  const [state, setState] = useState<GameState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...parsed, gameStatus: parsed.gameStatus === 'won' ? 'selecting' : parsed.gameStatus };
      } catch (e) {}
    }
    return { difficulty: 'easy', cascades: Array(8).fill([]).map(() => []), freeCells: Array(4).fill(null), foundations: Array(4).fill([]).map(() => []), history: [], moves: 0, timer: 0, hintsRemaining: 3, gameStatus: 'selecting' };
  });

  const [selected, setSelected] = useState<{ location: Location; cards: Card[] } | null>(null);
  const [invalidMoveLocation, setInvalidMoveLocation] = useState<Location | null>(null);
  const [hintedMove, setHintedMove] = useState<HintedMove | null>(null);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [winningAnimationActive, setWinningAnimationActive] = useState(false);
  const [isAutoSolving, setIsAutoSolving] = useState(false);
  const [isDealing, setIsDealing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(52);
  const [achievement, setAchievement] = useState<{title: string, icon: React.ReactNode} | null>(null);
  
  const timerRef = useRef<number | null>(null);
  const stateHistoryHashes = useRef<string[]>([]);
  const manualMoveCooldown = useRef<Record<string, number>>({});
  const lastAutoMoveTime = useRef<number>(0);
  const autoMoveStreak = useRef<number>(0);
  const bgmRef = useRef<{ ctx: AudioContext, gain: GainNode, oscillators: OscillatorNode[] } | null>(null);

  // --- 移动端触感反馈 ---
  const vibrate = (type: 'error' | 'success' | 'click') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'error') navigator.vibrate([40, 30, 40]);
      else if (type === 'success') navigator.vibrate(20);
      else if (type === 'click') navigator.vibrate(10);
    }
  };

  const startBGM = useCallback(() => {
    if (bgmRef.current || muted) return;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2);
    masterGain.connect(ctx.destination);
    const oscillators = [65.41, 82.41, 98.00, 123.47].map(f => {
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.setValueAtTime(f, ctx.currentTime);
      const lg = ctx.createGain(); lg.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.connect(lg); lg.connect(masterGain); osc.start();
      return osc;
    });
    bgmRef.current = { ctx, gain: masterGain, oscillators };
  }, [muted]);

  const stopBGM = useCallback(() => {
    if (bgmRef.current) {
      const { ctx, gain, oscillators } = bgmRef.current;
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
      setTimeout(() => { oscillators.forEach(osc => osc.stop()); ctx.close(); bgmRef.current = null; }, 1600);
    }
  }, []);

  useEffect(() => {
    if (state.gameStatus === 'playing' && !muted) startBGM();
    else stopBGM();
    return () => stopBGM();
  }, [state.gameStatus, muted, startBGM, stopBGM]);

  const getBoardHash = useCallback((cascades: Card[][], free: (Card | null)[], found: Card[][]) => {
    return `${cascades.map(p => p.map(c => c.id).join(',')).join('|')}#${free.map(c => c?.id || 'null').join(',')}#${found.map(p => p.length).join(',')}`;
  }, []);

  const getMaxMoveCount = useCallback((toEmptyCascade: boolean, currentCascades: Card[][], currentFree: (Card | null)[]) => {
    if (state.difficulty === 'easy') return 52;
    const emptyFree = currentFree.filter(c => !c).length;
    let emptyCasc = currentCascades.filter(c => c.length === 0).length;
    if (toEmptyCascade) emptyCasc -= 1;
    return (1 + emptyFree) * Math.pow(2, Math.max(0, emptyCasc));
  }, [state.difficulty]);

  const initGame = useCallback((difficulty: DifficultyLevel) => {
    const deck = createDeck(difficulty);
    const newCascades: Card[][] = Array(8).fill([]).map(() => []);
    deck.forEach((card, index) => newCascades[index % 8].push(card));
    const newState: GameState = { difficulty, cascades: newCascades, freeCells: Array(4).fill(null), foundations: Array(4).fill([]).map(() => []), history: [], moves: 0, timer: 0, hintsRemaining: 3, gameStatus: 'playing' };
    setState(newState); setSelected(null); setInvalidMoveLocation(null); setWinningAnimationActive(false); setIsAutoSolving(false);
    setIsDealing(true); setVisibleCount(0); stateHistoryHashes.current = [getBoardHash(newCascades, newState.freeCells, newState.foundations)];
    let current = 0;
    const interval = setInterval(() => {
      if (current < 52) { setVisibleCount(prev => prev + 1); playSound('deal', muted); current++; }
      else { clearInterval(interval); setTimeout(() => setIsDealing(false), 500); }
    }, 45);
    vibrate('success');
  }, [getBoardHash, muted]);

  useEffect(() => {
    if (state.gameStatus === 'playing' && !isDealing) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => setState(prev => ({ ...prev, timer: prev.timer + 1 })), 1000);
    } else if (timerRef.current) clearInterval(timerRef.current);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.gameStatus, isDealing]);

  useEffect(() => {
    if (state.foundations.every(f => f.length === 13) && state.gameStatus === 'playing') {
      setState(prev => ({ ...prev, gameStatus: 'won' }));
      playSound('win', muted);
      setWinningAnimationActive(true);
      setAchievement(ACHIEVEMENTS[Math.floor(Math.random() * ACHIEVEMENTS.length)]);
    }
  }, [state.foundations, state.gameStatus, muted]);

  const executeMove = useCallback((from: Location, to: Location, cards: Card[]) => {
    if (!cards || cards.length === 0) return;
    if (to.type === 'foundation') {
      const now = Date.now();
      autoMoveStreak.current = (now - lastAutoMoveTime.current < 800) ? Math.min(autoMoveStreak.current + 1, 12) : 0;
      lastAutoMoveTime.current = now;
      playSound('auto', muted, { pitchScale: 1 + (autoMoveStreak.current * 0.05) });
    } else playSound(cards.length > 1 ? 'slide_many' : 'move', muted, { cardCount: cards.length });

    setState(prev => {
      const nextCasc = prev.cascades.map(c => [...c]);
      const nextFree = [...prev.freeCells];
      const nextFound = prev.foundations.map(f => [...f]);
      if (from.type === 'cascade') nextCasc[from.index] = nextCasc[from.index].slice(0, -cards.length);
      else if (from.type === 'free') nextFree[from.index] = null;
      else if (from.type === 'foundation') nextFound[from.index] = nextFound[from.index].slice(0, -1);
      
      if (to.type === 'cascade') nextCasc[to.index] = [...nextCasc[to.index], ...cards];
      else if (to.type === 'free') nextFree[to.index] = cards[0];
      else if (to.type === 'foundation') nextFound[to.index] = [...nextFound[to.index], ...cards];
      
      return { ...prev, cascades: nextCasc, freeCells: nextFree, foundations: nextFound, moves: prev.moves + 1, history: [...prev.history, { cascades: prev.cascades.map(c => [...c]), freeCells: [...prev.freeCells], foundations: prev.foundations.map(f => [...f]) }] };
    });
    setSelected(null); setInvalidMoveLocation(null); setHintedMove(null);
  }, [getBoardHash, muted]);

  // --- 自动收纳逻辑 ---
  useEffect(() => {
    if (state.gameStatus !== 'playing' || isDealing) return;
    const interval = setTimeout(() => {
      const isSafe = (card: Card) => {
        if (state.difficulty === 'easy' || isAutoSolving) return true;
        if (card.rank <= 2) return true;
        const oppSuits = card.isRed ? [2, 3] : [0, 1];
        const minOpp = Math.min(...oppSuits.map(idx => state.foundations[idx].length));
        return card.rank <= minOpp + 1;
      };
      for (let i = 0; i < 4; i++) {
        const c = state.freeCells[i];
        if (c && canMoveToFoundation(c, state.foundations[state.foundations.findIndex(f => canMoveToFoundation(c, f))]) && isSafe(c)) {
          executeMove({ type: 'free', index: i }, { type: 'foundation', index: state.foundations.findIndex(f => canMoveToFoundation(c, f)) }, [c]);
          return;
        }
      }
      for (let i = 0; i < 8; i++) {
        const p = state.cascades[i];
        if (p.length > 0) {
          const c = p[p.length - 1];
          const fIdx = state.foundations.findIndex(f => canMoveToFoundation(c, f));
          if (fIdx !== -1 && isSafe(c)) {
            executeMove({ type: 'cascade', index: i }, { type: 'foundation', index: fIdx }, [c]);
            return;
          }
        }
      }
    }, isAutoSolving ? 100 : 800);
    return () => clearTimeout(interval);
  }, [state, executeMove, isAutoSolving, isDealing]);

  const handleQuickMove = (card: Card, location: Location) => {
    const fIdx = state.foundations.findIndex(f => canMoveToFoundation(card, f));
    if (fIdx !== -1) executeMove(location, { type: 'foundation', index: fIdx }, [card]);
    else vibrate('error');
  };

  const handleCardClick = (location: Location, pileCards: Card[], idx?: number) => {
    if (state.gameStatus !== 'playing' || isDealing || invalidMoveLocation) return;
    vibrate('click');
    if (!selected) {
      if (pileCards.length === 0) return;
      const clickedIdx = idx ?? (pileCards.length - 1);
      const seq = pileCards.slice(clickedIdx);
      if (isSequence(seq)) setSelected({ location, cards: seq });
      else setSelected({ location, cards: [pileCards[pileCards.length - 1]] });
    } else {
      const moving = selected.cards;
      let valid = false;
      if (location.type === 'cascade') {
        const target = state.cascades[location.index];
        if (canMoveToCascade(moving[0], target[target.length - 1]) && moving.length <= getMaxMoveCount(target.length === 0, state.cascades, state.freeCells)) valid = true;
      } else if (location.type === 'free' && moving.length === 1 && !state.freeCells[location.index]) valid = true;
      else if (location.type === 'foundation' && moving.length === 1 && canMoveToFoundation(moving[0], state.foundations[location.index])) valid = true;
      
      if (valid) executeMove(selected.location, location, moving);
      else {
        if (!(selected.location.type === location.type && selected.location.index === location.index)) {
          setInvalidMoveLocation(selected.location); playSound('invalid', muted); vibrate('error');
          setTimeout(() => { setInvalidMoveLocation(null); setSelected(null); }, 400);
        } else setSelected(null);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#1a472a] touch-none">
      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .invalid-shake { animation: shake 0.2s ease-in-out 2; }
        .card-deal-anim { animation: fly-in 0.4s ease-out forwards; opacity: 0; }
        @keyframes fly-in { from { transform: translateY(-50vh) rotate(45deg); opacity: 0; } to { transform: translateY(0) rotate(0); opacity: 1; } }
      `}</style>

      {/* 紧凑型移动端 Header */}
      <header className="p-2 sm:p-4 bg-black/30 backdrop-blur-md flex items-center justify-between z-50 border-b border-white/5">
        <div className="flex items-center gap-2 sm:gap-6">
          <div className="bg-black/40 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-white/10">
            <Clock size={16} className="text-emerald-400" />
            <span className="font-mono text-lg tabular-nums">{Math.floor(state.timer/60)}:{(state.timer%60).toString().padStart(2,'0')}</span>
          </div>
          <div className="bg-black/40 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-white/10">
            <PlayCircle size={16} className="text-emerald-400" />
            <span className="text-lg font-bold">{state.moves}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMuted(!muted)} className="p-2.5 bg-white/5 rounded-lg border border-white/10 active:bg-white/20 transition-all">{muted ? <VolumeX size={20}/> : <Volume2 size={20}/>}</button>
          <button onClick={() => {vibrate('click'); setState(p => ({...p, history: p.history.slice(0,-1), ...p.history[p.history.length-1]})); setSelected(null);}} className="p-2.5 bg-white/5 rounded-lg border border-white/10 active:bg-white/20" disabled={state.history.length === 0}><Undo2 size={20}/></button>
          <button onClick={() => {vibrate('error'); setState(p => ({...p, gameStatus: 'selecting'}));}} className="p-2.5 bg-red-500/20 text-red-200 rounded-lg border border-red-500/30 active:bg-red-500/40"><RotateCcw size={20}/></button>
        </div>
      </header>

      <main className="flex-1 p-2 sm:p-6 overflow-hidden flex flex-col gap-2 sm:gap-8">
        {/* 顶部收纳/中转区 - 响应式排列 */}
        <div className="grid grid-cols-8 gap-1.5 sm:gap-4 h-[18vw] sm:h-36">
          <div className="col-span-4 flex gap-1 sm:gap-3">
            {state.freeCells.map((c, i) => (
              <div key={i} onClick={() => handleCardClick({type:'free', index:i}, c ? [c] : [])} className={`flex-1 rounded-md border border-white/5 bg-black/20 flex items-center justify-center relative ${selected?.location.type === 'free' && selected.location.index === i ? 'ring-2 ring-yellow-400 bg-yellow-400/10' : ''}`}>
                {c && <CardUI card={c} isSelected={selected?.location.type === 'free' && selected.location.index === i} onDoubleClick={() => handleQuickMove(c, {type:'free', index:i})} className={invalidMoveLocation?.type === 'free' && invalidMoveLocation.index === i ? 'invalid-shake' : ''}/>}
              </div>
            ))}
          </div>
          <div className="col-span-4 flex gap-1 sm:gap-3">
            {state.foundations.map((p, i) => (
              <div key={i} onClick={() => handleCardClick({type:'foundation', index:i}, p)} className={`flex-1 rounded-md border border-white/5 bg-black/20 flex items-center justify-center relative ${selected?.location.type === 'foundation' && selected.location.index === i ? 'ring-2 ring-yellow-400 bg-yellow-400/10' : ''}`}>
                {p.length > 0 && <CardUI card={p[p.length-1]} isSelected={selected?.location.type === 'foundation' && selected.location.index === i} className={invalidMoveLocation?.type === 'foundation' && invalidMoveLocation.index === i ? 'invalid-shake' : ''}/>}
                <Trophy size={20} className="absolute opacity-10"/>
              </div>
            ))}
          </div>
        </div>

        {/* 主牌阵 - 响应式 8 列 */}
        <div className="flex-1 grid grid-cols-8 gap-1 sm:gap-4 items-start">
          {state.cascades.map((p, i) => (
            <div key={i} className="flex flex-col items-center h-full relative" onClick={() => p.length === 0 && handleCardClick({type:'cascade', index:i}, [])}>
              {p.map((c, idx) => {
                const isSelected = selected?.location.type === 'cascade' && selected.location.index === i && selected.cards.some(sc => sc.id === c.id);
                const isVisible = (i * 7 + idx) < visibleCount; // 简化的派牌动画控制
                if (!isVisible) return null;
                return (
                  <div key={c.id} className={`cascade-item w-full ${isDealing ? 'card-deal-anim' : ''}`} style={{zIndex: idx, animationDelay: `${idx*0.05}s`}}>
                    <CardUI 
                      card={c} 
                      isSelected={isSelected} 
                      className={`${invalidMoveLocation?.type === 'cascade' && invalidMoveLocation.index === i && isSelected ? 'invalid-shake' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleCardClick({type:'cascade', index:i}, p, idx); }}
                      onDoubleClick={(e) => { e.stopPropagation(); handleQuickMove(c, {type:'cascade', index:i}); }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </main>

      {/* 难度选择 Overlay */}
      {state.gameStatus === 'selecting' && (
        <div className="fixed inset-0 z-[100] bg-[#0d2215]/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="max-w-md w-full flex flex-col gap-6">
            <h2 className="text-5xl font-black text-center mb-8 italic tracking-tighter text-white uppercase">FREECELL</h2>
            <button onClick={() => initGame('easy')} className="w-full p-8 bg-emerald-800 rounded-3xl border border-emerald-400/30 flex items-center justify-between active:scale-95 transition-all">
              <div className="text-left"><span className="text-3xl font-black block">轻松模式</span><span className="text-emerald-400/60 font-bold">无限制移牌</span></div>
              <Sparkles size={40}/>
            </button>
            <button onClick={() => initGame('medium')} className="w-full p-8 bg-emerald-950 rounded-3xl border border-white/10 flex items-center justify-between active:scale-95 transition-all">
              <div className="text-left"><span className="text-3xl font-black block">经典模式</span><span className="text-white/40 font-bold">遵循空位规则</span></div>
              <BrainCircuit size={40}/>
            </button>
          </div>
        </div>
      )}

      {/* 胜利结算 Overlay */}
      {state.gameStatus === 'won' && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
           <Trophy size={120} className="text-yellow-400 mb-8 animate-bounce" />
           <h2 className="text-6xl font-black mb-4">游戏胜利！</h2>
           <p className="text-2xl text-white/60 mb-12">总步数: {state.moves} | 时间: {Math.floor(state.timer/60)}:{state.timer%60}</p>
           <button onClick={() => setState(p=>({...p, gameStatus:'selecting'}))} className="bg-emerald-500 text-black px-12 py-5 rounded-2xl font-black text-3xl active:scale-95 transition-all">再来一局</button>
        </div>
      )}
    </div>
  );
};

export default App;
