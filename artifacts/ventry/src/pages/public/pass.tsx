import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Clock, CheckCircle2, XCircle, LogOut, Printer } from "lucide-react";
import { useLang } from "@/hooks/use-language";
import { LangToggle } from "@/components/lang-toggle";

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
  const { t, dir } = useLang();
  const [passData, setPassData] = useState<PassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPass() {
      try {
        const res = await fetch(`${BASE}/api/public/pass/${token}`);
        if (!res.ok) {
          setError(t("Pass not found or link has expired.", "لم يتم العثور على التصريح أو انتهت صلاحية الرابط."));
          return;
        }
        const data = await res.json();
        setPassData(data);
      } catch {
        setError(t("Failed to load pass. Please try again.", "فشل تحميل التصريح. يرجى المحاولة مرة أخرى."));
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative" dir={dir}>
        <LangToggle className="absolute top-4 right-4" />
        <Card className="w-full max-w-md p-8 text-center rounded-3xl shadow-xl">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-display font-bold mb-2">{t("Invalid Pass", "تصريح غير صالح")}</h2>
          <p className="text-muted-foreground">{error || t("This pass link is not valid.", "رابط التصريح غير صالح.")}</p>
        </Card>
      </div>
    );
  }

  const statusConfig: Record<string, { icon: any; color: string; bgColor: string; title: string; description: string }> = {
    pending: {
      icon: Clock, color: "text-amber-600", bgColor: "bg-amber-50",
      title: t("Pending Approval", "بانتظار الموافقة"),
      description: t("Your visit request is being reviewed. You will receive an email once approved.", "طلب زيارتك قيد المراجعة. ستتلقى بريداً إلكترونياً عند الموافقة."),
    },
    approved: {
      icon: CheckCircle2, color: "text-emerald-600", bgColor: "bg-emerald-50",
      title: t("Visit Approved", "تمت الموافقة"),
      description: t("Show this QR code at the reception desk for check-in.", "أظهر رمز QR هذا في مكتب الاستقبال لتسجيل الدخول."),
    },
    checked_in: {
      icon: CheckCircle2, color: "text-blue-600", bgColor: "bg-blue-50",
      title: t("Checked In", "تم تسجيل الدخول"),
      description: t("You are currently checked in. Enjoy your visit!", "أنت مسجل حالياً. نتمنى لك زيارة ممتعة!"),
    },
    checked_out: {
      icon: LogOut, color: "text-slate-600", bgColor: "bg-slate-50",
      title: t("Visit Completed", "اكتملت الزيارة"),
      description: t(`Thank you for visiting ${passData.orgName}.`, `شكراً لزيارتك ${passData.orgName}.`),
    },
    rejected: {
      icon: XCircle, color: "text-red-600", bgColor: "bg-red-50",
      title: t("Request Declined", "تم رفض الطلب"),
      description: t("Unfortunately, your visit request was not approved.", "للأسف، لم تتم الموافقة على طلب زيارتك."),
    },
    expired: {
      icon: Clock, color: "text-slate-500", bgColor: "bg-slate-50",
      title: t("Request Expired", "انتهت صلاحية الطلب"),
      description: t("This visit request has expired.", "انتهت صلاحية طلب الزيارة هذا."),
    },
    cancelled: {
      icon: XCircle, color: "text-slate-500", bgColor: "bg-slate-50",
      title: t("Request Cancelled", "تم إلغاء الطلب"),
      description: t("This visit request was cancelled.", "تم إلغاء طلب الزيارة هذا."),
    },
  };

  const config = statusConfig[passData.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 flex flex-col items-center relative" dir={dir}>
      <LangToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-md mb-6 text-center">
        <div className="w-14 h-14 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center justify-center mx-auto mb-3 overflow-hidden">
          {passData.orgLogo
            ? <img src={passData.orgLogo} alt="Logo" className="w-full h-full object-cover" />
            : <Building2 className="w-7 h-7 text-primary" />}
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">{passData.orgName}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("Visitor Entry Pass", "تصريح دخول الزائر")}</p>
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
            <p className="text-xs text-muted-foreground mt-3">{t("Scan this code at the reception desk", "قم بمسح الرمز في مكتب الاستقبال")}</p>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs text-muted-foreground mb-1">{t("Manual Entry Code", "رمز الإدخال اليدوي")}</p>
              <p className="font-mono font-bold text-lg tracking-wider text-foreground select-all">{passData.qrCodeData}</p>
              <p className="text-xs text-slate-400 mt-1">{t("You may also provide this code to the receptionist", "يمكنك أيضاً تقديم هذا الرمز لموظف الاستقبال")}</p>
            </div>
          </div>
        )}

        <div className="p-6 bg-white space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">{t("Visitor", "الزائر")}</p>
              <p className="font-semibold text-foreground">{passData.visitorName}</p>
            </div>
            {passData.hostName && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">{t("Host", "المضيف")}</p>
                <p className="font-semibold text-foreground">{passData.hostName}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">{t("Branch", "الفرع")}</p>
              <p className="font-semibold text-foreground">{passData.branchName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">{t("Date", "التاريخ")}</p>
              <p className="font-semibold text-foreground">{passData.scheduledDate}</p>
            </div>
            {passData.scheduledTimeFrom && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">{t("Time", "الوقت")}</p>
                <p className="font-semibold text-foreground">
                  {passData.scheduledTimeFrom}{passData.scheduledTimeTo ? ` — ${passData.scheduledTimeTo}` : ""}
                </p>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-muted-foreground text-xs mb-0.5">{t("Purpose", "الغرض")}</p>
              <p className="font-medium text-foreground">{passData.purpose}</p>
            </div>
          </div>
        </div>

        {passData.status === "approved" && (
          <div className="p-4 bg-slate-50 border-t text-center">
            <Button variant="outline" className="rounded-xl gap-2" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> {t("Print Pass", "طباعة التصريح")}
            </Button>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground mt-6">{t("Powered by Availo Ventry", "مدعوم من Availo Ventry")}</p>
    </div>
  );
}
