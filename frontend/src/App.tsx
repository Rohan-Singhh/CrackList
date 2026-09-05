import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Homepage from './pages/Homepage';
import CompanyDetail from './pages/CompanyDetail';
import QuestionDetail from './pages/QuestionDetail';
import { Nav } from './components/Nav';
import { LocalProgressProvider, useLocalProgress } from './lib/useLocalProgress';

// Homepage, CompanyDetail and QuestionDetail stay in the main bundle: they are
// the three routes the prerenderer emits static HTML for, so they're the ones
// people land on cold from search, and code-splitting them would only add a
// second round trip before anything renders.
//
// These three are different — nobody arrives on them cold, and they drag weight
// the other 99% of visitors never need (the moderator queue alone pulls its own
// CSS plus the contributor-stats table).
const Contribute = lazy(() => import('./pages/Contribute'));
const About = lazy(() => import('./pages/About'));
const AdminRoute = lazy(() => import('./pages/AdminRoute'));

// React Router doesn't reset scroll on client-side navigation — click a
// company at the bottom of the homepage and you'd land on the company page
// still scrolled to the same Y. Reset to top on every pathname change
// (skip when there's an in-page hash target so /#trending still works).
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

// Shown only for the split routes, and only for as long as their chunk takes
// to arrive. Renders the nav so the header doesn't disappear and reflow the
// page underneath it.
function RouteFallback() {
  return (
    <div className="page-shell">
      <Nav />
      <div style={{ padding: 60, opacity: 0.6, fontSize: 14 }}>Loading…</div>
    </div>
  );
}

function ProgressStorageNotice() {
  const { storageError } = useLocalProgress();
  if (!storageError) return null;
  return <div className="progress-storage-notice" role="alert">Browser storage is unavailable. Your practice changes are kept for this session, but may be lost when you reload.</div>;
}

function App() {
  return (
    <LocalProgressProvider>
      <ProgressStorageNotice />
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/c/:slug" element={<CompanyDetail />} />
          <Route path="/q/:id" element={<QuestionDetail />} />
          <Route path="/contribute" element={<Contribute />} />
          <Route path="/about" element={<About />} />
          <Route path="/admin/queue" element={<AdminRoute />} />
        </Routes>
      </Suspense>
    </LocalProgressProvider>
  );
}

export default App;
