import { useState, useEffect } from "react";
import { useListOrganizations, useUpdateOrganizationStatus, useCreateOrganization, useUpdateOrganization, useResendAdminInvite } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Building2, Search, Plus, CheckCircle2, Ban, RefreshCw, MoreHorizontal, Pencil, Users, Mail, Eye, EyeOff } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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
    adminSetupMode: "invitation" as "invitation" | "direct",
    firstAdminPassword: "",
  });

  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<any>(null);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [adminForm, setAdminForm] = useState({ name: "", email: "" });
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", nameAr: "", type: "government", subscriptionTier: "starter",
    address: "", publicBookingSlug: "",
    maxUsers: 20, maxBranches: 5,
    contractStartDate: "", contractEndDate: "",
    primaryContactName: "", primaryContactEmail: "", primaryContactPhone: "",
  });

  const { data, isLoading, refetch } = useListOrganizations({
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
    limit: "100",
  });

  const statusMutation = useUpdateOrganizationStatus();
  const createMutation = useCreateOrganization();
  const updateMutation = useUpdateOrganization();
  const resendMutation = useResendAdminInvite();

  const handleStatusChange = async (orgId: string, status: string, name: string) => {
    try {
      await statusMutation.mutateAsync({ orgId, data: { status } });
      toast({ title: "Status Updated", description: `${name} is now ${status.replace("_", " ")}.` });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/organizations");
      }});
    } catch {
      toast({ title: "Failed", description: "Could not update status.", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.type || !form.firstAdminName || !form.firstAdminEmail) {
      toast({ title: "Missing fields", description: "Fill all required fields.", variant: "destructive" });
      return;
    }
    if (form.adminSetupMode === "direct" && form.firstAdminPassword.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    try {
      const payload: any = { ...form };
      if (form.adminSetupMode !== "direct") {
        delete payload.firstAdminPassword;
      }
      await createMutation.mutateAsync({ data: payload });
      if (form.adminSetupMode === "direct") {
        toast({ title: "Organization Created", description: `Admin can now log in with ${form.firstAdminEmail}.` });
      } else {
        toast({ title: "Organization Created", description: `Invitation email sent to ${form.firstAdminEmail}.` });
      }
      setCreateOpen(false);
      setForm({ name: "", nameAr: "", type: "government", subscriptionTier: "starter", firstAdminName: "", firstAdminEmail: "", primaryContactName: "", primaryContactEmail: "", adminSetupMode: "invitation", firstAdminPassword: "" });
      refetch();
    } catch {
      toast({ title: "Failed", description: "Could not create organization.", variant: "destructive" });
    }
  };

  const openEdit = (org: any) => {
    setEditOrg(org);
    setEditForm({
      name: org.name || "",
      nameAr: org.nameAr || "",
      type: org.type || "government",
      subscriptionTier: org.subscriptionTier || "starter",
      address: org.address || "",
      publicBookingSlug: org.publicBookingSlug || "",
      maxUsers: org.maxUsers || 20,
      maxBranches: org.maxBranches || 5,
      contractStartDate: org.contractStartDate || "",
      contractEndDate: org.contractEndDate || "",
      primaryContactName: org.primaryContactName || "",
      primaryContactEmail: org.primaryContactEmail || "",
      primaryContactPhone: org.primaryContactPhone || "",
    });
    setAdminUser(null);
    setAdminForm({ name: "", email: "" });
    setEditOpen(true);
    fetch(`/api/organizations/${org.id}/users?role=org_admin&limit=1`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const users = data.data || data || [];
        if (users[0]) {
          setAdminUser(users[0]);
          setAdminForm({ name: users[0].name || "", email: users[0].email || "" });
        }
      })
      .catch(() => {});
  };

  const handleSave = async () => {
    if (!editOrg) return;
    try {
      const updated = await updateMutation.mutateAsync({ orgId: editOrg.id, data: editForm });
      toast({ title: "Organization Updated", description: `${editForm.name} has been updated.` });
      setEditOrg(updated);
      setEditOpen(false);
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/organizations");
      }});
    } catch {
      toast({ title: "Failed", description: "Could not update organization.", variant: "destructive" });
    }
  };

  const handleSaveAdmin = async () => {
    if (!adminUser || !editOrg) return;
    if (!adminForm.name || !adminForm.email) {
      toast({ title: "Missing fields", description: "Admin name and email are required.", variant: "destructive" });
      return;
    }
    setSavingAdmin(true);
    try {
      const res = await fetch(`/api/organizations/${editOrg.id}/users/${adminUser.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ name: adminForm.name, email: adminForm.email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update admin");
      }
      const updated = await res.json();
      setAdminUser(updated);
      toast({ title: "Admin Updated", description: `Admin details updated to ${adminForm.name} (${adminForm.email}).` });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/organizations");
      }});
    } catch (e: any) {
      toast({ title: "Update Failed", description: e.message || "Could not update admin.", variant: "destructive" });
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleResendAdminInvite = async (orgId: string, name: string) => {
    try {
      await resendMutation.mutateAsync({ orgId });
      toast({ title: "Invitation Resent", description: `Admin invitation for ${name} has been resent.` });
    } catch {
      toast({ title: "Failed", description: "Could not resend invitation.", variant: "destructive" });
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
                    <th className="text-left p-4 font-semibold text-slate-600">Users</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Admin / Contact</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Created</th>
                    <th className="p-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {orgs.map((org: any) => (
                    <tr key={org.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                            {org.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground cursor-pointer hover:text-primary hover:underline" onClick={() => openEdit(org)}>
                              {org.name}
                            </p>
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
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-600 font-medium">{org.userCount ?? 0}</span>
                        </div>
                      </td>
                      <td className="p-4 text-xs">
                        <div>
                          <p className="text-slate-700 font-medium">{org.orgAdmin?.name || org.primaryContactName || "—"}</p>
                          <p className="text-slate-500">{org.orgAdmin?.email || org.primaryContactEmail || ""}</p>
                        </div>
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
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEdit(org)}>
                              <Pencil className="w-4 h-4 text-blue-500" /> Edit Details
                            </DropdownMenuItem>
                            {org.status === "pending_setup" && (
                              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleResendAdminInvite(org.id, org.name)}>
                                <Mail className="w-4 h-4 text-blue-500" /> Resend Admin Invitation
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
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
            <DialogDescription>Register a new organization and create the first admin account.</DialogDescription>
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
              <div className="space-y-3 mt-3">
                <Label className="text-xs text-slate-500">Admin Setup Method</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={form.adminSetupMode === "invitation" ? "default" : "outline"} size="sm" className="rounded-xl flex-1"
                    onClick={() => setForm(f => ({ ...f, adminSetupMode: "invitation", firstAdminPassword: "" }))}>
                    Send Invitation Email
                  </Button>
                  <Button type="button" variant={form.adminSetupMode === "direct" ? "default" : "outline"} size="sm" className="rounded-xl flex-1"
                    onClick={() => setForm(f => ({ ...f, adminSetupMode: "direct" }))}>
                    Set Password Directly
                  </Button>
                </div>
              </div>
              {form.adminSetupMode === "direct" && (
                <div className="space-y-1.5 mt-3">
                  <Label>Admin Password *</Label>
                  <div className="relative">
                    <Input type={showAdminPassword ? "text" : "password"} placeholder="Minimum 8 characters" className="rounded-xl pr-12"
                      value={form.firstAdminPassword} onChange={e => setForm(f => ({ ...f, firstAdminPassword: e.target.value }))} />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowAdminPassword(!showAdminPassword)} tabIndex={-1}>
                      {showAdminPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Organization</DialogTitle>
            <DialogDescription>Update organization details. Changes are saved immediately.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full grid grid-cols-3 rounded-xl">
              <TabsTrigger value="general" className="rounded-lg">General</TabsTrigger>
              <TabsTrigger value="subscription" className="rounded-lg">Subscription</TabsTrigger>
              <TabsTrigger value="contact" className="rounded-lg">Contact</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Organization Name *</Label>
                  <Input className="rounded-xl" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Arabic Name</Label>
                  <Input className="rounded-xl" value={editForm.nameAr} onChange={e => setEditForm(f => ({ ...f, nameAr: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={editForm.type} onValueChange={v => setEditForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="government">Government</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                      <SelectItem value="smb">SMB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Public Booking Slug</Label>
                  <Input className="rounded-xl" placeholder="my-org" value={editForm.publicBookingSlug} onChange={e => setEditForm(f => ({ ...f, publicBookingSlug: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input className="rounded-xl" placeholder="Full address" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            </TabsContent>

            <TabsContent value="subscription" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Subscription Tier</Label>
                  <Select value={editForm.subscriptionTier} onValueChange={v => setEditForm(f => ({ ...f, subscriptionTier: v }))}>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Max Users</Label>
                  <Input type="number" className="rounded-xl" value={editForm.maxUsers} onChange={e => setEditForm(f => ({ ...f, maxUsers: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Branches</Label>
                  <Input type="number" className="rounded-xl" value={editForm.maxBranches} onChange={e => setEditForm(f => ({ ...f, maxBranches: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Contract Start</Label>
                  <Input type="date" className="rounded-xl" value={editForm.contractStartDate} onChange={e => setEditForm(f => ({ ...f, contractStartDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contract End</Label>
                  <Input type="date" className="rounded-xl" value={editForm.contractEndDate} onChange={e => setEditForm(f => ({ ...f, contractEndDate: e.target.value }))} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4 mt-4">
              {adminUser && (
                <div className="border rounded-xl p-4 space-y-3 bg-blue-50/50 border-blue-200/60">
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" /> Admin Account
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Admin Name</Label>
                      <Input className="rounded-xl bg-white" value={adminForm.name} onChange={e => setAdminForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Admin Email (Login)</Label>
                      <Input type="email" className="rounded-xl bg-white" value={adminForm.email} onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" className="rounded-xl gap-1.5" onClick={handleSaveAdmin} disabled={savingAdmin || (adminForm.name === adminUser.name && adminForm.email === adminUser.email)}>
                      {savingAdmin ? "Saving..." : "Update Admin"}
                    </Button>
                  </div>
                </div>
              )}
              <div className="border-t pt-4 space-y-4">
                <p className="text-sm font-semibold text-slate-700">Primary Contact</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Contact Name</Label>
                    <Input className="rounded-xl" value={editForm.primaryContactName} onChange={e => setEditForm(f => ({ ...f, primaryContactName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact Email</Label>
                    <Input type="email" className="rounded-xl" value={editForm.primaryContactEmail} onChange={e => setEditForm(f => ({ ...f, primaryContactEmail: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Phone</Label>
                  <Input className="rounded-xl" value={editForm.primaryContactPhone} onChange={e => setEditForm(f => ({ ...f, primaryContactPhone: e.target.value }))} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
