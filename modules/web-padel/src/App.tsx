import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ApolloProvider, apolloClient } from './utils/apollo';
import { AuthProvider, useAuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LocationProvider } from './context/LocationContext';
import { MapProvider } from './context/MapContext';
import { RoutePaths } from './constants/RoutePaths';
import { LoginForm } from './components/auth/LoginForm';
import { RootLayout } from './layouts/RootLayout';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { ClubPage } from './components/club/ClubPage';
import { ClubOverviewPage } from './components/club/ClubOverviewPage';
import { AnalyticsPage } from './components/analytics/AnalyticsPage';
import { BookingPage } from './components/booking/BookingPage';
import './i18n';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthContext();
  if (!user) return <Navigate to={RoutePaths.AUTH} replace />;
  return <>{children}</>;
};

const AppContent = () => {
  const { user } = useAuthContext();

  useEffect(() => {
    const shell = document.getElementById('loading-shell');
    if (shell) {
      shell.style.opacity = '0';
      shell.style.transition = 'opacity 0.25s ease-out';
      setTimeout(() => shell.remove(), 250);
    }
  }, []);

  return (
    <>
      <Routes>
        <Route path={RoutePaths.AUTH} element={user ? <Navigate to={RoutePaths.DASHBOARD} replace /> : <LoginForm />} />
        <Route element={<ProtectedRoute><RootLayout /></ProtectedRoute>}>
          <Route path={RoutePaths.DASHBOARD} element={<DashboardPage />} />
          <Route path={RoutePaths.CLUBS} element={<ClubPage />} />
          <Route path={RoutePaths.CLUB_OVERVIEW} element={<ClubOverviewPage />} />
          <Route path={RoutePaths.ANALYTICS} element={<AnalyticsPage />} />
          <Route path={RoutePaths.BOOKINGS} element={<BookingPage />} />
        </Route>
        <Route path="*" element={<Navigate to={RoutePaths.AUTH} replace />} />
      </Routes>
    </>
  );
};

function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <ThemeProvider>
        <AuthProvider>
          <LocationProvider>
            <MapProvider>
              <Router>
                <AppContent />
              </Router>
            </MapProvider>
          </LocationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ApolloProvider>
  );
}

export default App;