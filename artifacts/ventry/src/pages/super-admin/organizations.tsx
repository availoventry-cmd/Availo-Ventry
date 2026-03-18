import { useState } from "react";
import { useListOrganizations, useUpdateOrganizationStatus, useCreateOrganization } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, Search, Plus, CheckCircle2, Ban, RefreshCw, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";

const statusColor: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  suspended: "bg-amber-100 text-amber-700 border-amber-200",
  pending_setup: "bg-blue-100 text-blue-700 border-blue-200",
  deactivated: "bg-red-100 text-red-700 border-red-200",
};

const tierColor: Record<string, string> = {
  starter: "bg-slate-100 text-slate-600",
  professional: "bg-violet-100 text-violet-700",
  enterprise: "bg-blue-100 text-blue-700",
  government: "bg-emerald-100 text-emerald-700",
};

export default function SuperAdminOrganizations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", nameAr: "", type: "government", subscriptionTier: "starter",
    firstAdminName: "", firstAdminEmail: "", primaryContactName: "", primaryContactEmail: "",
  });

  const { data, isLoading, refetch } = useListOrganizations({
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
    limit: "100",
  });

  const statusMutation = useUpdateOrganizationStatus();
  const createMutation = useCreateOrganization();

  const handleStatusChange = async (orgId: string, status: string, name: string) => {
    try {
      await statusMutation.mutateAsync({ orgId, data: { status } });
      toast({ title: "Status Updated", description: `${name} is now ${status.replace("_", " ")}.` });
      refetch();
    } catch {
      toast({ title: "Failed", description: "Could not update status.", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.type || !form.firstAdminName || !form.firstAdminEmail) {
      toast({ title: "Missing fields", description: "Fill all required fields.", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({ data: form });
      toast({ title: "Organization Created", description: `${form.name} has been created and an invitation sent to the admin.` });
      setCreateOpen(false);
      setForm({ name: "", nameAr: "", type: "government", subscriptionTier: "starter", firstAdminName: "", firstAdminEmail: "", primaryContactName: "", primaryContactEmail: "" });
      refetch();
    } catch {
      toast({ title: "Failed", description: "Could not create organization.", variant: "destructive" });
    }
  };

  const orgs = data?.data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Organizations</h1>
          <p className="text-muted-foreground mt-1">Manage all onboarded organizations across the platform.</p>
        </div>
        <Button className="gap-2 rounded-xl h-11" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          New Organization
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            className="pl-9 h-11 rounded-xl bg-white border-slate-200"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-11 rounded-xl bg-white border-slate-200">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending_setup">Pending Setup</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground animate-pulse">Loading organizations...</div>
          ) : orgs.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center gap-3">
              <Building2 className="w-10 h-10 text-slate-300" />
              <p className="text-muted-foreground">No organizations found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-border/50">
                  <tr>
                    <th className="text-left p-4 font-semibold text-slate-600">Organization</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Type</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Tier</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Status</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Contact</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Created</th>
                    <th className="p-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {orgs.map(org => (
                    <tr key={org.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                            {org.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{org.name}</p>
                            {org.nameAr && <p className="text-xs text-muted-foreground">{org.nameAr}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 capitalize text-slate-600">{org.type}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-lg font-medium capitalize ${tierColor[org.subscriptionTier] || "bg-slate-100 text-slate-600"}`}>
                          {org.subscriptionTier}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-medium border capitalize ${statusColor[org.status] || ""}`}>
                          {org.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 text-xs">
                        {org.primaryContactEmail || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="p-4 text-slate-500 text-xs">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            {org.status !== "active" && (
                              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleStatusChange(org.id, "active", org.name)}>
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Activate
                              </DropdownMenuItem>
                            )}
                            {org.status !== "suspended" && (
                              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleStatusChange(org.id, "suspended", org.name)}>
                                <Ban className="w-4 h-4 text-amber-500" /> Suspend
                              </DropdownMenuItem>
                            )}
                            {org.status !== "deactivated" && (
                              <DropdownMenuItem className="gap-2 cursor-pointer text-red-600" onClick={() => handleStatusChange(org.id, "deactivated", org.name)}>
                                <RefreshCw className="w-4 h-4" /> Deactivate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">New Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Organization Name *</Label>
                <Input placeholder="Ministry of..." className="rounded-xl" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Arabic Name</Label>
                <Input placeholder="وزارة..." className="rounded-xl" value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="smb">SMB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subscription Tier</Label>
                <Select value={form.subscriptionTier} onValueChange={v => setForm(f => ({ ...f, subscriptionTier: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">First Admin Account</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Admin Name *</Label>
                  <Input placeholder="Full name" className="rounded-xl" value={form.firstAdminName} onChange={e => setForm(f => ({ ...f, firstAdminName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Admin Email *</Label>
                  <Input type="email" placeholder="admin@org.sa" className="rounded-xl" value={form.firstAdminEmail} onChange={e => setForm(f => ({ ...f, firstAdminEmail: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
