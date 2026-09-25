import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  QrCode,
  Users,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  selectedCity?: string;
  onCityChange?: (city: string) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const authData = useMemo(() => {
    try {
      const raw = localStorage.getItem('whiskytix_auth');
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return { user: 'Deon Draijer', email: 'beheer@whiskyfestival.nl', role: 'admin' };
  }, []);

  const initials = useMemo(() => {
    if (!authData?.user) return 'DD';
    const parts = authData.user.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return authData.user.slice(0, 2).toUpperCase();
  }, [authData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const navItems = [
    { label: '3-Steden Cockpit', path: '/admin', icon: LayoutDashboard },
    { label: 'Ticket & QR Monitor', path: '/admin/tickets', icon: QrCode },
    { label: 'Hub Den Haag', path: '/admin/festival/denhaag', icon: Building2 },
    { label: 'Hub Amsterdam', path: '/admin/festival/amsterdam', icon: Building2 },
    { label: 'Hub Gent', path: '/admin/festival/gent', icon: Building2 },
    { label: 'Deurscanner PWA', path: '/scan', icon: QrCode, highlight: true },
  ];

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('whiskytix_auth');
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] bg-parchment-pattern flex flex-col font-sans text-[#1D1C1A]">
      {/* Top Heritage Notice Bar */}
      <header className="bg-[#1D1C1A] text-[#d8e7e2] text-[11px] sm:text-xs py-1.5 px-3 sm:px-6 border-b border-[#006448]/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 truncate">
            <span className="inline-block w-2 h-2 rounded-full bg-[#006448] animate-pulse shrink-0"></span>
            <span className="font-bold tracking-wider uppercase text-[#caac8e] hidden xs:inline">
              Centrale Service:
            </span>
            <span className="text-gray-300 font-mono text-[10px] sm:text-xs truncate">
              tickets.whiskyfestival.nl
            </span>
            <span className="hidden md:inline text-gray-500">• Den Haag • Gent • Amsterdam</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="text-[#e4d5c4] font-medium hidden sm:inline text-[11px]">
              Supabase RLS Actief
            </span>
            <span className="bg-[#006448] text-white px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider">
              V1.0 Live
            </span>
          </div>
        </div>
      </header>

      {/* Main Cockpit Header */}
      <div className="bg-[#FCFAF7] border-b-2 border-[#1D1C1A] shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo & Branding */}
            <div className="flex items-center gap-3">
              <Link to="/admin" className="flex items-center gap-2.5 sm:gap-3 group">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#006448] border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] rounded flex items-center justify-center p-1 sm:p-1.5 transition-transform group-hover:scale-105 shrink-0">
                  <img
                    src="/logo-white.svg"
                    alt="Whiskytix Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-[#1D1C1A]">
                      WHISKYTIX
                    </span>
                    <span className="bg-[#d8e7e2] text-[#006448] text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded font-extrabold uppercase tracking-wider border border-[#8ba198]">
                      COCKPIT
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-[#4c5752] font-semibold tracking-wide hidden xs:block">
                    International Whisky Festival Engine
                  </p>
                </div>
              </Link>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* User Profile & Settings Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  aria-expanded={userDropdownOpen}
                  className={`hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded border-2 transition-all cursor-pointer ${
                    userDropdownOpen
                      ? 'bg-[#d8e7e2] border-[#006448] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                      : 'bg-[#FAF7F2] border-[#1D1C1A] hover:bg-[#d8e7e2]/60 shadow-[2px_2px_0px_rgba(29,28,26,0.6)]'
                  }`}
                  title="Beheerder Profiel & Instellingen"
                >
                  <div className="w-7 h-7 rounded bg-[#caac8e] border border-[#1D1C1A] flex items-center justify-center font-bold text-xs text-[#1D1C1A] shrink-0">
                    {initials}
                  </div>
                  <div className="text-left leading-tight">
                    <div className="text-xs font-extrabold text-[#1D1C1A]">
                      {authData.user || 'Deon Draijer'}
                    </div>
                    <div className="text-[10px] font-bold text-[#006448] uppercase tracking-wider">
                      {authData.role === 'admin' ? 'Superadmin' : 'Beheerder'}
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#4c5752] transition-transform duration-200 ${
                      userDropdownOpen ? 'rotate-180 text-[#006448]' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150 font-sans">
                    {/* Account Info Header */}
                    <div className="px-4 py-3 border-b border-[#c1d4ce] bg-[#FAF7F2]">
                      <div className="text-xs font-extrabold text-[#1D1C1A] truncate">
                        {authData.user || 'Deon Draijer'}
                      </div>
                      <div className="text-xs text-[#4c5752] font-medium truncate mt-0.5">
                        {authData.email || 'beheer@whiskyfestival.nl'}
                      </div>
                      <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-[#d8e7e2] text-[#006448] border border-[#8ba198]">
                        {authData.role === 'admin' ? 'Superadmin Rechten' : 'Scanner / Beheer'}
                      </div>
                    </div>

                    {/* Menu Options */}
                    <div className="py-1">
                      <Link
                        to="/admin/users"
                        onClick={() => setUserDropdownOpen(false)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold transition-colors ${
                          location.pathname === '/admin/users'
                            ? 'bg-[#d8e7e2] text-[#006448] font-extrabold'
                            : 'text-[#1D1C1A] hover:bg-[#FAF7F2] hover:text-[#006448]'
                        }`}
                      >
                        <Users className="w-4 h-4 text-[#006448]" />
                        <div className="flex-1">
                          <div className="font-extrabold">Beheerders & Team</div>
                          <div className="text-[10px] text-[#4c5752] font-normal">
                            Accounts, rollen & scanner PINs
                          </div>
                        </div>
                      </Link>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-[#c1d4ce] my-1"></div>

                    {/* Logout */}
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-extrabold text-red-800 hover:bg-red-50 hover:text-red-900 rounded transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-red-700" />
                        <span>Veilig Uitloggen</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Hamburger Toggle Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Menu openen"
                className="lg:hidden p-2 rounded border-2 border-[#1D1C1A] bg-[#FAF7F2] text-[#1D1C1A] active:bg-[#d8e7e2] shadow-[2px_2px_0px_rgba(29,28,26,0.8)] cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Primary Desktop Navigation Bar: Cockpit & Festival Hubs */}
        <div className="border-t border-[#c1d4ce] bg-[#FCFAF7] hidden lg:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-2 py-1.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold uppercase tracking-wider rounded transition-all ${
                      isActive
                        ? 'bg-[#006448] text-white shadow-[2px_2px_0px_rgba(29,28,26,0.9)] border-2 border-[#1D1C1A]'
                        : item.highlight
                        ? 'bg-[#caac8e]/30 text-[#006448] border-2 border-dashed border-[#006448] hover:bg-[#caac8e]/50 ml-auto'
                        : 'text-[#4c5752] hover:text-[#1D1C1A] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#e4d5c4]' : 'text-[#006448]'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t-2 border-[#1D1C1A] bg-[#FCFAF7] p-4 space-y-2 shadow-xl">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#4c5752] mb-1">
              Navigatie:
            </div>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded font-extrabold text-xs uppercase tracking-wider border-2 transition-all ${
                    isActive
                      ? 'bg-[#006448] text-white border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                      : 'bg-[#FAF7F2] text-[#4c5752] border-[#c1d4ce]'
                  }`}
                >
                  <Icon className="w-4 h-4 text-[#006448]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-2 border-t border-[#c1d4ce] space-y-1">
              <Link
                to="/admin/users"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded font-extrabold text-xs uppercase tracking-wider border-2 transition-all ${
                  location.pathname === '/admin/users'
                    ? 'bg-[#006448] text-white border-[#1D1C1A]'
                    : 'bg-[#FAF7F2] text-[#1D1C1A] border-[#c1d4ce]'
                }`}
              >
                <Users className="w-4 h-4 text-[#006448]" />
                <span>Beheerders & Team</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-xs font-extrabold text-red-800 py-2 px-3 cursor-pointer w-full text-left hover:bg-red-50 rounded"
              >
                <LogOut className="w-4 h-4 text-red-700" />
                <span>Veilig Uitloggen</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
};
