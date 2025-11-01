'use client';

import { Button } from "@/components/ui/button";
import { Language, t } from "@/lib/translations";
import { useLanguage } from "@/lib/contexts/language-context";
import { toast } from "sonner";

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  const handleLanguageChange = (newLang: Language) => {
    if (newLang === language) return; // No change needed

    // Show toast notification
    toast.info(t("toast.languageChanging", newLang));

    // Update language in context and localStorage
    setLanguage(newLang);

    // Reload page to apply new language across all components
    setTimeout(() => {
      window.location.reload();
    }, 500); // Short delay to let user see the toast
  };

  return (
    <div className="flex gap-2 w-full">
      <Button
        variant={language === "ja" ? "default" : "outline"}
        onClick={() => handleLanguageChange("ja")}
        className={`flex-1 rounded-xl ${
          language === "ja"
            ? "bg-gradient-to-r from-[#B5179E] to-[#8B38BA] text-white"
            : ""
        }`}
      >
        {t("settings.japanese", language)}
      </Button>
      <Button
        variant={language === "en" ? "default" : "outline"}
        onClick={() => handleLanguageChange("en")}
        className={`flex-1 rounded-xl ${
          language === "en"
            ? "bg-gradient-to-r from-[#B5179E] to-[#8B38BA] text-white"
            : ""
        }`}
      >
        {t("settings.english", language)}
      </Button>
    </div>
  );
}
