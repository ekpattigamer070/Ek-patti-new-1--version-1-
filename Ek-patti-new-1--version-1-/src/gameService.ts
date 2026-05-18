import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  getDoc,
  arrayUnion,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { GameState, Player, Card } from './types';
import { createDeck, shuffleDeck, getBestImaginaryHand, compareHands } from './gameLogic';

const GAMES_COLLECTION = 'games';

export const createGame = async (player: Player) => {
  const gameId = Math.floor(1000 + Math.random() * 9000).toString();
  const gameState: GameState = {
    id: gameId,
    status: 'waiting',
    players: [player],
    middleCard: null,
    turnIndex: 0,
    roundNumber: 1,
    lastAction: {
      type: 'start',
      playerUid: player.uid,
      timestamp: Date.now(),
    },
    backShowChallenge: null,
    showResult: null,
    middleCardHistory: [],
    turnStartTime: Date.now(),
  };
  
  await setDoc(doc(db, GAMES_COLLECTION, gameId), gameState);
  return gameId;
};

export const joinGame = async (gameId: string, player: Player) => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) throw new Error('Game not found');
  
  const game = gameSnap.data() as GameState;
  if (game.players.length >= 6) throw new Error('Game full');
  if (game.players.find(p => p.uid === player.uid)) return;

  await updateDoc(gameRef, {
    players: arrayUnion(player)
  });
};

export const startGame = async (gameId: string) => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  const gameSnap = await getDoc(gameRef);
  const game = gameSnap.data() as GameState;
  
  const deck = shuffleDeck(createDeck());
  const players = game.players.map((p, i) => ({
    ...p,
    card: deck[i],
    declines: 3,
    isEliminated: false,
  }));
  
  const middleCard = deck[players.length];
  
  await updateDoc(gameRef, {
    status: 'playing',
    players,
    middleCard,
    middleCardHistory: [middleCard.rank + middleCard.suit],
    turnIndex: 0,
    turnStartTime: Date.now(),
    lastAction: {
      type: 'start',
      playerUid: auth.currentUser?.uid || '',
      timestamp: Date.now(),
    }
  });
};

export const flipMiddleCard = async (gameId: string, isAuto: boolean = false) => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  const gameSnap = await getDoc(gameRef);
  const game = gameSnap.data() as GameState;
  
  // Build the set of all excluded cards
  const excluded = new Set<string>();

  // Exclude current middle card
  if (game.middleCard) {
    excluded.add(game.middleCard.rank + game.middleCard.suit);
  }

  // Exclude all active (non-eliminated) players’ private cards
  game.players.forEach(player => {
    if (!player.isEliminated && player.card) {
      excluded.add(player.card.rank + player.card.suit);
    }
  });

  // Exclude all previously used middle cards (card history)
  if (game.middleCardHistory && game.middleCardHistory.length > 0) {
    game.middleCardHistory.forEach(historyEntry => {
      excluded.add(historyEntry);
    });
  }

  // Build available pool from full 52-card deck
  const fullDeck = createDeck();
  let available = fullDeck.filter(card => {
    const cardId = card.rank + card.suit;
    return !excluded.has(cardId);
  });

  // Deck exhaustion fallback
  let reshuffled = false;
  if (available.length === 0) {
    reshuffled = true;
    const activePlayerCards = new Set<string>();
    game.players.forEach(player => {
      if (!player.isEliminated && player.card) {
        activePlayerCards.add(player.card.rank + player.card.suit);
      }
    });
    available = fullDeck.filter(card => {
      const cardId = card.rank + card.suit;
      return !activePlayerCards.has(cardId);
    });
  }

  // Draw randomly from the available pool
  const newMiddleCard = available[Math.floor(Math.random() * available.length)];
  
  let nextTurnIndex = (game.turnIndex + 1) % game.players.length;
  while (game.players[nextTurnIndex].isEliminated) {
    nextTurnIndex = (nextTurnIndex + 1) % game.players.length;
  }

  await updateDoc(gameRef, {
    middleCard: newMiddleCard,
    middleCardHistory: reshuffled ? [newMiddleCard.rank + newMiddleCard.suit] : [...(game.middleCardHistory || []), newMiddleCard.rank + newMiddleCard.suit],
    turnIndex: nextTurnIndex,
    turnStartTime: Date.now(),
    lastAction: {
      type: 'flip',
      playerUid: game.players[game.turnIndex].uid,
      timestamp: Date.now(),
      reshuffled,
      isAuto
    }
  });
};

export const initiateBackShow = async (gameId: string) => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  const gameSnap = await getDoc(gameRef);
  const game = gameSnap.data() as GameState;
  
  const currentPlayer = game.players[game.turnIndex];
  
  // Find previous non-eliminated player
  let prevIndex = (game.turnIndex - 1 + game.players.length) % game.players.length;
  while (game.players[prevIndex].isEliminated) {
    prevIndex = (prevIndex - 1 + game.players.length) % game.players.length;
  }
  
  const targetPlayer = game.players[prevIndex];

  await updateDoc(gameRef, {
    backShowChallenge: {
      challengerUid: currentPlayer.uid,
      targetUid: targetPlayer.uid,
      status: 'pending'
    },
    turnStartTime: Date.now(),
    lastAction: {
      type: 'back_show',
      playerUid: currentPlayer.uid,
      targetUid: targetPlayer.uid,
      timestamp: Date.now(),
    }
  });
};

