import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import OnboardingPage from './pages/OnboardingPage'
import BotPage from './pages/BotPage'
import ContentHub from './pages/ContentHub'
import LeadsPage from './pages/LeadsPage'
import PlansPage from './pages/PlansPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import CampaignsPage from './pages/CampaignsPage'
import CampaignCreatePage from './pages/CampaignCreatePage'
import CampaignDetailPage from './pages/CampaignDetailPage'
import LumiChatPage from './pages/LumiChatPage'
import MonitoringPage from './pages/MonitoringPage'

export default function App() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .active-nav-glow { box-shadow: 0 0 15px rgba(192, 193, 255, 0.1); }
      `}} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<BotPage />} />
            <Route path="/bot" element={<BotPage />} />
            <Route path="/content" element={<ContentHub />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/campaigns/new" element={<CampaignCreatePage />} />
            <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
            <Route path="/lumi" element={<LumiChatPage />} />
            <Route path="/monitoring" element={<MonitoringPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}
