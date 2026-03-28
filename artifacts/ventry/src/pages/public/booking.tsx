import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSubmitPublicVisitRequest, useGetPublicOrgInfo } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Building2, ShieldCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLang } from "@/hooks/use-language";
import { LangToggle } from "@/components/lang-toggle";

const bookingSchema = z.object({
  visitorName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  nationalId: z.string().optional(),
  phone: z.string().min(9, "Valid phone number required"),
  companyName: z.string().optional(),
  branchId: z.string().min(1, "Please select a branch"),
  purpose: z.string().min(5, "Please state your purpose"),
  scheduledDate: z.string().min(1, "Date is required"),
  scheduledTimeFrom: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const { t, dir, lang } = useLang();
  const [isSuccess, setIsSuccess] = useState(false);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);

  const [pendingFormData, setPendingFormData] = useState<BookingFormData | null>(null);
  const [otpStep, setOtpStep] = useState(false);
  const [otpChannel, setOtpChannel] = useState<"sms" | "whatsapp" | "email">("sms");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpPhone, setOtpPhone] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: org, isLoading: orgLoading } = useGetPublicOrgInfo(slug);
  const submitMutation = useSubmitPublicVisitRequest();

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      visitorName: "",
      email: "",
      nationalId: "",
      phone: "",
      companyName: "",
      branchId: "",
      purpose: "",
      scheduledDate: new Date().toISOString().split("T")[0],
      scheduledTimeFrom: "10:00",
    },
  });

  const onSubmit = async (data: BookingFormData) => {
    setPendingFormData(data);
    setOtpPhone(data.phone);
    setOtpEmail(data.email);
    setOtpStep(true);
  };

  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const body: Record<string, string> = { method: otpChannel };
      if (otpChannel === "email") {
        body.email = otpEmail;
      } else {
        body.phone = otpPhone;
      }
      const res = await fetch(`${import.meta.env.BASE_URL}api/verification/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setChallengeId(data.challengeId);
        setOtpSent(true);
        toast({ title: t("Code Sent", "تم إرسال الرمز"), description: t(`Verification code sent via ${otpChannel.toUpperCase()}.`, `تم إرسال رمز التحقق عبر ${otpChannel.toUpperCase()}.`) });
      } else {
        toast({ title: t("Failed", "فشل"), description: data.error || t("Could not send code. Try again.", "تعذر إرسال الرمز. حاول مرة أخرى."), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Failed to send code", "فشل إرسال الرمز"), variant: "destructive" });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyAndSubmit = async () => {
    if (!pendingFormData) return;
    setVerifying(true);
    try {
      const verifyRes = await fetch(`${import.meta.env.BASE_URL}api/verification/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, otp: otpCode }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.verified) {
        toast({ title: t("Incorrect Code", "رمز غير صحيح"), description: verifyData.message || t("Please try again.", "يرجى المحاولة مرة أخرى."), variant: "destructive" });
        return;
      }

      setSubmitting(true);
      const result = await submitMutation.mutateAsync({ slug, data: pendingFormData });
      setTrackingToken((result as any)?.trackingToken || null);
      setIsSuccess(true);
    } catch {
      toast({ title: t("Submission Failed", "فشل الإرسال"), description: t("Please try again later.", "يرجى المحاولة لاحقاً."), variant: "destructive" });
    } finally {
      setVerifying(false);
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setSendingOtp(true);
    try {
      const body: Record<string, string> = { method: otpChannel };
      if (otpChannel === "email") {
        body.email = otpEmail;
      } else {
        body.phone = otpPhone;
      }
      const res = await fetch(`${import.meta.env.BASE_URL}api/verification/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.challengeId) setChallengeId(data.challengeId);
      toast({ title: t("Code Resent", "تم إعادة إرسال الرمز") });
    } catch {
      toast({ title: t("Failed to resend", "فشل إعادة الإرسال"), variant: "destructive" });
    } finally {
      setSendingOtp(false);
    }
  };

  if (orgLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading...</div>;
  if (!org) return <div className="min-h-screen flex items-center justify-center bg-slate-50">{t("Organization not found", "لم يتم العثور على المنظمة")}</div>;

  const orgName = lang === "ar" && (org as any).nameAr ? (org as any).nameAr : org.name;

  if (otpStep && !isSuccess) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4 relative" dir={dir}>
        <LangToggle className="absolute top-4 right-4" />
        <Card className="w-full max-w-md p-8 border-border/50 shadow-xl rounded-3xl animate-in-slide">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground">{t("Verify Your Identity", "تحقق من هويتك")}</h2>
            <p className="text-muted-foreground mt-2">{t("We need to verify your identity before submitting the request.", "نحتاج للتحقق من هويتك قبل إرسال الطلب.")}</p>
          </div>

          {!otpSent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">{t("Choose how to receive your verification code", "اختر طريقة استلام رمز التحقق")}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOtpChannel("sms")}
                  className={`flex-1 p-3 rounded-xl border text-center text-sm font-medium transition-all ${otpChannel === "sms" ? "border-primary bg-primary/5 text-primary" : "border-slate-200"}`}>
                  SMS
                </button>
                <button type="button" onClick={() => setOtpChannel("whatsapp")}
                  className={`flex-1 p-3 rounded-xl border text-center text-sm font-medium transition-all ${otpChannel === "whatsapp" ? "border-primary bg-primary/5 text-primary" : "border-slate-200"}`}>
                  WhatsApp
                </button>
                <button type="button" onClick={() => setOtpChannel("email")}
                  className={`flex-1 p-3 rounded-xl border text-center text-sm font-medium transition-all ${otpChannel === "email" ? "border-primary bg-primary/5 text-primary" : "border-slate-200"}`}>
                  {t("Email", "بريد")}
                </button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {t("Code will be sent to", "سيتم إرسال الرمز إلى")} {otpChannel === "email" ? otpEmail : otpPhone}
              </p>
              <Button className="w-full h-12 rounded-xl" onClick={handleSendOtp} disabled={sendingOtp}>
                {sendingOtp ? <Loader2 className="w-5 h-5 animate-spin" /> : t("Send Code", "إرسال الرمز")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {t(`Enter the code sent via ${otpChannel.toUpperCase()}`, `أدخل الرمز المرسل عبر ${otpChannel.toUpperCase()}`)}
              </p>
              <Input
                className="h-14 rounded-xl text-center text-2xl tracking-[0.5em] font-mono bg-slate-50 border-slate-200"
                placeholder="000000"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
              <Button
                className="w-full h-12 rounded-xl text-base font-semibold"
                disabled={verifying || submitting || otpCode.length < 4}
                onClick={handleVerifyAndSubmit}
              >
                {verifying || submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {submitting ? t("Submitting...", "جارٍ الإرسال...") : t("Verifying...", "جارٍ التحقق...")}</>
                ) : (
                  t("Verify & Submit Request", "تحقق وأرسل الطلب")
                )}
              </Button>
              <div className="flex justify-between text-xs">
                <button type="button" className="text-primary hover:underline" onClick={() => { setOtpSent(false); setOtpCode(""); }}>
                  {t("Change method", "تغيير الطريقة")}
                </button>
                <button type="button" className="text-primary hover:underline" onClick={handleResendOtp} disabled={sendingOtp}>
                  {sendingOtp ? t("Sending...", "جارٍ الإرسال...") : t("Resend code", "إعادة إرسال الرمز")}
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 text-center">
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => {
              setOtpStep(false);
              setOtpSent(false);
              setOtpCode("");
              setChallengeId("");
            }}>
              {t("Back to form", "العودة للنموذج")}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4 relative" dir={dir}>
        <LangToggle className="absolute top-4 right-4" />
        <Card className="w-full max-w-md p-8 text-center border-border/50 shadow-xl rounded-3xl animate-in-slide">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-3">{t("Request Submitted", "تم إرسال الطلب")}</h2>
          <p className="text-muted-foreground text-lg mb-6">
            {t(
              `Your visit request for ${orgName} has been sent for approval. You will receive an email with your entry pass and QR code once approved.`,
              `تم إرسال طلب زيارتك لـ ${orgName} للموافقة. ستتلقى بريداً إلكترونياً يحتوي على تصريح الدخول ورمز QR بمجرد الموافقة.`
            )}
          </p>
          {trackingToken && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 mb-6 text-left">
              <p className="text-sm font-semibold text-blue-900 mb-2">{t("Track your request:", "تتبع طلبك:")}</p>
              <a href={`/public/pass/${trackingToken}`} className="text-sm text-blue-600 hover:underline break-all">
                {window.location.origin}/public/pass/{trackingToken}
              </a>
              <p className="text-xs text-blue-500 mt-2">{t("Bookmark this link to check your request status anytime.", "احفظ هذا الرابط لمتابعة حالة طلبك في أي وقت.")}</p>
            </div>
          )}
          <Button onClick={() => window.location.reload()} variant="outline" className="h-12 px-8 rounded-xl font-semibold hover-elevate">
            {t("Submit Another Request", "إرسال طلب آخر")}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 py-12 px-4 flex flex-col items-center relative" dir={dir}>
      <LangToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-2xl mb-8 text-center animate-in-fade">
        <div className="w-16 h-16 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden">
          {org.logo ? <img src={org.logo} alt="Logo" className="w-full h-full object-cover" /> : <Building2 className="w-8 h-8 text-primary" />}
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground tracking-tight">{orgName}</h1>
        <p className="text-muted-foreground mt-2 text-lg">{t("Visitor Registration Form", "نموذج تسجيل الزوار")}</p>
      </div>

      <Card className="w-full max-w-2xl border-border/50 shadow-xl rounded-3xl overflow-hidden animate-in-slide bg-white">
        <div className="h-2 bg-primary w-full" />
        <div className="p-6 sm:p-10">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField control={form.control} name="visitorName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-700">{t("Full Name", "الاسم الكامل")}</FormLabel>
                    <FormControl><Input className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder={t("John Doe", "محمد أحمد")} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-700">{t("Phone Number", "رقم الجوال")}</FormLabel>
                    <FormControl>
                      <Input className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="+966 5X XXX XXXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-700">{t("Email Address", "البريد الإلكتروني")} *</FormLabel>
                    <FormControl>
                      <Input type="email" className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="visitor@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="nationalId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-700">{t("National ID / Iqama (Optional)", "رقم الهوية / الإقامة (اختياري)")}</FormLabel>
                    <FormControl><Input className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="10XXXXXXXX" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-700">{t("Your Company", "الشركة")}</FormLabel>
                    <FormControl><Input className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder={t("e.g. Saudi Aramco, STC...", "مثال: أرامكو، STC...")} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="col-span-1 sm:col-span-2">
                  <FormField control={form.control} name="branchId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-slate-700">{t("Destination Branch", "الفرع")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200">
                            <SelectValue placeholder={t("Select a branch", "اختر الفرع")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {org.branches.map(b => (
                            <SelectItem key={b.id} value={b.id}>
                              {lang === "ar" && (b as any).nameAr ? (b as any).nameAr : b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <FormField control={form.control} name="purpose" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-slate-700">{t("Purpose of Visit", "الغرض من الزيارة")}</FormLabel>
                      <FormControl><Textarea className="min-h-[100px] rounded-xl bg-slate-50 border-slate-200 resize-none p-4" placeholder={t("Meeting with IT department regarding...", "اجتماع مع قسم تقنية المعلومات بخصوص...")} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-700">{t("Date", "التاريخ")}</FormLabel>
                    <FormControl><Input type="date" className="h-12 rounded-xl bg-slate-50 border-slate-200" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="scheduledTimeFrom" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-slate-700">{t("Expected Time", "الوقت المتوقع")}</FormLabel>
                    <FormControl><Input type="time" className="h-12 rounded-xl bg-slate-50 border-slate-200" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-14 rounded-xl text-lg font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover-elevate"
                >
                  {t("Request Entry Pass", "طلب تصريح دخول")}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </Card>
    </div>
  );
}
