import { useState, useEffect } from "react";
import { useGetOrganization, useUpdateOrganization, useListUsers, useListBranches, useCreateInvitation, useDeactivateUser } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Plus, UserPlus, Building2, Settings, Users, MoreHorizontal, RotateCcw, Pencil } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export default function PortalSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: org } = useGetOrganization(user?.orgId || "", { query: { enabled: !!user?.orgId } });
  const { data: usersData } = useListUsers(user?.orgId || "", {}, { query: { enabled: !!user?.orgId } });
  const { data: branchesData } = useListBranches(user?.orgId || "", {}, { query: { enabled: !!user?.orgId } });

  const updateMutation = useUpdateOrganization();
  const inviteMutation = useCreateInvitation();
  const deactivateMutation = useDeactivateUser();

  const [orgForm, setOrgForm] = useState({ name: "", nameAr: "", address: "", primaryContactName: "", primaryContactEmail: "", primaryContactPhone: "" });
  const [inviteDialog, setInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "visitor_manager", department: "", jobTitle: "", branchId: "" });
  const [activeTab, setActiveTab] = useState<"general" | "users" | "branches">("general");

  const [branchDialog, setBranchDialog] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [branchForm, setBranchForm] = useState({
    name: "", nameAr: "", address: "", city: "", branchCode: "", entryMode: "staffed", maxConcurrentVisitors: 50,
  });

  const [confirmAction, setConfirmAction] = useState<{ type: "deactivate" | "reactivate"; userId: string; userName: string } | null>(null);

  const [editUserDialog, setEditUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editUserForm, setEditUserForm] = useState({ name: "", email: "" });

  useEffect(() => {
    if (org) {
      setOrgForm({
        name: org.name || "",
        nameAr: org.nameAr || "",
        address: org.address || "",
        primaryContactName: org.primaryContactName || "",
        primaryContactEmail: org.primaryContactEmail || "",
        primaryContactPhone: org.primaryContactPhone || "",
      });
    }
  }, [org]);

  const handleSaveOrg = async () => {
    try {
      await updateMutation.mutateAsync({ orgId: user!.orgId!, data: orgForm });
      toast({ title: "Settings Saved", description: "Organization details have been updated." });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}`] });
    } catch {
      toast({ title: "Save Failed", variant: "destructive" });
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.name || !inviteForm.email || !inviteForm.role) {
      toast({ title: "Missing fields", variant: "destructive" });
      return;
    }
    try {
      const payload: any = { ...inviteForm };
      if (!payload.branchId) delete payload.branchId;
      await inviteMutation.mutateAsync({ orgId: user!.orgId!, data: payload });
      toast({ title: "Invitation Sent", description: `${inviteForm.name} has been invited as ${inviteForm.role.replace("_", " ")}.` });
      setInviteDialog(false);
      setInviteForm({ name: "", email: "", role: "visitor_manager", department: "", jobTitle: "", branchId: "" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}/users`] });
    } catch {
      toast({ title: "Invite Failed", variant: "destructive" });
    }
  };

  const handleDeactivate = async (userId: string, userName: string) => {
    try {
      await deactivateMutation.mutateAsync({ orgId: user!.orgId!, userId });
      toast({ title: "User Deactivated", description: `${userName} has been deactivated.` });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}/users`] });
    } catch {
      toast({ title: "Action Failed", variant: "destructive" });
    }
  };

  const handleReactivate = async (userId: string, userName: string) => {
    try {
      const res = await fetch(`/api/organizations/${user!.orgId}/users/${userId}/reactivate`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "User Reactivated", description: `${userName} has been reactivated.` });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}/users`] });
    } catch {
      toast({ title: "Action Failed", variant: "destructive" });
    }
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "deactivate") {
      handleDeactivate(confirmAction.userId, confirmAction.userName);
    } else {
      handleReactivate(confirmAction.userId, confirmAction.userName);
    }
    setConfirmAction(null);
  };

  const openEditUser = (u: any) => {
    setEditingUser(u);
    setEditUserForm({ name: u.name || "", email: u.email || "" });
    setEditUserDialog(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser || !editUserForm.name || !editUserForm.email) {
      toast({ title: "Missing fields", description: "Name and email are required.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/organizations/${user!.orgId}/users/${editingUser.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ name: editUserForm.name, email: editUserForm.email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast({ title: "User Updated", description: `${editUserForm.name}'s details have been updated.` });
      setEditUserDialog(false);
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}/users`] });
    } catch (e: any) {
      toast({ title: "Update Failed", description: e.message || "Could not update user.", variant: "destructive" });
    }
  };

  const openBranchDialog = (branch?: any) => {
    if (branch) {
      setEditingBranch(branch);
      setBranchForm({
        name: branch.name || "", nameAr: branch.nameAr || "", address: branch.address || "",
        city: branch.city || "", branchCode: branch.branchCode || "", entryMode: branch.entryMode || "staffed",
        maxConcurrentVisitors: branch.maxConcurrentVisitors || 50,
      });
    } else {
      setEditingBranch(null);
      setBranchForm({ name: "", nameAr: "", address: "", city: "", branchCode: "", entryMode: "staffed", maxConcurrentVisitors: 50 });
    }
    setBranchDialog(true);
  };

  const handleSaveBranch = async () => {
    if (!branchForm.name || !branchForm.branchCode) {
      toast({ title: "Missing fields", description: "Branch name and code are required.", variant: "destructive" });
      return;
    }
    try {
      if (editingBranch) {
        const res = await fetch(`/api/organizations/${user!.orgId}/branches/${editingBranch.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify(branchForm),
        });
        if (!res.ok) throw new Error("Failed");
        toast({ title: "Branch Updated" });
      } else {
        const res = await fetch(`/api/organizations/${user!.orgId}/branches`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify(branchForm),
        });
        if (!res.ok) throw new Error("Failed");
        toast({ title: "Branch Created" });
      }
      setBranchDialog(false);
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}/branches`] });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const handleToggleBranch = async (branch: any) => {
    try {
      const res = await fetch(`/api/organizations/${user!.orgId}/branches/${branch.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ isActive: !branch.isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: branch.isActive ? "Branch Deactivated" : "Branch Activated" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}/branches`] });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "users", label: "Users", icon: Users },
    { id: "branches", label: "Branches", icon: Building2 },
  ] as const;

  const allUsers = (usersData as any)?.data ?? usersData ?? [];
  const branches = Array.isArray(branchesData) ? branchesData : (branchesData as any)?.data ?? [];

  const roleColor: Record<string, string> = {
    org_admin: "bg-violet-100 text-violet-700",
    visitor_manager: "bg-blue-100 text-blue-700",
    receptionist: "bg-emerald-100 text-emerald-700",
    host_employee: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your organization, users, and branches.</p>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? "bg-white text-foreground shadow-sm" : "text-slate-600 hover:text-foreground"}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <Card className="border-border/50 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display">Organization Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label>Organization Name</Label>
                <Input className="rounded-xl" value={orgForm.name} onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Arabic Name</Label>
                <Input className="rounded-xl" dir="rtl" value={orgForm.nameAr} onChange={e => setOrgForm(f => ({ ...f, nameAr: e.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Input className="rounded-xl" value={orgForm.address} onChange={e => setOrgForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
            <div className="border-t pt-5">
              <p className="text-sm font-semibold mb-4 text-slate-700">Primary Contact</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input className="rounded-xl" value={orgForm.primaryContactName} onChange={e => setOrgForm(f => ({ ...f, primaryContactName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" className="rounded-xl" value={orgForm.primaryContactEmail} onChange={e => setOrgForm(f => ({ ...f, primaryContactEmail: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input className="rounded-xl" value={orgForm.primaryContactPhone} onChange={e => setOrgForm(f => ({ ...f, primaryContactPhone: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button className="gap-2 rounded-xl" onClick={handleSaveOrg} disabled={updateMutation.isPending}>
                <Save className="w-4 h-4" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2 rounded-xl" onClick={() => setInviteDialog(true)}>
              <UserPlus className="w-4 h-4" />
              Invite User
            </Button>
          </div>
          <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-border/50">
                  <tr>
                    <th className="text-left p-4 font-semibold text-slate-600">Name</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Email</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Role</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Status</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Last Login</th>
                    <th className="p-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {allUsers.map((u: any) => (
                    <tr key={u.id} className={`hover:bg-slate-50/50 transition-colors ${!u.isActive ? "opacity-60" : ""}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${u.isActive ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-500"}`}>
                            {u.name.charAt(0)}
                          </div>
                          <span className="font-medium">{u.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">{u.email}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-lg font-medium capitalize ${roleColor[u.role] || "bg-slate-100 text-slate-600"}`}>
                          {u.role.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-medium ${u.isActive ? "text-emerald-600" : "text-slate-400"}`}>
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="p-4">
                        {u.id !== user?.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEditUser(u)}>
                                <Pencil className="w-4 h-4" /> Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {u.isActive ? (
                                <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={() => setConfirmAction({ type: "deactivate", userId: u.id, userName: u.name })}>
                                  Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem className="text-emerald-600 cursor-pointer gap-2" onClick={() => setConfirmAction({ type: "reactivate", userId: u.id, userName: u.name })}>
                                  <RotateCcw className="w-4 h-4" /> Reactivate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "branches" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2 rounded-xl" onClick={() => openBranchDialog()}>
              <Plus className="w-4 h-4" /> Add Branch
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((b: any) => (
              <Card key={b.id} className="border-border/50 shadow-sm rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <Badge className={`text-xs shadow-none border ${b.isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600"}`}>
                      {b.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-foreground">{b.name}</h3>
                  {b.nameAr && <p className="text-xs text-muted-foreground">{b.nameAr}</p>}
                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    <p>Code: <span className="font-mono font-medium text-foreground">{b.branchCode}</span></p>
                    {b.city && <p>City: {b.city}</p>}
                    <p className="capitalize">Mode: {b.entryMode}</p>
                  </div>
                  <div className="flex gap-2 mt-4 pt-3 border-t">
                    <Button variant="outline" size="sm" className="rounded-lg flex-1" onClick={() => openBranchDialog(b)}>Edit</Button>
                    <Button variant={b.isActive ? "destructive" : "default"} size="sm" className="rounded-lg flex-1" onClick={() => handleToggleBranch(b)}>
                      {b.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {branches.length === 0 && (
              <div className="col-span-3 p-12 text-center text-muted-foreground">
                <Building2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p>No branches configured.</p>
                <Button className="mt-4 rounded-xl gap-2" onClick={() => openBranchDialog()}>
                  <Plus className="w-4 h-4" /> Add Your First Branch
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Invite Team Member</DialogTitle>
            <DialogDescription>Send an invitation to join your organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input placeholder="Name" className="rounded-xl" value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" placeholder="email@org.sa" className="rounded-xl" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org_admin">Org Admin</SelectItem>
                    <SelectItem value="visitor_manager">Visitor Manager</SelectItem>
                    <SelectItem value="receptionist">Receptionist</SelectItem>
                    <SelectItem value="host_employee">Host Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={inviteForm.branchId || "_all"} onValueChange={v => setInviteForm(f => ({ ...f, branchId: v === "_all" ? "" : v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="All branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All branches</SelectItem>
                    {(branches as any[]).filter((b: any) => b.isActive).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input placeholder="IT, HR..." className="rounded-xl" value={inviteForm.department} onChange={e => setInviteForm(f => ({ ...f, department: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Job Title</Label>
                <Input placeholder="Manager..." className="rounded-xl" value={inviteForm.jobTitle} onChange={e => setInviteForm(f => ({ ...f, jobTitle: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setInviteDialog(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={handleInvite} disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={branchDialog} onOpenChange={setBranchDialog}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editingBranch ? "Edit Branch" : "Add Branch"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Branch Name *</Label>
                <Input className="rounded-xl" placeholder="Main Office" value={branchForm.name} onChange={e => setBranchForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Arabic Name</Label>
                <Input className="rounded-xl" dir="rtl" value={branchForm.nameAr} onChange={e => setBranchForm(f => ({ ...f, nameAr: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Branch Code *</Label>
                <Input className="rounded-xl" placeholder="HQ-001" value={branchForm.branchCode} onChange={e => setBranchForm(f => ({ ...f, branchCode: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Entry Mode</Label>
                <Select value={branchForm.entryMode} onValueChange={v => setBranchForm(f => ({ ...f, entryMode: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staffed">Staffed</SelectItem>
                    <SelectItem value="unmanned">Unmanned</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input className="rounded-xl" placeholder="Full address" value={branchForm.address} onChange={e => setBranchForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input className="rounded-xl" placeholder="Riyadh" value={branchForm.city} onChange={e => setBranchForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Max Visitors</Label>
                <Input type="number" className="rounded-xl" value={branchForm.maxConcurrentVisitors} onChange={e => setBranchForm(f => ({ ...f, maxConcurrentVisitors: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setBranchDialog(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={handleSaveBranch}>{editingBranch ? "Save Changes" : "Create Branch"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editUserDialog} onOpenChange={setEditUserDialog}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit User</DialogTitle>
            <DialogDescription>Update user name and email address.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input className="rounded-xl" value={editUserForm.name} onChange={e => setEditUserForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" className="rounded-xl" value={editUserForm.email} onChange={e => setEditUserForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            {editingUser && (
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
                <p>Role: <span className="capitalize font-medium text-slate-700">{editingUser.role?.replace(/_/g, " ")}</span></p>
                <p>Status: <span className={`font-medium ${editingUser.isActive ? "text-emerald-600" : "text-slate-400"}`}>{editingUser.isActive ? "Active" : "Inactive"}</span></p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setEditUserDialog(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={handleSaveUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "deactivate" ? "Deactivate User" : "Reactivate User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmAction?.type} <strong>{confirmAction?.userName}</strong>?
              {confirmAction?.type === "deactivate" && " They will no longer be able to log in."}
              {confirmAction?.type === "reactivate" && " They will be able to log in again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className={`rounded-xl ${confirmAction?.type === "deactivate" ? "bg-red-600 hover:bg-red-700" : ""}`} onClick={handleConfirmAction}>
              {confirmAction?.type === "deactivate" ? "Deactivate" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
