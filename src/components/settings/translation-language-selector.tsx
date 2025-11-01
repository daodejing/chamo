'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Language, t } from "@/lib/translations";
import { useLanguage } from "@/lib/contexts/language-context";
import { toast } from "sonner";
import { useMutation } from "@apollo/client";
import { gql } from "@apollo/client";

// GraphQL mutation to update user preferences
const UPDATE_USER_PREFERENCES = gql`
  mutation UpdateUserPreferences($input: UpdateUserPreferencesInput!) {
    updateUserPreferences(input: $input) {
      id
      preferences
    }
  }
`;

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
  const [updatePreferences] = useMutation(UPDATE_USER_PREFERENCES);

  const handleLanguageChange = async (newLang: TranslationLanguage) => {
    try {
      // Update backend user preferences via GraphQL mutation
      await updatePreferences({
        variables: {
          input: { preferredLanguage: newLang },
        },
      });

      // Show success toast (no page reload needed for translation language)
      toast.success(t("toast.translationLanguageUpdated", language));

      // Call optional callback
      if (onLanguageChange) {
        onLanguageChange(newLang);
      }
    } catch (error) {
      // Handle error
      toast.error(language === "ja" ? "翻訳言語の更新に失敗しました" : "Failed to update translation language");
      console.error("Failed to update translation language:", error);
    }
  };

  const languageOptions = getLanguageOptions(language);

  return (
    <Select defaultValue={defaultValue} onValueChange={handleLanguageChange}>
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
