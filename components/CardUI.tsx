
import React from 'react';
import { Card } from '../types';
import { SUITS, RANKS } from '../constants';

interface CardUIProps {
  card: Card;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export const CardUI: React.FC<CardUIProps> = ({ card, isSelected, onClick, onDoubleClick, className = '' }) => {
  const suitInfo = SUITS[card.suit];
  const isTen = card.rank === 10;
  
  return (
    <div
      onClick={onClick}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(e);
      }}
      className={`
        relative w-[11.5vw] h-[17.25vw] sm:w-24 sm:h-36 bg-white rounded-md sm:rounded-xl border flex flex-col cursor-pointer transition-all select-none
        ${isSelected 
          ? 'border-yellow-400 ring-2 sm:ring-4 ring-yellow-400 scale-105 z-50 shadow-[0_0_20px_rgba(250,204,21,0.6)]' 
          : 'border-gray-200 shadow-sm hover:shadow-md'}
        ${className}
      `}
    >
      {/* 顶部标识区 */}
      <div className={`absolute top-0.5 left-0.5 sm:top-2.5 sm:left-2.5 flex flex-col items-center gap-0 ${suitInfo.color} leading-none z-10 w-full text-center sm:w-6`}>
        <span className={`font-black tracking-tight ${isTen ? 'text-[2.8vw] sm:text-[18px]' : 'text-[3.2vw] sm:text-[20px]'}`}>
          {RANKS[card.rank]}
        </span>
        <span className="text-[3vw] sm:text-[22px]">
          {suitInfo.symbol}
        </span>
      </div>
      
      {/* 中心花色 (移动端略微缩小以免干扰数字读取) */}
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.08] ${suitInfo.color}`}>
        <span className="text-[6vw] sm:text-[32px] select-none">
          {suitInfo.symbol}
        </span>
      </div>

      {/* 底部标识区 (移动端隐藏以保持简洁) */}
      <div className={`hidden sm:flex absolute bottom-2.5 right-2.5 flex-col items-center gap-0.5 rotate-180 ${suitInfo.color} leading-none z-10 w-6`}>
        <span className={`font-black tracking-tight ${isTen ? 'text-[18px]' : 'text-[20px]'}`}>
          {RANKS[card.rank]}
        </span>
        <span className="text-[22px]">
          {suitInfo.symbol}
        </span>
      </div>
      
      {/* 牌面细节叠加 */}
      <div className="absolute inset-0 rounded-md sm:rounded-xl bg-gradient-to-br from-white/80 via-transparent to-gray-100/30 pointer-events-none"></div>
    </div>
  );
};
