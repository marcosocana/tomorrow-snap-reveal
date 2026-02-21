import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Logout from "./pages/Logout";
import Camera from "./pages/Camera";
import Gallery from "./pages/Gallery";
import EventManagement from "./pages/EventManagement";
import EventForm from "./pages/EventForm";
import BulkUpload from "./pages/BulkUpload";
import EventAccess from "./pages/EventAccess";
import AdminLogin from "./pages/AdminLogin";
import AdminResetPassword from "./pages/AdminResetPassword";
import NotFound from "./pages/NotFound";
import TermsAndConditions from "./pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import PublicDemoEventForm from "./pages/PublicDemoEventForm";
import DemoEventSummary from "./pages/DemoEventSummary";
import PricingPlans from "./pages/PricingPlans";
import { AdminI18nProvider } from "@/lib/adminI18n";
import RedeemEvent from "./pages/RedeemEvent";
import PaidEventSummary from "./pages/PaidEventSummary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AdminI18nProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<AdminLogin />} />
            <Route path="/login" element={<AdminLogin />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/event-login" element={<Login />} />
            <Route path="/camera" element={<Camera />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/reset-password" element={<AdminResetPassword />} />
            <Route path="/event-management" element={<EventManagement />} />
            <Route path="/event-form" element={<EventForm />} />
            <Route path="/event-form/:eventId" element={<EventForm />} />
            <Route path="/bulk-upload" element={<BulkUpload />} />
            <Route path="/event/:password" element={<EventAccess />} />
            <Route path="/events/:password" element={<EventAccess />} />
            <Route path="/redeem/:token" element={<RedeemEvent />} />
            <Route path="/terms" element={<TermsAndConditions />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/nuevoeventodemo" element={<PublicDemoEventForm />} />
            <Route path="/nuevoeventodemo/resumen" element={<DemoEventSummary />} />
            <Route path="/evento-pago/resumen" element={<PaidEventSummary />} />
            <Route path="/planes" element={<PricingPlans />} />

            {/* Admin translations via URL prefix */}
            <Route path="/en/login" element={<AdminLogin />} />
            <Route path="/en/admin-login" element={<AdminLogin />} />
            <Route path="/en/reset-password" element={<AdminResetPassword />} />
            <Route path="/en/event-management" element={<EventManagement />} />
            <Route path="/en/event-form" element={<EventForm />} />
            <Route path="/en/event-form/:eventId" element={<EventForm />} />
            <Route path="/en/bulk-upload" element={<BulkUpload />} />
            <Route path="/en/planes" element={<PricingPlans />} />
            <Route path="/en/logout" element={<Logout />} />
            <Route path="/en/redeem/:token" element={<RedeemEvent />} />
            <Route path="/en/evento-pago/resumen" element={<PaidEventSummary />} />

            <Route path="/it/login" element={<AdminLogin />} />
            <Route path="/it/admin-login" element={<AdminLogin />} />
            <Route path="/it/reset-password" element={<AdminResetPassword />} />
            <Route path="/it/event-management" element={<EventManagement />} />
            <Route path="/it/event-form" element={<EventForm />} />
            <Route path="/it/event-form/:eventId" element={<EventForm />} />
            <Route path="/it/bulk-upload" element={<BulkUpload />} />
            <Route path="/it/planes" element={<PricingPlans />} />
            <Route path="/it/logout" element={<Logout />} />
            <Route path="/it/redeem/:token" element={<RedeemEvent />} />
            <Route path="/it/evento-pago/resumen" element={<PaidEventSummary />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AdminI18nProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
