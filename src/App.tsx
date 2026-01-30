import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Camera from "./pages/Camera";
import Gallery from "./pages/Gallery";
import EventManagement from "./pages/EventManagement";
import EventForm from "./pages/EventForm";
import BulkUpload from "./pages/BulkUpload";
import EventAccess from "./pages/EventAccess";
import AdminLogin from "./pages/AdminLogin";
import NotFound from "./pages/NotFound";
import TermsAndConditions from "./pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import PublicDemoEventForm from "./pages/PublicDemoEventForm";
import DemoEventSummary from "./pages/DemoEventSummary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/camera" element={<Camera />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/event-management" element={<EventManagement />} />
          <Route path="/event-form" element={<EventForm />} />
          <Route path="/event-form/:eventId" element={<EventForm />} />
          <Route path="/bulk-upload" element={<BulkUpload />} />
          <Route path="/event/:password" element={<EventAccess />} />
          <Route path="/events/:password" element={<EventAccess />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/nuevoeventodemo" element={<PublicDemoEventForm />} />
          <Route path="/nuevoeventodemo/resumen" element={<DemoEventSummary />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
