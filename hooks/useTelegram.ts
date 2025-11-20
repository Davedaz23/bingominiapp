import { useEffect, useState } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
}

interface TelegramWebApp {
  // Core methods
  ready: () => void;
  expand: () => void;
  close: () => void;
  
  // Data properties
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    query_id?: string;
    auth_date?: string;
    hash?: string;
  };
  
  // Theme
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
    section_bg_color?: string;
    section_header_text_color?: string;
    subtitle_text_color?: string;
    destructive_text_color?: string;
  };
  
  // Platform info
  platform: string;
  version: string;
  
  // Viewport info
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;
  isVersionAtLeast: (version: string) => boolean;
  
  // Back button
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  
  // Main button
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    setParams: (params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }) => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface UseTelegramReturn {
  user: TelegramUser | null;
  isReady: boolean;
  WebApp: TelegramWebApp | null;
  initData: string | null;
  theme: TelegramWebApp['themeParams'];
  platform: string;
}

export const useTelegram = (): UseTelegramReturn => {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [initData, setInitData] = useState<string | null>(null);
  const [theme, setTheme] = useState<TelegramWebApp['themeParams']>({});
  const [platform, setPlatform] = useState<string>('unknown');

  useEffect(() => {
    const initTelegram = () => {
      if (typeof window === 'undefined') return;

      const tg = window.Telegram?.WebApp;

      console.log('Telegram WebApp detected:', {
        exists: !!tg,
        initData: tg?.initData ? 'PRESENT' : 'MISSING',
        initDataLength: tg?.initData?.length,
        user: tg?.initDataUnsafe?.user,
        platform: tg?.platform
      });

      if (tg && tg.initData && tg.initData.length > 0) {
        try {
          // Initialize Telegram WebApp
          tg.ready();
          tg.expand();

          // Set user and app data
          setUser(tg.initDataUnsafe.user || null);
          setInitData(tg.initData); // This should be the real Telegram initData
          setWebApp(tg);
          setPlatform(tg.platform);

          // Apply and store theme
          const currentTheme = applyTheme(tg.themeParams);
          setTheme(currentTheme);

          // Set up viewport handling
          setupViewport(tg);

          console.log('✅ Telegram WebApp initialized with REAL data:', {
            platform: tg.platform,
            version: tg.version,
            user: tg.initDataUnsafe.user,
            initDataLength: tg.initData.length,
            hasUser: !!tg.initDataUnsafe.user
          });

          setIsReady(true);
        } catch (error) {
          console.error('Error initializing Telegram WebApp:', error);
          setupDevelopmentMode();
        }
      } else {
        console.warn('❌ Telegram WebApp not found or no initData. Using development mode.', {
          hasTelegram: !!window.Telegram,
          hasWebApp: !!tg,
          initDataLength: tg?.initData?.length
        });
        setupDevelopmentMode();
      }
    };

    const applyTheme = (themeParams: TelegramWebApp['themeParams']) => {
      const root = document.documentElement;
      
      // Set CSS custom properties
      const themeProperties = {
        '--tg-theme-bg-color': themeParams.bg_color || '#ffffff',
        '--tg-theme-text-color': themeParams.text_color || '#000000',
        '--tg-theme-hint-color': themeParams.hint_color || '#707579',
        '--tg-theme-link-color': themeParams.link_color || '#3390ec',
        '--tg-theme-button-color': themeParams.button_color || '#3390ec',
        '--tg-theme-button-text-color': themeParams.button_text_color || '#ffffff',
        '--tg-theme-secondary-bg-color': themeParams.secondary_bg_color || '#f4f4f5',
        '--tg-theme-section-bg-color': themeParams.section_bg_color || '#f4f4f5',
        '--tg-theme-section-header-text-color': themeParams.section_header_text_color || '#000000',
        '--tg-theme-subtitle-text-color': themeParams.subtitle_text_color || '#707579',
        '--tg-theme-destructive-text-color': themeParams.destructive_text_color || '#ff3b30',
      };

      Object.entries(themeProperties).forEach(([property, value]) => {
        root.style.setProperty(property, value);
      });

      return themeParams;
    };

    const setupViewport = (tg: TelegramWebApp) => {
      // Handle viewport changes
      const updateViewport = () => {
        document.documentElement.style.setProperty('--tg-viewport-height', `${tg.viewportHeight}px`);
        document.documentElement.style.setProperty('--tg-viewport-stable-height', `${tg.viewportStableHeight}px`);
      };

      updateViewport();

      // Listen for viewport changes (if supported)
      if (tg.isVersionAtLeast('6.1')) {
        window.addEventListener('resize', updateViewport);
      }
    };

    const setupDevelopmentMode = () => {
      const devUser: TelegramUser = {
        id: Date.now(),
        first_name: 'Test User',
        username: 'test_user',
        language_code: 'en',
        is_premium: false,
        allows_write_to_pm: true
      };

      setUser(devUser);
      setInitData('development'); // This sets development mode
      setPlatform('web');
      
      // Apply default theme
      const defaultTheme = applyTheme({});
      setTheme(defaultTheme);

      console.log('🔧 Development mode activated with test user');
      setIsReady(true);
    };

    // Initialize immediately
    initTelegram();

  }, []);

  return { 
    user, 
    isReady, 
    WebApp: webApp, 
    initData,
    theme,
    platform
  };
};

// Additional helper hook for Main Button
export const useTelegramMainButton = (webApp: TelegramWebApp | null) => {
  const [buttonState, setButtonState] = useState({
    text: 'Continue',
    color: webApp?.themeParams.button_color || '#3390ec',
    textColor: webApp?.themeParams.button_text_color || '#ffffff',
    isVisible: false,
    isActive: true,
  });

  useEffect(() => {
    if (!webApp) return;

    const mainButton = webApp.MainButton;

    // Sync initial state
    mainButton.setParams({
      text: buttonState.text,
      color: buttonState.color,
      text_color: buttonState.textColor,
      is_active: buttonState.isActive,
      is_visible: buttonState.isVisible,
    });
  }, [webApp, buttonState]);

  const updateButton = (params: {
    text?: string;
    color?: string;
    textColor?: string;
    isVisible?: boolean;
    isActive?: boolean;
  }) => {
    setButtonState(prev => ({ ...prev, ...params }));
    
    if (webApp) {
      webApp.MainButton.setParams({
        text: params.text,
        color: params.color,
        text_color: params.textColor,
        is_visible: params.isVisible,
        is_active: params.isActive,
      });
    }
  };

  const setButtonText = (text: string) => updateButton({ text });
  const showButton = () => updateButton({ isVisible: true });
  const hideButton = () => updateButton({ isVisible: false });
  const enableButton = () => updateButton({ isActive: true });
  const disableButton = () => updateButton({ isActive: false });

  const onButtonClick = (callback: () => void) => {
    if (webApp) {
      webApp.MainButton.onClick(callback);
    }
  };

  return {
    updateButton,
    setButtonText,
    showButton,
    hideButton,
    enableButton,
    disableButton,
    onButtonClick,
    buttonState,
  };
};