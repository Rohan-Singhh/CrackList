import { Route, Routes } from 'react-router-dom';
import Homepage from './pages/Homepage';
import CompanyDetail from './pages/CompanyDetail';
import QuestionDetail from './pages/QuestionDetail';
import Contribute from './pages/Contribute';
import ModeratorQueue from './pages/ModeratorQueue';
import { RequireModerator } from './pages/ModeratorLogin';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/c/:slug" element={<CompanyDetail />} />
      <Route path="/q/:id" element={<QuestionDetail />} />
      <Route path="/contribute" element={<Contribute />} />
      <Route
        path="/admin/queue"
        element={
          <RequireModerator>
            <ModeratorQueue />
          </RequireModerator>
        }
      />
    </Routes>
  );
}

export default App;
