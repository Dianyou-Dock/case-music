"use client";

import { useEffect } from "react";
import i18n from "@/hooks/i18n";

export function I18nLanguageRestore() {
  useEffect(() => {
    const language = window.localStorage.getItem("i18nextLng");
    if (language && language !== i18n.language) {
      void i18n.changeLanguage(language);
    }
  }, []);

  return null;
}
