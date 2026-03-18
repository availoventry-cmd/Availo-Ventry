import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useScanQrCode, useCheckInVisitor, useCheckOutVisitor } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ScanLine, CheckCircle2, ArrowRightLeft, UserCheck, X } from "lucide-react";
import { format } from "date-fns";

export default function ReceptionistDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState("");
  const [scannedVisitor, setScannedVisitor] = useState<any>(null);

  const scanMutation = useScanQrCode();
  const checkInMutation = useCheckInVisitor();
  const checkOutMutation = useCheckOutVisitor();

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrCode || !user?.orgId) return;
    
    try {
      const res = await scanMutation.mutateAsync({ orgId: user.orgId, data: { qrCode } });
      setScannedVisitor(res);
      setQrCode("");
    } catch (e) {
      toast({ title: "Invalid QR Code", description: "The scanned code was not recognized or is expired.", variant: "destructive" });
    }
  };

  const handleCheckIn = async () => {
    if (!scannedVisitor) return;
    try {
      await checkInMutation.mutateAsync({ orgId: user!.orgId!, requestId: scannedVisitor.id });
      toast({ title: "Checked In", description: `${scannedVisitor.visitor?.fullName} is now checked in.` });
      setScannedVisitor(null);
    } catch (e) {
      toast({ title: "Check-in failed", variant: "destructive" });
    }
  };

  const handleCheckOut = async () => {
    if (!scannedVisitor) return;
    try {
      await checkOutMutation.mutateAsync({ orgId: user!.orgId!, requestId: scannedVisitor.id });
      toast({ title: "Checked Out", description: `${scannedVisitor.visitor?.fullName} has departed.` });
      setScannedVisitor(null);
    } catch (e) {
      toast({ title: "Check-out failed", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Desk Console</h1>
          <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm font-medium text-slate-700">
          Branch: {user?.branchId || "HQ Main Entry"}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Scanner Panel */}
        <Card className="border-border/50 shadow-lg rounded-2xl overflow-hidden relative bg-white">
          <CardHeader className="bg-slate-50 border-b border-slate-100">
            <CardTitle className="font-display flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-primary" /> Scan Visitor Pass
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {!scannedVisitor ? (
              <form onSubmit={handleScan} className="flex flex-col items-center justify-center space-y-6 py-8">
                <div className="w-32 h-32 border-4 border-dashed border-slate-300 rounded-3xl flex items-center justify-center relative animate-pulse">
                  <ScanLine className="w-12 h-12 text-slate-400" />
                  <div className="absolute top-1/2 left-0 right-0 h-1 bg-primary/50 shadow-[0_0_10px_rgba(var(--primary),0.5)] transform -translate-y-1/2"></div>
                </div>
                <div className="w-full max-w-sm space-y-2">
                  <Input 
                    autoFocus
                    placeholder="Scan or type QR token here..." 
                    className="text-center h-12 text-lg tracking-widest bg-slate-50 rounded-xl"
                    value={qrCode}
                    onChange={(e) => setQrCode(e.target.value)}
                  />
                  <Button type="submit" className="w-full h-12 rounded-xl text-base hover-elevate" disabled={!qrCode || scanMutation.isPending}>
                    Verify Code
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-6 animate-in-slide">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xl font-bold">
                      {scannedVisitor.visitor?.fullName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">{scannedVisitor.visitor?.fullName}</h3>
                      <p className="text-muted-foreground">{scannedVisitor.visitor?.companyName || 'Guest'}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setScannedVisitor(null)} className="rounded-full bg-slate-100 hover:bg-slate-200 hover-elevate">
                    <X className="w-5 h-5 text-slate-600" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm">
                  <div>
                    <span className="text-muted-foreground block mb-1">Host</span>
                    <span className="font-semibold text-foreground">{scannedVisitor.hostUser?.name || 'Walk-in'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Purpose</span>
                    <span className="font-medium text-foreground">{scannedVisitor.purpose}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground block mb-1">Current Status</span>
                    <span className="font-bold text-blue-600 capitalize">{scannedVisitor.status.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  {scannedVisitor.status === 'approved' && (
                    <Button onClick={handleCheckIn} className="flex-1 h-14 rounded-xl text-lg bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 hover-elevate" disabled={checkInMutation.isPending}>
                      <UserCheck className="w-6 h-6 mr-2" /> Check In
                    </Button>
                  )}
                  {scannedVisitor.status === 'checked_in' && (
                    <Button onClick={handleCheckOut} className="flex-1 h-14 rounded-xl text-lg bg-slate-800 hover:bg-slate-900 shadow-lg shadow-slate-800/20 hover-elevate" disabled={checkOutMutation.isPending}>
                      <ArrowRightLeft className="w-6 h-6 mr-2" /> Check Out
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Panel Placeholder */}
        <Card className="border-border/50 shadow-sm rounded-2xl bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="font-display">Live Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-lg font-medium text-foreground">Ready to receive visitors</p>
              <p className="text-sm text-muted-foreground max-w-[250px]">Scan a QR code or search manually to manage entry.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
