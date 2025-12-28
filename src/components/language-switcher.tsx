import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Button } from "./ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "./ui/utils";

export function LanguageSwitcher() {
    const { i18n, ready } = useTranslation();
    const [currentLang, setCurrentLang] = useState(i18n.language || "en");

    useEffect(() => {
        const handleLanguageChanged = (lng: string) => {
            setCurrentLang(lng);
        };

        i18n.on("languageChanged", handleLanguageChanged);
        setCurrentLang(i18n.language || "en");

        return () => {
            i18n.off("languageChanged", handleLanguageChanged);
        };
    }, [i18n]);

    const languages = [
        { code: "en", label: "EN", fullLabel: "English" },
        { code: "vi", label: "VI", fullLabel: "Tiếng Việt" },
    ];

    const currentLanguage = languages.find((lang) => lang.code === currentLang) || languages[0];

    if (!ready) {
        return (
            <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled
            >
                <Globe className="w-4 h-4" />
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title={currentLanguage.fullLabel}
                >
                    <Globe className="w-4 h-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[140px]">
                {languages.map((lang) => (
                    <DropdownMenuItem
                        key={lang.code}
                        onClick={() => {
                            i18n.changeLanguage(lang.code);
                        }}
                        className={cn(
                            "text-[11px] cursor-pointer",
                            currentLang === lang.code && "bg-accent"
                        )}
                    >
                        <span className="font-medium mr-2">{lang.label}</span>
                        <span className="text-muted-foreground">{lang.fullLabel}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
