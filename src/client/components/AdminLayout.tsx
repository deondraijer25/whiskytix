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
import { FestivalBadgeLogo } from './FestivalBadgeLogo';
import { Footer } from './Footer';

interface AdminLayoutProps {
  children: React.ReactNode;
  selectedCity?: string;
  onCityChange?: (city: string) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  selectedCity = 'all',
}) => {
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

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('whiskytix_auth');
    navigate('/admin/login');
  };

  const navItems = [
    { label: 'Cockpit', path: '/admin', icon: LayoutDashboard },
    { label: 'Ticket & QR Monitor', path: '/admin/tickets', icon: QrCode },
    { label: 'Gent', path: '/admin/festival/gent', icon: Building2 },
    { label: 'Den Haag', path: '/admin/festival/denhaag', icon: Building2 },
    { label: 'Amsterdam', path: '/admin/festival/amsterdam', icon: Building2 },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F2] bg-parchment-pattern flex flex-col font-sans text-[#1D1C1A]">
      {/* Main Clean Header: Unified Single-Row with Overlapping Festival Shield Logo */}
      <div className="bg-[#FCFAF7] border-b-2 border-[#1D1C1A] shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 sm:h-24">
            
            {/* Left: Overlapping Official Whiskytix Badge Logo (Hangs down past navbar) */}
            <div className="flex items-center shrink-0">
              <Link to="/admin" title="Centrale Cockpit" className="focus:outline-none">
                <FestivalBadgeLogo cityId="whiskytix" className="-mb-8 sm:-mb-10" />
              </Link>
            </div>

            {/* Center: Desktop Unified Navigation (ONE Single Clean Row) */}
            <nav className="hidden lg:flex items-center gap-1.5 xl:gap-2 ml-4">
              <Link
                to="/admin"
                className={`flex items-center gap-2 px-3.5 py-2 rounded text-xs font-extrabold uppercase tracking-wider transition-all ${
                  location.pathname === '/admin'
                    ? 'bg-[#006448] text-white border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                    : 'text-[#4c5752] hover:text-[#1D1C1A] hover:bg-[#FAF7F2] border border-transparent'
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 ${location.pathname === '/admin' ? 'text-[#e4d5c4]' : 'text-[#006448]'}`} />
                <span>Cockpit</span>
              </Link>

              <Link
                to="/admin/tickets"
                className={`flex items-center gap-2 px-3.5 py-2 rounded text-xs font-extrabold uppercase tracking-wider transition-all ${
                  location.pathname === '/admin/tickets'
                    ? 'bg-[#006448] text-white border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                    : 'text-[#4c5752] hover:text-[#1D1C1A] hover:bg-[#FAF7F2] border border-transparent'
                }`}
              >
                <QrCode className={`w-4 h-4 ${location.pathname === '/admin/tickets' ? 'text-[#e4d5c4]' : 'text-[#006448]'}`} />
                <span>Ticket & QR Monitor</span>
              </Link>

              {/* Vertical Subtle Divider */}
              <div className="h-5 w-[1.5px] bg-[#c1d4ce] mx-2 self-center shrink-0"></div>

              {/* Festival Links */}
              {[
                { id: 'gent', label: 'Gent', path: '/admin/festival/gent' },
                { id: 'denhaag', label: 'Den Haag', path: '/admin/festival/denhaag' },
                { id: 'amsterdam', label: 'Amsterdam', path: '/admin/festival/amsterdam' },
              ].map((fest) => {
                const isActive = location.pathname.startsWith(fest.path);
                return (
                  <Link
                    key={fest.id}
                    to={fest.path}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs font-extrabold uppercase tracking-wider transition-all ${
                      isActive
                        ? 'bg-[#006448] text-white border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                        : 'text-[#4c5752] hover:text-[#1D1C1A] hover:bg-[#FAF7F2] border border-transparent'
                    }`}
                  >
                    <Building2 className={`w-3.5 h-3.5 ${isActive ? 'text-[#e4d5c4]' : 'text-[#006448]'}`} />
                    <span>{fest.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right: Quick Tools & Profile Dropdown */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Quick Scanner PWA Button */}
              <Link
                to="/scan"
                className="hidden md:flex h-10 items-center gap-2 px-3 rounded border-2 border-[#1D1C1A] bg-[#FAF7F2] hover:bg-[#d8e7e2] text-[#1D1C1A] text-xs font-extrabold uppercase tracking-wider shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all cursor-pointer shrink-0"
                title="Mobiele Deurscanner PWA"
              >
                <QrCode className="w-4 h-4 text-[#006448]" />
                <span>Scanner</span>
              </Link>

              {/* User Profile & Settings Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  aria-expanded={userDropdownOpen}
                  className={`h-10 flex items-center gap-2 px-3 rounded border-2 border-[#1D1C1A] transition-all cursor-pointer shrink-0 shadow-[2px_2px_0px_rgba(29,28,26,0.9)] ${
                    userDropdownOpen
                      ? 'bg-[#d8e7e2]'
                      : 'bg-[#FAF7F2] hover:bg-[#d8e7e2]'
                  }`}
                  title="Beheerder Profiel & Instellingen"
                >
                  <div className="w-6 h-6 rounded bg-[#caac8e] border border-[#1D1C1A] flex items-center justify-center font-extrabold text-[11px] text-[#1D1C1A] shrink-0">
                    {initials}
                  </div>
                  <span className="text-xs font-extrabold text-[#1D1C1A] hidden sm:inline">
                    {authData.user || 'Deon Draijer'}
                  </span>
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

                      <Link
                        to="/scan"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex md:hidden items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[#1D1C1A] hover:bg-[#FAF7F2] hover:text-[#006448] transition-colors"
                      >
                        <QrCode className="w-4 h-4 text-[#006448]" />
                        <div className="flex-1">
                          <div className="font-extrabold">Deurscanner PWA</div>
                          <div className="text-[10px] text-[#4c5752] font-normal">
                            Mobiele camera ticket scanner
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

              {/* Mobile Hamburger Toggle */}
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
                      : 'bg-[#FAF7F2] text-[#1D1C1A] border-[#1D1C1A] hover:bg-[#d8e7e2]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 pt-10 sm:pt-14 lg:pt-16 pb-6 sm:pb-8">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};
