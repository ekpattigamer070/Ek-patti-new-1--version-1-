import React from 'react';
import { Card as CardType } from '../types';
import { cn } from '../lib/utils';

interface CardProps {
  card: CardType | null;
  hidden?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SUIT_SYMBOLS: Record<string, string> = {
  Spades: '♠',
  Hearts: '♥',
  Clubs: '♣',
  Diamonds: '♦',
};

const SUIT_COLORS: Record<string, string> = {
  Spades: 'text-slate-900',
  Hearts: 'text-red-600',
  Clubs: 'text-slate-900',
  Diamonds: 'text-red-600',
};

export const Card: React.FC<CardProps> = ({ card, hidden, className, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-12 h-16 text-xs',
    md: 'w-20 h-28 text-sm',
    lg: 'w-32 h-44 text-xl',
  };

  if (!card || hidden) {
    return (
      <div className={cn(
        "bg-blue-800 border-2 border-white rounded-lg flex items-center justify-center shadow-lg",
        sizeClasses[size],
        className
      )}>
        <div className="w-full h-full border-4 border-blue-700 rounded-md flex items-center justify-center">
          <div className="text-blue-200 opacity-20 font-bold rotate-45">EK PATTI</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-white border border-slate-200 rounded-lg flex flex-col p-2 shadow-lg relative select-none",
      sizeClasses[size],
      SUIT_COLORS[card.suit],
      className
    )}>
      <div className="font-bold leading-none">{card.rank}</div>
      <div className="text-lg leading-none">{SUIT_SYMBOLS[card.suit]}</div>
      
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
        <div className="text-6xl">{SUIT_SYMBOLS[card.suit]}</div>
      </div>
      
      <div className="mt-auto self-end rotate-180 flex flex-col items-end">
        <div className="font-bold leading-none">{card.rank}</div>
        <div className="text-lg leading-none">{SUIT_SYMBOLS[card.suit]}</div>
      </div>
    </div>
  );
};
