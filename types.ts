
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  isRed: boolean;
}

export type SlotType = 'free' | 'foundation' | 'cascade';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface Location {
  type: SlotType;
  index: number;
}

export interface HintedMove {
  from: Location;
  to: Location;
  fromIndex?: number; // The index of the card in the pile where the move starts
}

export interface GameState {
  difficulty: DifficultyLevel;
  cascades: Card[][];
  freeCells: (Card | null)[];
  foundations: Card[][];
  history: {
    cascades: Card[][];
    freeCells: (Card | null)[];
    foundations: Card[][];
  }[];
  moves: number;
  timer: number;
  hintsRemaining: number;
  gameStatus: 'selecting' | 'playing' | 'won' | 'lost';
}
