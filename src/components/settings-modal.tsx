import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { LanguageSwitcher } from "./language-switcher";
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
    const { t } = useTranslation();
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
        newSession: "Cmd+N",
        closeSession: "Cmd+W",
        nextTab: "Cmd+Tab",
        previousTab: "Cmd+Shift+Tab",
        settings: "Cmd+,",
        tab: "Cmd+T",

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
                newSession: "Cmd+N",
                closeSession: "Cmd+W",
                nextTab: "Cmd+Tab",
                previousTab: "Cmd+Shift+Tab",
                settings: "Cmd+,",
                tab: "Cmd+T",
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
            label: t("settings.terminal"),
            icon: Terminal,
        },
        {
            id: "connection",
            label: t("settings.connection"),
            icon: Globe,
        },
        {
            id: "security",
            label: t("settings.security"),
            icon: Shield,
        },
        {
            id: "interface",
            label: t("settings.interface"),
            icon: Monitor,
        },
        {
            id: "keyboard",
            label: t("settings.keyboard"),
            icon: Keyboard,
        },
        {
            id: "advanced",
            label: t("settings.advanced"),
            icon: SettingsIcon,
        },
    ];

    // Compact styles matching ConnectionDialog
    const inputClassName =
        "h-8 !text-[12px] !font-normal bg-background/40 border-border/40 focus:border-primary/40 focus:bg-background/80 transition-all placeholder:text-muted-foreground/40";
    const labelClassName =
        "text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-1.5 block";
    const selectTriggerClassName =
        "h-8 text-[11px] font-medium bg-background/40 border-border/40 transition-all hover:bg-background/60 shadow-none";
    const sectionTitleClassName =
        "text-[11px] font-bold text-foreground/90 uppercase tracking-wider mb-0.5";
    const sectionDescClassName =
        "text-[10px] text-muted-foreground/60 leading-relaxed";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[620px] h-[75vh] max-h-[630px] overflow-hidden p-0 gap-0 flex flex-col border border-border/50">
                <div className="flex flex-col flex-1 min-h-0">
                    {/* Compact Header */}
                    <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                        <div>
                            <DialogTitle className="text-sm font-semibold py-1">
                                Settings - Something went wrong
                            </DialogTitle>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                        {/* Compact Sidebar Navigation */}
                        <div className="w-40 border-r border-border/40 bg-muted/10 flex flex-col shrink-0">
                            <ScrollArea className="flex-1">
                                <nav className="p-2 space-y-0.5">
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
                                                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[11px] font-semibold",
                                                    activeCategory ===
                                                        category.id
                                                        ? "bg-background text-primary border border-border/40"
                                                        : "text-muted-foreground/70 hover:bg-background/50 hover:text-foreground"
                                                )}
                                            >
                                                <Icon className="h-3.5 w-3.5 shrink-0" />
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
                                <div className="p-4">
                                    {/* Terminal Settings */}
                                    {activeCategory === "terminal" && (
                                        <ScrollArea className="h-[500px]">
                                            <div className="space-y-4 pr-3 pb-2">
                                                {/* Typography Section */}
                                                <div className="space-y-3">
                                                    <div>
                                                        <h3
                                                            className={
                                                                sectionTitleClassName
                                                            }
                                                        >
                                                            Typography
                                                        </h3>
                                                        <p
                                                            className={
                                                                sectionDescClassName
                                                            }
                                                        >
                                                            Customize fonts and
                                                            readability
                                                        </p>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <Label
                                                                className={
                                                                    labelClassName
                                                                }
                                                            >
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
                                                                <SelectTrigger
                                                                    className={
                                                                        selectTriggerClassName
                                                                    }
                                                                >
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
                                                                    <SelectItem
                                                                        value="Menlo, Monaco, 'Courier New', monospace"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Menlo
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="'JetBrains Mono', monospace"
                                                                        className="text-[10px]"
                                                                    >
                                                                        JetBrains
                                                                        Mono
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="'Fira Code', monospace"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Fira
                                                                        Code
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="'Source Code Pro', monospace"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Source
                                                                        Code Pro
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="Consolas, monospace"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Consolas
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="Monaco, monospace"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Monaco
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="'Courier New', monospace"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Courier
                                                                        New
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <Label
                                                                    className={
                                                                        labelClassName
                                                                    }
                                                                >
                                                                    Font Size
                                                                </Label>
                                                                <span className="text-[10px] font-mono text-muted-foreground/60">
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
                                                                className="h-1.5"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <Label
                                                                    className={
                                                                        labelClassName
                                                                    }
                                                                >
                                                                    Line Height
                                                                </Label>
                                                                <span className="text-[10px] font-mono text-muted-foreground/60">
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
                                                                className="h-1.5"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <Label
                                                                    className={
                                                                        labelClassName
                                                                    }
                                                                >
                                                                    Letter
                                                                    Spacing
                                                                </Label>
                                                                <span className="text-[10px] font-mono text-muted-foreground/60">
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
                                                                className="h-1.5"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <Separator className="my-1 bg-border/30" />

                                                {/* Appearance Section */}
                                                <div className="space-y-3">
                                                    <div>
                                                        <h3
                                                            className={
                                                                sectionTitleClassName
                                                            }
                                                        >
                                                            Appearance
                                                        </h3>
                                                        <p
                                                            className={
                                                                sectionDescClassName
                                                            }
                                                        >
                                                            Visual style and
                                                            terminal behavior
                                                        </p>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="space-y-1.5">
                                                            <Label
                                                                className={
                                                                    labelClassName
                                                                }
                                                            >
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
                                                                <SelectTrigger
                                                                    className={
                                                                        selectTriggerClassName
                                                                    }
                                                                >
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem
                                                                        value="vs-code-dark"
                                                                        className="text-[10px]"
                                                                    >
                                                                        VS Code
                                                                        Dark
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="monokai"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Monokai
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="solarized-dark"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Solarized
                                                                        Dark
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="solarized-light"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Solarized
                                                                        Light
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="dracula"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Dracula
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="one-dark"
                                                                        className="text-[10px]"
                                                                    >
                                                                        One Dark
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="nord"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Nord
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="gruvbox-dark"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Gruvbox
                                                                        Dark
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="tokyo-night"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Tokyo
                                                                        Night
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="matrix"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Matrix
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <Label
                                                                className={
                                                                    labelClassName
                                                                }
                                                            >
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
                                                                <SelectTrigger
                                                                    className={
                                                                        selectTriggerClassName
                                                                    }
                                                                >
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem
                                                                        value="block"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Block
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="underline"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Underline
                                                                    </SelectItem>
                                                                    <SelectItem
                                                                        value="bar"
                                                                        className="text-[10px]"
                                                                    >
                                                                        Bar
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="flex items-center justify-between py-1">
                                                            <div className="flex-1">
                                                                <Label className="text-[11px] font-semibold text-foreground/90 mb-0.5 block">
                                                                    Cursor
                                                                    Blinking
                                                                </Label>
                                                                <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
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

                                                        <div className="flex items-center justify-between py-1">
                                                            <div className="flex-1">
                                                                <Label className="text-[11px] font-semibold text-foreground/90 mb-0.5 block">
                                                                    Background
                                                                    Transparency
                                                                </Label>
                                                                <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
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
                                                            <div className="space-y-2 pl-0">
                                                                <div className="flex items-center justify-between">
                                                                    <Label
                                                                        className={
                                                                            labelClassName
                                                                        }
                                                                    >
                                                                        Opacity
                                                                    </Label>
                                                                    <span className="text-[10px] font-mono text-muted-foreground/60">
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
                                                                    className="h-1.5"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <Separator />

                                                {/* Terminal Preview */}
                                                <div className="space-y-3">
                                                    <div>
                                                        <h3
                                                            className={
                                                                sectionTitleClassName
                                                            }
                                                        >
                                                            Preview
                                                        </h3>
                                                        <p
                                                            className={
                                                                sectionDescClassName
                                                            }
                                                        >
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
                                        <div className="space-y-4">
                                            <div className="space-y-3">
                                                <div className="space-y-1.5">
                                                    <Label
                                                        className={
                                                            labelClassName
                                                        }
                                                    >
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
                                                        <SelectTrigger
                                                            className={
                                                                selectTriggerClassName
                                                            }
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem
                                                                value="SSH"
                                                                className="text-[10px]"
                                                            >
                                                                SSH
                                                            </SelectItem>
                                                            <SelectItem
                                                                value="Telnet"
                                                                className="text-[10px]"
                                                            >
                                                                Telnet
                                                            </SelectItem>
                                                            <SelectItem
                                                                value="Raw"
                                                                className="text-[10px]"
                                                            >
                                                                Raw
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* Connection Timeout */}
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label
                                                                className={
                                                                    labelClassName
                                                                }
                                                            >
                                                                Connection
                                                                Timeout
                                                            </Label>
                                                            <span className="text-[10px] font-mono text-muted-foreground/60">
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
                                                            className="h-1.5"
                                                        />
                                                    </div>
                                                    {/* Keep Alive Interval */}
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label
                                                                className={
                                                                    labelClassName
                                                                }
                                                            >
                                                                Keep Alive
                                                                Interval
                                                            </Label>
                                                            <span className="text-[10px] font-mono text-muted-foreground/60">
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
                                                            className="h-1.5"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between py-1">
                                                    <div className="flex-1">
                                                        <Label className="text-[11px] font-semibold text-foreground/90 mb-0.5 block">
                                                            Auto Reconnect
                                                        </Label>
                                                        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
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
                                        <div className="space-y-4">
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between py-1">
                                                    <div className="flex-1">
                                                        <Label className="text-[11px] font-semibold text-foreground/90 mb-0.5 block">
                                                            Host Key
                                                            Verification
                                                        </Label>
                                                        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
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

                                                <Separator className="my-1 bg-border/30" />

                                                <div className="flex items-center justify-between py-1">
                                                    <div className="flex-1">
                                                        <Label className="text-[11px] font-semibold text-foreground/90 mb-0.5 block">
                                                            Save Passwords
                                                        </Label>
                                                        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
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

                                                <Separator className="my-1 bg-border/30" />

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label
                                                            className={
                                                                labelClassName
                                                            }
                                                        >
                                                            Auto-Lock Timeout
                                                        </Label>
                                                        <span className="text-[10px] font-mono text-muted-foreground/60">
                                                            {
                                                                settings.autoLockTimeout
                                                            }{" "}
                                                            min
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
                                                        className="h-1.5"
                                                    />
                                                    <p className="text-[9px] text-muted-foreground/50 leading-relaxed mt-1">
                                                        Automatically lock after
                                                        inactivity
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Interface Settings */}
                                    {activeCategory === "interface" && (
                                        <div className="space-y-4">
                                            <div className="space-y-3">
                                                <div className="space-y-1.5">
                                                    <Label
                                                        className={
                                                            labelClassName
                                                        }
                                                    >
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
                                                        <SelectTrigger
                                                            className={
                                                                selectTriggerClassName
                                                            }
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem
                                                                value="dark"
                                                                className="text-[10px]"
                                                            >
                                                                {t(
                                                                    "theme.dark"
                                                                )}
                                                            </SelectItem>
                                                            <SelectItem
                                                                value="light"
                                                                className="text-[10px]"
                                                            >
                                                                {t(
                                                                    "theme.light"
                                                                )}
                                                            </SelectItem>
                                                            <SelectItem
                                                                value="auto"
                                                                className="text-[10px]"
                                                            >
                                                                {t(
                                                                    "theme.system"
                                                                )}
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label
                                                        className={
                                                            labelClassName
                                                        }
                                                    >
                                                        {t("settings.theme")}
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
                                                            className="w-10 h-8 p-0.5 border rounded cursor-pointer"
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
                                                            className={cn(
                                                                inputClassName,
                                                                "font-mono flex-1"
                                                            )}
                                                        />
                                                    </div>
                                                    <p className="text-[9px] text-muted-foreground/50 leading-relaxed mt-0.5">
                                                        {t("settings.theme")}
                                                    </p>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label
                                                        className={
                                                            labelClassName
                                                        }
                                                    >
                                                        {t("settings.language")}
                                                    </Label>
                                                    <LanguageSwitcher />
                                                </div>

                                                <Separator className="my-1 bg-border/30" />

                                                <div className="space-y-3">
                                                    <Label className="text-[11px] font-semibold text-foreground/90 uppercase tracking-wider">
                                                        Panel Visibility
                                                    </Label>

                                                    <div className="flex items-center justify-between py-0.5">
                                                        <span className="text-[11px] text-foreground/80">
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
                                                        <span className="text-[11px] text-foreground/80">
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

                                                    <div className="flex items-center justify-between py-0.5">
                                                        <span className="text-[11px] text-foreground/80">
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

                                                <Separator className="my-1 bg-border/30" />

                                                <div className="flex items-center justify-between py-1">
                                                    <div className="flex-1">
                                                        <Label className="text-[11px] font-semibold text-foreground/90 mb-0.5 block">
                                                            Enable Notifications
                                                        </Label>
                                                        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
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
                                        <div className="space-y-4">
                                            <div className="space-y-3">
                                                <div>
                                                    <h3 className="text-[11px] font-bold text-foreground/90 uppercase tracking-wider mb-0.5">
                                                        Keyboard Shortcuts
                                                    </h3>
                                                    <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                                                        Customize keyboard
                                                        shortcuts for common
                                                        actions
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <Label
                                                            className={
                                                                labelClassName
                                                            }
                                                        >
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
                                                            placeholder="Cmd+N"
                                                            className={cn(
                                                                inputClassName,
                                                                "font-mono text-center"
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label
                                                            className={
                                                                labelClassName
                                                            }
                                                        >
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
                                                            placeholder="Cmd+W"
                                                            className={cn(
                                                                inputClassName,
                                                                "font-mono text-center"
                                                            )}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <Label
                                                            className={
                                                                labelClassName
                                                            }
                                                        >
                                                            Settings
                                                        </Label>
                                                        <Input
                                                            value={
                                                                settings.settings
                                                            }
                                                            onChange={(e) =>
                                                                updateSetting(
                                                                    "settings",
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="Cmd+,"
                                                            className={cn(
                                                                inputClassName,
                                                                "font-mono text-center"
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label
                                                            className={
                                                                labelClassName
                                                            }
                                                        >
                                                            Tab
                                                        </Label>
                                                        <Input
                                                            value={settings.tab}
                                                            onChange={(e) =>
                                                                updateSetting(
                                                                    "tab",
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="Cmd+1/2/3..."
                                                            className={cn(
                                                                inputClassName,
                                                                "font-mono text-center"
                                                            )}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                                                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                                                        <strong className="text-foreground/90 font-semibold">
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
                                        <div className="space-y-4">
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <Label
                                                            className={
                                                                labelClassName
                                                            }
                                                        >
                                                            Log Level
                                                        </Label>
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
                                                            <SelectTrigger
                                                                className={
                                                                    selectTriggerClassName
                                                                }
                                                            >
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem
                                                                    value="error"
                                                                    className="text-[10px]"
                                                                >
                                                                    Error
                                                                </SelectItem>
                                                                <SelectItem
                                                                    value="warn"
                                                                    className="text-[10px]"
                                                                >
                                                                    Warning
                                                                </SelectItem>
                                                                <SelectItem
                                                                    value="info"
                                                                    className="text-[10px]"
                                                                >
                                                                    Info
                                                                </SelectItem>
                                                                <SelectItem
                                                                    value="debug"
                                                                    className="text-[10px]"
                                                                >
                                                                    Debug
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label
                                                                className={
                                                                    labelClassName
                                                                }
                                                            >
                                                                Max Log Size
                                                            </Label>
                                                            <span className="text-[10px] font-mono text-muted-foreground/60">
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
                                                            className="h-1.5"
                                                        />
                                                    </div>
                                                </div>

                                                <Separator className="my-1 bg-border/30" />

                                                <div className="flex items-center justify-between py-1">
                                                    <div className="flex-1">
                                                        <Label className="text-[11px] font-semibold text-foreground/90 mb-0.5 block">
                                                            Check for Updates
                                                        </Label>
                                                        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
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

                                                <div className="flex items-center justify-between py-1">
                                                    <div className="flex-1">
                                                        <Label className="text-[11px] font-semibold text-foreground/90 mb-0.5 block">
                                                            Enable Telemetry
                                                        </Label>
                                                        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
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

                    {/* Compact Footer */}
                    <div className="flex items-center justify-between border-t border-border/50 bg-muted/10 px-4 py-3">
                        <button
                            onClick={handleReset}
                            className="text-[11px] text-muted-foreground/70 hover:text-foreground underline-offset-4 transition-colors font-medium"
                        >
                            Reset to Defaults (Upcoming)
                        </button>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="h-8 text-[11px] px-3"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                className="h-8 min-w-[120px] text-[11px] px-4"
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
