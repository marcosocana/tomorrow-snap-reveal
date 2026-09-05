import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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
import PublicDemoEventWizard from "./pages/PublicDemoEventWizard";
import DemoEventSummary from "./pages/DemoEventSummary";
import PricingPlans from "./pages/PricingPlans";
import { AdminI18nProvider } from "@/lib/adminI18n";
import RedeemEvent from "./pages/RedeemEvent";
import PaidEventSummary from "./pages/PaidEventSummary";
import Register from "./pages/Register";
import { CaptainsAdminDetail, CaptainsAdminForm, CaptainsAdminList, CaptainsOnboarding } from "./pages/CaptainsAdmin";
import CaptainsDemoV2 from "./pages/CaptainsDemoV2";
import CaptainsExperience from "./pages/CaptainsExperience";
import LiveSlideshow from "./pages/LiveSlideshow";
import TimeCapsule from "./pages/TimeCapsule";
import OAuthConsent from "./pages/OAuthConsent";
import PhotostripPublic from "./pages/PhotostripPublic";
import { PhotostripAdminDetail, PhotostripAdminForm } from "./pages/PhotostripAdmin";
import NewPhotostripDemo from "./pages/NewPhotostripDemo";

const queryClient = new QueryClient();

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "2026-02-23";
const APP_VERSION_KEY = "app-version";
const RESET_KEYS = [
  "adminEventId",
  "isDemoMode",
  "isAdmin",
  "eventId",
  "eventName",
  "eventLanguage",
  "eventTimezone",
  "bulkUploadMode",
  "likedPhotos",
];

const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    const getContainers = () => {
      const containers = new Set<HTMLElement>();
      const root = document.scrollingElement || document.documentElement;
      if (root) containers.add(root as HTMLElement);
      if (document.documentElement) containers.add(document.documentElement);
      if (document.body) containers.add(document.body);
      const appRoot = document.getElementById("root");
      if (appRoot) containers.add(appRoot);
      document
        .querySelectorAll<HTMLElement>(
          "[data-scroll-container], .overflow-y-auto, .overflow-auto, main"
        )
        .forEach((el) => containers.add(el));
      return containers;
    };

    const isScrollable = (el: HTMLElement) => {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      return (
        (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
        el.scrollHeight > el.clientHeight + 1
      );
    };

    const resetScrollableAncestors = (el: HTMLElement | null) => {
      let current: HTMLElement | null = el;
      while (current && current !== document.body && current !== document.documentElement) {
        if (isScrollable(current)) {
          current.scrollTop = 0;
          current.scrollLeft = 0;
        }
        current = current.parentElement;
      }
    };

    const scrollTop = () => {
      const anchor = document.querySelector<HTMLElement>("[data-scroll-anchor]");
      if (anchor) resetScrollableAncestors(anchor);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      getContainers().forEach((el) => {
        if (el.scrollTop !== 0) el.scrollTop = 0;
        if (el.scrollLeft !== 0) el.scrollLeft = 0;
      });
      if (anchor) {
        anchor.scrollIntoView({ block: "start", inline: "nearest" });
      }
    };

    scrollTop();
    requestAnimationFrame(() => requestAnimationFrame(scrollTop));
    setTimeout(scrollTop, 0);
    setTimeout(scrollTop, 100);
    setTimeout(scrollTop, 300);
  }, [pathname, hash]);

  return null;
};

