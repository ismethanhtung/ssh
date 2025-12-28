import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import {
    Terminal,
    Plus,
    FolderTree,
    Zap,
    Server,
    FileText,
    BookOpen,
    Settings,
} from "lucide-react";
import { Separator } from "./ui/separator";

interface WelcomeScreenProps {
    onNewSession: () => void;
    onOpenSettings: () => void;
}

export function WelcomeScreen({
    onNewSession,
    onOpenSettings,
}: WelcomeScreenProps) {
    const { t } = useTranslation();

    const quickActions = [
        {
            icon: Plus,
            title: t("welcome.newSession"),
            description: t("welcome.connectDescription"),
            action: onNewSession,
            variant: "default" as const,
            shortcut: "Ctrl+N",
        },
        {
            icon: FolderTree,
            title: t("welcome.sessionManager"),
            description: t("welcome.organizeDescription"),
            action: () => {},
            variant: "outline" as const,
            highlight: t("welcome.sidebarHint"),
        },
        {
            icon: Settings,
            title: t("welcome.settings"),
            description: t("welcome.configureDescription"),
            action: onOpenSettings,
            variant: "outline" as const,
            shortcut: "Ctrl+,",
        },
    ];

    const protocols = [
        {
            name: "SSH",
            color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        },
        {
            name: "SFTP",
            color: "bg-green-500/10 text-green-500 border-green-500/20",
        },
        {
            name: "Telnet",
            color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        },
        {
            name: "Serial",
            color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
        },
    ];

    return (
        <div className="h-full overflow-auto">
            <div className="max-w-5xl w-full mx-auto p-6 space-y-6">
                {/* Hero Section */}
                <div className="text-center space-y-3">
                    <div className="flex items-center justify-center gap-3">
                        <div className="p-2.5 bg-muted rounded-lg">
                            <Terminal className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold">
                                {t("app.welcome")}
                            </h1>
                        </div>
                    </div>

                    {/* Supported Protocols */}
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                            {t("welcome.supports")}:
                        </span>
                        {protocols.map((protocol) => (
                            <span
                                key={protocol.name}
                                className="text-xs border px-2 py-1 rounded"
                            >
                                {protocol.name}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
