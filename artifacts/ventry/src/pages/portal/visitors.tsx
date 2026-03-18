import { useState } from "react";
import { useListVisitors, useAddToBlacklist, useRemoveFromBlacklist } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Users, ShieldX, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";

const verificationBadge = (status: string) => {
  const map: Record<string, string> = {
    verified_otp: "bg-blue-100 text-blue-700 border-blue-200",
    verified_nafath: "bg-emerald-100 text-emerald-700 border-emerald-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    unverified: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return map[status] || "bg-slate-100 text-slate-600 border-slate-200";
};

export default function PortalVisitors() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [blacklistDialog, setBlacklistDialog] = useState<{ open: boolean; visitorId: string; name: string; isBlacklisted: boolean }>({
    open: false, visitorId: "", name: "", isBlacklisted: false,
  });
  const [reason, setReason] = useState("");

  const { data, isLoading } = useListVisitors(
    user?.orgId || "",
    { search: search || undefined, limit: "100" },
    { query: { enabled: !!user?.orgId } }
  );

  const addBlacklistMutation = useAddToBlacklist();
  const removeBlacklistMutation = useRemoveFromBlacklist();

  const visitors = data?.data ?? [];

  const handleBlacklistToggle = async () => {
    const { visitorId, name, isBlacklisted } = blacklistDialog;
    try {
      if (isBlacklisted) {
        await removeBlacklistMutation.mutateAsync({ orgId: user!.orgId!, visitorId });
        toast({ title: "Removed from Blacklist", description: `${name} can now visit again.` });
      } else {
        if (!reason.trim()) {
          toast({ title: "Reason required", variant: "destructive" });
          return;
        }
        await addBlacklistMutation.mutateAsync({ orgId: user!.orgId!, data: { visitorId, reason } });
        toast({ title: "Added to Blacklist", description: `${name} has been blacklisted.` });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}/visitors`] });
      setBlacklistDialog({ open: false, visitorId: "", name: "", isBlacklisted: false });
      setReason("");
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Visitors</h1>
        <p className="text-muted-foreground mt-1">All visitors who have requested access to your organization.</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, ID..."
            className="pl-9 h-11 rounded-xl bg-white border-slate-200"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center animate-pulse text-muted-foreground">Loading visitors...</div>
          ) : visitors.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center gap-3">
              <Users className="w-10 h-10 text-slate-300" />
              <p className="text-muted-foreground">No visitors found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-border/50">
                  <tr>
                    <th className="text-left p-4 font-semibold text-slate-600">Visitor</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Phone</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Company</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Verification</th>
                    <th className="text-left p-4 font-semibold text-slate-600">Status</th>
                    <th className="text-left p-4 font-semibold text-slate-600">First Visit</th>
                    <th className="p-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {visitors.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                            {v.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{v.fullName}</p>
                            {v.email && <p className="text-xs text-muted-foreground">{v.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">{v.phone || <span className="text-slate-400">—</span>}</td>
                      <td className="p-4 text-slate-600">{v.companyName || <span className="text-slate-400">—</span>}</td>
                      <td className="p-4">
                        <Badge className={`capitalize shadow-none border text-xs ${verificationBadge(v.verificationStatus)}`}>
                          {v.verificationStatus.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="p-4">
                        {v.isBlacklisted ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                            <AlertTriangle className="w-3.5 h-3.5" /> Blacklisted
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Clear
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-500 text-xs">{new Date(v.createdAt).toLocaleDateString()}</td>
                      <td className="p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 rounded-lg text-xs ${v.isBlacklisted ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" : "text-red-500 hover:text-red-600 hover:bg-red-50"}`}
                          onClick={() => setBlacklistDialog({ open: true, visitorId: v.id, name: v.fullName, isBlacklisted: v.isBlacklisted })}
                        >
                          {v.isBlacklisted ? <><ShieldCheck className="w-3.5 h-3.5 mr-1" />Unblock</> : <><ShieldX className="w-3.5 h-3.5 mr-1" />Blacklist</>}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={blacklistDialog.open} onOpenChange={o => { if (!o) { setBlacklistDialog(d => ({ ...d, open: false })); setReason(""); } }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {blacklistDialog.isBlacklisted ? "Remove from Blacklist" : "Blacklist Visitor"}
            </DialogTitle>
          </DialogHeader>
          {blacklistDialog.isBlacklisted ? (
            <p className="text-muted-foreground">Remove <strong>{blacklistDialog.name}</strong> from the blacklist? They will be able to request visits again.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-muted-foreground">Blacklisting <strong>{blacklistDialog.name}</strong> will prevent them from submitting future visit requests.</p>
              <div className="space-y-1.5">
                <Label>Reason *</Label>
                <Textarea placeholder="State the reason..." className="rounded-xl resize-none" rows={3} value={reason} onChange={e => setReason(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setBlacklistDialog(d => ({ ...d, open: false })); setReason(""); }}>Cancel</Button>
            <Button
              className={`rounded-xl ${blacklistDialog.isBlacklisted ? "" : "bg-red-600 hover:bg-red-700"}`}
              onClick={handleBlacklistToggle}
              disabled={addBlacklistMutation.isPending || removeBlacklistMutation.isPending}
            >
              {blacklistDialog.isBlacklisted ? "Remove from Blacklist" : "Confirm Blacklist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
