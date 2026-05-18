import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithRedirect, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { GameState, Player } from './types';
import { createGame, joinGame, startGame, flipMiddleCard, initiateBackShow, respondToBackShow, resetRound, clearShowResult } from './gameService';
import { PlayerSeat } from './components/PlayerSeat';
import { Card } from './components/Card';
import { getBestImaginaryHand, compareHands, RANK_STRENGTH } from './gameLogic';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, Play, RefreshCw, ShieldAlert, LogIn, AlertCircle, X, History } from 'lucide-react';
import { cn } from './lib/utils';

const HAND_NAMES = ['High Card', 'Pair', 'Color', 'Sequence', 'Pure Sequence', 'Trail'];

const HistoryOverlay = ({ history, onClose }: { history: string[], onClose: () => void }) => {
  const parseCardString = (s: string): { rank: string, suit: string } => {
    const suits = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
    for (const suit of suits) {
      if (s.endsWith(suit)) {
        return { rank: s.replace(suit, ''), suit };
      }
    }
    return { rank: '', suit: '' };
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <History className="text-yellow-400" size={20} />
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Card History</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {history && history.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {history.map((cardStr, i) => {
                const card = parseCardString(cardStr);
                const isLatest = i === history.length - 1;
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={cn(
                      "p-1 rounded-lg transition-all",
                      isLatest ? "bg-yellow-400/20 ring-2 ring-yellow-400" : "bg-white/5"
                    )}>
                      <Card card={card as any} size="sm" className="scale-75 sm:scale-90" />
                    </div>
                    <span className="text-[8px] text-slate-500 font-bold">#{i + 1}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 italic">
              <AlertCircle size={32} className="mb-2 opacity-20" />
              No history yet
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-white/5 text-center">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Showing all middle cards from this round</p>
        </div>
      </motion.div>
    </motion.div>
  );
};

const ShowResultOverlay = ({ game, userUid, onClose }: { game: GameState, userUid: string, onClose: () => void }) => {
  if (!game.showResult) return null;
  
  const winner = game.players.find(p => p.uid === game.showResult?.winnerUid);
  const loser = game.players.find(p => p.uid === game.showResult?.loserUid);
  const challengerUid = game.showResult.challengerUid;
  
  const challengerHand = game.showResult.challengerHand;
  const targetHand = game.showResult.targetHand;

  const isWinner = userUid === game.showResult.winnerUid;
  const isLoser = userUid === game.showResult.loserUid;

  const winnerCard = game.showResult.winnerCard;
  const loserCard = game.showResult.loserCard;

  const isPrivateCard = (c: any, privateCard: any) => {
    return c.rank === privateCard.rank && c.suit === privateCard.suit;
  };

  // Rule: Participants (winner/loser) can see both hands. Spectators see neither.
  const canSeeWinnerHand = isWinner || isLoser;
  const canSeeLoserHand = isWinner || isLoser;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-red-500"></div>
        
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 text-slate-500 hover:text-white transition-colors z-20"
        >
          <X size={24} />
        </button>

        <div className="text-center mb-4 sm:mb-8">
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tighter mb-1 sm:mb-2 italic">SHOWDOWN!</h2>
          <div className="text-yellow-400 font-bold uppercase tracking-widest text-[10px] sm:text-sm">Winner Declared</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 landscape:grid-cols-2 gap-4 sm:gap-8 items-center max-h-[50vh] overflow-y-auto landscape:max-h-none landscape:overflow-visible pr-1 custom-scrollbar">
          {/* Winner Side */}
          <div className="flex flex-col items-center gap-2 sm:gap-4 p-3 sm:p-6 rounded-2xl bg-green-500/10 border border-green-500/20 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-black text-[8px] sm:text-[10px] font-black px-2 sm:px-3 py-1 rounded-full uppercase">Winner</div>
            <img src={winner?.photoURL} className="w-12 h-12 sm:w-20 sm:h-20 rounded-full border-2 sm:border-4 border-green-500 shadow-lg shadow-green-500/20" referrerPolicy="no-referrer" />
            <div className="text-center">
              <div className="text-sm sm:text-xl font-bold text-white">{winner?.displayName}</div>
              <div className="text-green-400 font-bold text-[10px] sm:text-sm h-4 sm:h-5">
                {canSeeWinnerHand ? (
                  winner?.uid === challengerUid ? HAND_NAMES[challengerHand.rank] : HAND_NAMES[targetHand.rank]
                ) : (
                  <span className="text-slate-500 italic">Hand Hidden</span>
                )}
              </div>
            </div>
            <div className="flex gap-1 sm:gap-2">
              {(winner?.uid === challengerUid ? challengerHand : targetHand).cards.map((c, i) => (
                <Card 
                  key={i} 
                  card={c} 
                  size="sm" 
                  hidden={!canSeeWinnerHand} 
                  className={cn(
                    "scale-75 sm:scale-100",
                    isPrivateCard(c, winnerCard) && !(!canSeeWinnerHand) && "border-2 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)] -translate-y-1 sm:-translate-y-2"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Loser Side */}
          <div className="flex flex-col items-center gap-2 sm:gap-4 p-3 sm:p-6 rounded-2xl bg-red-500/10 border border-red-500/20 relative grayscale opacity-60">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] sm:text-[10px] font-black px-2 sm:px-3 py-1 rounded-full uppercase">Eliminated</div>
            <img src={loser?.photoURL} className="w-12 h-12 sm:w-20 sm:h-20 rounded-full border-2 sm:border-4 border-red-500" referrerPolicy="no-referrer" />
            <div className="text-center">
              <div className="text-sm sm:text-xl font-bold text-white">{loser?.displayName}</div>
              <div className="text-red-400 font-bold text-[10px] sm:text-sm h-4 sm:h-5">
                {canSeeLoserHand ? (
                  loser?.uid === challengerUid ? HAND_NAMES[challengerHand.rank] : HAND_NAMES[targetHand.rank]
                ) : (
                  <span className="text-slate-500 italic">Hand Hidden</span>
                )}
              </div>
            </div>
            <div className="flex gap-1 sm:gap-2">
              {(loser?.uid === challengerUid ? challengerHand : targetHand).cards.map((c, i) => (
                <Card 
                  key={i} 
                  card={c} 
                  size="sm" 
                  hidden={!canSeeLoserHand} 
                  className={cn(
                    "scale-75 sm:scale-100",
                    isPrivateCard(c, loserCard) && !(!canSeeLoserHand) && "border-2 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)] -translate-y-1 sm:-translate-y-2"
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 sm:mt-8 flex justify-center">
          <button 
            onClick={onClose}
            className="bg-white text-black font-black px-6 sm:px-12 py-2 sm:py-4 rounded-xl hover:bg-yellow-400 transition-all active:scale-95 uppercase tracking-tighter text-xs sm:text-base"
          >
            Continue
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameIdInput, setGameIdInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [lastAutoActTime, setLastAutoActTime] = useState(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  // Orientation logic
  useEffect(() => {
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    handleResize(); // Initial check
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!game?.id) return;
    const unsubscribe = onSnapshot(doc(db, 'games', game.id), (doc) => {
      if (doc.exists()) {
        setGame(doc.data() as GameState);
      }
    });
    return unsubscribe;
  }, [game?.id]);

  // Timer and Auto-Action Logic
  useEffect(() => {
    if (!game || game.status !== 'playing' || !user) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - game.turnStartTime) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setTimeLeft(remaining);

      // Auto-Action Logic
      if (remaining === 0 && lastAutoActTime !== game.turnStartTime) {
        const turnPlayer = game.players[game.turnIndex];
        const challengedPlayerUid = game.backShowChallenge?.targetUid;
        const isMyTurn = turnPlayer?.uid === user.uid && !game.backShowChallenge;
        const isMyChallenge = challengedPlayerUid === user.uid;

        if (isMyTurn || isMyChallenge) {
          setLastAutoActTime(game.turnStartTime);
          handleAutoAction();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [game?.turnStartTime, game?.status, user?.uid, lastAutoActTime]);

  const handleAutoAction = async () => {
    if (!game || !user) return;

    // Safety check: fetch fresh state
    const gameRef = doc(db, 'games', game.id);
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) return;
    const freshGame = gameSnap.data() as GameState;

    // Verify it's still the same turn/challenge
    if (freshGame.turnStartTime !== game.turnStartTime) return;

    if (freshGame.backShowChallenge) {
      // Back Show Auto-Action
      if (freshGame.backShowChallenge.targetUid === user.uid) {
        const me = freshGame.players.find(p => p.uid === user.uid);
        if (me) {
          if (me.declines > 0) {
            await respondToBackShow(game.id, false, true);
          } else {
            await respondToBackShow(game.id, true, true);
          }
        }
      }
    } else {
      // Normal Turn Auto-Action
      if (freshGame.players[freshGame.turnIndex].uid === user.uid) {
        await flipMiddleCard(game.id, true);
      }
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err) {
      setError('Login failed');
    }
  };

  const handleCreateGame = async () => {
    if (!user) return;
    try {
      const player: Player = {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        photoURL: user.photoURL || '',
        card: null,
        declines: 3,
        isEliminated: false,
        wins: 0,
        isReady: true,
      };
      const id = await createGame(player);
      setGameIdInput(id);
      setGame({ id, players: [], status: 'waiting' } as any);
    } catch (err) {
      setError('Failed to create game');
    }
  };

  const handleJoinGame = async () => {
    if (!user || !gameIdInput) return;
    try {
      const player: Player = {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        photoURL: user.photoURL || '',
        card: null,
        declines: 3,
        isEliminated: false,
        wins: 0,
        isReady: true,
      };
      await joinGame(gameIdInput, player);
      setGame({ id: gameIdInput } as GameState);
    } catch (err) {
      setError('Failed to join game');
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-black italic tracking-widest animate-pulse">LOADING...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 text-center"
        >
          <h1 className="text-5xl font-black mb-2 tracking-tighter text-yellow-400">EK PATTI</h1>
          <p className="text-slate-400 mb-8 italic">One Card. One Middle. One Imaginary. Pure Strategy.</p>
          
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-bold py-4 rounded-xl hover:bg-slate-100 transition-all active:scale-95"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (!game || game.status === 'waiting' || !game.players || game.players.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Users className="text-blue-400" />
            {(!game || !game.players || game.players.length === 0) ? 'Join or Create' : 'Game Lobby'}
          </h2>
          
          {(!game || !game.players || game.players.length === 0) ? (
            <div className="space-y-6">
              <button 
                onClick={handleCreateGame}
                className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-4 rounded-xl transition-all active:scale-95"
              >
                Create New Game
              </button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-700"></span></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-800 px-2 text-slate-500">Or Join Existing</span></div>
              </div>
              
              <div className="flex gap-2">
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={gameIdInput}
                  onChange={(e) => setGameIdInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="4-Digit Code"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono tracking-widest"
                />
                <button 
                  onClick={handleJoinGame}
                  disabled={gameIdInput.length !== 4}
                  className={cn(
                    "px-6 rounded-xl font-bold transition-all active:scale-95",
                    gameIdInput.length === 4 ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-slate-800 text-slate-600 cursor-not-allowed"
                  )}
                >
                  Join
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 text-center">
                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Game ID</div>
                <div className="text-3xl font-mono font-bold tracking-widest text-yellow-400">{game.id}</div>
              </div>
              
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                <div className="text-sm text-slate-400 font-bold uppercase sticky top-0 bg-slate-800 z-10 py-1">Players ({game.players.length}/6)</div>
                {game.players.map(p => (
                  <div key={p.uid} className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                    <img src={p.photoURL} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                    <span className="font-medium">{p.displayName}</span>
                    {p.uid === user.uid && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full ml-auto">YOU</span>}
                  </div>
                ))}
              </div>
              
              {game.players[0]?.uid === user.uid && game.players.length >= 2 && (
                <button 
                  onClick={() => startGame(game.id)}
                  className="w-full bg-green-600 hover:bg-green-500 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Play size={20} />
                  Start Game
                </button>
              )}
              
              {game.players.length < 2 && (
                <p className="text-center text-sm text-slate-500 italic">Waiting for at least 2 players...</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentPlayer = game.players.find(p => p.uid === user.uid);
  if (!currentPlayer) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Joining Game...</div>;

  const turnPlayer = game.players[game.turnIndex];
  const isMyTurn = turnPlayer?.uid === user.uid;
  const isChallenged = game.backShowChallenge?.targetUid === user.uid;
  
  // Calculate player positions around the table
  const getPosition = (index: number) => {
    const myIndex = game.players.findIndex(p => p.uid === user.uid);
    const relativeIndex = (index - myIndex + game.players.length) % game.players.length;
    
    // Positions for up to 6 players
    const positions = [
      { bottom: isLandscape ? '15%' : '10%', left: '50%', transform: 'translateX(-50%)' }, // Self (Bottom)
      { bottom: isLandscape ? '25%' : '30%', left: isLandscape ? '15%' : '10%', transform: 'translateY(-50%)' }, // Left Bottom
      { top: isLandscape ? '25%' : '30%', left: isLandscape ? '15%' : '10%', transform: 'translateY(-50%)' },    // Left Top
      { top: isLandscape ? '15%' : '10%', left: '50%', transform: 'translateX(-50%)' },    // Top
      { top: isLandscape ? '25%' : '30%', right: isLandscape ? '15%' : '10%', transform: 'translateY(-50%)' },   // Right Top
      { bottom: isLandscape ? '25%' : '30%', right: isLandscape ? '15%' : '10%', transform: 'translateY(-50%)' }, // Right Bottom
    ];
    
    // Adjust based on total players
    if (game.players.length === 2) {
      return relativeIndex === 0 ? positions[0] : positions[3];
    }
    if (game.players.length === 3) {
      const pos = [positions[0], positions[2], positions[4]];
      return pos[relativeIndex];
    }
    if (game.players.length === 4) {
      const pos = [positions[0], positions[1], positions[3], positions[5]];
      return pos[relativeIndex];
    }
    if (game.players.length === 5) {
      const pos = [positions[0], positions[1], positions[2], positions[4], positions[5]];
      return pos[relativeIndex];
    }
    
    return positions[relativeIndex];
  };

  // Calculate profile positions outside the table
  const getProfilePosition = (index: number) => {
    const myIndex = game.players.findIndex(p => p.uid === user.uid);
    const relativeIndex = (index - myIndex + game.players.length) % game.players.length;
    
    // Local player is always bottom center
    if (relativeIndex === 0) {
      return { bottom: '0px', left: '50%', transform: 'translateX(-50%)' };
    }

    // Positions for opponents outside the table
    if (game.players.length === 2) {
      return { top: isLandscape ? '10px' : '40px', left: '50%', transform: 'translateX(-50%)' };
    }
    
    if (game.players.length === 3) {
      const pos = [
        null, // Self
        { top: isLandscape ? '10px' : '60px', left: isLandscape ? '15%' : '10%', transform: 'none' }, // Opponent 1 (Top Left)
        { top: isLandscape ? '10px' : '60px', right: isLandscape ? '15%' : '10%', transform: 'none' }, // Opponent 2 (Top Right)
      ];
      return pos[relativeIndex];
    }

    // For 4-6 players: middle-left, top-left, top-center, top-right, middle-right
    const positions = [
      { bottom: isLandscape ? '5px' : '0px', left: '50%', transform: 'translateX(-50%)' }, // Self (Bottom)
      { top: '45%', left: isLandscape ? '10%' : '5%', transform: 'translateY(-50%)' },     // Middle Left
      { top: isLandscape ? '10px' : '70px', left: isLandscape ? '20%' : '14%', transform: 'none' },               // Top Left
      { top: isLandscape ? '10px' : '45px', left: '50%', transform: 'translateX(-50%)' },    // Top Center
      { top: isLandscape ? '10px' : '70px', right: isLandscape ? '20%' : '14%', transform: 'none' },              // Top Right
      { top: '45%', right: isLandscape ? '10%' : '5%', transform: 'translateY(-50%)' },    // Middle Right
    ];

    if (game.players.length === 4) {
      const pos = [positions[0], positions[1], positions[3], positions[5]];
      return pos[relativeIndex];
    }

    if (game.players.length === 5) {
      const pos = [positions[0], positions[1], positions[2], positions[4], positions[5]];
      return pos[relativeIndex];
    }
    
    return positions[relativeIndex];
  };

  const myBestHand = currentPlayer.card && game.middleCard ? getBestImaginaryHand(currentPlayer.card, game.middleCard) : null;

  return (
    <div className="min-h-screen h-[100dvh] bg-slate-950 flex flex-col overflow-hidden relative select-none">
      {/* App Header */}
      <div className="absolute top-0 left-0 w-full p-2 sm:p-4 flex justify-between items-center z-30 pointer-events-none">
        <div className="flex flex-col pointer-events-auto">
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tighter italic leading-none">EK PATTI</h1>
          <div className="text-[8px] sm:text-[10px] text-yellow-500 font-bold uppercase tracking-widest">Round {game.roundNumber} / {game.players.length}</div>
        </div>
        <button 
          onClick={() => setIsHistoryOpen(true)}
          className="p-1.5 sm:p-2 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all pointer-events-auto border border-white/10 backdrop-blur-sm"
        >
          <History size={16} className="sm:w-5 sm:h-5" />
        </button>
      </div>

      <AnimatePresence>
        {game.showResult && (
          <ShowResultOverlay 
            game={game} 
            userUid={user.uid}
            onClose={() => clearShowResult(game.id)} 
          />
        )}
        {isHistoryOpen && (
          <HistoryOverlay 
            history={game.middleCardHistory} 
            onClose={() => setIsHistoryOpen(false)} 
          />
        )}
      </AnimatePresence>

      {/* Table Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-2 sm:p-8 mb-24 landscape:mb-0 landscape:pb-16 sm:mb-40 portrait:mb-28">
        
        {/* Player Profiles (Outside Table) */}
        {game.players.map((p, i) => {
          const pos = getProfilePosition(i);
          if (!pos) return null;
          
          return (
            <div key={`profile-${p.uid}`} className="absolute z-20" style={pos}>
              <PlayerSeat 
                player={p}
                isCurrentTurn={game.turnIndex === i && game.status === 'playing'}
                isSelf={p.uid === user.uid}
                position={{}}
                isChallenged={game.backShowChallenge?.targetUid === p.uid}
                timeLeft={game.status === 'playing' && (
                  (game.backShowChallenge?.targetUid === p.uid) || 
                  (!game.backShowChallenge && game.turnIndex === i)
                ) ? timeLeft : undefined}
                timerType={game.backShowChallenge?.targetUid === p.uid ? 'challenge' : 'turn'}
                showProfileOnly
                isLandscape={isLandscape}
              />
            </div>
          );
        })}

        {/* The Table */}
        <div className="w-[75vw] h-[75vw] landscape:w-[65vh] landscape:h-[65vh] sm:w-[85vw] sm:h-[60vh] max-w-5xl max-h-[550px] aspect-square sm:aspect-auto bg-emerald-900 rounded-full sm:rounded-[200px] border-[6px] sm:border-[12px] border-amber-900 shadow-[0_0_100px_rgba(0,0,0,0.5)] relative flex items-center justify-center transition-all duration-500">
          <div className="absolute inset-1 sm:inset-4 border border-emerald-800 rounded-full sm:rounded-[180px] opacity-30"></div>
          
          {/* Action Banner (Inside Table) */}
          <AnimatePresence>
            {game.lastAction && (
              <motion.div 
                key={game.lastAction.timestamp}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-2 sm:top-8 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1 rounded-2xl text-white text-[10px] sm:text-sm font-bold z-50 pointer-events-none text-center min-w-[150px] sm:min-w-[200px]"
              >
                <div className="flex flex-col leading-tight">
                  <span className="text-white truncate max-w-[140px] sm:max-w-[180px]">
                    {game.players.find(p => p.uid === game.lastAction?.playerUid)?.displayName}
                  </span>
                  <span className="text-[8px] sm:text-[10px] text-slate-300 font-medium uppercase tracking-wider">
                    {game.lastAction.type === 'flip' && (game.lastAction.isAuto ? 'auto-flipped' : 'flipped middle')}
                    {game.lastAction.type === 'back_show' && 'initiated SHOW'}
                    {game.lastAction.type === 'accept' && 'accepted'}
                    {game.lastAction.type === 'decline' && 'declined'}
                    {game.lastAction.type === 'start' && 'started'}
                  </span>
                </div>
                {game.lastAction.reshuffled && (
                  <span className="block text-yellow-400 text-[8px] sm:text-[9px] mt-0.5 sm:mt-1 animate-pulse uppercase font-black">
                    Deck Reshuffled
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Middle Card */}
          <div className="flex flex-col items-center gap-1 sm:gap-4 z-10">
            <div className="text-emerald-400 text-[8px] sm:text-xs font-bold uppercase tracking-widest">Middle</div>
            <AnimatePresence mode="wait">
              <motion.div
                key={game.middleCard?.rank + game.middleCard?.suit}
                initial={{ scale: 0.8, opacity: 0, rotateY: 90 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                exit={{ scale: 0.8, opacity: 0, rotateY: -90 }}
              >
                <Card card={game.middleCard} className="w-16 h-24 sm:w-28 sm:h-40 text-xs sm:text-lg" />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Player Cards (On Table) */}
          {game.players.map((p, i) => (
            <PlayerSeat 
              key={`card-${p.uid}`}
              player={p}
              isCurrentTurn={game.turnIndex === i && game.status === 'playing'}
              isSelf={p.uid === user.uid}
              position={getPosition(i)}
              showCardOnly
              isLandscape={isLandscape}
            />
          ))}
        </div>
      </div>

      {/* UI Controls / Info - Fixed Bottom Panel */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-xl border-t border-white/10 p-2 sm:p-6 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] landscape:p-1.5 transition-all">
        <div className="max-w-5xl mx-auto flex flex-row items-center justify-between gap-2 sm:gap-8">
          
          {/* My Hand Info */}
          <div className="flex items-center gap-2 sm:gap-4 justify-start">
            <div className="text-center scale-75 sm:scale-100 origin-left">
              <div className="text-[8px] sm:text-[10px] text-slate-500 uppercase font-bold mb-0.5">Your Card</div>
              <Card card={currentPlayer.card} size="sm" className="shadow-lg border-white/10" />
            </div>
            <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
            <div className="flex flex-col">
              <div className="text-[8px] sm:text-[10px] text-slate-500 uppercase font-bold mb-0.5">Best Hand</div>
              <div className="text-sm sm:text-xl font-black text-white leading-tight">
                {myBestHand ? (
                  <span className="text-yellow-400 drop-shadow-sm">
                    {['High Card', 'Pair', 'Color', 'Sequence', 'Pure Sequence', 'Trail'][myBestHand.rank]}
                  </span>
                ) : '...'}
              </div>
              <div className="flex gap-0.5 sm:gap-1 mt-1 sm:mt-1.5 flex-wrap">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border border-black/20",
                      i < currentPlayer.declines ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-slate-700"
                    )} 
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-1 flex justify-center gap-1.5 sm:gap-4 max-w-xs sm:max-w-md">
            {game.status === 'playing' && !game.backShowChallenge && (
              <>
                <button 
                  disabled={!isMyTurn || currentPlayer.isEliminated}
                  onClick={() => flipMiddleCard(game.id)}
                  className={cn(
                    "flex-1 py-1.5 sm:py-4 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-base flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all active:scale-95 border-b-2 sm:border-b-4",
                    isMyTurn ? "bg-blue-600 border-blue-800 hover:bg-blue-500 text-white shadow-lg" : "bg-slate-800 border-slate-900 text-slate-600 cursor-not-allowed"
                  )}
                >
                  <RefreshCw size={14} className={cn("sm:w-5 sm:h-5", isMyTurn ? "animate-spin-slow" : "")} />
                  <span className="hidden sm:inline">FLIP</span>
                  <span className="sm:hidden">FLIP</span>
                </button>
                <button 
                  disabled={!isMyTurn || currentPlayer.isEliminated}
                  onClick={() => initiateBackShow(game.id)}
                  className={cn(
                    "flex-1 py-1.5 sm:py-4 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-base flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all active:scale-95 border-b-2 sm:border-b-4",
                    isMyTurn ? "bg-red-600 border-red-800 hover:bg-red-500 text-white shadow-lg" : "bg-slate-800 border-slate-900 text-slate-600 cursor-not-allowed"
                  )}
                >
                  <ShieldAlert size={14} className="sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">SHOW</span>
                  <span className="sm:hidden">SHOW</span>
                </button>
              </>
            )}

            {game.status === 'playing' && game.backShowChallenge && isChallenged && (
              <div className="flex gap-1.5 sm:gap-4 w-full">
                <button 
                  onClick={() => respondToBackShow(game.id, true)}
                  className="flex-1 bg-green-600 border-b-2 sm:border-b-4 border-green-800 hover:bg-green-500 py-1.5 sm:py-4 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-sm text-white shadow-lg transition-all active:scale-95 uppercase"
                >
                  Accept
                </button>
                <button 
                  disabled={currentPlayer.declines <= 0}
                  onClick={() => respondToBackShow(game.id, false)}
                  className={cn(
                    "flex-1 py-1.5 sm:py-4 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-sm transition-all active:scale-95 border-b-2 sm:border-b-4 uppercase",
                    currentPlayer.declines > 0 ? "bg-slate-700 border-slate-800 hover:bg-slate-600 text-white" : "bg-slate-800 border-slate-900 text-slate-600 cursor-not-allowed"
                  )}
                >
                  Decline
                </button>
              </div>
            )}

            {game.status === 'round_end' && (
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <div className="text-sm sm:text-xl font-black text-yellow-400 flex items-center gap-1 sm:gap-2">
                  <Trophy size={16} className="sm:w-5 sm:h-5" />
                  <span className="landscape:text-xs">ROUND OVER!</span>
                </div>
                {game.players[0].uid === user.uid && (
                  <button 
                    onClick={() => resetRound(game.id)}
                    className="bg-green-600 border-b-2 sm:border-b-4 border-green-800 hover:bg-green-500 px-4 sm:px-8 py-1 sm:py-2.5 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-base text-white transition-all active:scale-95 whitespace-nowrap"
                  >
                    NEXT ROUND
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Game Status Info */}
          <div className="text-right hidden lg:block">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Round</div>
            <div className="text-xl font-black text-white leading-none">{game.roundNumber} / {game.players.length}</div>
            <div className="text-[10px] text-blue-400 font-bold mt-1">
              {game.status === 'playing' ? (
                isMyTurn ? "YOUR TURN" : `${game.players[game.turnIndex].displayName.toUpperCase()}'S TURN`
              ) : "ROUND ENDED"}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications / Last Action removed from here */}
      
      {error && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold z-50">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Close</button>
        </div>
      )}
    </div>
  );
}
