import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useAppContext } from "@/context/AppContext";
import { Layout } from "@/components/layout/Layout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ProductsHub from "@/pages/ProductsHub";
import ResearchHub from "@/pages/ResearchHub";
import AddProduct from "@/pages/AddProduct";
import Orders from "@/pages/Orders";
import AnalyticsHub from "@/pages/AnalyticsHub";
import SettingsHub from "@/pages/SettingsHub";
import StoreFront from "@/pages/StoreFront";

import AdminOverview from "@/pages/admin/Overview";
import AdminStores from "@/pages/admin/Stores";
import AdminClients from "@/pages/admin/Clients";
import AdminSubscriptions from "@/pages/admin/Subscriptions";
import AdminDomains from "@/pages/admin/Domains";
import AdminSettings from "@/pages/admin/AdminSettings";
import AIUsage from "@/pages/admin/AIUsage";
import GrowthAgentAdmin from "@/pages/admin/GrowthAgent";
import SiteBuilder from "@/pages/SiteBuilder";
import EditProduct from "@/pages/EditProduct";
import PromotionsHub from "@/pages/PromotionsHub";
import MarketingStudioHub from "@/pages/MarketingStudioHub";
import AIAdvisor from "@/pages/AIAdvisor";

const queryClient = new QueryClient();

const pageMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.4 },
};

const ADMIN_EMAIL = "admin@mawq3i.com";

function Router() {
  const [location] = useLocation();
  const { supabaseUser, authLoading, currentUser, staffPermissions } = useAppContext();

  // Show loading spinner while Supabase session is being checked
  if (authLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#060809] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Public routes — always accessible
  if (location === "/" || location === "/login") {
    // If already logged in, redirect to the right place
    if (supabaseUser) {
      return <Redirect to={supabaseUser.email?.toLowerCase() === ADMIN_EMAIL ? "/admin" : "/dashboard"} />;
    }
    return (
      <AnimatePresence mode="wait">
        <motion.div key="login" {...pageMotion} className="min-h-[100dvh] bg-background">
          <Switch>
            <Route path="/" component={Login} />
            <Route path="/login" component={Login} />
          </Switch>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Store front — public
  if (location.startsWith("/store/")) {
    return (
      <Switch>
        <Route path="/store/:slug" component={StoreFront} />
      </Switch>
    );
  }

  // Protected: /admin — must be logged in AND email is admin
  if (location.startsWith("/admin")) {
    if (!supabaseUser) return <Redirect to="/login" />;
    if (supabaseUser.email?.toLowerCase() !== ADMIN_EMAIL) return <Redirect to="/dashboard" />;
    return (
      <AdminLayout>
        <AnimatePresence mode="wait">
          <motion.div key={location} {...pageMotion}>
            <Switch>
              <Route path="/admin" component={AdminOverview} />
              <Route path="/admin/stores" component={AdminStores} />
              <Route path="/admin/clients" component={AdminClients} />
              <Route path="/admin/customers" component={AdminClients} />
              <Route path="/admin/subscriptions" component={AdminSubscriptions} />
              <Route path="/admin/domains" component={AdminDomains} />
              <Route path="/admin/settings" component={AdminSettings} />
              <Route path="/admin/ai-usage" component={AIUsage} />
              <Route path="/admin/growth-agent" component={GrowthAgentAdmin} />
              <Route path="/admin/site-builder/:slug" component={SiteBuilder} />
              <Route component={NotFound} />
            </Switch>
          </motion.div>
        </AnimatePresence>
      </AdminLayout>
    );
  }

  // Protected: /dashboard — must be logged in
  // Admin can access dashboard when "entered as owner" via setCurrentStore
  if (location.startsWith("/dashboard")) {
    if (!supabaseUser) return <Redirect to="/login" />;
    // If admin and NOT entered as owner (no currentStore set), redirect to /admin
    if (supabaseUser.email?.toLowerCase() === ADMIN_EMAIL && currentUser === "admin") {
      return <Redirect to="/admin" />;
    }
    // Staff accounts (limited permissions) can't reach pages outside their grant
    if (staffPermissions) {
      if (location.startsWith("/dashboard/staff")) {
        return <Redirect to="/dashboard/orders" />;
      }
      const routePermission: Record<string, keyof typeof staffPermissions> = {
        "/dashboard/products": "products",
        "/dashboard/bundles": "products",
        "/dashboard/winning-products": "products",
        "/dashboard/competitor-prices": "products",
        "/dashboard/add-product": "products",
        "/dashboard/analytics": "analytics",
        "/dashboard/settings": "settings",
        "/dashboard/promotions": "promotions",
        "/dashboard/discount-codes": "promotions",
      };
      const neededPerm = Object.entries(routePermission).find(([path]) => location.startsWith(path))?.[1];
      if (neededPerm && !staffPermissions[neededPerm]) {
        return <Redirect to="/dashboard/orders" />;
      }
      if (location === "/dashboard" && !staffPermissions.analytics) {
        return <Redirect to="/dashboard/orders" />;
      }
    }
    return (
      <Layout>
        <AnimatePresence mode="wait">
          <motion.div key={location} {...pageMotion}>
            <Switch>
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/dashboard/products" component={ProductsHub} />
              <Route path="/dashboard/bundles" component={ProductsHub} />
              <Route path="/dashboard/winning-products" component={ResearchHub} />
              <Route path="/dashboard/competitor-prices" component={ResearchHub} />
              <Route path="/dashboard/add-product" component={AddProduct} />
              <Route path="/dashboard/products/edit/:id" component={EditProduct} />
              <Route path="/dashboard/orders" component={Orders} />
              <Route path="/dashboard/analytics" component={AnalyticsHub} />
              <Route path="/dashboard/reviews" component={AnalyticsHub} />
              <Route path="/dashboard/settings" component={SettingsHub} />
              <Route path="/dashboard/staff" component={SettingsHub} />
              <Route path="/dashboard/marketing-studio" component={MarketingStudioHub} />
              <Route path="/dashboard/abandoned-carts" component={MarketingStudioHub} />
              <Route path="/dashboard/promotions" component={PromotionsHub} />
              <Route path="/dashboard/discount-codes" component={PromotionsHub} />
              <Route path="/dashboard/ai-advisor" component={AIAdvisor} />
              <Route component={NotFound} />
            </Switch>
          </motion.div>
        </AnimatePresence>
      </Layout>
    );
  }

  return <NotFound />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
