import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  CalendarCheck, 
  Settings, 
  LogOut,
  ShieldAlert,
  UserSquare2,
  ScanLine,
  Send
} from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const getNavItems = () => {
    switch (user.role) {
      case "super_admin":
        return [
          { title: "Dashboard", url: "/super-admin/dashboard", icon: LayoutDashboard },
          { title: "Organizations", url: "/super-admin/organizations", icon: Building2 },
          { title: "Analytics", url: "/super-admin/analytics", icon: ShieldAlert },
        ];
      case "org_admin":
        return [
          { title: "Dashboard", url: "/portal/dashboard", icon: LayoutDashboard },
          { title: "Visit Requests", url: "/portal/visit-requests", icon: CalendarCheck },
          { title: "Visitors", url: "/portal/visitors", icon: Users },
          { title: "Settings", url: "/portal/settings", icon: Settings },
          { title: "Telegram Bot", url: "/settings/telegram", icon: Send },
        ];
      case "visitor_manager":
        return [
          { title: "Dashboard", url: "/portal/dashboard", icon: LayoutDashboard },
          { title: "Visit Requests", url: "/portal/visit-requests", icon: CalendarCheck },
          { title: "Visitors", url: "/portal/visitors", icon: Users },
          { title: "Telegram Bot", url: "/settings/telegram", icon: Send },
        ];
      case "receptionist":
        return [
          { title: "Desk Console", url: "/receptionist", icon: ScanLine },
          { title: "Expected Today", url: "/portal/visit-requests", icon: CalendarCheck },
        ];
      case "host_employee":
        return [
          { title: "My Visitors", url: "/host", icon: UserSquare2 },
          { title: "New Request", url: "/host/new", icon: CalendarCheck },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <Sidebar className="border-r border-border/50 bg-card">
          <SidebarHeader className="p-4 flex items-center justify-center border-b border-border/50">
            <div className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}images/logo-mark.png`} alt="Ventry Logo" className="w-8 h-8 object-contain" />
              <span className="font-display font-bold text-xl tracking-tight text-primary">Ventry</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-2 pt-4">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location === item.url || location.startsWith(`${item.url}/`)}
                        className="rounded-xl transition-all duration-200"
                      >
                        <Link href={item.url} className="flex items-center gap-3 px-3 py-2.5">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-border/50">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {user.name.charAt(0)}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold truncate">{user.name}</span>
                <span className="text-xs text-muted-foreground truncate">{user.role.replace('_', ' ')}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full justify-start gap-2 hover-elevate" onClick={logout}>
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-16 flex items-center justify-between px-6 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden" />
              <h2 className="font-display font-semibold text-lg text-foreground hidden sm:block">
                {user.organizationName || 'Availo Platform'}
              </h2>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 animate-in-fade bg-slate-50/50 dark:bg-transparent">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
