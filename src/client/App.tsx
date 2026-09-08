import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { InventoryPage } from './pages/InventoryPage';
import { CouponsPage } from './pages/CouponsPage';
import { DoorMonitorPage } from './pages/DoorMonitorPage';
import { ScannerPwaPage } from './pages/ScannerPwaPage';
import { TicketViewPage } from './pages/TicketViewPage';
import { FestivalOverviewPage } from './pages/FestivalOverviewPage';
import { AdminLayout } from './components/AdminLayout';
import { FestivalLayout } from './components/FestivalLayout';

export const App: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState<string>('all');

  return (
    <Routes>
      {/* 1. Admin Login Screen */}
      <Route path="/admin/login" element={<LoginPage />} />

      {/* 2. LAYER 1: 3-Steden Centrale Cockpit Dashboard */}
      <Route
        path="/admin"
        element={
          <AdminLayout selectedCity={selectedCity} onCityChange={setSelectedCity}>
            <AdminDashboardPage selectedCity={selectedCity} onCityChange={setSelectedCity} />
          </AdminLayout>
        }
      />

      {/* 3. LAYER 2: Festival Hub (Editie-specifieke omgeving) */}
      <Route
        path="/admin/festival/:cityId"
        element={
          <FestivalLayout>
            <FestivalOverviewPage />
          </FestivalLayout>
        }
      />
      <Route
        path="/admin/festival/:cityId/overview"
        element={
          <FestivalLayout>
            <FestivalOverviewPage />
          </FestivalLayout>
        }
      />
      <Route
        path="/admin/festival/:cityId/orders"
        element={
          <FestivalLayout>
            <OrdersPage />
          </FestivalLayout>
        }
      />
      <Route
        path="/admin/festival/:cityId/inventory"
        element={
          <FestivalLayout>
            <InventoryPage />
          </FestivalLayout>
        }
      />
      <Route
        path="/admin/festival/:cityId/door"
        element={
          <FestivalLayout>
            <DoorMonitorPage />
          </FestivalLayout>
        }
      />
      <Route
        path="/admin/festival/:cityId/coupons"
        element={
          <FestivalLayout>
            <CouponsPage />
          </FestivalLayout>
        }
      />

      {/* Backwards-compatible legacy redirects */}
      <Route path="/admin/orders" element={<Navigate to="/admin/festival/denhaag/orders" replace />} />
      <Route path="/admin/inventory" element={<Navigate to="/admin/festival/denhaag/inventory" replace />} />
      <Route path="/admin/door" element={<Navigate to="/admin/festival/denhaag/door" replace />} />
      <Route path="/admin/coupons" element={<Navigate to="/admin/festival/denhaag/coupons" replace />} />

      {/* 4. Mobiele Deurscanner PWA */}
      <Route path="/scan" element={<ScannerPwaPage />} />

      {/* 5. Officiële E-Ticket Viewer (Responsive & Print-klaar) */}
      <Route path="/ticket" element={<TicketViewPage />} />
      <Route path="/ticket/:ticketCode" element={<TicketViewPage />} />

      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
};

export default App;
