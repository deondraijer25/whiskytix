import React, { useState } from 'react';
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
  Calendar,
  MapPin,
  Menu,
  X,
  Building2,
} from 'lucide-react';
import { INITIAL_FESTIVALS } from '../data/mockData';

interface FestivalLayoutProps {
  children: React.ReactNode;
}

export const FestivalLayout: React.FC<FestivalLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cityId = 'denhaag' } = useParams<{ cityId: string }>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);

  const currentFestival =
    INITIAL_FESTIVALS.find((f) => f.id === cityId) || INITIAL_FESTIVALS[0];

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
      label: 'Deurscanner',
      path: `/scan?festival=${cityId}`,
      icon: QrCode,
      highlight: true,
      external: false,
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem('whiskytix_auth');
    navigate('/admin/login');
  };

  const handleCitySwitch = (newCityId: string) => {
    setCityDropdownOpen(false);
    // Keep the current subpage (e.g. orders, inventory, door)
    const currentSubPage = location.pathname.split('/').pop() || 'orders';
    const targetSubPage = ['orders', 'inventory', 'door', 'coupons'].includes(currentSubPage)
      ? currentSubPage
      : 'orders';
    navigate(`/admin/festival/${newCityId}/${targetSubPage}`);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] bg-parchment-pattern flex flex-col font-sans text-[#1D1C1A]">
      {/* Top Notice Bar with Quick Back-to-Cockpit */}
      <header className="bg-[#1D1C1A] text-[#d8e7e2] text-[11px] sm:text-xs py-2 px-3 sm:px-6 border-b border-[#006448]/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            to="/admin"
            className="flex items-center gap-1.5 text-[#caac8e] hover:text-white font-bold transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform text-[#006448]" />
            <span>← Terug naar Centrale Cockpit</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-gray-400 hidden sm:inline text-[11px]">
              Actieve Festival Context:
            </span>
            <span className="bg-[#006448] text-white px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider">
              {currentFestival.edition}
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white text-[11px] font-semibold hidden xs:flex items-center gap-1 ml-2 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>Uitloggen</span>
            </button>
          </div>
        </div>
      </header>

      {/* Festival Hub Header & Identity Banner */}
      <div className="bg-[#FCFAF7] border-b-2 border-[#1D1C1A] shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 sm:h-24">
            {/* Festival Title & Badges */}
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                to={`/admin/festival/${cityId}/orders`}
                className="w-12 h-12 sm:w-14 sm:h-14 bg-[#006448] border-2 border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)] rounded-lg flex items-center justify-center p-2 shrink-0 hover:scale-105 transition-transform"
                title="Festival Hub"
              >
                <img
                  src="/logo-white.svg"
                  alt="Whiskytix Logo"
                  className="w-full h-full object-contain"
                />
              </Link>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-[#d8e7e2] text-[#006448] text-[10px] sm:text-xs px-2 py-0.5 rounded font-extrabold uppercase tracking-wider border border-[#8ba198]">
                    {currentFestival.edition}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full hidden xs:inline">
                    {currentFestival.statusLabel}
                  </span>
                </div>
                <h1 className="font-extrabold text-lg sm:text-2xl text-[#1D1C1A] tracking-tight mt-0.5 leading-tight">
                  {currentFestival.name}
                </h1>
                <div className="flex items-center gap-3 text-xs text-[#4c5752] font-medium mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#006448]" />
                    {currentFestival.dates}
                  </span>
                  <span className="hidden sm:flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#006448]" />
                    {currentFestival.location}
                  </span>
                </div>
              </div>
            </div>

            {/* Fast Festival Switcher Dropdown (Switch between Den Haag, Amsterdam, Gent) */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
                  className="bg-[#FAF7F2] hover:bg-[#d8e7e2] border-2 border-[#1D1C1A] px-3 py-2 rounded font-extrabold text-xs text-[#1D1C1A] flex items-center gap-2 shadow-[2px_2px_0px_rgba(29,28,26,0.9)] cursor-pointer transition-all"
                  title="Wissel van festival locatie"
                >
                  <Building2 className="w-3.5 h-3.5 text-[#006448]" />
                  <span className="hidden sm:inline">Wissel Editie:</span>
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

              {/* Mobile hamburger toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded border-2 border-[#1D1C1A] bg-[#FAF7F2] text-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.8)] cursor-pointer"
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs for this Festival */}
        <div className="border-t border-[#c1d4ce] bg-[#FCFAF7] hidden lg:block overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center space-x-1.5 py-1.5">
              {/* Underlined link: Terug naar Alle (Cockpit) */}
              <Link
                to="/admin"
                className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#006448] hover:text-[#1D1C1A] underline underline-offset-4 decoration-2 mr-2.5 pr-2.5 border-r-2 border-[#c1d4ce] transition-colors group shrink-0 whitespace-nowrap"
                title="Terug naar het 3-Steden Cockpit Overzicht"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Terug naar Alle</span>
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
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold uppercase tracking-wider rounded transition-all whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-[#006448] text-white shadow-[2px_2px_0px_rgba(29,28,26,0.9)] border-2 border-[#1D1C1A]'
                        : item.highlight
                        ? 'bg-[#caac8e]/30 text-[#006448] border-2 border-dashed border-[#006448] hover:bg-[#caac8e]/50 ml-auto'
                        : 'text-[#4c5752] hover:text-[#1D1C1A] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#e4d5c4]' : 'text-[#006448]'}`} />
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
              Navigatie {currentFestival.edition}:
            </div>
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
                      ? 'bg-[#006448] text-white border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.9)]'
                      : 'bg-[#FAF7F2] text-[#4c5752] border-[#c1d4ce]'
                  }`}
                >
                  <Icon className="w-4 h-4 text-[#006448]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-2 border-t border-[#c1d4ce]">
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 text-xs font-extrabold text-[#006448] py-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Terug naar Centrale Cockpit</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 mb-16 lg:mb-6">
        {children}
      </main>

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
