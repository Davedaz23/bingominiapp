import { motion } from 'framer-motion';
import { Target, Users, Play, Trophy, Clock } from 'lucide-react';

interface GameStatusDisplayProps {
  gameStatus: 'WAITING_FOR_PLAYERS' | 'ACTIVE'|'CARD_SELECTION' |'COOLDOWN'| 'FINISHED' |'NO_WINNER' | 'RESTARTING';
  currentPlayers: number;
  restartCountdown: number;
  selectedNumber: number | null;
  walletBalance: number;
  shouldEnableCardSelection: boolean;
   autoStartTimeRemaining?: number; // ADD THIS
  hasAutoStartTimer?: boolean; // ADD THIS
    hasRestartCooldown: boolean;
  restartCooldownRemaining: number;
  
}

export const GameStatusDisplay: React.FC<GameStatusDisplayProps> = ({
  gameStatus,
  currentPlayers,
  restartCountdown,
  selectedNumber,
  walletBalance,
  shouldEnableCardSelection,
   autoStartTimeRemaining = 0,
   
  hasAutoStartTimer = false
}) => {
  const getStatusMessage = () => {
    const players = currentPlayers || 0;
    const minPlayers = 2;
    
    const canSelectCards = shouldEnableCardSelection;
    // AUTO-START COUNTDOWN
    // if (hasAutoStartTimer && autoStartTimeRemaining > 0) {
    //   const secondsRemaining = Math.ceil(autoStartTimeRemaining / 1000);
    //   return {
    //     message: '🚀 Game Starting Soon!',
    //     description: `Auto-starting in ${secondsRemaining}s (${players}/2 players ready)`,
    //     color: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
    //     icon: <Clock className="w-5 h-5" />,
    //     showAutoStartCountdown: true
    //   };
    // }
    switch (gameStatus) {
      case 'WAITING_FOR_PLAYERS':
        const playersNeeded = Math.max(0, minPlayers - players);
        
        return {
          message: canSelectCards ? '🎯 Select Your Card!' : '🕒 Waiting for Players',
          description: canSelectCards 
            ? `${players}/${minPlayers} players - Choose your card number to join`
            : playersNeeded > 0 
              ? `${players}/${minPlayers} players - Need ${playersNeeded} more to start`
              : `${players}/${minPlayers} players - Ready to start!`,
          color: canSelectCards 
            ? 'bg-green-500/20 border-green-500/30 text-green-300'
            : 'bg-blue-500/20 border-blue-500/30 text-blue-300',
          icon: canSelectCards ? <Target className="w-5 h-5" /> : <Users className="w-5 h-5" />
        };
      
      case 'ACTIVE':
        const activeMessage = !selectedNumber 
          ? `${players} players playing - ${walletBalance >= 10 ? 'Game in progress' : 'Watch live game'}`
          : walletBalance >= 10 
            ? `${players} players playing - Auto-joining with card #${selectedNumber}...`
            : `${players} players playing - Joining as spectator...`;
        
        return {
          message: selectedNumber && walletBalance >= 10 ? '🚀 Joining Game!' : '🎯 Game in Progress',
          description: activeMessage,
          color: 'bg-green-500/20 border-green-500/30 text-green-300',
          icon: <Play className="w-5 h-5" />
        };
      
      case 'FINISHED':
        return {
          message: canSelectCards ? '🔄 Next Game Starting Soon!' : '🏁 Game Finished',
          description: canSelectCards 
            ? `Select your card for the next game (${restartCountdown}s)`
            : `New game starting in ${restartCountdown}s`,
          color: canSelectCards 
            ? 'bg-orange-500/20 border-orange-500/30 text-orange-300'
            : 'bg-purple-500/20 border-purple-500/30 text-purple-300',
          icon: canSelectCards ? <Clock className="w-5 h-5" /> : <Trophy className="w-5 h-5" />
        };
      
      case 'RESTARTING':
        return {
          message: '🔄 Starting New Game...',
          description: 'Please wait while we set up a new game',
          color: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
          icon: <Clock className="w-5 h-5" />
        };
      
      default:
        return {
          message: '❓ Checking Game Status...',
          description: 'Please wait...',
          color: 'bg-gray-500/20 border-gray-500/30 text-gray-300',
          icon: <Clock className="w-5 h-5" />
        };
    }
  };

  const statusInfo = getStatusMessage();

  return (
    <motion.div 
      className={`backdrop-blur-lg rounded-2xl p-4 mb-6 border ${statusInfo.color}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        {statusInfo.icon}
        <p className="font-bold text-lg">{statusInfo.message}</p>
      </div>
      <p className="text-sm text-center">{statusInfo.description}</p>
       
      {/* AUTO-START COUNTDOWN */}
      {/* {statusInfo.showAutoStartCountdown && autoStartTimeRemaining > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-white/80 mb-1">
            <span>Game starts in:</span>
            <span className="font-bold">{Math.ceil(autoStartTimeRemaining / 1000)}s</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-orange-400 to-red-400 h-2 rounded-full transition-all duration-1000"
              style={{ 
                width: `${((30000 - autoStartTimeRemaining) / 30000) * 100}%` 
              }}
            />
          </div>
        </div>
      )} */}
     {gameStatus === 'FINISHED' || gameStatus === 'NO_WINNER' && restartCountdown > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-white/80 mb-1">
            <span>Next game starts in:</span>
            <span className="font-bold">{restartCountdown}s</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${((30 - restartCountdown) / 30) * 100}%` }}
            />
          </div>
        </div>
      )}
      
      {gameStatus === 'WAITING_FOR_PLAYERS' && (
        <p className="text-yellow-300 text-sm text-center mt-2">
          ⏳ Need at least 2 players to start the game. Currently: {currentPlayers}/2
        </p>
      )}
    </motion.div>
  );
};