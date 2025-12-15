// app/page.tsx - SIMPLIFIED AUTO-REDIRECT VERSION
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { gameAPI } from '../services/api';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // ==================== SIMPLIFIED: CHECK AND REDIRECT TO ACTIVE GAME ====================
  useEffect(() => {
    if (authLoading || !user?.id || isChecking || hasChecked) return;

    const checkAndRedirect = async () => {
      setIsChecking(true);
      
      try {
        console.log('🔄 Checking for active games...');
        
        // 1. First, check if user is in any active game
        const activeGamesResponse = await gameAPI.getActiveGames();
        
        if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
          const activeGame = activeGamesResponse.data.games[0];
          
          // Check if this game is ACTIVE (uppercase)
          if (activeGame.status === 'ACTIVE') {
            console.log(`🎯 Found ACTIVE game: ${activeGame._id}, status: ${activeGame.status}`);
            
            // 2. Check if user is a participant in this game
            const participantsResponse = await gameAPI.getGameParticipants(activeGame._id);
            
            if (participantsResponse.data.success) {
              const participants = participantsResponse.data.participants || [];
              const playerParticipant = participants.find((p: any) => p.userId === user.id);
              
              // 3. If user has a card in this ACTIVE game, redirect immediately
              if (playerParticipant && playerParticipant.hasCard) {
                console.log(`✅ User has card #${playerParticipant.cardNumber} in ACTIVE game, redirecting...`);
                setHasChecked(true);
                
                // Add a small delay for better UX
                setTimeout(() => {
                  router.push(`/game/${activeGame._id}`);
                }, 500);
                return;
              }
            }
          }
        }
        
        // 4. If no active game with user's card, check waiting games
        const waitingGamesResponse = await gameAPI.getWaitingGames();
        
        if (waitingGamesResponse.data.success && waitingGamesResponse.data.games.length > 0) {
          const waitingGame = waitingGamesResponse.data.games[0];
          
          if (waitingGame.status === 'WAITING_FOR_PLAYERS') {
            // Check if user has card in this waiting game
            const participantsResponse = await gameAPI.getGameParticipants(waitingGame._id);
            
            if (participantsResponse.data.success) {
              const participants = participantsResponse.data.participants || [];
              const playerParticipant = participants.find((p: any) => p.userId === user.id);
              
              if (playerParticipant && playerParticipant.hasCard) {
                console.log(`⏳ User has card in WAITING game - staying on home page`);
                // DO NOT redirect for WAITING games
                setHasChecked(true);
                return;
              }
            }
          }
        }
        
        // 5. If no game found with user's card, but there are active games, redirect as spectator
        if (activeGamesResponse.data.success && activeGamesResponse.data.games.length > 0) {
          const activeGame = activeGamesResponse.data.games[0];
          if (activeGame.status === 'ACTIVE') {
            console.log(`🎮 Redirecting as spectator to ACTIVE game: ${activeGame._id}`);
            setHasChecked(true);
            
            setTimeout(() => {
              router.push(`/game/${activeGame._id}?spectator=true`);
            }, 500);
            return;
          }
        }
        
        // 6. If nothing found, allow user to stay on home page
        console.log('🏠 No ACTIVE game found for user, staying on home page');
        setHasChecked(true);
        
      } catch (error) {
        console.error('❌ Error checking games:', error);
        setHasChecked(true);
      } finally {
        setIsChecking(false);
      }
    };

    checkAndRedirect();
  }, [authLoading, user, router, isChecking, hasChecked]);

  // ==================== LOADING SCREEN ====================
  if (authLoading || isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-2xl font-bold mb-4">
            {isChecking ? 'Checking for active games...' : 'Loading...'}
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">
            {isChecking ? 'Checking if you are in an active game...' : 'Initializing...'}
          </p>
        </div>
      </div>
    );
  }

  // ==================== MAIN PAGE CONTENT ====================
  // If we've checked and user is not in an active game, show the normal home page
  if (hasChecked && !isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-white font-bold text-xl">Bingo Game</h1>
              <p className="text-white/60 text-sm">Select your card number to play!</p>
            </div>
            {/* Rest of your existing home page content */}
          </div>
        </div>
        
        {/* Your existing home page content goes here */}
        <div className="text-white text-center mt-8">
          <p className="text-lg">Welcome to Bingo!</p>
          <p className="text-sm opacity-75 mt-2">Choose a card number to join a game</p>
        </div>
      </div>
    );
  }

  // Show a simple loading state while checking
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        <p className="mt-4 text-sm">Checking game status...</p>
      </div>
    </div>
  );
}