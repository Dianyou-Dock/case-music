"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";


// 配置 i18next
i18n
  .use(HttpBackend) // 从文件加载翻译资源
  .use(LanguageDetector) // 自动检测语言
  .use(initReactI18next) // 绑定到 React
  .init({
    fallbackLng: "en", // 默认语言
    debug: true, // 启用调试模式
    interpolation: {
      escapeValue: false, // React 已经内置防止 XSS
    },
  });

export default i18n;