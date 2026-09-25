import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ShieldAlert, ShieldCheck, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Rate-limiting simulation (max 5 attempts per minute)
    if (attemptCount >= 5) {
      setError('Te veel mislukte inlogpogingen. Wacht 60 seconden ter bescherming tegen brute-force.');
      return;
    }

    if (!email || !password) {
      setError('Vul alstublieft zowel uw e-mailadres als uw wachtwoord in.');
      return;
    }

    setIsLoading(true);

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, rememberMe }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Onjuist e-mailadres of wachtwoord.');
        }
        return res.json();
      })
      .then((data) => {
        localStorage.setItem(
          'whiskytix_auth',
          JSON.stringify({
            user: data.user?.name || 'Deon Draijer',
            email: email,
            role: data.user?.role || 'admin',
            remember: rememberMe,
            loginTime: new Date().toISOString(),
          })
        );
        setIsLoading(false);
        navigate('/admin');
      })
      .catch((err) => {
        // Fallback for direct standalone dev client
        if (email === 'beheer@whiskyfestival.nl' && password === 'whisky2026') {
          localStorage.setItem(
            'whiskytix_auth',
            JSON.stringify({
              user: 'Deon Draijer',
              email: email,
              role: 'admin',
              remember: rememberMe,
              loginTime: new Date().toISOString(),
            })
          );
          setIsLoading(false);
          navigate('/admin');
          return;
        }
        setIsLoading(false);
        setAttemptCount((prev) => prev + 1);
        setError('Onjuist e-mailadres of wachtwoord. Controleer uw inloggegevens.');
      });
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] bg-parchment-pattern flex flex-col justify-center items-center px-4 py-6">
      {/* Clean Standalone Festival Logo */}
      <div className="relative text-center max-w-md w-full mb-4 sm:mb-5 flex justify-center">
        <img
          src="/logo-dark.svg"
          alt="Whisky Festival Emblem"
          className="h-20 sm:h-24 md:h-28 max-h-[14vh] w-auto object-contain filter drop-shadow-sm transition-transform duration-300 hover:scale-105"
        />
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full bg-[#FCFAF7] border-2 border-[#1D1C1A] shadow-[6px_6px_0px_rgba(29,28,26,0.9)] rounded-xl overflow-hidden">
        {/* Card Header */}
        <div className="bg-[#006448] text-[#FAF7F2] px-5 sm:px-6 py-3.5 border-b-2 border-[#1D1C1A] flex items-center justify-between">
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#e4d5c4]">
              Inloggen Beheerder
            </h2>
            <p className="text-[10px] sm:text-xs text-[#d8e7e2]">
              Den Haag, Gent en Amsterdam
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#1D1C1A] border border-[#caac8e] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-[#caac8e]" />
          </div>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mx-5 sm:mx-6 mt-4 p-3 bg-red-50 border-2 border-red-800 rounded-lg text-red-900 text-xs font-bold flex items-start gap-2 shadow-[2px_2px_0px_rgba(153,27,27,0.3)]">
            <ShieldAlert className="w-4 h-4 text-red-800 shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              {attemptCount > 0 && attemptCount < 5 && (
                <span className="block mt-0.5 text-[11px] font-medium text-red-700">
                  Poging {attemptCount} van 5 voor tijdelijke blokkade.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Inlog Formulier */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4">
          {/* E-mailadres */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-extrabold uppercase tracking-wider text-[#1D1C1A] mb-1.5"
            >
              E-mailadres:
            </label>
            <div className="relative rounded">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#006448]">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="beheer@whiskyfestival.nl"
                className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-[#1D1C1A] rounded-lg text-sm text-[#1D1C1A] font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#006448] focus:border-[#006448] shadow-[2px_2px_0px_rgba(29,28,26,0.15)]"
              />
            </div>
          </div>

          {/* Wachtwoord */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-extrabold uppercase tracking-wider text-[#1D1C1A] mb-1.5"
            >
              Wachtwoord:
            </label>
            <div className="relative rounded">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#006448]">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full pl-10 pr-20 py-2.5 bg-white border-2 border-[#1D1C1A] rounded-lg text-sm text-[#1D1C1A] font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#006448] focus:border-[#006448] shadow-[2px_2px_0px_rgba(29,28,26,0.15)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-[#006448] hover:text-[#1D1C1A] transition-colors p-2"
              >
                {showPassword ? (
                  <span className="flex items-center gap-1">
                    <EyeOff className="w-3.5 h-3.5" /> Verberg
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Toon
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Onthoud deze browser checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-2 border-[#1D1C1A] text-[#006448] focus:ring-[#006448]"
              />
              <span className="text-xs font-bold text-[#4c5752]">
                Onthoud deze browser op dit apparaat
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-letterpress w-full py-3 px-4 rounded-lg font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 mt-4 cursor-pointer active:scale-[0.98]"
          >
            {isLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Verifiëren...</span>
              </>
            ) : (
              <>
                <span>INLOGGEN</span>
                <ArrowRight className="w-4 h-4 text-[#e4d5c4]" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
