import React from 'react';
import { useEnvironment, MollieEnv } from '../context/EnvironmentContext';

interface MollieEnvToggleProps {
  compact?: boolean;
  className?: string;
  onEnvChange?: (newEnv: MollieEnv) => void;
}

export const MollieEnvToggle: React.FC<MollieEnvToggleProps> = ({
  compact = false,
  className = '',
  onEnvChange,
}) => {
  const { env, setEnv } = useEnvironment();

  const handleSelect = (selectedEnv: MollieEnv) => {
    if (env !== selectedEnv) {
      setEnv(selectedEnv);
      if (onEnvChange) {
        onEnvChange(selectedEnv);
      }
    }
  };

  const containerPadding = compact ? 'p-0.5' : 'p-1';
  const buttonPadding = compact
    ? 'px-2 sm:px-2.5 py-1 text-[11px]'
    : 'px-2.5 sm:px-3 py-1.5 text-xs';

  return (
    <div
      className={`inline-flex items-center bg-[#FAF7F2] border-2 border-[#1D1C1A] rounded-lg shadow-[2px_2px_0px_rgba(29,28,26,0.9)] font-sans select-none shrink-0 ${containerPadding} ${className}`}
      role="group"
      aria-label="Mollie Test of Live Modus"
    >
      {/* Test Modus Knop */}
      <button
        type="button"
        onClick={() => handleSelect('test')}
        className={`${buttonPadding} rounded font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
          env === 'test'
            ? 'bg-[#caac8e] text-[#1D1C1A] border-2 border-[#1D1C1A] shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
            : 'text-[#4c5752] hover:text-[#1D1C1A]'
        }`}
        title="Schakel naar de testmodus: bekijk testorders en proefbetalingen"
      >
        <span className={compact ? 'inline' : 'hidden sm:inline'}>Mollie </span>Test
      </button>

      {/* Live Modus Knop */}
      <button
        type="button"
        onClick={() => handleSelect('live')}
        className={`${buttonPadding} rounded font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
          env === 'live'
            ? 'bg-[#006448] text-white border-2 border-[#1D1C1A] shadow-[1px_1px_0px_rgba(29,28,26,0.9)]'
            : 'text-[#4c5752] hover:text-[#1D1C1A]'
        }`}
        title="Schakel naar de live modus: bekijk echte betaalde festivaltickets en omzet"
      >
        <span className={compact ? 'inline' : 'hidden sm:inline'}>Mollie </span>Live
      </button>
    </div>
  );
};
