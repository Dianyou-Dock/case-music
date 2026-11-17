"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "../../public/locales/zh/translation.json";
import en from "../../public/locales/en/translation.json";


void i18n.use(initReactI18next).init({
  lng: "zh",
  fallbackLng: "zh",
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  interpolation: { escapeValue: false },
});

export default i18n;
