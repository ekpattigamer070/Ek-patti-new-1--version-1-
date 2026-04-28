import { Rank, Suit, Card, HandRank, Hand } from './types';

export const SUITS: Suit[] = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const SUIT_STRENGTH: Record<Suit, number> = {
  'Spades': 4,
  'Hearts': 3,
  'Clubs': 2,
  'Diamonds': 1,
};

export const RANK_STRENGTH: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

// Special Sequence Order: 2-3-5 (highest), A-K-Q, A-2-3, K-Q-J, ... 4-3-2
export function getSequenceStrength(ranks: Rank[]): number {
  const sortedRanks = [...ranks].sort((a, b) => RANK_STRENGTH[b] - RANK_STRENGTH[a]);
  const rankStr = sortedRanks.join('-');

  if (rankStr === '5-3-2') return 100; // Highest
  if (rankStr === 'A-K-Q') return 99;
  if (rankStr === 'A-3-2') return 98;
  
  // Standard sequences
  const values = sortedRanks.map(r => RANK_STRENGTH[r]);
  if (values[0] === values[1] + 1 && values[1] === values[2] + 1) {
    return values[0]; // Strength based on high card
  }
  
  // A-2-3 sequence (A is low here)
  if (rankStr === 'A-3-2') return RANK_STRENGTH['3'];

  return 0;
}

export function getHandStrength(cards: Card[]): Hand {
  const ranks = cards.map(c => c.rank);
  const suits = cards.map(c => c.suit);
  const sortedCards = [...cards].sort((a, b) => RANK_STRENGTH[b.rank] - RANK_STRENGTH[a.rank]);

  // Trail
  if (ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
    return { rank: HandRank.Trail, cards: sortedCards, strength: RANK_STRENGTH[ranks[0]] };
  }

  const seqStrength = getSequenceStrength(ranks);
  const isColor = suits[0] === suits[1] && suits[1] === suits[2];

  // Pure Sequence
  if (seqStrength > 0 && isColor) {
    return { rank: HandRank.PureSequence, cards: sortedCards, strength: seqStrength };
  }

  // Sequence
  if (seqStrength > 0) {
    return { rank: HandRank.Sequence, cards: sortedCards, strength: seqStrength };
  }

  // Color
  if (isColor) {
    return { rank: HandRank.Color, cards: sortedCards, strength: RANK_STRENGTH[sortedCards[0].rank] };
  }

  // Pair
  const rankCounts: Record<string, number> = {};
  ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
  const pairRank = Object.keys(rankCounts).find(r => rankCounts[r] === 2);
  if (pairRank) {
    return { rank: HandRank.Pair, cards: sortedCards, strength: RANK_STRENGTH[pairRank as Rank] };
  }

  // High Card
  return { rank: HandRank.HighCard, cards: sortedCards, strength: RANK_STRENGTH[sortedCards[0].rank] };
}

export function getBestImaginaryHand(privateCard: Card, middleCard: Card): Hand {
  let bestHand: Hand | null = null;

  // Iterate through all possible imaginary cards to find the best one
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const imaginaryCard: Card = { suit, rank };
      const currentHand = getHandStrength([privateCard, middleCard, imaginaryCard]);

      if (!bestHand || compareHands(currentHand, bestHand, privateCard, privateCard) > 0) {
        bestHand = currentHand;
      }
    }
  }

  return bestHand!;
}

export function compareHands(h1: Hand, h2: Hand, p1Private: Card, p2Private: Card): number {
  if (h1.rank !== h2.rank) {
    return h1.rank - h2.rank;
  }
  
  if (h1.strength !== h2.strength) {
    return h1.strength - h2.strength;
  }

  // Tiebreakers:
  // 1. Higher PRIVATE CARD rank wins
  if (RANK_STRENGTH[p1Private.rank] !== RANK_STRENGTH[p2Private.rank]) {
    return RANK_STRENGTH[p1Private.rank] - RANK_STRENGTH[p2Private.rank];
  }

  // 2. Suit ranking: Spades > Hearts > Clubs > Diamonds
  return SUIT_STRENGTH[p1Private.suit] - SUIT_STRENGTH[p2Private.suit];
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}
