import { BrowserRouter as Router, Routes, Route } from "react-router";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import DeveloperView from "./pages/DeveloperView";
import Console from "./pages/Console";
import LivePipeline from "./pages/LivePipeline";
import Traceability from "./pages/Traceability";
import KnowledgeGraph from "./pages/KnowledgeGraph";
import NotBuilt from "./pages/NotBuilt";
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
          <Route
            path="/settings"
            element={<NotBuilt title="Settings" blurb="Workspace, connectors and notification preferences." />}
          />
          <Route
            path="/support"
            element={<NotBuilt title="Support" blurb="Raise an issue with the platform team." />}
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
