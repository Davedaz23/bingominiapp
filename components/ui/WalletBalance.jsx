import { useState, useEffect } from 'react';
import { Wallet, Plus, History } from 'lucide-react';

export function WalletBalance() {
  const [balance, setBalance] = useState(0);
  const [showDeposit, setShowDeposit] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      await Promise.all([
        fetchBalance(),
        fetchRecentTransactions()
      ]);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        console.error('User ID not found');
        return;
      }

      // const response = await fetch('/api/wallet/balance', {
      //   headers: {
      //     'user-id': userId,
      //     'Content-Type': 'application/json'
      //   }
      // });

       const walletResponse = await walletAPIAuto.getBalance();
            if (walletResponse.data.success) {
              setBalance(walletResponse.data.balance);
            }
      
      // const data = await response.json();
      // if (data.success) {
      //   setBalance(data.balance);
      // } 
      // else {
      //   console.error('Failed to fetch balance:', data.error);
      // }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        console.error('User ID not found');
        return;
      }

      const response = await fetch('/api/wallet/transactions?limit=5', {
        headers: {
          'user-id': userId,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setTransactions(data.transactions || []);
      } else {
        console.error('Failed to fetch transactions:', data.error);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleDepositClick = () => {
    // Navigate to deposit page
    window.location.href = '/deposit';
  };

  if (isLoading) {
    return (
      <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Wallet className="w-6 h-6 text-white" />
            <h3 className="text-white font-bold text-lg">Wallet</h3>
          </div>
          <div className="w-24 h-10 bg-white/20 rounded-2xl animate-pulse" />
        </div>
        <div className="text-center mb-6">
          <div className="text-3xl font-black text-white/50 animate-pulse">$---</div>
          <div className="text-white/60 text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-white" />
          <h3 className="text-white font-bold text-lg">Wallet</h3>
        </div>
        <button
          onClick={handleDepositClick}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Deposit
        </button>
      </div>

      <div className="text-center mb-6">
        <div className="text-3xl font-black text-white">${balance.toFixed(2)}</div>
        <div className="text-white/60 text-sm">Available Balance</div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-white/60 text-sm">
          <span>Recent Transactions</span>
          <History className="w-4 h-4" />
        </div>
        
        {transactions.length === 0 ? (
          <div className="text-center py-4">
            <div className="text-white/50 text-sm">No transactions yet</div>
            <div className="text-white/40 text-xs mt-1">Make a deposit to get started!</div>
          </div>
        ) : (
          transactions.map((transaction) => (
            <div key={transaction._id} className="flex justify-between items-center p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
              <div className="flex-1">
                <div className="text-white text-sm font-medium">
                  {transaction.description}
                </div>
                <div className="text-white/60 text-xs">
                  {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                {transaction.status === 'PENDING' && (
                  <div className="inline-block px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full mt-1 border border-yellow-500/30">
                    Pending
                  </div>
                )}
              </div>
              <div className={`font-bold text-lg ${
                transaction.amount > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/20">
        <div className="text-center">
          <div className="text-white font-bold text-sm">Entry Fee</div>
          <div className="text-green-400 font-black">$10</div>
        </div>
        <div className="text-center">
          <div className="text-white font-bold text-sm">Can Play</div>
          <div className="text-green-400 font-black">
            {Math.floor(balance / 10)} games
          </div>
        </div>
      </div>
    </div>
  );
}