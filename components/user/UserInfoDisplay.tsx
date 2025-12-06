/* eslint-disable @typescript-eslint/no-explicit-any */
import { User, Shield, Crown } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
interface UserInfoDisplayProps {
  user: any;
  userRole: string;
}

export const UserInfoDisplay: React.FC<UserInfoDisplayProps> = ({ user, userRole }) => {
  const { walletBalance } = useAuth();

  const getUserDisplayName = () => {
    if (!user) {
      console.log('❌ No user object provided to UserInfoDisplay');
      return 'Guest';
    }

    if (user.firstName && user.firstName !== 'User' && user.firstName !== 'Development') {
      return user.firstName;
    }
    
    if (user.telegramUsername) {
      return user.telegramUsername;
    }
    
    if (user.username && !user.username.startsWith('user_') && user.username !== 'dev_user') {
      return user.username;
    }
    
    if (user.telegramId) {
      return `User${user.telegramId.toString().slice(-4)}`;
    }
    
    if (user.id) {
      return `User${user.id.toString().slice(-4)}`;
    }
    
    return 'Player';
  };

  const getRoleBadge = () => {
    switch (userRole) {
      case 'admin':
        return {
          bg: 'bg-yellow-500/20 border-yellow-400/50',
          text: 'text-yellow-300',
          icon: <Crown className="w-3 h-3" />,
          label: 'ADMIN'
        };
      case 'moderator':
        return {
          bg: 'bg-blue-500/20 border-blue-400/50',
          text: 'text-blue-300',
          icon: <Shield className="w-3 h-3" />,
          label: 'MOD'
        };
      default:
        return null;
    }
  };

  const roleBadge = getRoleBadge();
  const displayName = getUserDisplayName();

  return (
    <div className="flex items-center gap-3">
      {/* Balance Display */}
      <div className="text-right">
        <p className="text-white font-bold text-lg">{walletBalance} ብር</p>
        <p className="text-white/60 text-xs">Balance</p>
      </div>
      
      {/* User Name Display with Role Badge */}
      <div className={`flex items-center gap-2 backdrop-blur-lg rounded-xl px-3 py-2 border ${
        roleBadge ? roleBadge.bg : 'bg-white/20 border-white/30'
      }`}>
        <User className={`w-4 h-4 ${roleBadge ? roleBadge.text : 'text-white'}`} />
        <div className="flex flex-col">
          <p className={`font-medium text-sm ${roleBadge ? roleBadge.text : 'text-white'}`}>
            {displayName}
          </p>
          {roleBadge && (
            <div className="flex items-center gap-1">
              {roleBadge.icon}
              <p className="text-xs font-bold">{roleBadge.label}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};