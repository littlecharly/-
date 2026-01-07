
import { Card, Suit, Rank, DifficultyLevel } from '../types';

export const createDeck = (difficulty: DifficultyLevel = 'easy'): Card[] => {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const deck: Card[] = [];

  suits.forEach((suit) => {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank: rank as Rank,
        isRed: suit === 'hearts' || suit === 'diamonds',
      });
    }
  });

  return shuffle(deck, difficulty);
};

const shuffle = (array: Card[], difficulty: DifficultyLevel): Card[] => {
  const newArray = [...array];
  // Fisher-Yates shuffle base
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }

  if (difficulty === 'easy') {
    // Strategic Easy Shuffle:
    // 1. Ensure Aces and 2s are very likely to be at the bottom (accessible)
    // 2. Spread high cards towards the top
    const acesAndTwos = newArray.filter(c => c.rank <= 2);
    const midCards = newArray.filter(c => c.rank > 2 && c.rank < 10);
    const highCards = newArray.filter(c => c.rank >= 10);

    const result = [
      ...highCards.sort(() => Math.random() - 0.5),
      ...midCards.sort(() => Math.random() - 0.5),
      ...acesAndTwos.sort(() => Math.random() - 0.5)
    ];
    
    // Slight randomization to avoid deterministic feel
    for (let i = 0; i < 15; i++) {
      const idx1 = Math.floor(Math.random() * result.length);
      const idx2 = Math.floor(Math.random() * result.length);
      // Only swap if they are close in rank or both in the "mid/high" section 
      // to keep Aces mostly near the end
      if (result[idx1].rank > 3 && result[idx2].rank > 3) {
        [result[idx1], result[idx2]] = [result[idx2], result[idx1]];
      }
    }
    return result;
  } else if (difficulty === 'medium') {
    // Medium: Just ensure Aces aren't in the bottom 2 layers of long stacks
    const aces = newArray.filter(c => c.rank === 1);
    const rest = newArray.filter(c => c.rank !== 1);
    
    const result = [...rest];
    // Insert Aces into the last 30 cards (which are the lower half of stacks)
    aces.forEach(ace => {
      const pos = result.length - Math.floor(Math.random() * 30);
      result.splice(pos, 0, ace);
    });
    return result;
  }

  return newArray;
};

export const canMoveToCascade = (movingCard: Card, targetCard: Card | undefined): boolean => {
  if (!targetCard) return true; // Empty column
  return movingCard.isRed !== targetCard.isRed && movingCard.rank === targetCard.rank - 1;
};

export const canMoveToFoundation = (movingCard: Card, foundationPile: Card[]): boolean => {
  if (foundationPile.length === 0) return movingCard.rank === 1; 
  const topCard = foundationPile[foundationPile.length - 1];
  return movingCard.suit === topCard.suit && movingCard.rank === topCard.rank + 1;
};

export const isSequence = (cards: Card[]): boolean => {
  if (cards.length === 0) return true;
  for (let i = 0; i < cards.length - 1; i++) {
    if (!canMoveToCascade(cards[i + 1], cards[i])) return false;
  }
  return true;
};
