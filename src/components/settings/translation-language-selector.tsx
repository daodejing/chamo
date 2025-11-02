'use client';

import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Language, t } from "@/lib/translations";
import { useLanguage } from "@/lib/contexts/language-context";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";
import { useMutation } from "@apollo/client/react";
import { UPDATE_USER_PREFERENCES_MUTATION } from "@/lib/graphql/operations";
import type {
  UpdateUserPreferencesMutation,
  UpdateUserPreferencesMutationVariables,
} from "@/lib/graphql/generated/graphql";

// Translation language type (20+ languages as per AC#2)
export type TranslationLanguage =
  | "en" | "ja" | "es" | "fr" | "de" | "zh" | "ko" | "pt"
  | "ru" | "ar" | "it" | "nl" | "pl" | "tr" | "vi" | "th"
  | "id" | "hi" | "sv" | "no";

interface TranslationLanguageSelectorProps {
  defaultValue?: TranslationLanguage;
  onLanguageChange?: (lang: TranslationLanguage) => void;
}

// Language options with translated names
const getLanguageOptions = (currentLang: Language): Array<{ value: TranslationLanguage; label: string }> => {
  const isJapanese = currentLang === "ja";

  return [
    { value: "en", label: isJapanese ? "英語" : "English" },
    { value: "ja", label: isJapanese ? "日本語" : "Japanese" },
    { value: "es", label: isJapanese ? "スペイン語" : "Spanish" },
    { value: "fr", label: isJapanese ? "フランス語" : "French" },
    { value: "de", label: isJapanese ? "ドイツ語" : "German" },
    { value: "zh", label: isJapanese ? "中国語" : "Chinese" },
    { value: "ko", label: isJapanese ? "韓国語" : "Korean" },
    { value: "pt", label: isJapanese ? "ポルトガル語" : "Portuguese" },
    { value: "ru", label: isJapanese ? "ロシア語" : "Russian" },
    { value: "ar", label: isJapanese ? "アラビア語" : "Arabic" },
    { value: "it", label: isJapanese ? "イタリア語" : "Italian" },
    { value: "nl", label: isJapanese ? "オランダ語" : "Dutch" },
    { value: "pl", label: isJapanese ? "ポーランド語" : "Polish" },
    { value: "tr", label: isJapanese ? "トルコ語" : "Turkish" },
    { value: "vi", label: isJapanese ? "ベトナム語" : "Vietnamese" },
    { value: "th", label: isJapanese ? "タイ語" : "Thai" },
    { value: "id", label: isJapanese ? "インドネシア語" : "Indonesian" },
    { value: "hi", label: isJapanese ? "ヒンディー語" : "Hindi" },
    { value: "sv", label: isJapanese ? "スウェーデン語" : "Swedish" },
    { value: "no", label: isJapanese ? "ノルウェー語" : "Norwegian" },
  ];
};

export function TranslationLanguageSelector({
  defaultValue = "en",
  onLanguageChange
}: TranslationLanguageSelectorProps) {
  const { language } = useLanguage();
  const { user, updateUserPreferences } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<TranslationLanguage>(defaultValue);
  const [pendingLanguage, setPendingLanguage] = useState<TranslationLanguage | null>(null);
  const [mutate] = useMutation<
    UpdateUserPreferencesMutation,
    UpdateUserPreferencesMutationVariables
  >(UPDATE_USER_PREFERENCES_MUTATION);

  useEffect(() => {
    setSelectedLanguage(defaultValue);
  }, [defaultValue]);

  const languageOptions = useMemo(() => getLanguageOptions(language), [language]);

  const mergePreferences = (preferredLanguage: TranslationLanguage) => {
    const currentPrefs = (user?.preferences as Record<string, unknown> | undefined) ?? {};
    return {
      ...currentPrefs,
      preferredLanguage,
    };
  };

  const applySelection = (preferredLanguage: TranslationLanguage) => {
    setSelectedLanguage(preferredLanguage);
    updateUserPreferences(mergePreferences(preferredLanguage));
    if (onLanguageChange) {
      onLanguageChange(preferredLanguage);
    }
  };

  const handleLanguageChange = async (newLang: TranslationLanguage) => {
    if (newLang === selectedLanguage || pendingLanguage === newLang) {
      return;
    }

    const previousLanguage = selectedLanguage;
    const previousPreferences = (user?.preferences as Record<string, unknown> | undefined) ?? null;

    applySelection(newLang);
    setPendingLanguage(newLang);

    try {
      const { data } = await mutate({
        variables: {
          input: { preferredLanguage: newLang },
        },
      });

      const updatedPreferences = data?.updateUserPreferences?.preferences as
        | { preferredLanguage?: string | null }
        | null
        | undefined;

      if (updatedPreferences) {
        updateUserPreferences(updatedPreferences as Record<string, unknown>);
      }

      toast.success(t("toast.translationLanguageUpdated", language));
    } catch (error) {
      console.error("Failed to update translation language:", error);
      toast.error(t("toast.translationLanguageUpdateFailed", language));

      if (previousPreferences) {
        updateUserPreferences(previousPreferences);
      } else {
        updateUserPreferences(null);
      }
      setSelectedLanguage(previousLanguage);
    } finally {
      setPendingLanguage(null);
    }
  };

  return (
    <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
      <SelectTrigger className="rounded-xl">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languageOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
