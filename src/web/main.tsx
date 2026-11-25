import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import { api, ApiError } from './api';
import { Layout, Loading, MeContext, type Me } from './components';
import { Alerts, Dashboard, Login, Search } from './pages/core';
import { Contacts, Setup, Sources } from './pages/ops';
import { AiReview } from './pages/ai';
import { CampaignDetail, Campaigns, PublicReport, ReportDetail, Reports } from './pages/work';

function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const load = useCallback(() => {
    api<Me>('GET', '/auth/me').then(setMe).catch((e) => { if (e instanceof ApiError && e.status === 401) setMe(null); else setMe(null); });
  }, []);
  useEffect(load, [load]);

  // Public client report links need no session.
  if (location.pathname.startsWith('/r/')) {
    return <BrowserRouter><Routes><Route path="/r/:token" element={<PublicReport />} /></Routes></BrowserRouter>;
  }
  if (me === undefined) return <main className="main"><Loading /></main>;
  if (me === null) return <Login onDone={load} />;
  return (
    <MeContext.Provider value={{ me, reload: load }}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="search" element={<Search />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="ai" element={<AiReview />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />
            <Route path="reports" element={<Reports />} />
            <Route path="reports/:id" element={<ReportDetail />} />
            <Route path="sources" element={<Sources />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="setup" element={<Setup />} />
            <Route path="*" element={<p>Page not found.</p>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MeContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
