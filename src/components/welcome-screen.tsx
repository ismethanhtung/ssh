import React from "react";
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
    const quickActions = [
        {
            icon: Plus,
            title: "New Session",
            description: "Connect to a remote server",
            action: onNewSession,
            variant: "default" as const,
            shortcut: "Ctrl+N",
        },
        {
            icon: FolderTree,
            title: "Session Manager",
            description: "Organize your connections",
            action: () => {},
            variant: "outline" as const,
            highlight: "Use the left sidebar →",
        },
        {
            icon: Settings,
            title: "Settings",
            description: "Configure your preferences",
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
                                Welcome to SSH Client
                            </h1>
                        </div>
                    </div>

                    {/* Supported Protocols */}
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                            Supports:
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

                {/* Quick Actions */}
                <div className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Quick Actions
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Get started with a new session or configure your
                            workspace
                        </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                        {quickActions.map((action, index) => (
                            <div
                                key={index}
                                className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors"
                                onClick={action.action}
                            >
                                <div className="flex flex-col items-center text-center space-y-2">
                                    <div className="p-2 bg-muted rounded-lg">
                                        <action.icon className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-sm mb-0.5">
                                            {action.title}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            {action.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
