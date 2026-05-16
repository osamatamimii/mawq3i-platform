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
import Products from "@/pages/Products";
import AddProduct from "@/pages/AddProduct";
import Orders from "@/pages/Orders";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import StoreFront from "@/pages/StoreFront";

import AdminOverview from "@/pages/admin/Overview";
import AdminStores from "@/pages/admin/Stores";
import AdminClients from "@/pages/admin/Clients";
import AdminSubscriptions from "@/pages/admin/Subscriptions";
import AdminDomains from "@/pages/admin/Domains";
import AdminSettings from "@/pages/admin/AdminSettings";
import SiteBuilder from "@/pages/SiteBuilder";
import EditProduct from "@/pages/EditProduct";
import Promotions from "@/pages/Promotions";

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
  const { supabaseUser, authLoading, currentUser } = useAppContext();

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
    return (
      <Layout>
        <AnimatePresence mode="wait">
          <motion.div key={location} {...pageMotion}>
            <Switch>
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/dashboard/products" component={Products} />
              <Route path="/dashboard/add-product" component={AddProduct} />
              <Route path="/dashboard/products/edit/:id" component={EditProduct} />
              <Route path="/dashboard/orders" component={Orders} />
              <Route path="/dashboard/analytics" component={Analytics} />
              <Route path="/dashboard/settings" component={Settings} />
              <Route path="/dashboard/promotions" component={Promotions} />
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
