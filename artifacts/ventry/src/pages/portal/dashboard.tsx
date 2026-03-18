import { useGetOrgDashboard } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, ShieldCheck, MapPin } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format } from "date-fns";

export default function PortalDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useGetOrgDashboard(user?.orgId || "");

  if (!user?.orgId) return null;
  if (isLoading || !data) {
    return <div className="p-8 animate-pulse flex space-x-4"><div className="flex-1 space-y-6 py-1"><div className="h-40 bg-slate-200 rounded-2xl"></div></div></div>;
  }

  const statCards = [
    { title: "Expected Today", value: data.visitorsToday, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "Pending Approvals", value: data.pendingApprovals, icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
    { title: "Checked In Now", value: data.checkedInNow, icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-100" },
  ];

  return (
    <div className="space-y-8 animate-in-slide">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Welcome, {user.name.split(' ')[0]}</h1>
        <p className="text-muted-foreground mt-1">Here is what's happening across your branches today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="border-border/50 shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden relative">
            <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-bl from-white/40 to-transparent rounded-bl-full z-0 opacity-50" />
            <CardContent className="p-6 relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-4xl font-display font-bold text-foreground tracking-tight mb-1">{stat.value}</h3>
              <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="col-span-2 border-border/50 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Weekly Traffic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                  <Tooltip cursor={{fill: '#F1F5F9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm rounded-2xl flex flex-col">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" /> Branch Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-6">
              {data.branchComparison.map((branch, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-foreground">{branch.branchName}</span>
                    <span className="font-medium">{branch.visitorsToday} visitors</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-primary h-2.5 rounded-full" 
                      style={{ width: `${Math.min(100, (branch.visitorsToday / 100) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
