import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Homepage from './pages/Homepage';
import CompanyDetail from './pages/CompanyDetail';
import QuestionDetail from './pages/QuestionDetail';
import Contribute from './pages/Contribute';
import About from './pages/About';
import ModeratorQueue from './pages/ModeratorQueue';
import { RequireModerator } from './pages/ModeratorLogin';
import { LocalProgressProvider } from './lib/useLocalProgress';

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

function App() {
  return (
    <LocalProgressProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/c/:slug" element={<CompanyDetail />} />
        <Route path="/q/:id" element={<QuestionDetail />} />
        <Route path="/contribute" element={<Contribute />} />
        <Route path="/about" element={<About />} />
        <Route
          path="/admin/queue"
          element={
            <RequireModerator>
              <ModeratorQueue />
            </RequireModerator>
          }
        />
      </Routes>
    </LocalProgressProvider>
  );
}

export default App;
