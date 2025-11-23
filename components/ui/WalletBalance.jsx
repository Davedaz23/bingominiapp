import { useState, useEffect } from 'react';
import { Wallet, Plus, History } from 'lucide-react';

export function WalletBalance() {
  const [balance, setBalance] = useState(0);
  const [showDeposit, setShowDeposit] = useState(false);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    fetchBalance();
    fetchRecentTransactions();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/wallet/balance');
      const data = await response.json();
      if (data.success) {
        setBalance(data.balance);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      const response = await fetch('/api/wallet/transactions?limit=5');
      const data = await response.json();
      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  return (
    <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-white" />
          <h3 className="text-white font-bold text-lg">Wallet</h3>
        </div>
        <button
          onClick={() => setShowDeposit(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-2xl font-bold"
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
        {transactions.map((transaction) => (
          <div key={transaction._id} className="flex justify-between items-center p-2 bg-white/10 rounded-xl">
            <div>
              <div className="text-white text-sm font-medium">
                {transaction.description}
              </div>
              <div className="text-white/60 text-xs">
                {new Date(transaction.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className={`font-bold ${
              transaction.amount > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {transaction.amount > 0 ? '+' : ''}${transaction.amount}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}