import { useGetSuperAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, CalendarCheck, Activity } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function SuperAdminDashboard() {
  const { data, isLoading } = useGetSuperAdminDashboard();

  if (isLoading || !data) {
    return <div className="p-8 animate-pulse flex space-x-4"><div className="flex-1 space-y-6 py-1"><div className="h-40 bg-slate-200 rounded-2xl"></div></div></div>;
  }

  const statCards = [
    { title: "Total Organizations", value: data.totalOrgs, icon: Building2, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "Active Organizations", value: data.activeOrgs, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-100" },
    { title: "Visitors Today", value: data.totalVisitorsToday, icon: Users, color: "text-indigo-600", bg: "bg-indigo-100" },
    { title: "Requests Today", value: data.totalRequestsToday, icon: CalendarCheck, color: "text-amber-600", bg: "bg-amber-100" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Platform Overview</h1>
        <p className="text-muted-foreground mt-1">Monitor all organizations and platform health.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="border-border/50 shadow-sm hover:shadow-md transition-shadow rounded-2xl">
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <h3 className="text-3xl font-bold text-foreground tracking-tight">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="col-span-2 border-border/50 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Monthly Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                  <Tooltip cursor={{fill: '#F1F5F9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="totalVisitors" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Recent Onboardings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {data.recentOrgs.map((org) => (
                <div key={org.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold">
                      {org.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{org.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{org.subscriptionTier} Tier</p>
                    </div>
                  </div>
                  <div className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    {org.status}
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
