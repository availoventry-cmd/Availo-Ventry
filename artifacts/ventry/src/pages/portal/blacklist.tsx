import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, ShieldBan, Trash2, Plus, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function BlacklistPage() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission("blacklist.manage") || user?.role === "org_admin";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addDialog, setAddDialog] = useState(false);
  const [visitorId, setVisitorId] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/blacklist", user?.orgId, search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`${BASE}/api/organizations/${user?.orgId}/blacklist?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user?.orgId,
  });

  const addMutation = useMutation({
    mutationFn: async (body: { visitorId: string; reason: string; expiresAt?: string }) => {
      const res = await fetch(`${BASE}/api/organizations/${user?.orgId}/blacklist`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Visitor blacklisted" });
      queryClient.invalidateQueries({ queryKey: ["/api/blacklist"] });
      setAddDialog(false); setVisitorId(""); setReason(""); setExpiresAt("");
    },
    onError: () => toast({ title: "Failed to blacklist", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${BASE}/api/organizations/${user?.orgId}/blacklist/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Removed from blacklist" });
      queryClient.invalidateQueries({ queryKey: ["/api/blacklist"] });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const { data: visitorsData } = useQuery({
    queryKey: ["/api/visitors", user?.orgId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/organizations/${user?.orgId}/visitors?limit=200`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user?.orgId && addDialog,
  });

  const entries = data?.data ?? [];
  const visitors = visitorsData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Blacklist</h1>
          <p className="text-muted-foreground mt-1">Manage blocked visitors for your organization.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-9 w-56 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {canManage && (
            <Button className="gap-2 rounded-xl" onClick={() => setAddDialog(true)}>
              <Plus className="w-4 h-4" /> Add to Blacklist
            </Button>
          )}
        </div>
      </div>

      <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-semibold">Visitor</TableHead>
              <TableHead className="font-semibold">Phone</TableHead>
              <TableHead className="font-semibold">Reason</TableHead>
              <TableHead className="font-semibold">Expires</TableHead>
              <TableHead className="font-semibold">Added</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : entries.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                <ShieldBan className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                No blacklisted visitors.
              </TableCell></TableRow>
            ) : entries.map((entry: any) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.visitor?.fullName || "Unknown"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{entry.visitor?.phone || "—"}</TableCell>
                <TableCell className="text-sm max-w-xs truncate">{entry.reason}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {entry.expiresAt ? new Date(entry.expiresAt).toLocaleDateString() : <Badge variant="outline" className="text-xs">Permanent</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => removeMutation.mutate(entry.id)}>
                      <Trash2 className="w-4 h-4 mr-1" /> Remove
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Add to Blacklist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">Select Visitor</label>
              <select className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3"
                value={visitorId} onChange={e => setVisitorId(e.target.value)}>
                <option value="">Choose a visitor...</option>
                {visitors.filter((v: any) => !v.isBlacklisted).map((v: any) => (
                  <option key={v.id} value={v.id}>{v.fullName} — {v.phone || v.email || "No contact"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">Reason</label>
              <Textarea className="rounded-xl resize-none" rows={3} placeholder="Why is this visitor being blacklisted?" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">Expires (optional)</label>
              <Input type="date" className="rounded-xl" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Leave empty for permanent ban.</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button className="rounded-xl bg-red-600 hover:bg-red-700" disabled={!visitorId || !reason}
              onClick={() => addMutation.mutate({ visitorId, reason, ...(expiresAt ? { expiresAt } : {}) })}>
              Blacklist Visitor
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
