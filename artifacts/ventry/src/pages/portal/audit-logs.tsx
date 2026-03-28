import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const actionColors: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  approve: "bg-green-100 text-green-800",
  reject: "bg-red-100 text-red-800",
  check_in: "bg-indigo-100 text-indigo-800",
  check_out: "bg-slate-100 text-slate-700",
  login: "bg-amber-100 text-amber-800",
};

export default function AuditLogs() {
  const { user } = useAuth();
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/audit-logs", user?.orgId, actionFilter, entityFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (entityFilter !== "all") params.set("entityType", entityFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`${BASE}/api/organizations/${user?.orgId}/audit-logs?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!user?.orgId,
  });

  const logs = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">Track all activity across your organization.</p>
        </div>
        <Button variant="outline" size="icon" className="rounded-xl" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="approve">Approve</SelectItem>
            <SelectItem value="reject">Reject</SelectItem>
            <SelectItem value="check_in">Check In</SelectItem>
            <SelectItem value="check_out">Check Out</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="Entity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="visit_request">Visit Requests</SelectItem>
            <SelectItem value="visitor">Visitors</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="branch">Branches</SelectItem>
            <SelectItem value="role">Roles</SelectItem>
            <SelectItem value="organization">Organization</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" className="w-40 rounded-xl" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From" />
        <Input type="date" className="w-40 rounded-xl" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To" />
      </div>

      <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-semibold">Time</TableHead>
              <TableHead className="font-semibold">User</TableHead>
              <TableHead className="font-semibold">Action</TableHead>
              <TableHead className="font-semibold">Entity</TableHead>
              <TableHead className="font-semibold">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                No audit logs found.
              </TableCell></TableRow>
            ) : logs.map((log: any) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm whitespace-nowrap">
                  {log.timestamp ? format(new Date(log.timestamp), "MMM d, HH:mm") : "—"}
                </TableCell>
                <TableCell className="font-medium text-sm">{log.userName || log.userId?.slice(0, 8) || "System"}</TableCell>
                <TableCell>
                  <Badge className={`capitalize shadow-none border text-xs ${actionColors[log.action] || "bg-slate-100 text-slate-700"}`}>
                    {(log.action || "").replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm capitalize text-muted-foreground">{(log.entityType || "").replace("_", " ")}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{log.description || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
