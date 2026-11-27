import { Route, Routes } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { BotControlPage } from './pages/BotControlPage';
import { OptionChainPage } from './pages/OptionChainPage';
import { StrategyBuilderPage } from './pages/StrategyBuilderPage';
import { BacktestResultsPage } from './pages/BacktestResultsPage';
import { TradeAuditorPage } from './pages/TradeAuditorPage';
import { PaperTradingPage } from './pages/PaperTradingPage';
import { LiveTradingPage } from './pages/LiveTradingPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { TradingAcademyPage } from './pages/TradingAcademyPage';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AuthProvider } from './context/AuthContext';
import { AuthGuard } from './components/AuthGuard';
import { AppShell } from './components/layout/AppShell';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route
          path="/*"
          element={
            <AuthGuard>
              <AppShell>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/bot" element={<BotControlPage />} />
                  <Route path="/option-chain" element={<OptionChainPage />} />
                  <Route path="/strategy/builder" element={<StrategyBuilderPage />} />
                  <Route path="/backtest" element={<BacktestResultsPage />} />
                  <Route path="/trade-auditor" element={<TradeAuditorPage />} />
                  <Route path="/trade-auditor/:id" element={<TradeAuditorPage />} />
                  <Route path="/paper-trading" element={<PaperTradingPage />} />
                  <Route path="/live-trading" element={<LiveTradingPage />} />
                  <Route path="/audit-logs" element={<AuditLogsPage />} />
                  <Route path="/academy" element={<TradingAcademyPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </AppShell>
            </AuthGuard>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
