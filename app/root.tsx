import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import {useEffect, useState} from "react";
import {LanguageContext, useLang, type Lang} from "./hooks/useLang";
import {LANGUAGE_STORAGE_KEY, resolveLanguage, translate} from "./lib/i18n";
import "./app.css";
import "../decss/utils/all_styles.mjs";
import "../decss/utils/all_classes.mjs";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  // Match the pre-rendered document on first render, then read browser preferences.
  const [language, updateLanguage] = useState<Lang>("en");
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { /* Storage is optional. */ }
    updateLanguage(resolveLanguage(saved, navigator.languages));
  }, []);
  const setLanguage = (next: Lang) => {
    updateLanguage(next);
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Keep working without persistence. */ }
  };
  return (
    <html lang={language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{translate(language, "Dacc, simple invoicing")}</title>
        <meta name="description" content={translate(language, "Invoicing made simple with Dacc")} />
        <Meta />
        <Links />
      </head>
      <body>
        <LanguageContext.Provider value={{language, setLanguage}}>{children}</LanguageContext.Provider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const {t} = useLang();
  let message = t("Oops!");
  let details = t("An unexpected error occurred.");
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : t("Error");
    details =
      error.status === 404
        ? t("The requested page could not be found.")
        : details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
