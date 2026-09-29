import React, { createContext, useContext, useState, useEffect } from 'react';

export type MollieEnv = 'test' | 'live';

interface EnvironmentContextType {
  env: MollieEnv;
  setEnv: (env: MollieEnv) => void;
  isLive: boolean;
  isTest: boolean;
  toggleEnv: () => void;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

const STORAGE_KEY = 'whiskytix_mollie_env';

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [env, setEnvState] = useState<MollieEnv>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'live' || saved === 'test') {
        return saved;
      }
    } catch {
      // localStorage fallback
    }
    return 'test';
  });

  const setEnv = (newEnv: MollieEnv) => {
    setEnvState(newEnv);
    try {
      localStorage.setItem(STORAGE_KEY, newEnv);
      window.dispatchEvent(new CustomEvent('whiskytix_env_changed', { detail: newEnv }));
    } catch {
      // ignore storage errors
    }
  };

  const toggleEnv = () => {
    setEnv(env === 'live' ? 'test' : 'live');
  };

  // Sync across tabs/windows if needed
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'live' || e.newValue === 'test')) {
        setEnvState(e.newValue);
      }
    };
    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent<MollieEnv>;
      if (customEvent.detail && (customEvent.detail === 'live' || customEvent.detail === 'test')) {
        setEnvState(customEvent.detail);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('whiskytix_env_changed', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('whiskytix_env_changed', handleCustom);
    };
  }, []);

  return (
    <EnvironmentContext.Provider
      value={{
        env,
        setEnv,
        isLive: env === 'live',
        isTest: env === 'test',
        toggleEnv,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
};

export const useEnvironment = (): EnvironmentContextType => {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return context;
};
