import { useState, useEffect } from 'react';

export const useAccountStorage = (user: any) => {
  const getAccountStorageKey = (baseKey: string): string => {
    if (!user?.telegramId) return baseKey;
    return `${baseKey}_${user.telegramId}`;
  };

  const getAccountData = (baseKey: string): any => {
    if (typeof window === 'undefined') return null;
    
    const accountKey = getAccountStorageKey(baseKey);
    const stored = localStorage.getItem(accountKey);
    
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.warn(`⚠️ Failed to parse stored data for ${accountKey}:`, error);
        return null;
      }
    }
    return null;
  };

  const setAccountData = (baseKey: string, data: any): void => {
    if (typeof window === 'undefined' || !user?.telegramId) return;
    
    const accountKey = getAccountStorageKey(baseKey);
    localStorage.setItem(accountKey, JSON.stringify(data));
  };

  const removeAccountData = (baseKey: string): void => {
    if (typeof window === 'undefined') return;
    
    const accountKey = getAccountStorageKey(baseKey);
    localStorage.removeItem(accountKey);
  };

  return {
    getAccountData,
    setAccountData,
    removeAccountData,
    getAccountStorageKey
  };
};