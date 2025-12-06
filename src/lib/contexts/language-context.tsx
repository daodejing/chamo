'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Check if a string is a valid Language type
 */
function isValidLanguage(lang: string | null): lang is Language {
  return lang === 'en' || lang === 'ja';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default to English, but check localStorage for saved preference
  const [language, setLanguageState] = useState<Language>('en');

  // Load language preference on mount
  // Priority: URL param (for invitees) > localStorage > default (en)
  useEffect(() => {
    // Check URL parameter first (for invitees arriving from email links)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');

    if (isValidLanguage(urlLang)) {
      setLanguageState(urlLang);
      // Save to localStorage so it persists after navigation
      localStorage.setItem('appLanguage', urlLang);
      return;
    }

    // Fall back to localStorage
    const savedLanguage = localStorage.getItem('appLanguage');
    if (isValidLanguage(savedLanguage)) {
      setLanguageState(savedLanguage);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('appLanguage', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