const App = () => {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    const storedVersion = localStorage.getItem(APP_VERSION_KEY);
    if (storedVersion === APP_VERSION) return;
    RESET_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
    window.location.reload();
  }, []);

  useEffect(() => {
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";
    return () => {
      document.documentElement.style.overflowX = "";
      document.body.style.overflowX = "";
    };
  }, []);

  useEffect(() => {
    const updateAppHeight = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${Math.round(viewportHeight)}px`);
    };

    updateAppHeight();
    window.addEventListener("resize", updateAppHeight);
    window.addEventListener("orientationchange", updateAppHeight);
    window.visualViewport?.addEventListener("resize", updateAppHeight);

    return () => {
      window.removeEventListener("resize", updateAppHeight);
      window.removeEventListener("orientationchange", updateAppHeight);
      window.visualViewport?.removeEventListener("resize", updateAppHeight);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AdminI18nProvider>
            <Toaster />
            <Sonner />
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<AdminLogin />} />
              <Route path="/login" element={<AdminLogin />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="/logout" element={<Logout />} />
              <Route path="/event-login" element={<Login />} />
              <Route path="/camera" element={<Camera />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password" element={<AdminResetPassword />} />
              <Route path="/event-management" element={<EventManagement />} />
              <Route path="/event-form" element={<EventForm />} />
              <Route path="/event-form/:eventId" element={<EventForm />} />
              <Route path="/bulk-upload" element={<BulkUpload />} />
              <Route path="/event/:password" element={<EventAccess />} />
              <Route path="/events/:password" element={<EventAccess />} />
              <Route path="/capsula/:eventId" element={<TimeCapsule />} />
              <Route path="/slideshow/:eventId" element={<LiveSlideshow />} />
              <Route path="/redeem/:token" element={<RedeemEvent />} />
              <Route path="/terms" element={<TermsAndConditions />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/nuevoeventodemo" element={<PublicDemoEventForm />} />
              <Route path="/nuevoeventodemo2" element={<PublicDemoEventWizard />} />
              <Route path="/nuevophotostripdemo" element={<NewPhotostripDemo />} />
              <Route path="/nuevoeventocapitanes" element={<CaptainsOnboarding />} />
              <Route path="/nuevoeventodemo/resumen" element={<DemoEventSummary />} />
              <Route path="/evento-pago/resumen" element={<PaidEventSummary />} />
              <Route path="/planes" element={<PricingPlans />} />
              <Route path="/admin/capitanes" element={<CaptainsAdminList />} />
              <Route path="/admin/capitanes/onboarding" element={<CaptainsOnboarding />} />
              <Route path="/admin/capitanes/new" element={<CaptainsAdminForm />} />
              <Route path="/admin/capitanes/:eventId" element={<CaptainsAdminDetail />} />
              <Route path="/admin/capitanes/:eventId/edit" element={<CaptainsAdminForm edit />} />
              <Route path="/capitanes/onboarding" element={<CaptainsOnboarding />} />
              <Route path="/capitanes/demo-capitanes-v2" element={<CaptainsDemoV2 />} />
              <Route path="/capitanes/:eventSlug" element={<CaptainsExperience />} />
              <Route path="/capitanes/:eventSlug/start" element={<CaptainsExperience />} />
              <Route path="/capitanes/:eventSlug/play" element={<CaptainsExperience />} />
              <Route path="/capitanes/:eventSlug/ranking" element={<CaptainsExperience />} />
              <Route path="/capitanes/:eventSlug/final" element={<CaptainsExperience />} />
              <Route path="/capitanes/:eventSlug/live" element={<CaptainsExperience />} />
              <Route path="/capitanes/:eventSlug/resumen" element={<CaptainsExperience />} />
              <Route path="/photostrip/:eventSlug" element={<PhotostripPublic />} />
              <Route path="/photostrip/:eventSlug/gallery" element={<PhotostripPublic />} />
              <Route path="/admin/photostrip/new" element={<PhotostripAdminForm />} />
              <Route path="/admin/photostrip/:eventId" element={<PhotostripAdminDetail />} />
              <Route path="/admin/photostrip/:eventId/edit" element={<PhotostripAdminForm edit />} />

              {/* Admin translations via URL prefix */}
              <Route path="/en/login" element={<AdminLogin />} />
              <Route path="/en/admin-login" element={<AdminLogin />} />
              <Route path="/en/register" element={<Register />} />
              <Route path="/en/reset-password" element={<AdminResetPassword />} />
              <Route path="/en/event-management" element={<EventManagement />} />
              <Route path="/en/event-form" element={<EventForm />} />
              <Route path="/en/event-form/:eventId" element={<EventForm />} />
              <Route path="/en/bulk-upload" element={<BulkUpload />} />
              <Route path="/en/planes" element={<PricingPlans />} />
              <Route path="/en/nuevoeventodemo" element={<PublicDemoEventForm />} />
              <Route path="/en/nuevoeventodemo2" element={<PublicDemoEventWizard />} />
              <Route path="/en/nuevoeventocapitanes" element={<CaptainsOnboarding />} />
              <Route path="/en/nuevoeventodemo/resumen" element={<DemoEventSummary />} />
              <Route path="/en/logout" element={<Logout />} />
              <Route path="/en/redeem/:token" element={<RedeemEvent />} />
              <Route path="/en/evento-pago/resumen" element={<PaidEventSummary />} />
              <Route path="/en/terms" element={<TermsAndConditions />} />
              <Route path="/en/privacy" element={<PrivacyPolicy />} />

              <Route path="/it/login" element={<AdminLogin />} />
              <Route path="/it/admin-login" element={<AdminLogin />} />
              <Route path="/it/register" element={<Register />} />
              <Route path="/it/reset-password" element={<AdminResetPassword />} />
              <Route path="/it/event-management" element={<EventManagement />} />
              <Route path="/it/event-form" element={<EventForm />} />
              <Route path="/it/event-form/:eventId" element={<EventForm />} />
              <Route path="/it/bulk-upload" element={<BulkUpload />} />
              <Route path="/it/planes" element={<PricingPlans />} />
              <Route path="/it/nuevoeventodemo" element={<PublicDemoEventForm />} />
              <Route path="/it/nuevoeventodemo2" element={<PublicDemoEventWizard />} />
              <Route path="/it/nuevoeventocapitanes" element={<CaptainsOnboarding />} />
              <Route path="/it/nuevoeventodemo/resumen" element={<DemoEventSummary />} />
              <Route path="/it/logout" element={<Logout />} />
              <Route path="/it/redeem/:token" element={<RedeemEvent />} />
              <Route path="/it/evento-pago/resumen" element={<PaidEventSummary />} />
              <Route path="/it/terms" element={<TermsAndConditions />} />
              <Route path="/it/privacy" element={<PrivacyPolicy />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AdminI18nProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
