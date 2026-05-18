export type Suit = 'Spades' | 'Hearts' | 'Clubs' | 'Diamonds';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export enum HandRank {
  HighCard = 0,
  Pair = 1,
  Color = 2,
  Sequence = 3,
  PureSequence = 4,
  Trail = 5,
}

export interface Hand {
  rank: HandRank;
  cards: Card[];
  strength: number; // For tie-breaking
}

export interface Player {
  uid: string;
  displayName: string;
  photoURL: string;
  card: Card | null;
  declines: number;
  isEliminated: boolean;
  wins: number;
  isReady: boolean;
}

export interface GameState {
  id: string;
  status: 'waiting' | 'playing' | 'round_end';
  players: Player[];
  middleCard: Card | null;
  middleCardHistory: string[];
  turnIndex: number;
  turnStartTime: number;
  roundNumber: number;
  lastAction: {
    type: 'flip' | 'back_show' | 'accept' | 'decline' | 'start';
    playerUid: string;
    targetUid?: string;
    timestamp: number;
    reshuffled?: boolean;
    isAuto?: boolean;
  } | null;
  backShowChallenge: {
    challengerUid: string;
    targetUid: string;
    status: 'pending' | 'accepted' | 'declined';
  } | null;
  showResult: {
    winnerUid: string;
    loserUid: string;
    winnerCard: Card;
    loserCard: Card;
    challengerUid: string;
    challengerHand: Hand;
    targetHand: Hand;
    timestamp: number;
  } | null;
}
