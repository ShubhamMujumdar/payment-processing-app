import { BrowserRouter as Router, Routes, Route } from "react-router";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import DeveloperView from "./pages/DeveloperView";
import Console from "./pages/Console";
import LivePipeline from "./pages/LivePipeline";
import Traceability from "./pages/Traceability";
import KnowledgeGraph from "./pages/KnowledgeGraph";
import NotFound from "./pages/OtherPage/NotFound";

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index path="/" element={<DeveloperView />} />
          <Route path="/delivery" element={<Console />} />
          <Route path="/live" element={<LivePipeline />} />
          <Route path="/traceability" element={<Traceability />} />
          <Route path="/graph" element={<KnowledgeGraph />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
