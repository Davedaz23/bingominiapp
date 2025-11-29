// utils/roleValidation.ts
export const validateAdminAccess = (telegramId: string): boolean => {
  const adminTelegramId = process.env.NEXT_PUBLIC_ADMIN_TELEGRAM_ID;
  
  if (!adminTelegramId) {
    console.warn('⚠️ No admin Telegram ID configured');
    return false;
  }
  
  const isAdmin = telegramId === adminTelegramId;
  console.log(`🔐 Admin validation: ${telegramId} === ${adminTelegramId} -> ${isAdmin}`);
  
  return isAdmin;
};

export const validateModeratorAccess = (telegramId: string): boolean => {
  const moderatorIds = process.env.NEXT_PUBLIC_MODERATOR_TELEGRAM_IDS;
  
  if (!moderatorIds) {
    return false;
  }
  
  const moderatorList = moderatorIds.split(',');
  return moderatorList.includes(telegramId);
};