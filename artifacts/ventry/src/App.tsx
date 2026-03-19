import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, Component, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
          <div className="text-center space-y-4">
            <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground">An unexpected error occurred.</p>
            <button className="px-4 py-2 bg-primary text-white rounded-lg" onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}>
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
import PortalRoles from "@/pages/portal/roles";
import AcceptInvitation from "@/pages/auth/accept-invitation";
import ForgotPassword from "@/pages/auth/forgot-password";
import ResetPassword from "@/pages/auth/reset-password";

const queryClient = new QueryClient();

function ProtectedRoute({ 
  component: Component, 
  allowedRoles, 
  requiredPermission,
  requiredAnyPermission 
}: { 
  component: any, 
  allowedRoles?: string[], 
  requiredPermission?: string,
  requiredAnyPermission?: string[] 
}) {
  const { user, isLoading, isFetching, hasPermission, hasAnyPermission } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isFetching && !user) {
      setLocation("/login");
    }
  }, [isLoading, isFetching, user, setLocation]);

  if ((isLoading || isFetching) && !user) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!user) return null;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <div className="p-8 text-center text-red-600">Access Denied</div>;
  }
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <div className="p-8 text-center text-red-600">You do not have permission to view this page.</div>;
  }
  if (requiredAnyPermission && !hasAnyPermission(...requiredAnyPermission)) {
    return <div className="p-8 text-center text-red-600">You do not have permission to view this page.</div>;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function getRoleHome(role: string, permissions: string[]) {
  if (role === 'super_admin') return '/super-admin/dashboard';
  if (role === 'org_admin') return '/portal/dashboard';
  
  if (permissions.includes('visit_requests.check_in') || permissions.includes('visit_requests.check_out')) {
    return '/receptionist';
  }
  if (permissions.includes('dashboard.view')) {
    return '/portal/dashboard';
  }
  if (permissions.includes('visit_requests.view') || permissions.includes('visit_requests.approve') || permissions.includes('visit_requests.create')) {
    return '/portal/visit-requests';
  }
  if (permissions.includes('visitors.view')) {
    return '/portal/visitors';
  }
  if (permissions.includes('roles.view')) {
    return '/portal/roles';
  }
  if (permissions.includes('settings.view') || permissions.includes('settings.manage')) {
    return '/portal/settings';
  }
  if (permissions.includes('telegram.manage')) {
    return '/settings/telegram';
  }
  return '/portal/dashboard';
}

function RootRedirect() {
  const { user, isLoading, isFetching } = useAuth();

  if (isLoading || (isFetching && !user)) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Redirect to="/login" />;
  const permissions: string[] = (user as any).permissions ?? [];
  return <Redirect to={getRoleHome(user.role, permissions)} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={Login} />
      <Route path="/accept-invitation" component={AcceptInvitation} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      
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
      
      {/* Portal Routes — permission-based access */}
      <Route path="/portal/dashboard">
        {() => <ProtectedRoute component={PortalDashboard} requiredPermission="dashboard.view" />}
      </Route>
      <Route path="/portal/visit-requests">
        {() => <ProtectedRoute component={VisitRequests} requiredAnyPermission={["visit_requests.view", "visit_requests.approve", "visit_requests.create"]} />}
      </Route>
      <Route path="/portal/visitors">
        {() => <ProtectedRoute component={PortalVisitors} requiredPermission="visitors.view" />}
      </Route>
      <Route path="/portal/settings">
        {() => <ProtectedRoute component={PortalSettings} requiredAnyPermission={["settings.view", "settings.manage"]} />}
      </Route>
      <Route path="/portal/roles">
        {() => <ProtectedRoute component={PortalRoles} requiredPermission="roles.view" />}
      </Route>

      {/* Host Employee Routes — permission-based */}
      <Route path="/host">
        {() => <ProtectedRoute component={HostDashboard} requiredPermission="visit_requests.view" />}
      </Route>
      <Route path="/host/new">
        {() => <ProtectedRoute component={HostNewRequest} requiredPermission="visit_requests.create" />}
      </Route>

      {/* Desk Console — permission-based */}
      <Route path="/receptionist">
        {() => <ProtectedRoute component={ReceptionistDashboard} requiredAnyPermission={["visit_requests.check_in", "visit_requests.check_out"]} />}
      </Route>

      {/* Settings */}
      <Route path="/settings/telegram">
        {() => <ProtectedRoute component={TelegramSettings} requiredPermission="telegram.manage" />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;
