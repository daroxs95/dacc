import {createContext, useContext} from "react";
import {formatMoney, translate, type Lang, type MessageKey} from "~/lib/i18n";

export type {Lang} from "~/lib/i18n";
export const LanguageContext = createContext<{language: Lang; setLanguage: (language: Lang) => void}>({
    language: "en", setLanguage: () => {},
});

export function useLang(override?: Lang) {
    const context = useContext(LanguageContext);
    const language = override ?? context.language;
    return {
        language,
        setLanguage: context.setLanguage,
        t: (key: MessageKey, values?: Record<string, string | number>) => translate(language, key, values),
        money: (value: number) => formatMoney(language, value),
        number: (value: number) => new Intl.NumberFormat(language).format(value),
    };
}
