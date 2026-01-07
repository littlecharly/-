
import React from 'react';

export const SUITS: any = {
  hearts: { symbol: '♥', color: 'text-red-600', label: '红心' },
  diamonds: { symbol: '♦', color: 'text-red-600', label: '方块' },
  clubs: { symbol: '♣', color: 'text-black', label: '梅花' },
  spades: { symbol: '♠', color: 'text-black', label: '黑桃' },
};

export const RANKS: Record<number, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

export const INITIAL_CASCADES_COUNT = 8;
export const INITIAL_FREE_CELLS_COUNT = 4;
export const INITIAL_FOUNDATIONS_COUNT = 4;
