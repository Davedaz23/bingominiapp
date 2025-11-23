// Example for App Router (app/deposit/page.tsx)
'use client'; // If you need interactivity

import { useState } from 'react';

export default function DepositPage() {
  const [amount, setAmount] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Add your deposit logic here
    console.log('Deposit amount:', amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center p-4">
      <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-8 border border-white/30 shadow-2xl w-full max-w-md">
        <h1 className="text-3xl font-black text-white mb-2">Deposit Funds</h1>
        <p className="text-white/80 mb-6">Add funds to your wallet to start playing.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="amount" className="block text-white text-sm font-medium mb-2">
              Amount (USD)
            </label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-2xl font-bold transition-colors"
          >
            Proceed to Payment
          </button>
        </form>
      </div>
    </div>
  );
}