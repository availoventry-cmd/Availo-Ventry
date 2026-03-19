import { useState } from "react";
import { useListVisitRequests, useApproveVisitRequest, useRejectVisitRequest } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Check, X, Search, MoreHorizontal, User, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function VisitRequests() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

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
                <TableHead className="font-semibold">Purpose</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Branch</TableHead>
                <TableHead className="font-semibold">Scheduled Time</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Loading requests...</TableCell></TableRow>
              ) : data?.data.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No requests found.</TableCell></TableRow>
              ) : (
                data?.data.map((req) => (
                  <TableRow key={req.id} className="group hover:bg-slate-50/50 cursor-pointer" onClick={() => setSelectedRequest(req)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{req.visitor?.fullName || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{req.visitor?.phone || ''}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-foreground max-w-[300px]">{req.purpose}</p>
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
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Visit Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Visitor Name</p>
                  <p className="font-semibold">{selectedRequest.visitor?.fullName || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Phone</p>
                  <p className="font-semibold">{selectedRequest.visitor?.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Email</p>
                  <p className="font-semibold">{selectedRequest.visitor?.email || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Company</p>
                  <p className="font-semibold">{selectedRequest.visitor?.companyName || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">National ID</p>
                  <p className="font-semibold">{selectedRequest.visitor?.nationalIdNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Type</p>
                  <p className="font-semibold capitalize">{selectedRequest.type.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Branch</p>
                  <p className="font-semibold">{selectedRequest.branch?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Status</p>
                  {getStatusBadge(selectedRequest.status)}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Scheduled Date</p>
                  <p className="font-semibold">{format(new Date(selectedRequest.scheduledDate), "MMMM d, yyyy")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Time</p>
                  <p className="font-semibold">
                    {selectedRequest.scheduledTimeFrom || '—'}
                    {selectedRequest.scheduledTimeTo ? ` — ${selectedRequest.scheduledTimeTo}` : ''}
                  </p>
                </div>
                {selectedRequest.hostUser && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Host</p>
                    <p className="font-semibold">{selectedRequest.hostUser.name}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Purpose of Visit</p>
                <p className="text-sm font-medium bg-slate-50 p-3 rounded-xl">{selectedRequest.purpose}</p>
              </div>
              {selectedRequest.notes && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Notes</p>
                  <p className="text-sm bg-slate-50 p-3 rounded-xl">{selectedRequest.notes}</p>
                </div>
              )}
              {selectedRequest.rejectionReason && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{selectedRequest.rejectionReason}</p>
                </div>
              )}
              {selectedRequest.status === 'pending' && (
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 rounded-xl text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => { handleReject(selectedRequest.id); setSelectedRequest(null); }}>
                    <X className="w-4 h-4 mr-2" /> Reject
                  </Button>
                  <Button className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => { handleApprove(selectedRequest.id); setSelectedRequest(null); }}>
                    <Check className="w-4 h-4 mr-2" /> Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
