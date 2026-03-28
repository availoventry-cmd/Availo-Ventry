import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Lang = "en" | "ar";

const LangContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (en: string, ar: string) => string;
  dir: "ltr" | "rtl";
}>({ lang: "en", setLang: () => {}, t: (en) => en, dir: "ltr" });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem("ventry-lang") as Lang) || "en";
  });

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const handleSetLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem("ventry-lang", l);
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = l;
  };

  const t = (en: string, ar: string) => lang === "ar" ? ar : en;
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <LangContext.Provider value={{ lang, setLang: handleSetLang, t, dir }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
