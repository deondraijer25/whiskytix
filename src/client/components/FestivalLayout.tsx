import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  LayoutDashboard,
  ShoppingBag,
  Layers,
  Activity,
  Ticket,
  QrCode,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Building2,
  Users,
} from 'lucide-react';
import { INITIAL_FESTIVALS } from '../data/mockData';
import { FestivalBadgeLogo } from './FestivalBadgeLogo';
import { Footer } from './Footer';

const CITY_THEMES: Record<string, {
  primary: string;
  dotColor: string;
  activeTabBg: string;
  iconActiveColor: string;
  iconColor: string;
}> = {
  gent: {
    primary: '#1E3A8A',
    dotColor: 'bg-[#1E3A8A]',
    activeTabBg: 'bg-[#1E3A8A] text-white',
    iconActiveColor: 'text-[#BFDBFE]',
    iconColor: 'text-[#1E3A8A]',
  },
  denhaag: {
    primary: '#006448',
    dotColor: 'bg-[#006448]',
    activeTabBg: 'bg-[#006448] text-white',
    iconActiveColor: 'text-[#e4d5c4]',
    iconColor: 'text-[#006448]',
  },
  amsterdam: {
    primary: '#8C0223',
    dotColor: 'bg-[#8C0223]',
    activeTabBg: 'bg-[#8C0223] text-white',
    iconActiveColor: 'text-[#FECDD3]',
    iconColor: 'text-[#8C0223]',
  },
};

