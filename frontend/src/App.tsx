import { Route, Routes } from 'react-router-dom';
import Homepage from './pages/Homepage';
import CompanyDetail from './pages/CompanyDetail';
import QuestionDetail from './pages/QuestionDetail';
import Contribute from './pages/Contribute';
import ModeratorQueue from './pages/ModeratorQueue';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/c/:slug" element={<CompanyDetail />} />
      <Route path="/q/:id" element={<QuestionDetail />} />
      <Route path="/contribute" element={<Contribute />} />
      <Route path="/admin/queue" element={<ModeratorQueue />} />
    </Routes>
  );
}

export default App;
