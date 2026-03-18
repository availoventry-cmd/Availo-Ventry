import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";

// Pages
import Login from "@/pages/auth/login";
import SuperAdminDashboard from "@/pages/super-admin/dashboard";
import SuperAdminOrganizations from "@/pages/super-admin/organizations";
import SuperAdminAnalytics from "@/pages/super-admin/analytics";
import PortalDashboard from "@/pages/portal/dashboard";
import VisitRequests from "@/pages/portal/visit-requests";
import ReceptionistDashboard from "@/pages/receptionist/dashboard";
import PublicBooking from "@/pages/public/booking";
import TelegramSettings from "@/pages/settings/telegram";
import PortalVisitors from "@/pages/portal/visitors";
import PortalSettings from "@/pages/portal/settings";
import HostDashboard from "@/pages/host/index";
import HostNewRequest from "@/pages/host/new";

const queryClient = new QueryClient();

// Protected Route Wrapper
function ProtectedRoute({ component: Component, allowedRoles }: { component: any, allowedRoles?: string[] }) {
  const { user, isLoading, isFetching } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isFetching && !user) {
      setLocation("/login");
    }
  }, [isLoading, isFetching, user, setLocation]);

  // Wait until we have a definitive answer — either user data or confirmation of no session
  if ((isLoading || isFetching) && !user) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!user) return null;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <div className="p-8 text-center text-red-600">Access Denied</div>;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function getRoleHome(role: string) {
  if (role === 'super_admin') return '/super-admin/dashboard';
  if (role === 'receptionist') return '/receptionist';
  if (role === 'host_employee') return '/host';
  return '/portal/dashboard';
}

// Redirect root based on role
function RootRedirect() {
  const { user, isLoading, isFetching } = useAuth();

  if (isLoading || (isFetching && !user)) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Redirect to="/login" />;
  return <Redirect to={getRoleHome(user.role)} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={Login} />
      
      {/* Public Routes */}
      <Route path="/public/orgs/:slug" component={PublicBooking} />
      
      {/* Super Admin Routes */}
      <Route path="/super-admin/dashboard">
        {() => <ProtectedRoute component={SuperAdminDashboard} allowedRoles={['super_admin']} />}
      </Route>
      <Route path="/super-admin/organizations">
        {() => <ProtectedRoute component={SuperAdminOrganizations} allowedRoles={['super_admin']} />}
      </Route>
      <Route path="/super-admin/analytics">
        {() => <ProtectedRoute component={SuperAdminAnalytics} allowedRoles={['super_admin']} />}
      </Route>
      
      {/* Portal Routes (Org Admin / Visitor Manager) */}
      <Route path="/portal/dashboard">
        {() => <ProtectedRoute component={PortalDashboard} allowedRoles={['org_admin', 'visitor_manager']} />}
      </Route>
      <Route path="/portal/visit-requests">
        {() => <ProtectedRoute component={VisitRequests} allowedRoles={['org_admin', 'visitor_manager', 'receptionist', 'host_employee']} />}
      </Route>
      <Route path="/portal/visitors">
        {() => <ProtectedRoute component={PortalVisitors} allowedRoles={['org_admin', 'visitor_manager']} />}
      </Route>
      <Route path="/portal/settings">
        {() => <ProtectedRoute component={PortalSettings} allowedRoles={['org_admin']} />}
      </Route>

      {/* Host Employee Routes */}
      <Route path="/host">
        {() => <ProtectedRoute component={HostDashboard} allowedRoles={['host_employee']} />}
      </Route>
      <Route path="/host/new">
        {() => <ProtectedRoute component={HostNewRequest} allowedRoles={['host_employee']} />}
      </Route>

      {/* Receptionist Route */}
      <Route path="/receptionist">
        {() => <ProtectedRoute component={ReceptionistDashboard} allowedRoles={['receptionist']} />}
      </Route>

      {/* Settings */}
      <Route path="/settings/telegram">
        {() => <ProtectedRoute component={TelegramSettings} />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
