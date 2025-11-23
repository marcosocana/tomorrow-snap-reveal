import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { InstallPromptModal } from "@/components/InstallPromptModal";
import Login from "./pages/Login";
import Camera from "./pages/Camera";
import Gallery from "./pages/Gallery";
import EventManagement from "./pages/EventManagement";
import BulkUpload from "./pages/BulkUpload";
import EventAccess from "./pages/EventAccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <InstallPromptModal />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/camera" element={<Camera />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/event-management" element={<EventManagement />} />
          <Route path="/bulk-upload" element={<BulkUpload />} />
          <Route path="/event/:password" element={<EventAccess />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
