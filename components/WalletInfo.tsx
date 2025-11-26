// app/components/WalletInfo.tsx
import type { WalletInfo as WalletInfoType } from '../types';

interface WalletInfoProps {
  wallet: WalletInfoType;
  players: number;
}

export default function WalletInfo({ wallet, players }: WalletInfoProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-sm text-gray-600">Balance</p>
          <p className="text-lg font-bold text-green-600">{wallet.balance} ብር</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Players</p>
          <p className="text-lg font-bold text-blue-600">{players}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">To Win</p>
          <p className="text-lg font-bold text-purple-600">{wallet.potentialWin} ብር</p>
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className="text-sm text-gray-600">Bet Amount: {wallet.betAmount} ብር</p>
      </div>
    </div>
  );
}