import React from 'react';
import { Player } from '../types';
import { Card } from './Card';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface PlayerSeatProps {
  player: Player;
  isCurrentTurn: boolean;
  isSelf: boolean;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  isChallenged?: boolean;
  timeLeft?: number;
  timerType?: 'turn' | 'challenge';
  showProfileOnly?: boolean;
  showCardOnly?: boolean;
  isLandscape?: boolean;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({ 
  player, 
  isCurrentTurn, 
  isSelf, 
  position,
  isChallenged,
  timeLeft,
  timerType = 'turn',
  showProfileOnly = false,
  showCardOnly = false,
  isLandscape = false
}) => {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = timeLeft !== undefined ? circumference - (timeLeft / 60) * circumference : 0;

  const Profile = (
    <div className={cn("flex flex-col items-center gap-0.5 sm:gap-1", !showProfileOnly && "z-10")}>
      <div className={cn(
        "relative inline-flex items-center justify-center w-12 h-12 sm:w-20 sm:h-20",
        isLandscape && "w-10 h-10 sm:w-14 sm:h-14"
      )}>
        {timeLeft !== undefined && (
          <svg className="absolute inset-0 w-full h-full -rotate-90 z-10 pointer-events-none" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className={cn(
                "transition-all duration-1000 ease-linear",
                timerType === 'turn' ? "text-yellow-500/20" : "text-red-500/20"
              )}
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              style={{ strokeDashoffset }}
              className={cn(
                "transition-all duration-1000 ease-linear",
                timerType === 'turn' ? "text-yellow-500" : "text-red-500"
              )}
            />
          </svg>
        )}
        
        {timeLeft !== undefined && (
          <div className={cn(
            "absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 font-black text-[8px] sm:text-sm z-20 bg-slate-950/80 px-1.5 sm:px-2 py-0.5 rounded-full border border-white/10",
            timerType === 'turn' ? "text-yellow-400" : "text-red-400"
          )}>
            {timeLeft}s
          </div>
        )}

        <motion.div 
          animate={isCurrentTurn ? { scale: 1.05 } : { scale: 1 }}
          className={cn(
            "relative p-0.5 rounded-full border-2 transition-colors z-0",
            isCurrentTurn ? "border-yellow-400" : "border-slate-700",
            player.isEliminated && "grayscale opacity-50",
            isChallenged && "animate-pulse border-red-500"
          )}
        >
          <img 
            src={player.photoURL || `https://picsum.photos/seed/${player.uid}/100/100`} 
            alt={player.displayName}
            className={cn(
              "w-10 h-10 sm:w-14 sm:h-14 rounded-full object-cover",
              isLandscape && "w-8 h-8 sm:w-10 sm:h-10"
            )}
            referrerPolicy="no-referrer"
          />
          
          {player.isEliminated && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
              <span className="text-white font-bold text-[6px] sm:text-[10px] uppercase">OUT</span>
            </div>
          )}
        </motion.div>
      </div>

      <div className="flex flex-col items-center">
        <span className={cn(
          "text-white font-bold text-[7px] sm:text-[10px] px-1 sm:px-2 py-0.5 rounded bg-black/60 whitespace-nowrap",
          isSelf && "text-yellow-400"
        )}>
          {player.displayName}
        </span>
        <div className="flex gap-0.5 sm:gap-1 mt-0.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full border border-black/20",
                i < player.declines ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" : "bg-slate-700"
              )} 
            />
          ))}
        </div>
      </div>
    </div>
  );

  const PlayerCard = (
    <div className={cn("mt-1", isLandscape && "mt-0")}>
      <Card 
        card={player.card} 
        hidden={!isSelf} 
        size="sm" 
        className={cn(
          "scale-50 sm:scale-90 origin-top",
          isLandscape && "scale-[0.4]"
        )}
      />
    </div>
  );

  if (showProfileOnly) return Profile;
  if (showCardOnly) return (
    <div className="absolute flex flex-col items-center transition-all duration-500" style={position}>
      {PlayerCard}
    </div>
  );

  return (
    <div 
      className="absolute flex flex-col items-center gap-1 transition-all duration-500"
      style={position}
    >
      {Profile}
      {PlayerCard}
    </div>
  );
};