export const respondToBackShow = async (gameId: string, accept: boolean, isAuto: boolean = false) => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  const gameSnap = await getDoc(gameRef);
  const game = gameSnap.data() as GameState;
  
  if (!game.backShowChallenge) return;
  
  const challenger = game.players.find(p => p.uid === game.backShowChallenge!.challengerUid)!;
  const target = game.players.find(p => p.uid === game.backShowChallenge!.targetUid)!;
  
  let updatedPlayers = [...game.players];
  let nextTurnIndex = game.turnIndex;
  let newMiddleCard = game.middleCard;
  let reshuffled = false;

  if (accept) {
    const challengerHand = getBestImaginaryHand(challenger.card!, game.middleCard!);
    const targetHand = getBestImaginaryHand(target.card!, game.middleCard!);
    
    const result = compareHands(challengerHand, targetHand, challenger.card!, target.card!);
    
    let winnerUid = '';
    let loserUid = '';

    if (result > 0) {
      // Challenger wins, target eliminated
      winnerUid = challenger.uid;
      loserUid = target.uid;
      updatedPlayers = updatedPlayers.map(p => p.uid === target.uid ? { ...p, isEliminated: true } : p);
    } else {
      // Target wins, challenger eliminated
      winnerUid = target.uid;
      loserUid = challenger.uid;
      updatedPlayers = updatedPlayers.map(p => p.uid === challenger.uid ? { ...p, isEliminated: true } : p);
    }

    // Set show result for pop-up
    await updateDoc(gameRef, {
      showResult: {
        winnerUid,
        loserUid,
        winnerCard: result > 0 ? challenger.card! : target.card!,
        loserCard: result > 0 ? target.card! : challenger.card!,
        challengerUid: challenger.uid,
        challengerHand,
        targetHand,
        timestamp: Date.now()
      }
    });
  } else {
    // Decline
    updatedPlayers = updatedPlayers.map(p => p.uid === target.uid ? { ...p, declines: p.declines - 1 } : p);
    
    // Build the set of all excluded cards
    const excluded = new Set<string>();

    // Exclude current middle card
    if (game.middleCard) {
      excluded.add(game.middleCard.rank + game.middleCard.suit);
    }

    // Exclude all active (non-eliminated) players’ private cards
    game.players.forEach(player => {
      if (!player.isEliminated && player.card) {
        excluded.add(player.card.rank + player.card.suit);
      }
    });

    // Exclude all previously used middle cards (card history)
    if (game.middleCardHistory && game.middleCardHistory.length > 0) {
      game.middleCardHistory.forEach(historyEntry => {
        excluded.add(historyEntry);
      });
    }

    // Build available pool from full 52-card deck
    const fullDeck = createDeck();
    let available = fullDeck.filter(card => {
      const cardId = card.rank + card.suit;
      return !excluded.has(cardId);
    });

    // Deck exhaustion fallback
    if (available.length === 0) {
      reshuffled = true;
      const activePlayerCards = new Set<string>();
      game.players.forEach(player => {
        if (!player.isEliminated && player.card) {
          activePlayerCards.add(player.card.rank + player.card.suit);
        }
      });
      available = fullDeck.filter(card => {
        const cardId = card.rank + card.suit;
        return !activePlayerCards.has(cardId);
      });
    }

    // Draw randomly from the available pool
    newMiddleCard = available[Math.floor(Math.random() * available.length)];
  }

  // Check if round ended
  const activePlayers = updatedPlayers.filter(p => !p.isEliminated);
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    updatedPlayers = updatedPlayers.map(p => p.uid === winner.uid ? { ...p, wins: p.wins + 1 } : p);
    
    await updateDoc(gameRef, {
      status: 'round_end',
      players: updatedPlayers,
      backShowChallenge: null,
      turnStartTime: Date.now(),
      lastAction: {
        type: accept ? 'accept' : 'decline',
        playerUid: target.uid,
        timestamp: Date.now(),
        isAuto
      }
    });
  } else {
    // Move turn if challenger was eliminated or if it was just a flip/decline
    // In Back Show, if challenger wins, it's still their turn? 
    // Usually turn passes after an action.
    nextTurnIndex = (game.turnIndex + 1) % game.players.length;
    while (updatedPlayers[nextTurnIndex].isEliminated) {
      nextTurnIndex = (nextTurnIndex + 1) % game.players.length;
    }

    await updateDoc(gameRef, {
      players: updatedPlayers,
      turnIndex: nextTurnIndex,
      middleCard: newMiddleCard,
      middleCardHistory: accept ? (game.middleCardHistory || []) : (reshuffled ? [newMiddleCard!.rank + newMiddleCard!.suit] : [...(game.middleCardHistory || []), newMiddleCard!.rank + newMiddleCard!.suit]),
      backShowChallenge: null,
      turnStartTime: Date.now(),
      lastAction: {
        type: accept ? 'accept' : 'decline',
        playerUid: target.uid,
        timestamp: Date.now(),
        reshuffled: !accept && reshuffled,
        isAuto
      }
    });
  }
};

export const resetRound = async (gameId: string) => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  const gameSnap = await getDoc(gameRef);
  const game = gameSnap.data() as GameState;

  const deck = shuffleDeck(createDeck());
  const players = game.players.map((p, i) => ({
    ...p,
    card: deck[i],
    declines: 3,
    isEliminated: false,
  }));
  
  const middleCard = deck[players.length];

  await updateDoc(gameRef, {
    status: 'playing',
    players,
    middleCard,
    middleCardHistory: [middleCard.rank + middleCard.suit],
    turnIndex: game.roundNumber % players.length, // Rotate starting player
    turnStartTime: Date.now(),
    roundNumber: game.roundNumber + 1,
    backShowChallenge: null,
    showResult: null,
    lastAction: {
      type: 'start',
      playerUid: auth.currentUser?.uid || '',
      timestamp: Date.now(),
    }
  });
};

export const clearShowResult = async (gameId: string) => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  await updateDoc(gameRef, {
    showResult: null
  });
};
