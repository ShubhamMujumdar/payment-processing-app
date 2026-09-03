import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import DeveloperView from "./pages/DeveloperView";
import Console from "./pages/Console";
import LivePipeline from "./pages/LivePipeline";
import Traceability from "./pages/Traceability";
import KnowledgeGraph from "./pages/KnowledgeGraph";
import KnowledgeManagement from "./pages/KnowledgeManagement";
import NotBuilt from "./pages/NotBuilt";
import Portfolio from "./pages/Portfolio";
import Strategy from "./pages/Strategy";
import { Analytics, Initiatives, RiskRegister } from "./pages/ExecStubs";
import NotFound from "./pages/OtherPage/NotFound";
import Login from "./pages/Login";
import ProgramManagerHealth from "./pages/ProgramManagerHealth";
import ProgramManagerDeliverables from "./pages/ProgramManagerDeliverables";
import ProgramManagerKnowledgeBase from "./pages/ProgramManagerKnowledgeBase";
import ProgramManagerTraceability from "./pages/ProgramManagerTraceability";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!localStorage.getItem("demo_role")) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RoleIndex() {
  const role = localStorage.getItem("demo_role");
  if (role === "user_executive") return <Navigate to="/portfolio" replace />;
  if (role === "user_program_manager") return <Navigate to="/pm-health" replace />;
  if (role === "user_developer") return <Navigate to="/knowledge-management" replace />;
  if (role === "user_product_ops") return <Navigate to="/knowledge-management" replace />;
  return <Navigate to="/knowledge-management" replace />;
}

function BlockProductOps({ children }: { children: React.ReactNode }) {
  const role = localStorage.getItem("demo_role");
  if (role === "user_product_ops") {
    return <Navigate to="/settings" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index path="/" element={<RoleIndex />} />
          <Route path="/tasks" element={<BlockProductOps><DeveloperView /></BlockProductOps>} />
          <Route path="/delivery" element={<BlockProductOps><Console /></BlockProductOps>} />
          <Route path="/live" element={<BlockProductOps><LivePipeline /></BlockProductOps>} />
          <Route path="/traceability" element={<BlockProductOps><Traceability /></BlockProductOps>} />
          <Route path="/graph" element={<BlockProductOps><KnowledgeGraph /></BlockProductOps>} />
          <Route path="/pm-health" element={<ProgramManagerHealth />} />
          <Route path="/pm-deliverables" element={<ProgramManagerDeliverables />} />
          <Route path="/pm-knowledge" element={<ProgramManagerKnowledgeBase />} />
          <Route path="/pm-traceability" element={<ProgramManagerTraceability />} />
          <Route path="/knowledge-management" element={<KnowledgeManagement />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/strategy" element={<Strategy />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/initiatives" element={<Initiatives />} />
          <Route path="/risk" element={<RiskRegister />} />
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
