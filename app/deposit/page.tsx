/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, CreditCard } from 'lucide-react';
import { walletAPI } from '@/services/api';

export default function DepositPage() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [receiptImage, setReceiptImage] = useState('');
  const [reference, setReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Validate amount
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount < 10) {
      alert('Minimum deposit amount is $10');
      return;
    }

    setIsSubmitting(true);

    try {
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        alert('User not found. Please log in again.');
        router.push('/');
        return;
      }

      // Use the centralized walletAPI service
      const response = await walletAPI.createDeposit(userId, {
        amount: depositAmount,
        receiptImage,
        reference,
        description: `Bank deposit - Ref: ${reference}`
      });

      const data = response.data;
      
      if (data.success) {
        alert('Deposit request submitted! It will be approved within 24 hours.');
        router.push('/');
      } else {
        alert('Deposit failed: ' + data.success);
      }
    } catch (error: any) {
      console.error('Deposit error:', error);
      
      // Enhanced error handling based on API error structure
      const errorMessage = error.response?.data?.error || 
                          error.message || 
                          'Deposit request failed. Please try again.';
      
      alert(`Deposit failed: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-blue-600 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pt-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-3 bg-white/20 backdrop-blur-lg text-white rounded-2xl border border-white/30"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-black text-white">Deposit Funds</h1>
        </div>

        {/* Deposit Form */}
        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/30">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount Input */}
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
                min="10"
                step="0.01"
                className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                required
              />
              <p className="text-white/60 text-xs mt-2">Minimum deposit: $10</p>
            </div>

            {/* Reference Number */}
            <div>
              <label htmlFor="reference" className="block text-white text-sm font-medium mb-2">
                Bank Reference Number
              </label>
              <input
                type="text"
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Enter bank transaction reference"
                className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                required
              />
            </div>

            {/* Receipt Upload */}
            <div>
              <label htmlFor="receipt" className="block text-white text-sm font-medium mb-2">
                Receipt Screenshot URL
              </label>
              <input
                type="url"
                id="receipt"
                value={receiptImage}
                onChange={(e) => setReceiptImage(e.target.value)}
                placeholder="Paste receipt image URL"
                className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                required
              />
              <p className="text-white/60 text-xs mt-2">
                Upload your receipt to imgur or similar service and paste the URL here
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
              <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Deposit Instructions
              </h3>
              <ol className="text-white/80 text-sm list-decimal list-inside space-y-1">
                <li>Transfer funds to our bank account</li>
                <li>Take a screenshot of the receipt</li>
                <li>Upload to image hosting service</li>
                <li>Fill out this form with details</li>
                <li>We'll approve within 24 hours</li>
              </ol>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white py-4 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              {isSubmitting ? 'Submitting...' : 'Submit Deposit Request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}