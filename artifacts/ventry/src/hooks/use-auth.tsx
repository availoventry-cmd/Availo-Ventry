import { createContext, useContext, ReactNode } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser, useLogout, CurrentUser } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: CurrentUser | null;
  isLoading: boolean;
  isFetching: boolean;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: user, isLoading, isFetching } = useGetCurrentUser({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }
  });

  const logoutMutation = useLogout();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      setLocation("/login");
    } catch (err) {
      toast({
        title: "Logout failed",
        description: "There was a problem logging you out.",
        variant: "destructive",
      });
    }
  };

  const permissions: string[] = (user as unknown as { permissions?: string[] })?.permissions ?? [];

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === "super_admin" || user.role === "org_admin") return true;
    return permissions.includes(permission);
  };

  const hasAnyPermission = (...perms: string[]): boolean => {
    return perms.some(p => hasPermission(p));
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        isFetching,
        logout: handleLogout,
        isAuthenticated: !!user,
        hasPermission,
        hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
