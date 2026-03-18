import { useState } from "react";
import { useListVisitRequests, useApproveVisitRequest, useRejectVisitRequest } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Check, X, Search, MoreHorizontal, User, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function VisitRequests() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListVisitRequests(user?.orgId || "", {
    search,
    limit: 50
  }, { query: { enabled: !!user?.orgId } });

  const approveMutation = useApproveVisitRequest();
  const rejectMutation = useRejectVisitRequest();

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync({ orgId: user!.orgId!, requestId: id, data: {} });
      toast({ title: "Request Approved", description: "Visitor has been sent their QR pass." });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}/visit-requests`] });
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectMutation.mutateAsync({ orgId: user!.orgId!, requestId: id, data: { rejectionReason: "Rejected by admin" } });
      toast({ title: "Request Rejected" });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.orgId}/visit-requests`] });
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-100 text-amber-800 border-amber-200",
      approved: "bg-blue-100 text-blue-800 border-blue-200",
      checked_in: "bg-emerald-100 text-emerald-800 border-emerald-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
    };
    return <Badge className={`capitalize shadow-none border ${styles[status] || "bg-slate-100 text-slate-800"}`}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Visit Requests</h1>
          <p className="text-muted-foreground mt-1">Manage and approve upcoming visitors.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search visitor name..." 
            className="pl-9 h-11 rounded-xl bg-white border-slate-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-semibold">Visitor</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Branch</TableHead>
                <TableHead className="font-semibold">Scheduled Time</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Loading requests...</TableCell></TableRow>
              ) : data?.data.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No requests found.</TableCell></TableRow>
              ) : (
                data?.data.map((req) => (
                  <TableRow key={req.id} className="group hover:bg-slate-50/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{req.visitor?.fullName || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{req.purpose}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground capitalize">{req.type.replace('_', ' ')}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{req.branch?.name}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{format(new Date(req.scheduledDate), "MMM d, yyyy")}</span>
                        {req.scheduledTimeFrom && <span className="text-muted-foreground">{req.scheduledTimeFrom}</span>}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell className="text-right">
                      {req.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover-elevate" onClick={() => handleReject(req.id)}>
                            <X className="w-4 h-4" />
                          </Button>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover-elevate" onClick={() => handleApprove(req.id)}>
                            <Check className="w-4 h-4 mr-1" /> Approve
                          </Button>
                        </div>
                      ) : (
                        <Button size="icon" variant="ghost" className="hover-elevate">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
