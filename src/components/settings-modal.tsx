import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import { Slider } from "./ui/slider";
import { ScrollArea } from "./ui/scroll-area";
import {
    Terminal,
    Globe,
    Shield,
    Monitor,
    Keyboard,
    Settings as SettingsIcon,
} from "lucide-react";
import {
    TerminalAppearanceSettings,
    defaultAppearanceSettings,
    loadAppearanceSettings,
    saveAppearanceSettings,
    terminalThemes,
} from "../lib/terminal-config";
import { cn } from "./ui/utils";

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAppearanceChange?: (settings: TerminalAppearanceSettings) => void;
}

export function SettingsModal({
    open,
    onOpenChange,
    onAppearanceChange,
}: SettingsModalProps) {
    const [terminalAppearance, setTerminalAppearance] =
        useState<TerminalAppearanceSettings>(defaultAppearanceSettings);

    const [settings, setSettings] = useState({
        // Terminal settings
        fontSize: 14,
        fontFamily: "JetBrains Mono",
        colorScheme: "dark",
        cursorStyle: "block",
        scrollbackLines: 10000,

        // Connection settings
        defaultProtocol: "SSH",
        connectionTimeout: 30,
        keepAliveInterval: 60,
        autoReconnect: true,

        // Security settings
        hostKeyVerification: true,
        savePasswords: false,
        autoLockTimeout: 30,

        // Interface settings
        theme: "dark",
        darkBackgroundColor: "#1a1b26",
        showSessionManager: true,
        showSystemMonitor: true,
        showStatusBar: true,
        enableNotifications: true,

        // Keyboard shortcuts
        newSession: "Ctrl+N",
        closeSession: "Ctrl+W",
        nextTab: "Ctrl+Tab",
        previousTab: "Ctrl+Shift+Tab",

        // Advanced settings
        logLevel: "info",
        maxLogSize: 100,
        checkUpdates: true,
        telemetry: false,
    });

    // Load settings when modal opens
    useEffect(() => {
        if (open) {
            const appearance = loadAppearanceSettings();
            setTerminalAppearance(appearance);

            // Load settings from localStorage
            const savedSettings = localStorage.getItem("sshClientSettings");
            if (savedSettings) {
                try {
                    const parsedSettings = JSON.parse(savedSettings);
                    setSettings((prev) => ({ ...prev, ...parsedSettings }));

                    // Apply dark background color immediately
                    if (parsedSettings.darkBackgroundColor) {
                        document.documentElement.style.setProperty(
                            "--dark-background",
                            parsedSettings.darkBackgroundColor
                        );
                    }
                } catch (e) {
                    console.warn("Failed to parse saved settings:", e);
                }
            }
        }
    }, [open]);

    const updateTerminalAppearance = <
        K extends keyof TerminalAppearanceSettings
    >(
        key: K,
        value: TerminalAppearanceSettings[K]
    ) => {
        setTerminalAppearance((prev) => ({ ...prev, [key]: value }));
    };

    const updateSetting = (key: keyof typeof settings, value: any) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        // Save terminal appearance settings
        saveAppearanceSettings(terminalAppearance);

        // Notify parent component of appearance changes
        if (onAppearanceChange) {
            onAppearanceChange(terminalAppearance);
        }

        // Save other settings to localStorage
        localStorage.setItem("sshClientSettings", JSON.stringify(settings));

        // Apply dark background color to CSS
        document.documentElement.style.setProperty(
            "--dark-background",
            settings.darkBackgroundColor
        );

        onOpenChange(false);
    };

    const handleReset = () => {
        if (
            confirm("Are you sure you want to reset all settings to defaults?")
        ) {
            // Reset terminal appearance
            const defaultAppearance = defaultAppearanceSettings;
            setTerminalAppearance(defaultAppearance);
            saveAppearanceSettings(defaultAppearance);

            // Reset other settings to default values
            const defaultSettings = {
                fontSize: 14,
                fontFamily: "JetBrains Mono",
                colorScheme: "dark",
                cursorStyle: "block",
                scrollbackLines: 10000,
                defaultProtocol: "SSH",
                connectionTimeout: 30,
                keepAliveInterval: 60,
                autoReconnect: true,
                hostKeyVerification: true,
                savePasswords: false,
                autoLockTimeout: 30,
                theme: "dark",
                darkBackgroundColor: "#1a1b26",
                showSessionManager: true,
                showSystemMonitor: true,
                showStatusBar: true,
                enableNotifications: true,
                newSession: "Ctrl+N",
                closeSession: "Ctrl+W",
                nextTab: "Ctrl+Tab",
                previousTab: "Ctrl+Shift+Tab",
                logLevel: "info",
                maxLogSize: 100,
                checkUpdates: true,
                telemetry: false,
            };
            setSettings(defaultSettings);

            // Save to localStorage
            localStorage.setItem(
                "sshClientSettings",
                JSON.stringify(defaultSettings)
            );

            // Apply dark background color immediately
            document.documentElement.style.setProperty(
                "--dark-background",
                defaultSettings.darkBackgroundColor
            );

            // Notify parent component of appearance changes
            if (onAppearanceChange) {
                onAppearanceChange(defaultAppearance);
            }
        }
    };

    const [activeCategory, setActiveCategory] = useState("terminal");

    const categories = [
        {
            id: "terminal",
            label: "Terminal",
            icon: Terminal,
        },
        {
            id: "connection",
            label: "Connection",
            icon: Globe,
        },
        {
            id: "security",
            label: "Security",
            icon: Shield,
        },
        {
            id: "interface",
            label: "Interface",
            icon: Monitor,
        },
        {
            id: "keyboard",
            label: "Keyboard",
            icon: Keyboard,
        },
        {
            id: "advanced",
            label: "Advanced",
            icon: SettingsIcon,
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[750px] h-[70vh] max-h-[650px] overflow-hidden p-0 gap-0 flex flex-col">
                <div className="flex flex-col flex-1 min-h-0">
                    {/* Header */}
                    <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b">
                        <div>
                            <DialogTitle className="text-2xl font-semibold mb-1">
                                Settings
                            </DialogTitle>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                        {/* Sidebar Navigation */}
                        <div className="w-48 border-r bg-muted/30 flex flex-col shrink-0">
                            <ScrollArea className="flex-1">
                                <nav className="p-2 space-y-1">
                                    {categories.map((category) => {
                                        const Icon = category.icon;
                                        return (
                                            <button
                                                key={category.id}
                                                onClick={() =>
                                                    setActiveCategory(
                                                        category.id
                                                    )
                                                }
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                                                    activeCategory ===
                                                        category.id
                                                        ? "bg-slate-800 text-primary-foreground shadow-sm"
                                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                )}
                                            >
                                                <Icon className="h-4 w-4 shrink-0" />
                                                <span>{category.label}</span>
                                            </button>
                                        );
                                    })}
                                </nav>
                            </ScrollArea>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                            <ScrollArea className="flex-1">
                                <div className="p-5">
                                    {/* Terminal Settings */}
                                    {activeCategory === "terminal" && (
                                        <ScrollArea className="h-[500px]">
                                            <div className="space-y-6 pr-4">
                                                {/* Typography Section */}
                                                <div className="space-y-4">
                                                    <div>
                                                        <h3 className="text-base font-semibold mb-1">
                                                            Typography
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground">
                                                            Customize fonts and
                                                            readability
                                                        </p>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div className="space-y-2">
                                                            <Label>
                                                                Font Family
                                                            </Label>
                                                            <Select
                                                                value={
                                                                    terminalAppearance.fontFamily
                                                                }
                                                                onValueChange={(
                                                                    value
                                                                ) =>
                                                                    updateTerminalAppearance(
                                                                        "fontFamily",
                                                                        value
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue>
                                                                        {{
                                                                            "Menlo, Monaco, 'Courier New', monospace":
                                                                                "Menlo",
                                                                            "'JetBrains Mono', monospace":
                                                                                "JetBrains Mono",
                                                                            "'Fira Code', monospace":
                                                                                "Fira Code",
                                                                            "'Source Code Pro', monospace":
                                                                                "Source Code Pro",
                                                                            "Consolas, monospace":
                                                                                "Consolas",
                                                                            "Monaco, monospace":
                                                                                "Monaco",
                                                                            "'Courier New', monospace":
                                                                                "Courier New",
                                                                        }[
                                                                            terminalAppearance
                                                                                .fontFamily
                                                                        ] ||
                                                                            "Select font"}
                                                                    </SelectValue>
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="Menlo, Monaco, 'Courier New', monospace">
                                                                        Menlo
                                                                    </SelectItem>
                                                                    <SelectItem value="'JetBrains Mono', monospace">
                                                                        JetBrains
                                                                        Mono
                                                                    </SelectItem>
                                                                    <SelectItem value="'Fira Code', monospace">
                                                                        Fira
                                                                        Code
                                                                    </SelectItem>
                                                                    <SelectItem value="'Source Code Pro', monospace">
                                                                        Source
                                                                        Code Pro
                                                                    </SelectItem>
                                                                    <SelectItem value="Consolas, monospace">
                                                                        Consolas
                                                                    </SelectItem>
                                                                    <SelectItem value="Monaco, monospace">
                                                                        Monaco
                                                                    </SelectItem>
                                                                    <SelectItem value="'Courier New', monospace">
                                                                        Courier
                                                                        New
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-sm font-medium">
                                                                    Font Size
                                                                </Label>
                                                                <span className="text-sm text-muted-foreground">
                                                                    {
                                                                        terminalAppearance.fontSize
                                                                    }
                                                                    px
                                                                </span>
                                                            </div>
                                                            <Slider
                                                                value={[
                                                                    terminalAppearance.fontSize,
                                                                ]}
                                                                onValueChange={([
                                                                    value,
                                                                ]) =>
                                                                    updateTerminalAppearance(
                                                                        "fontSize",
                                                                        value
                                                                    )
                                                                }
                                                                min={8}
                                                                max={32}
                                                                step={1}
                                                            />
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-sm font-medium">
                                                                    Line Height
                                                                </Label>
                                                                <span className="text-sm text-muted-foreground">
                                                                    {
                                                                        terminalAppearance.lineHeight
                                                                    }
                                                                </span>
                                                            </div>
                                                            <Slider
                                                                value={[
                                                                    terminalAppearance.lineHeight,
                                                                ]}
                                                                onValueChange={([
                                                                    value,
                                                                ]) =>
                                                                    updateTerminalAppearance(
                                                                        "lineHeight",
                                                                        value
                                                                    )
                                                                }
                                                                min={1.0}
                                                                max={2.0}
                                                                step={0.1}
                                                            />
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-sm font-medium">
                                                                    Letter
                                                                    Spacing
                                                                </Label>
                                                                <span className="text-sm text-muted-foreground">
                                                                    {
                                                                        terminalAppearance.letterSpacing
                                                                    }
                                                                    px
                                                                </span>
                                                            </div>
                                                            <Slider
                                                                value={[
                                                                    terminalAppearance.letterSpacing,
                                                                ]}
                                                                onValueChange={([
                                                                    value,
                                                                ]) =>
                                                                    updateTerminalAppearance(
                                                                        "letterSpacing",
                                                                        value
                                                                    )
                                                                }
                                                                min={-2}
                                                                max={5}
                                                                step={0.5}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <Separator />

                                                {/* Appearance Section */}
                                                <div className="space-y-5">
                                                    <div>
                                                        <h3 className="text-base font-semibold mb-1">
                                                            Appearance
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground">
                                                            Visual style and
                                                            terminal behavior
                                                        </p>
                                                    </div>

                                                    <div className="space-y-5">
                                                        <div className="space-y-2">
                                                            <Label>
                                                                Color Theme
                                                            </Label>
                                                            <Select
                                                                value={
                                                                    terminalAppearance.theme
                                                                }
                                                                onValueChange={(
                                                                    value
                                                                ) =>
                                                                    updateTerminalAppearance(
                                                                        "theme",
                                                                        value
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="vs-code-dark">
                                                                        VS Code
                                                                        Dark
                                                                    </SelectItem>
                                                                    <SelectItem value="monokai">
                                                                        Monokai
                                                                    </SelectItem>
                                                                    <SelectItem value="solarized-dark">
                                                                        Solarized
                                                                        Dark
                                                                    </SelectItem>
                                                                    <SelectItem value="solarized-light">
                                                                        Solarized
                                                                        Light
                                                                    </SelectItem>
                                                                    <SelectItem value="dracula">
                                                                        Dracula
                                                                    </SelectItem>
                                                                    <SelectItem value="one-dark">
                                                                        One Dark
                                                                    </SelectItem>
                                                                    <SelectItem value="nord">
                                                                        Nord
                                                                    </SelectItem>
                                                                    <SelectItem value="gruvbox-dark">
                                                                        Gruvbox
                                                                        Dark
                                                                    </SelectItem>
                                                                    <SelectItem value="tokyo-night">
                                                                        Tokyo
                                                                        Night
                                                                    </SelectItem>
                                                                    <SelectItem value="matrix">
                                                                        Matrix
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label>
                                                                Cursor Style
                                                            </Label>
                                                            <Select
                                                                value={
                                                                    terminalAppearance.cursorStyle
                                                                }
                                                                onValueChange={(
                                                                    value:
                                                                        | "block"
                                                                        | "underline"
                                                                        | "bar"
                                                                ) =>
                                                                    updateTerminalAppearance(
                                                                        "cursorStyle",
                                                                        value
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="block">
                                                                        Block
                                                                    </SelectItem>
                                                                    <SelectItem value="underline">
                                                                        Underline
                                                                    </SelectItem>
                                                                    <SelectItem value="bar">
                                                                        Bar
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <Label className="text-sm font-medium mb-1">
                                                                    Cursor
                                                                    Blinking
                                                                </Label>
                                                                <p className="text-sm text-muted-foreground">
                                                                    Enable
                                                                    smooth
                                                                    animation
                                                                    for the
                                                                    cursor
                                                                </p>
                                                            </div>
                                                            <Switch
                                                                checked={
                                                                    terminalAppearance.cursorBlink
                                                                }
                                                                onCheckedChange={(
                                                                    checked
                                                                ) =>
                                                                    updateTerminalAppearance(
                                                                        "cursorBlink",
                                                                        checked
                                                                    )
                                                                }
                                                            />
                                                        </div>

                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <Label className="text-sm font-medium mb-1">
                                                                    Background
                                                                    Transparency
                                                                </Label>
                                                                <p className="text-sm text-muted-foreground">
                                                                    Allow
                                                                    terminal
                                                                    window to be
                                                                    semi-transparent
                                                                </p>
                                                            </div>
                                                            <Switch
                                                                checked={
                                                                    terminalAppearance.allowTransparency
                                                                }
                                                                onCheckedChange={(
                                                                    checked
                                                                ) =>
                                                                    updateTerminalAppearance(
                                                                        "allowTransparency",
                                                                        checked
                                                                    )
                                                                }
                                                            />
                                                        </div>

                                                        {terminalAppearance.allowTransparency && (
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <Label className="text-sm font-medium">
                                                                        Opacity
                                                                    </Label>
                                                                    <span className="text-sm text-muted-foreground">
                                                                        {
                                                                            terminalAppearance.opacity
                                                                        }
                                                                        %
                                                                    </span>
                                                                </div>
                                                                <Slider
                                                                    value={[
                                                                        terminalAppearance.opacity,
                                                                    ]}
                                                                    onValueChange={([
                                                                        value,
                                                                    ]) =>
                                                                        updateTerminalAppearance(
                                                                            "opacity",
                                                                            value
                                                                        )
                                                                    }
                                                                    min={10}
                                                                    max={100}
                                                                    step={5}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <Separator />

                                                {/* Terminal Preview */}
                                                <div className="space-y-3">
                                                    <div>
                                                        <h3 className="text-base font-semibold mb-1">
                                                            Preview
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground">
                                                            See how your
                                                            terminal will look
                                                        </p>
                                                    </div>
                                                    <div className="rounded-lg border overflow-hidden">
                                                        <div
                                                            className="font-mono text-sm p-4 rounded transition-all"
                                                            style={{
                                                                fontFamily:
                                                                    terminalAppearance.fontFamily,
                                                                fontSize: `${terminalAppearance.fontSize}px`,
                                                                lineHeight:
                                                                    terminalAppearance.lineHeight,
                                                                letterSpacing: `${terminalAppearance.letterSpacing}px`,
                                                                backgroundColor:
                                                                    terminalThemes[
                                                                        terminalAppearance
                                                                            .theme
                                                                    ]
                                                                        ?.background ||
                                                                    "#1e1e1e",
                                                                color:
                                                                    terminalThemes[
                                                                        terminalAppearance
                                                                            .theme
                                                                    ]
                                                                        ?.foreground ||
                                                                    "#d4d4d4",
                                                                opacity:
                                                                    terminalAppearance.allowTransparency
                                                                        ? terminalAppearance.opacity /
                                                                          100
                                                                        : 1,
                                                            }}
                                                        >
                                                            <div
                                                                className="flex items-center gap-2 mb-2"
                                                                style={{
                                                                    color: terminalThemes[
                                                                        terminalAppearance
                                                                            .theme
                                                                    ]?.green,
                                                                }}
                                                            >
                                                                <span>
                                                                    user@host
                                                                </span>
                                                                <span
                                                                    style={{
                                                                        color: terminalThemes[
                                                                            terminalAppearance
                                                                                .theme
                                                                        ]
                                                                            ?.foreground,
                                                                    }}
                                                                >
                                                                    :
                                                                </span>
                                                                <span
                                                                    style={{
                                                                        color: terminalThemes[
                                                                            terminalAppearance
                                                                                .theme
                                                                        ]?.blue,
                                                                    }}
                                                                >
                                                                    ~/projects
                                                                </span>
                                                                <span
                                                                    style={{
                                                                        color: terminalThemes[
                                                                            terminalAppearance
                                                                                .theme
                                                                        ]
                                                                            ?.magenta,
                                                                    }}
                                                                >
                                                                    $
                                                                </span>
                                                                <span
                                                                    className={`${
                                                                        terminalAppearance.cursorBlink
                                                                            ? "animate-pulse"
                                                                            : ""
                                                                    } inline-block w-2 h-4 ml-1`}
                                                                    style={{
                                                                        backgroundColor:
                                                                            terminalThemes[
                                                                                terminalAppearance
                                                                                    .theme
                                                                            ]
                                                                                ?.foreground,
                                                                    }}
                                                                />
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color: terminalThemes[
                                                                        terminalAppearance
                                                                            .theme
                                                                    ]
                                                                        ?.foreground,
                                                                }}
                                                            >
                                                                $ ls -la
                                                            </div>
                                                            <div
                                                                className="mt-2"
                                                                style={{
                                                                    color: terminalThemes[
                                                                        terminalAppearance
                                                                            .theme
                                                                    ]?.blue,
                                                                }}
                                                            >
                                                                drwxr-xr-x
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color: terminalThemes[
                                                                        terminalAppearance
                                                                            .theme
                                                                    ]?.yellow,
                                                                }}
                                                            >
                                                                -rw-r--r--
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    )}

                                    {/* Connection Settings */}
                                    {activeCategory === "connection" && (
                                        <div className="space-y-5">
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label>
                                                        Default Protocol
                                                    </Label>
                                                    <Select
                                                        value={
                                                            settings.defaultProtocol
                                                        }
                                                        onValueChange={(
                                                            value
                                                        ) =>
                                                            updateSetting(
                                                                "defaultProtocol",
                                                                value
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="SSH">
                                                                SSH
                                                            </SelectItem>
                                                            <SelectItem value="Telnet">
                                                                Telnet
                                                            </SelectItem>
                                                            <SelectItem value="Raw">
                                                                Raw
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="flex gap-8">
                                                    {/* Connection Timeout */}
                                                    <div className="space-y-3 flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-sm font-medium">
                                                                Connection
                                                                Timeout
                                                            </Label>
                                                            <span className="text-sm text-muted-foreground">
                                                                {
                                                                    settings.connectionTimeout
                                                                }
                                                                s
                                                            </span>
                                                        </div>
                                                        <Slider
                                                            value={[
                                                                settings.connectionTimeout,
                                                            ]}
                                                            onValueChange={([
                                                                value,
                                                            ]) =>
                                                                updateSetting(
                                                                    "connectionTimeout",
                                                                    value
                                                                )
                                                            }
                                                            min={5}
                                                            max={120}
                                                            step={5}
                                                        />
                                                    </div>
                                                    {/* Keep Alive Interval */}
                                                    <div className="space-y-3 flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-sm font-medium">
                                                                Keep Alive
                                                                Interval
                                                            </Label>
                                                            <span className="text-sm text-muted-foreground">
                                                                {
                                                                    settings.keepAliveInterval
                                                                }
                                                                s
                                                            </span>
                                                        </div>
                                                        <Slider
                                                            value={[
                                                                settings.keepAliveInterval,
                                                            ]}
                                                            onValueChange={([
                                                                value,
                                                            ]) =>
                                                                updateSetting(
                                                                    "keepAliveInterval",
                                                                    value
                                                                )
                                                            }
                                                            min={30}
                                                            max={300}
                                                            step={30}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <Label className="text-sm font-medium mb-1">
                                                            Auto Reconnect
                                                        </Label>
                                                        <p className="text-sm text-muted-foreground">
                                                            Automatically
                                                            reconnect when
                                                            connection is lost
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        checked={
                                                            settings.autoReconnect
                                                        }
                                                        onCheckedChange={(
                                                            checked
                                                        ) =>
                                                            updateSetting(
                                                                "autoReconnect",
                                                                checked
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Security Settings */}
                                    {activeCategory === "security" && (
                                        <div className="space-y-5">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <Label className="text-sm font-medium mb-1">
                                                            Host Key
                                                            Verification
                                                        </Label>
                                                        <p className="text-sm text-muted-foreground">
                                                            Verify SSH host keys
                                                            for enhanced
                                                            security
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        checked={
                                                            settings.hostKeyVerification
                                                        }
                                                        onCheckedChange={(
                                                            checked
                                                        ) =>
                                                            updateSetting(
                                                                "hostKeyVerification",
                                                                checked
                                                            )
                                                        }
                                                    />
                                                </div>

                                                <Separator />

                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <Label className="text-sm font-medium mb-1">
                                                            Save Passwords
                                                        </Label>
                                                        <p className="text-sm text-muted-foreground">
                                                            Store passwords
                                                            locally (encrypted)
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        checked={
                                                            settings.savePasswords
                                                        }
                                                        onCheckedChange={(
                                                            checked
                                                        ) =>
                                                            updateSetting(
                                                                "savePasswords",
                                                                checked
                                                            )
                                                        }
                                                    />
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-sm font-medium">
                                                            Auto Lock Timeout
                                                        </Label>
                                                        <span className="text-sm text-muted-foreground">
                                                            {
                                                                settings.autoLockTimeout
                                                            }{" "}
                                                            minutes
                                                        </span>
                                                    </div>
                                                    <Slider
                                                        value={[
                                                            settings.autoLockTimeout,
                                                        ]}
                                                        onValueChange={([
                                                            value,
                                                        ]) =>
                                                            updateSetting(
                                                                "autoLockTimeout",
                                                                value
                                                            )
                                                        }
                                                        min={5}
                                                        max={120}
                                                        step={5}
                                                    />
                                                    <p className="text-sm text-muted-foreground">
                                                        Automatically lock the
                                                        application after this
                                                        period of inactivity
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Interface Settings */}
                                    {activeCategory === "interface" && (
                                        <div className="space-y-5">
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label>
                                                        Application Theme
                                                    </Label>
                                                    <Select
                                                        value={settings.theme}
                                                        onValueChange={(
                                                            value
                                                        ) =>
                                                            updateSetting(
                                                                "theme",
                                                                value
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="dark">
                                                                Dark (Very bad)
                                                            </SelectItem>
                                                            <SelectItem value="light">
                                                                Light
                                                            </SelectItem>
                                                            <SelectItem value="auto">
                                                                Auto (System)
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>
                                                        Dark Background Color
                                                    </Label>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="color"
                                                            value={
                                                                settings.darkBackgroundColor
                                                            }
                                                            onChange={(e) =>
                                                                updateSetting(
                                                                    "darkBackgroundColor",
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            className="w-12 h-8 p-1 border rounded"
                                                        />
                                                        <Input
                                                            value={
                                                                settings.darkBackgroundColor
                                                            }
                                                            onChange={(e) =>
                                                                updateSetting(
                                                                    "darkBackgroundColor",
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="#1a1b26"
                                                            className="flex-1"
                                                        />
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Customize the background
                                                        color for dark mode
                                                    </p>
                                                </div>

                                                <Separator />

                                                <div className="space-y-4">
                                                    <Label className="text-sm font-medium">
                                                        Panel Visibility
                                                    </Label>

                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm">
                                                            Session Manager
                                                        </span>
                                                        <Switch
                                                            checked={
                                                                settings.showSessionManager
                                                            }
                                                            onCheckedChange={(
                                                                checked
                                                            ) =>
                                                                updateSetting(
                                                                    "showSessionManager",
                                                                    checked
                                                                )
                                                            }
                                                        />
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm">
                                                            System Monitor
                                                        </span>
                                                        <Switch
                                                            checked={
                                                                settings.showSystemMonitor
                                                            }
                                                            onCheckedChange={(
                                                                checked
                                                            ) =>
                                                                updateSetting(
                                                                    "showSystemMonitor",
                                                                    checked
                                                                )
                                                            }
                                                        />
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm">
                                                            Status Bar
                                                        </span>
                                                        <Switch
                                                            checked={
                                                                settings.showStatusBar
                                                            }
                                                            onCheckedChange={(
                                                                checked
                                                            ) =>
                                                                updateSetting(
                                                                    "showStatusBar",
                                                                    checked
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </div>

                                                <Separator />

                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <Label className="text-sm font-medium mb-1">
                                                            Enable Notifications
                                                        </Label>
                                                        <p className="text-sm text-muted-foreground">
                                                            Show system
                                                            notifications for
                                                            important events
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        checked={
                                                            settings.enableNotifications
                                                        }
                                                        onCheckedChange={(
                                                            checked
                                                        ) =>
                                                            updateSetting(
                                                                "enableNotifications",
                                                                checked
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Keyboard Settings */}
                                    {activeCategory === "keyboard" && (
                                        <div className="space-y-5">
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>
                                                            New Session
                                                        </Label>
                                                        <Input
                                                            value={
                                                                settings.newSession
                                                            }
                                                            onChange={(e) =>
                                                                updateSetting(
                                                                    "newSession",
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="Ctrl+N"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>
                                                            Close Session
                                                        </Label>
                                                        <Input
                                                            value={
                                                                settings.closeSession
                                                            }
                                                            onChange={(e) =>
                                                                updateSetting(
                                                                    "closeSession",
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="Ctrl+W"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Next Tab</Label>
                                                        <Input
                                                            value={
                                                                settings.nextTab
                                                            }
                                                            onChange={(e) =>
                                                                updateSetting(
                                                                    "nextTab",
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="Ctrl+Tab"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>
                                                            Previous Tab
                                                        </Label>
                                                        <Input
                                                            value={
                                                                settings.previousTab
                                                            }
                                                            onChange={(e) =>
                                                                updateSetting(
                                                                    "previousTab",
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="Ctrl+Shift+Tab"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="rounded-lg border bg-muted/50 p-4">
                                                    <p className="text-sm text-muted-foreground">
                                                        <strong className="text-foreground">
                                                            Note:
                                                        </strong>{" "}
                                                        Changes to keyboard
                                                        shortcuts will take
                                                        effect after restarting
                                                        the application.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Advanced Settings */}
                                    {activeCategory === "advanced" && (
                                        <div className="space-y-5">
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Log Level</Label>
                                                        <Select
                                                            value={
                                                                settings.logLevel
                                                            }
                                                            onValueChange={(
                                                                value
                                                            ) =>
                                                                updateSetting(
                                                                    "logLevel",
                                                                    value
                                                                )
                                                            }
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="error">
                                                                    Error
                                                                </SelectItem>
                                                                <SelectItem value="warn">
                                                                    Warning
                                                                </SelectItem>
                                                                <SelectItem value="info">
                                                                    Info
                                                                </SelectItem>
                                                                <SelectItem value="debug">
                                                                    Debug
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-sm font-medium">
                                                                Max Log Size
                                                            </Label>
                                                            <span className="text-sm text-muted-foreground">
                                                                {
                                                                    settings.maxLogSize
                                                                }
                                                                MB
                                                            </span>
                                                        </div>
                                                        <Slider
                                                            value={[
                                                                settings.maxLogSize,
                                                            ]}
                                                            onValueChange={([
                                                                value,
                                                            ]) =>
                                                                updateSetting(
                                                                    "maxLogSize",
                                                                    value
                                                                )
                                                            }
                                                            min={10}
                                                            max={500}
                                                            step={10}
                                                        />
                                                    </div>
                                                </div>

                                                <Separator />

                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <Label className="text-sm font-medium mb-1">
                                                            Check for Updates
                                                        </Label>
                                                        <p className="text-sm text-muted-foreground">
                                                            Automatically check
                                                            for application
                                                            updates
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        checked={
                                                            settings.checkUpdates
                                                        }
                                                        onCheckedChange={(
                                                            checked
                                                        ) =>
                                                            updateSetting(
                                                                "checkUpdates",
                                                                checked
                                                            )
                                                        }
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <Label className="text-sm font-medium mb-1">
                                                            Enable Telemetry
                                                        </Label>
                                                        <p className="text-sm text-muted-foreground">
                                                            Help improve the
                                                            application by
                                                            sending anonymous
                                                            usage data
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        checked={
                                                            settings.telemetry
                                                        }
                                                        onCheckedChange={(
                                                            checked
                                                        ) =>
                                                            updateSetting(
                                                                "telemetry",
                                                                checked
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t px-5 py-3">
                        <button
                            onClick={handleReset}
                            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 transition-colors"
                        >
                            Reset to Defaults (Upcoming)
                        </button>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="text-sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                className="min-w-[140px] text-sm"
                            >
                                Apply Changes
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
