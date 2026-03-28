import { useLang } from "@/hooks/use-language";

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      className={`px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-colors ${className}`}
    >
      {lang === "en" ? "عربي" : "EN"}
    </button>
  );
}