export const FestivalLayout: React.FC<FestivalLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cityId = 'denhaag' } = useParams<{ cityId: string }>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const currentFestival =
    INITIAL_FESTIVALS.find((f) => f.id === cityId) || INITIAL_FESTIVALS[0];

  const theme = CITY_THEMES[cityId] || CITY_THEMES.denhaag;

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
      const target = event.target as Node;
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(target)) {
        setCityDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(target)) {
        setUserDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCityDropdownOpen(false);
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

  const festivalNavItems = [
    {
      label: 'Overzicht',
      path: `/admin/festival/${cityId}`,
      exact: true,
      icon: LayoutDashboard,
    },
    {
      label: 'Bestellingen',
      path: `/admin/festival/${cityId}/orders`,
      icon: ShoppingBag,
    },
    {
      label: 'Zaalcapaciteit',
      path: `/admin/festival/${cityId}/inventory`,
      icon: Layers,
    },
    {
      label: 'Deurmonitor',
      path: `/admin/festival/${cityId}/door`,
      icon: Activity,
    },
    {
      label: 'Kortingscodes',
      path: `/admin/festival/${cityId}/coupons`,
      icon: Ticket,
    },
    {
      label: 'Ticket & QR',
      path: `/admin/festival/${cityId}/tickets`,
      icon: QrCode,
    },
  ];

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('whiskytix_auth');
    navigate('/admin/login');
  };

  const handleCitySwitch = (newCityId: string) => {
    setCityDropdownOpen(false);
    // Keep current subpage if possible
    const currentSubPage = location.pathname.split('/').pop() || 'orders';
    const targetSubPage = ['orders', 'inventory', 'door', 'coupons', 'tickets'].includes(currentSubPage)
      ? targetSubPageOrDefault(currentSubPage)
      : '';
    if (targetSubPage) {
      navigate(`/admin/festival/${newCityId}/${targetSubPage}`);
    } else {
      navigate(`/admin/festival/${newCityId}`);
    }
  };

  function targetSubPageOrDefault(sub: string) {
    return sub;
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] bg-parchment-pattern flex flex-col font-sans text-[#1D1C1A]">
      {/* Main Header: 2-Level Festival Hub Navigation */}
      <div className="bg-[#FCFAF7] border-b-2 border-[#1D1C1A] shadow-sm sticky top-0 z-40">
        {/* Level 1: Global Platform Bar & Festival Switcher */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            
            {/* Left: Whiskytix Logo + Back to Cockpit & Active Festival Breadcrumb */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <Link to="/admin" title="Centrale Cockpit" className="focus:outline-none">
                <FestivalBadgeLogo cityId="whiskytix" className="-mb-6 sm:-mb-8" />
              </Link>

              <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3 border-l-2 border-[#c1d4ce]">
                <Link
                  to="/admin"
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-extrabold uppercase tracking-wider text-[#4c5752] hover:text-[#1D1C1A] hover:bg-[#FAF7F2] transition-all group"
                  title="Terug naar Centrale Cockpit"
                >
                  <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform text-[#006448]" />
                  <span>Cockpit</span>
                </Link>
                <span className="text-[#c1d4ce] font-bold">/</span>
                <span className="text-xs font-extrabold text-[#1D1C1A] flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${theme.dotColor}`}></span>
                  <span className="hidden md:inline">{currentFestival.name}</span>
                  <span className="md:hidden">{cityId === 'denhaag' ? 'Den Haag' : cityId === 'amsterdam' ? 'Amsterdam' : 'Gent'} Hub</span>
                </span>
              </div>
            </div>

            {/* Right: City Switcher, Quick Scanner & Profile Dropdown */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              
              {/* Fast City Switcher */}
              <div className="relative" ref={cityDropdownRef}>
                <button
                  type="button"
                  onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
                  aria-expanded={cityDropdownOpen}
                  className="h-10 bg-[#FAF7F2] hover:bg-[#d8e7e2] border-2 border-[#1D1C1A] px-3 rounded font-extrabold text-xs text-[#1D1C1A] flex items-center gap-2 shadow-[2px_2px_0px_rgba(29,28,26,0.9)] cursor-pointer transition-all shrink-0"
                  title="Wissel van festival locatie"
                >
                  <Building2 className="w-4 h-4 text-[#006448]" />
                  <span className="text-[#4c5752] font-semibold">Editie:</span>
                  <span className="text-[#006448]">
                    {cityId === 'denhaag' ? 'Den Haag' : cityId === 'amsterdam' ? 'Amsterdam' : 'Gent'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#4c5752]" />
                </button>

                {cityDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 border-b border-[#c1d4ce] text-[10px] font-extrabold uppercase tracking-wider text-[#4c5752]">
                      Kies festival editie:
                    </div>
                    {INITIAL_FESTIVALS.map((fest) => (
                      <button
                        key={fest.id}
                        type="button"
                        onClick={() => handleCitySwitch(fest.id)}
                        className={`w-full text-left px-3 py-2.5 text-xs font-bold flex items-center justify-between hover:bg-[#FAF7F2] cursor-pointer transition-colors ${
                          fest.id === cityId
                            ? 'bg-[#d8e7e2] text-[#006448] font-extrabold border-l-4 border-[#006448]'
                            : 'text-[#1D1C1A]'
                        }`}
                      >
                        <div>
                          <div className="font-extrabold">{fest.name}</div>
                          <div className="text-[10px] text-[#4c5752]">{fest.dates}</div>
                        </div>
                        {fest.id === cityId && (
                          <span className="text-[10px] bg-[#006448] text-white px-1.5 py-0.5 rounded font-extrabold">
                            Actief
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Scanner PWA Button */}
              <Link
                to={`/scan?festival=${cityId}`}
                className="hidden md:flex h-10 items-center gap-2 px-3 rounded border-2 border-[#1D1C1A] bg-[#FAF7F2] hover:bg-[#d8e7e2] text-[#1D1C1A] text-xs font-extrabold uppercase tracking-wider shadow-[2px_2px_0px_rgba(29,28,26,0.9)] transition-all cursor-pointer shrink-0"
                title="Mobiele Deurscanner PWA"
              >
                <QrCode className="w-4 h-4 text-[#006448]" />
                <span>Scanner</span>
              </Link>

              {/* User Profile & Settings Dropdown */}
              <div className="relative" ref={userDropdownRef}>
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

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150 font-sans">
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
                        to={`/scan?festival=${cityId}`}
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

                    <div className="border-t border-[#c1d4ce] my-1"></div>

                    <div className="p-1">
                      <button
                        type="button"
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

              {/* Mobile hamburger toggle */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded border-2 border-[#1D1C1A] bg-[#FAF7F2] text-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.8)] cursor-pointer"
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Level 2: Dedicated Festival Hub Sub-navigation Tabs with Dynamic Festival Theme */}
        <div className="hidden lg:block bg-[#FCFAF7] border-t border-[#c1d4ce]/80">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <nav className="flex items-center justify-end gap-1.5 xl:gap-2 py-2 pl-36 overflow-x-auto scrollbar-none">
              {festivalNavItems.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.path || location.pathname === `${item.path}/overview`
                  : location.pathname.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-extrabold uppercase tracking-wider transition-all shrink-0 ${
                      isActive
                        ? `${theme.activeTabBg} border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]`
                        : 'text-[#4c5752] hover:text-[#1D1C1A] hover:bg-[#FAF7F2] border border-transparent'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? theme.iconActiveColor : theme.iconColor}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t-2 border-[#1D1C1A] bg-[#FCFAF7] p-4 space-y-2 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#c1d4ce]">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#4c5752]">
                Navigatie {currentFestival.edition}:
              </span>
              <span className={`text-[10px] text-white px-2 py-0.5 rounded font-extrabold ${theme.dotColor}`}>
                {currentFestival.statusLabel}
              </span>
            </div>

            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded font-extrabold text-xs uppercase tracking-wider text-[#1D1C1A] bg-[#FAF7F2] border-2 border-[#c1d4ce]"
            >
              <ArrowLeft className="w-4 h-4 text-[#006448]" />
              <span>← Terug naar Centrale Cockpit</span>
            </Link>

            {festivalNavItems.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.path || location.pathname === `${item.path}/overview`
                : location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded font-extrabold text-xs uppercase tracking-wider border-2 transition-all ${
                    isActive
                      ? `${theme.activeTabBg} border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]`
                      : 'bg-[#FAF7F2] text-[#4c5752] border-[#c1d4ce]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? theme.iconActiveColor : theme.iconColor}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-2 border-t border-[#c1d4ce] space-y-2">
              <Link
                to={`/scan?festival=${cityId}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded font-extrabold text-xs text-[#006448] bg-[#caac8e]/20 border border-[#caac8e]"
              >
                <QrCode className="w-4 h-4" />
                <span>Open Deurscanner PWA</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-extrabold text-red-800 hover:bg-red-50 hover:text-red-900 rounded"
              >
                <LogOut className="w-4 h-4 text-red-700" />
                <span>Veilig Uitloggen</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-8 pb-3 sm:pb-6 lg:pb-8">
        {children}
      </main>

      {/* Footer */}
      <Footer className="pb-24 lg:pb-8" />

      {/* Mobile Bottom Dock Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FCFAF7] border-t-2 border-[#1D1C1A] px-2 py-1.5 shadow-[0px_-4px_10px_rgba(0,0,0,0.08)] flex items-center justify-around">
        <Link
          to={`/admin/festival/${cityId}`}
          className={`flex flex-col items-center py-1 px-2 rounded font-extrabold text-[10px] ${
            location.pathname === `/admin/festival/${cityId}` || location.pathname === `/admin/festival/${cityId}/overview`
              ? 'text-[#006448]'
              : 'text-[#4c5752]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span>Overzicht</span>
        </Link>
        <Link
          to={`/admin/festival/${cityId}/orders`}
          className={`flex flex-col items-center py-1 px-2 rounded font-extrabold text-[10px] ${
            location.pathname.includes('/orders') ? 'text-[#006448]' : 'text-[#4c5752]'
          }`}
        >
          <ShoppingBag className="w-4 h-4 mb-0.5" />
          <span>Orders</span>
        </Link>
        <Link
          to={`/admin/festival/${cityId}/inventory`}
          className={`flex flex-col items-center py-1 px-2 rounded font-extrabold text-[10px] ${
            location.pathname.includes('/inventory') ? 'text-[#006448]' : 'text-[#4c5752]'
          }`}
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span>Zalen</span>
        </Link>
        <Link
          to={`/admin/festival/${cityId}/door`}
          className={`flex flex-col items-center py-1 px-2 rounded font-extrabold text-[10px] ${
            location.pathname.includes('/door') ? 'text-[#006448]' : 'text-[#4c5752]'
          }`}
        >
          <Activity className="w-4 h-4 mb-0.5" />
          <span>Deur</span>
        </Link>
        <Link
          to={`/scan?festival=${cityId}`}
          className="flex flex-col items-center py-1 px-3 rounded-lg font-black text-[10px] bg-[#006448] text-white border border-[#1D1C1A] shadow-[1px_1px_0px_rgba(29,28,26,0.9)]"
        >
          <QrCode className="w-4 h-4 mb-0.5" />
          <span>Scanner</span>
        </Link>
        <Link
          to="/admin"
          className="flex flex-col items-center py-1 px-2 rounded font-extrabold text-[10px] text-[#4c5752]"
        >
          <ArrowLeft className="w-4 h-4 mb-0.5" />
          <span>Cockpit</span>
        </Link>
      </div>
    </div>
  );
};
