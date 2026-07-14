import React from 'react';
import type { ReactNode } from 'react';

import HomePage from './pages/HomePage';
import PackagesPage from './pages/PackagesPage';
import VoucherPage from './pages/VoucherPage';
import SupportPage from './pages/SupportPage';
import PaymentVerifyPage from './pages/PaymentVerifyPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import AdminVouchersPage from './pages/admin/AdminVouchersPage';
import AdminPackagesPage from './pages/admin/AdminPackagesPage';
import AdminAdsPage from './pages/admin/AdminAdsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import { AdminLayout } from './components/layouts/AdminLayout';
import { AdminGuard } from './components/common/AdminGuard';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  public?: boolean;
}

function AdminPage({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      <AdminLayout>{children}</AdminLayout>
    </AdminGuard>
  );
}

export const routes: RouteConfig[] = [
  // Public
  { name: 'Home', path: '/', element: <HomePage />, public: true },
  { name: 'Packages', path: '/packages', element: <PackagesPage />, public: true },
  { name: 'Redeem Voucher', path: '/voucher', element: <VoucherPage />, public: true },
  { name: 'Support', path: '/support', element: <SupportPage />, public: true },
  { name: 'Payment Verify', path: '/payment/verify', element: <PaymentVerifyPage />, public: true },
  // Admin login (public)
  { name: 'Admin Login', path: '/admin/login', element: <AdminLoginPage />, public: true },
  // Admin (protected)
  { name: 'Dashboard', path: '/admin', element: <AdminPage><AdminDashboardPage /></AdminPage> },
  { name: 'Users', path: '/admin/users', element: <AdminPage><AdminUsersPage /></AdminPage> },
  { name: 'Payments', path: '/admin/payments', element: <AdminPage><AdminPaymentsPage /></AdminPage> },
  { name: 'Vouchers', path: '/admin/vouchers', element: <AdminPage><AdminVouchersPage /></AdminPage> },
  { name: 'Packages', path: '/admin/packages', element: <AdminPage><AdminPackagesPage /></AdminPage> },
  { name: 'Advertisements', path: '/admin/ads', element: <AdminPage><AdminAdsPage /></AdminPage> },
  { name: 'Settings', path: '/admin/settings', element: <AdminPage><AdminSettingsPage /></AdminPage> },
];
