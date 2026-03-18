import { useGetHostDashboard, useListVisitRequests, useCancelVisitRequest } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CalendarCheck, Users, Clock, Plus, Calendar, X } from "lucide-react";

const statusStyle: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  checked_in: "bg-emerald-100 text-emerald-700 border-emerald-200",
  checked_out: "bg-slate-100 text-slate-600 border-slate-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function HostDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: dashboard, isLoading: dashLoading } = useGetHostDashboard({ query: { enabled: !!user } });
  const { data: requestsData, isLoading: reqLoading } = useListVisitRequests(
    user?.orgId || "",
    { limit: "50" },
    { query: { enabled: !!user?.orgId } }
  );
  const cancelMutation = useCancelVisitRequest();

  const requests = requestsData?.data ?? [];
  const upcoming = requests.filter(r => !["cancelled", "checked_out", "rejected"].includes(r.status));
  const past = requests.filter(r => ["cancelled", "checked_out", "rejected"].includes(r.status)).slice(0, 10);

  const handleCancel = async (requestId: string) => {
    try {
      await cancelMutation.mutateAsync({ orgId: user!.orgId!, requestId, data: {} });
      toast({ title: "Request Cancelled" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}/visit-requests`] });
    } catch {
      toast({ title: "Failed to cancel", variant: "destructive" });
    }
  };

  const isLoading = dashLoading || reqLoading;

  if (isLoading) {
    return <div className="p-8 animate-pulse space-y-6"><div className="h-40 bg-slate-200 rounded-2xl" /><div className="h-60 bg-slate-200 rounded-2xl" /></div>;
  }

  const stats = [
    { title: "This Month", value: dashboard?.totalVisitorsThisMonth ?? 0, icon: CalendarCheck, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "Upcoming Visitors", value: upcoming.length, icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
    { title: "Past Visitors", value: past.length, icon: Users, color: "text-emerald-600", bg: "bg-emerald-100" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">My Visitors</h1>
          <p className="text-muted-foreground mt-1">Track and manage your invited guests.</p>
        </div>
        <Button className="gap-2 rounded-xl h-11" onClick={() => setLocation("/host/new")}>
          <Plus className="w-4 h-4" />
          Invite Visitor
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {stats.map((s, i) => (
          <Card key={i} className="border-border/50 shadow-sm rounded-2xl">
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${s.bg} ${s.color}`}>
                <s.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">{s.title}</p>
                <h3 className="text-3xl font-bold text-foreground tracking-tight">{s.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming */}
      <Card className="border-border/50 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Upcoming Visits
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CalendarCheck className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              No upcoming visits. <button className="text-primary hover:underline ml-1" onClick={() => setLocation("/host/new")}>Invite a visitor</button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(r => (
                <div key={r.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-border/30">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                      {(r as any).visitor?.fullName?.charAt(0) || "V"}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{(r as any).visitor?.fullName || "Visitor"}</p>
                      <p className="text-xs text-muted-foreground">{r.scheduledDate} {r.scheduledTimeFrom && `· ${r.scheduledTimeFrom}`}</p>
                      <p className="text-xs text-slate-500 truncate max-w-xs">{r.purpose}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs shadow-none border capitalize ${statusStyle[r.status] || ""}`}>
                      {r.status.replace("_", " ")}
                    </Badge>
                    {r.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500"
                        onClick={() => handleCancel(r.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past */}
      {past.length > 0 && (
        <Card className="border-border/50 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display text-base text-muted-foreground">Past Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {past.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs shrink-0">
                      {(r as any).visitor?.fullName?.charAt(0) || "V"}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-700">{(r as any).visitor?.fullName || "Visitor"}</p>
                      <p className="text-xs text-muted-foreground">{r.scheduledDate}</p>
                    </div>
                  </div>
                  <Badge className={`text-xs shadow-none border capitalize ${statusStyle[r.status] || ""}`}>
                    {r.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
