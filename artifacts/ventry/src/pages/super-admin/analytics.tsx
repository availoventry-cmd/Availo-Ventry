import { useGetSuperAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { TrendingUp, Building2, Users, CalendarCheck, Activity } from "lucide-react";

const TIER_COLORS = ["#94a3b8", "#8b5cf6", "#3b82f6", "#10b981"];
const STATUS_COLORS = { active: "#10b981", suspended: "#f59e0b", pending_setup: "#3b82f6", deactivated: "#ef4444" };

export default function SuperAdminAnalytics() {
  const { data, isLoading } = useGetSuperAdminDashboard();

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded-xl w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-200 rounded-2xl" />)}
        </div>
        <div className="h-80 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  const orgStatusData = [
    { name: "Active", value: data.activeOrgs, color: STATUS_COLORS.active },
    { name: "Suspended", value: data.suspendedOrgs ?? 0, color: STATUS_COLORS.suspended },
    { name: "Pending Setup", value: data.pendingSetupOrgs ?? 0, color: STATUS_COLORS.pending_setup },
  ].filter(d => d.value > 0);

  const tierData = (data.orgsByTier ?? []).map((t: { tier: string; count: number }, i: number) => ({
    ...t,
    color: TIER_COLORS[i] || "#94a3b8",
    label: t.tier.charAt(0).toUpperCase() + t.tier.slice(1),
  }));

  const totalRequests = (data.monthlyGrowth ?? []).reduce((sum: number, m: { totalVisitors: number }) => sum + m.totalVisitors, 0);

  const kpis = [
    { title: "Total Organizations", value: data.totalOrgs, icon: Building2, color: "text-blue-600", bg: "bg-blue-100", change: "+2 this month" },
    { title: "Active Organizations", value: data.activeOrgs, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-100", change: `${Math.round((data.activeOrgs / Math.max(data.totalOrgs, 1)) * 100)}% of total` },
    { title: "Total Requests (6mo)", value: totalRequests, icon: CalendarCheck, color: "text-indigo-600", bg: "bg-indigo-100", change: "All visit requests" },
    { title: "Today's Activity", value: data.totalVisitorsToday, icon: Users, color: "text-amber-600", bg: "bg-amber-100", change: "Scheduled today" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Platform Analytics</h1>
        <p className="text-muted-foreground mt-1">Platform-wide metrics and activity trends.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-border/50 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${kpi.bg} ${kpi.color}`}>
                  <kpi.icon className="w-6 h-6" />
                </div>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold text-foreground tracking-tight">{kpi.value}</h3>
                <p className="text-sm font-medium text-muted-foreground mt-0.5">{kpi.title}</p>
                <p className="text-xs text-slate-400 mt-1">{kpi.change}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Visitor Traffic */}
        <Card className="col-span-2 border-border/50 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Monthly Visitor Traffic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthlyGrowth} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }} />
                  <Legend />
                  <Line type="monotone" dataKey="totalVisitors" name="Visit Requests" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="newOrgs" name="New Orgs" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Organization Status Breakdown */}
        <Card className="border-border/50 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Org Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={orgStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {orgStatusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {orgStatusData.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                    <span className="text-slate-600">{d.name}</span>
                  </div>
                  <span className="font-semibold">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organizations by Tier */}
        <Card className="border-border/50 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Organizations by Subscription Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }} />
                  <Bar dataKey="count" name="Organizations" radius={[6, 6, 0, 0]} maxBarSize={50}>
                    {tierData.map((entry: { color: string }, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Onboardings Table */}
        <Card className="border-border/50 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Recent Onboardings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data.recentOrgs ?? []).map((org: { id: string; name: string; subscriptionTier: string; status: string; createdAt: string }) => (
                <div key={org.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {org.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{org.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{org.subscriptionTier} Tier · {new Date(org.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                    org.status === "active" ? "bg-emerald-100 text-emerald-700" :
                    org.status === "pending_setup" ? "bg-blue-100 text-blue-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {org.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
