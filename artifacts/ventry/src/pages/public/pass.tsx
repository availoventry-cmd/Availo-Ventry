import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Clock, CheckCircle2, XCircle, LogOut, Printer } from "lucide-react";

interface PassData {
  requestId: string;
  visitorName: string;
  hostName: string | null;
  orgName: string;
  orgLogo: string | null;
  branchName: string;
  scheduledDate: string;
  scheduledTimeFrom: string | null;
  scheduledTimeTo: string | null;
  status: string;
  qrCodeData: string | null;
  purpose: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function VisitorPass() {
  const { token } = useParams<{ token: string }>();
  const [passData, setPassData] = useState<PassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPass() {
      try {
        const res = await fetch(`${BASE}/api/public/pass/${token}`);
        if (!res.ok) {
          setError("Pass not found or link has expired.");
          return;
        }
        const data = await res.json();
        setPassData(data);
      } catch {
        setError("Failed to load pass. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    if (token) fetchPass();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !passData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md p-8 text-center rounded-3xl shadow-xl">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-display font-bold mb-2">Invalid Pass</h2>
          <p className="text-muted-foreground">{error || "This pass link is not valid."}</p>
        </Card>
      </div>
    );
  }

  const statusConfig: Record<string, { icon: any; color: string; bgColor: string; title: string; description: string }> = {
    pending: {
      icon: Clock, color: "text-amber-600", bgColor: "bg-amber-50",
      title: "Pending Approval",
      description: "Your visit request is being reviewed. You will receive an email once approved.",
    },
    approved: {
      icon: CheckCircle2, color: "text-emerald-600", bgColor: "bg-emerald-50",
      title: "Visit Approved",
      description: "Show this QR code at the reception desk for check-in.",
    },
    checked_in: {
      icon: CheckCircle2, color: "text-blue-600", bgColor: "bg-blue-50",
      title: "Checked In",
      description: "You are currently checked in. Enjoy your visit!",
    },
    checked_out: {
      icon: LogOut, color: "text-slate-600", bgColor: "bg-slate-50",
      title: "Visit Completed",
      description: `Thank you for visiting ${passData.orgName}.`,
    },
    rejected: {
      icon: XCircle, color: "text-red-600", bgColor: "bg-red-50",
      title: "Request Declined",
      description: "Unfortunately, your visit request was not approved.",
    },
    expired: {
      icon: Clock, color: "text-slate-500", bgColor: "bg-slate-50",
      title: "Request Expired",
      description: "This visit request has expired.",
    },
    cancelled: {
      icon: XCircle, color: "text-slate-500", bgColor: "bg-slate-50",
      title: "Request Cancelled",
      description: "This visit request was cancelled.",
    },
  };

  const config = statusConfig[passData.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 flex flex-col items-center">
      <div className="w-full max-w-md mb-6 text-center">
        <div className="w-14 h-14 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center justify-center mx-auto mb-3 overflow-hidden">
          {passData.orgLogo
            ? <img src={passData.orgLogo} alt="Logo" className="w-full h-full object-cover" />
            : <Building2 className="w-7 h-7 text-primary" />}
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">{passData.orgName}</h1>
        <p className="text-muted-foreground text-sm mt-1">Visitor Entry Pass</p>
      </div>

      <Card className={`w-full max-w-md rounded-3xl shadow-xl overflow-hidden ${config.bgColor}`}>
        <div className={`p-6 text-center border-b ${config.bgColor}`}>
          <StatusIcon className={`w-12 h-12 mx-auto mb-3 ${config.color}`} />
          <h2 className={`text-xl font-display font-bold ${config.color}`}>{config.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
        </div>

        {passData.status === "approved" && passData.qrCodeData && (
          <div className="p-6 bg-white text-center">
            <div className="inline-block p-4 bg-white rounded-2xl shadow-md border border-slate-100">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(passData.qrCodeData)}`}
                alt="Entry QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">Scan this code at the reception desk</p>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs text-muted-foreground mb-1">Manual Entry Code</p>
              <p className="font-mono font-bold text-lg tracking-wider text-foreground select-all">{passData.qrCodeData}</p>
              <p className="text-xs text-slate-400 mt-1">If camera is unavailable, provide this code to the receptionist</p>
            </div>
          </div>
        )}

        <div className="p-6 bg-white space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Visitor</p>
              <p className="font-semibold text-foreground">{passData.visitorName}</p>
            </div>
            {passData.hostName && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Host</p>
                <p className="font-semibold text-foreground">{passData.hostName}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Branch</p>
              <p className="font-semibold text-foreground">{passData.branchName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Date</p>
              <p className="font-semibold text-foreground">{passData.scheduledDate}</p>
            </div>
            {passData.scheduledTimeFrom && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Time</p>
                <p className="font-semibold text-foreground">
                  {passData.scheduledTimeFrom}{passData.scheduledTimeTo ? ` — ${passData.scheduledTimeTo}` : ""}
                </p>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-muted-foreground text-xs mb-0.5">Purpose</p>
              <p className="font-medium text-foreground">{passData.purpose}</p>
            </div>
          </div>
        </div>

        {passData.status === "approved" && (
          <div className="p-4 bg-slate-50 border-t text-center">
            <Button variant="outline" className="rounded-xl gap-2" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> Print Pass
            </Button>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground mt-6">Powered by Availo Ventry</p>
    </div>
  );
}
