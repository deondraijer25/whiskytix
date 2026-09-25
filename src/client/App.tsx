import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { InventoryPage } from './pages/InventoryPage';
import { CouponsPage } from './pages/CouponsPage';
import { DoorMonitorPage } from './pages/DoorMonitorPage';
import { TicketsMonitorPage } from './pages/TicketsMonitorPage';
import { UsersPage } from './pages/UsersPage';
import { ScannerPwaPage } from './pages/ScannerPwaPage';
import { ScanHistoryPage } from './pages/ScanHistoryPage';
import { TicketViewPage } from './pages/TicketViewPage';
import { FestivalOverviewPage } from './pages/FestivalOverviewPage';
import { AdminLayout } from './components/AdminLayout';
import { FestivalLayout } from './components/FestivalLayout';
import { ProtectedRoute } from './components/ProtectedRoute';

export const App: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState<string>('all');

  return (
    <Routes>
      {/* 1. Admin Login Screen */}
      <Route path="/admin/login" element={<LoginPage />} />

      {/* 2. LAYER 1: 3-Steden Centrale Cockpit Dashboard (Protected) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout selectedCity={selectedCity} onCityChange={setSelectedCity}>
              <AdminDashboardPage selectedCity={selectedCity} onCityChange={setSelectedCity} />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/tickets"
        element={
          <ProtectedRoute>
            <AdminLayout selectedCity={selectedCity} onCityChange={setSelectedCity}>
              <TicketsMonitorPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <AdminLayout selectedCity={selectedCity} onCityChange={setSelectedCity}>
              <UsersPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* 3. LAYER 2: Festival Hub (Editie-specifieke omgeving - Protected) */}
      <Route
        path="/admin/festival/:cityId"
        element={
          <ProtectedRoute>
            <FestivalLayout>
              <FestivalOverviewPage />
            </FestivalLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/festival/:cityId/overview"
        element={
          <ProtectedRoute>
            <FestivalLayout>
              <FestivalOverviewPage />
            </FestivalLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/festival/:cityId/orders"
        element={
          <ProtectedRoute>
            <FestivalLayout>
              <OrdersPage />
            </FestivalLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/festival/:cityId/inventory"
        element={
          <ProtectedRoute>
            <FestivalLayout>
              <InventoryPage />
            </FestivalLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/festival/:cityId/door"
        element={
          <ProtectedRoute>
            <FestivalLayout>
              <DoorMonitorPage />
            </FestivalLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/festival/:cityId/coupons"
        element={
          <ProtectedRoute>
            <FestivalLayout>
              <CouponsPage />
            </FestivalLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/festival/:cityId/tickets"
        element={
          <ProtectedRoute>
            <FestivalLayout>
              <TicketsMonitorPage />
            </FestivalLayout>
          </ProtectedRoute>
        }
      />

      {/* Backwards-compatible legacy redirects */}
      <Route path="/admin/orders" element={<Navigate to="/admin/festival/denhaag/orders" replace />} />
      <Route path="/admin/inventory" element={<Navigate to="/admin/festival/denhaag/inventory" replace />} />
      <Route path="/admin/door" element={<Navigate to="/admin/festival/denhaag/door" replace />} />
      <Route path="/admin/coupons" element={<Navigate to="/admin/festival/denhaag/coupons" replace />} />

      {/* 4. Mobiele Deurscanner PWA & Audit Log */}
      <Route path="/scan" element={<ScannerPwaPage />} />
      <Route path="/scan/history" element={<ScanHistoryPage />} />

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
