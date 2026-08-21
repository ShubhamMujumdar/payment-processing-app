import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import CommitToast from "../components/code2doc/CommitToast";
import ChatWidget from "../components/chat/ChatWidget";

/**
 * Console chrome. Content is edge-to-edge with no page padding - tables own
 * their own gutters, and a dense tool should not waste 24px on every side.
 */
const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen">
      <AppSidebar />
      <Backdrop />
      <div
        className={`min-h-screen transition-all duration-200 ease-out ${
          isExpanded || isHovered ? "lg:ml-[218px]" : "lg:ml-[60px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeader />
        <Outlet />
      </div>
      {/* Outside the content column: it must find you on any page. */}
      <CommitToast />
      <ChatWidget />
    </div>
  );
};

const AppLayout: React.FC = () => (
  <SidebarProvider>
    <LayoutContent />
  </SidebarProvider>
);

export default AppLayout;
