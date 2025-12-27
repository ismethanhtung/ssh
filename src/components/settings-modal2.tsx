import React, { useState, useEffect, useMemo } from "react";

export interface TerminalAppearanceSettings {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
    theme: string;
    cursorStyle: "block" | "underline" | "bar";
    cursorBlink: boolean;
    scrollback: number;
    allowTransparency: boolean;
    opacity: number;
}

export interface AppSettings {
    defaultProtocol: string;
    connectionTimeout: number;
    keepAliveInterval: number;
    autoReconnect: boolean;
    hostKeyVerification: boolean;
    savePasswords: boolean;
    autoLockTimeout: number;
    theme: "dark" | "light" | "auto";
    showSessionManager: boolean;
    showSystemMonitor: boolean;
    showStatusBar: boolean;
    enableNotifications: boolean;
    newSession: string;
    closeSession: string;
    nextTab: string;
    previousTab: string;
    logLevel: string;
    maxLogSize: number;
    checkUpdates: boolean;
    telemetry: boolean;
}

export interface ThemeColors {
    background: string;
    foreground: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
}

export const TERMINAL_THEMES: Record<string, ThemeColors> = {
    "vs-code-dark": {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        black: "#000000",
        red: "#f44747",
        green: "#6a9955",
        yellow: "#d7ba7d",
        blue: "#569cd6",
        magenta: "#c586c0",
        cyan: "#4ec9b0",
        white: "#d4d4d4",
    },
    "one-dark": {
        background: "#282c34",
        foreground: "#abb2bf",
        black: "#282c34",
        red: "#e06c75",
        green: "#98c379",
        yellow: "#d19a66",
        blue: "#61afef",
        magenta: "#c678dd",
        cyan: "#56b6c2",
        white: "#abb2bf",
    },
    nord: {
        background: "#2e3440",
        foreground: "#d8dee9",
        black: "#3b4252",
        red: "#bf616a",
        green: "#a3be8c",
        yellow: "#ebcb8b",
        blue: "#81a1c1",
        magenta: "#b48ead",
        cyan: "#88c0d0",
        white: "#e5e9f0",
    },
    dracula: {
        background: "#282a36",
        foreground: "#f8f8f2",
        black: "#21222c",
        red: "#ff5555",
        green: "#50fa7b",
        yellow: "#f1fa8c",
        blue: "#6272a4",
        magenta: "#ff79c6",
        cyan: "#8be9fd",
        white: "#f8f8f2",
    },
    "solarized-dark": {
        background: "#002b36",
        foreground: "#839496",
        black: "#073642",
        red: "#dc322f",
        green: "#859900",
        yellow: "#b58900",
        blue: "#268bd2",
        magenta: "#d33682",
        cyan: "#2aa198",
        white: "#eee8d5",
    },
};

export const DEFAULT_APPEARANCE: TerminalAppearanceSettings = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 14,
    lineHeight: 1.5,
    letterSpacing: 0,
    theme: "vs-code-dark",
    cursorStyle: "block",
    cursorBlink: true,
    scrollback: 10000,
    allowTransparency: false,
    opacity: 100,
};

export const DEFAULT_SETTINGS: AppSettings = {
    defaultProtocol: "SSH",
    connectionTimeout: 30,
    keepAliveInterval: 60,
    autoReconnect: true,
    hostKeyVerification: true,
    savePasswords: false,
    autoLockTimeout: 30,
    theme: "dark",
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

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAppearanceChange?: (settings: TerminalAppearanceSettings) => void;
}

type SettingsSection =
    | "terminal"
    | "connection"
    | "security"
    | "interface"
    | "keyboard"
    | "advanced";

export const SettingsModal: React.FC<SettingsModalProps> = ({
    open,
    onOpenChange,
    onAppearanceChange,
}) => {
    const [activeSection, setActiveSection] =
        useState<SettingsSection>("terminal");
    const [appearance, setAppearance] =
        useState<TerminalAppearanceSettings>(DEFAULT_APPEARANCE);
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

    // Sync state with storage on open
    useEffect(() => {
        if (open) {
            const savedAppearance = localStorage.getItem("termAppearance");
            const savedSettings = localStorage.getItem("termSettings");
            if (savedAppearance) setAppearance(JSON.parse(savedAppearance));
            if (savedSettings) setSettings(JSON.parse(savedSettings));
        }
    }, [open]);

    const updateAppearance = <K extends keyof TerminalAppearanceSettings>(
        key: K,
        value: TerminalAppearanceSettings[K]
    ) => {
        setAppearance((prev) => ({ ...prev, [key]: value }));
    };

    const updateSetting = <K extends keyof AppSettings>(
        key: K,
        value: AppSettings[K]
    ) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        localStorage.setItem("termAppearance", JSON.stringify(appearance));
        localStorage.setItem("termSettings", JSON.stringify(settings));
        if (onAppearanceChange) onAppearanceChange(appearance);
        onOpenChange(false);
    };

    const handleReset = () => {
        if (
            confirm(
                "Reset all settings to defaults? This action cannot be undone."
            )
        ) {
            setAppearance(DEFAULT_APPEARANCE);
            setSettings(DEFAULT_SETTINGS);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[700px] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">
                            Settings
                        </h2>
                        <p className="text-sm text-slate-500">
                            Configure your workspace and connectivity
                        </p>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-56 border-r bg-slate-50 p-3 space-y-1">
                        <SidebarItem
                            active={activeSection === "terminal"}
                            onClick={() => setActiveSection("terminal")}
                            label="Terminal"
                            icon={<TerminalIcon />}
                        />
                        <SidebarItem
                            active={activeSection === "connection"}
                            onClick={() => setActiveSection("connection")}
                            label="Connection"
                            icon={<GlobeIcon />}
                        />
                        <SidebarItem
                            active={activeSection === "security"}
                            onClick={() => setActiveSection("security")}
                            label="Security"
                            icon={<LockIcon />}
                        />
                        <SidebarItem
                            active={activeSection === "interface"}
                            onClick={() => setActiveSection("interface")}
                            label="Interface"
                            icon={<MonitorIcon />}
                        />
                        <SidebarItem
                            active={activeSection === "keyboard"}
                            onClick={() => setActiveSection("keyboard")}
                            label="Keyboard"
                            icon={<KeyboardIcon />}
                        />
                        <SidebarItem
                            active={activeSection === "advanced"}
                            onClick={() => setActiveSection("advanced")}
                            label="Advanced"
                            icon={<CpuIcon />}
                        />
                    </div>

                    {/* Main Panel */}
                    <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
                        {activeSection === "terminal" && (
                            <div className="space-y-8">
                                <SectionHeader
                                    title="Typography"
                                    description="Customize fonts and readability"
                                />
                                <div className="grid grid-cols-2 gap-6">
                                    <FormGroup label="Font Family">
                                        <select
                                            value={appearance.fontFamily}
                                            onChange={(e) =>
                                                updateAppearance(
                                                    "fontFamily",
                                                    e.target.value
                                                )
                                            }
                                            className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                                        >
                                            <option value="'JetBrains Mono', monospace">
                                                JetBrains Mono
                                            </option>
                                            <option value="'Fira Code', monospace">
                                                Fira Code
                                            </option>
                                            <option value="Menlo, Monaco, monospace">
                                                Menlo / Monaco
                                            </option>
                                            <option value="'Source Code Pro', monospace">
                                                Source Code Pro
                                            </option>
                                        </select>
                                    </FormGroup>
                                    <FormGroup
                                        label={`Font Size (${appearance.fontSize}px)`}
                                    >
                                        <input
                                            type="range"
                                            min="8"
                                            max="32"
                                            step="1"
                                            value={appearance.fontSize}
                                            onChange={(e) =>
                                                updateAppearance(
                                                    "fontSize",
                                                    Number(e.target.value)
                                                )
                                            }
                                            className="w-full accent-slate-900"
                                        />
                                    </FormGroup>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <FormGroup
                                        label={`Line Height (${appearance.lineHeight})`}
                                    >
                                        <input
                                            type="range"
                                            min="1.0"
                                            max="2.0"
                                            step="0.1"
                                            value={appearance.lineHeight}
                                            onChange={(e) =>
                                                updateAppearance(
                                                    "lineHeight",
                                                    Number(e.target.value)
                                                )
                                            }
                                            className="w-full accent-slate-900"
                                        />
                                    </FormGroup>
                                    <FormGroup
                                        label={`Letter Spacing (${appearance.letterSpacing}px)`}
                                    >
                                        <input
                                            type="range"
                                            min="-2"
                                            max="5"
                                            step="0.5"
                                            value={appearance.letterSpacing}
                                            onChange={(e) =>
                                                updateAppearance(
                                                    "letterSpacing",
                                                    Number(e.target.value)
                                                )
                                            }
                                            className="w-full accent-slate-900"
                                        />
                                    </FormGroup>
                                </div>

                                <hr className="border-slate-100" />

                                <SectionHeader
                                    title="Appearance"
                                    description="Visual style and terminal behavior"
                                />
                                <div className="grid grid-cols-2 gap-6">
                                    <FormGroup label="Color Theme">
                                        <select
                                            value={appearance.theme}
                                            onChange={(e) =>
                                                updateAppearance(
                                                    "theme",
                                                    e.target.value
                                                )
                                            }
                                            className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                                        >
                                            <option value="vs-code-dark">
                                                VS Code Dark
                                            </option>
                                            <option value="one-dark">
                                                One Dark
                                            </option>
                                            <option value="nord">Nord</option>
                                            <option value="dracula">
                                                Dracula
                                            </option>
                                            <option value="solarized-dark">
                                                Solarized Dark
                                            </option>
                                        </select>
                                    </FormGroup>
                                    <FormGroup label="Cursor Style">
                                        <select
                                            value={appearance.cursorStyle}
                                            onChange={(e) =>
                                                updateAppearance(
                                                    "cursorStyle",
                                                    e.target.value as any
                                                )
                                            }
                                            className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                                        >
                                            <option value="block">Block</option>
                                            <option value="bar">
                                                Bar (Beam)
                                            </option>
                                            <option value="underline">
                                                Underline
                                            </option>
                                        </select>
                                    </FormGroup>
                                </div>

                                <div className="space-y-4">
                                    <SwitchRow
                                        label="Cursor Blinking"
                                        description="Enable smooth animation for the cursor"
                                        checked={appearance.cursorBlink}
                                        onChange={(checked) =>
                                            updateAppearance(
                                                "cursorBlink",
                                                checked
                                            )
                                        }
                                    />
                                    <SwitchRow
                                        label="Background Transparency"
                                        description="Allow terminal window to be semi-transparent"
                                        checked={appearance.allowTransparency}
                                        onChange={(checked) =>
                                            updateAppearance(
                                                "allowTransparency",
                                                checked
                                            )
                                        }
                                    />
                                    {appearance.allowTransparency && (
                                        <FormGroup
                                            label={`Opacity (${appearance.opacity}%)`}
                                        >
                                            <input
                                                type="range"
                                                min="10"
                                                max="100"
                                                step="5"
                                                value={appearance.opacity}
                                                onChange={(e) =>
                                                    updateAppearance(
                                                        "opacity",
                                                        Number(e.target.value)
                                                    )
                                                }
                                                className="w-full accent-slate-900"
                                            />
                                        </FormGroup>
                                    )}
                                </div>

                                <div className="mt-8 rounded-lg overflow-hidden border border-slate-200">
                                    <div className="bg-slate-50 px-3 py-1.5 border-b text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                        Preview
                                    </div>
                                    <TerminalPreview settings={appearance} />
                                </div>
                            </div>
                        )}

                        {activeSection === "connection" && (
                            <div className="space-y-8">
                                <SectionHeader
                                    title="Connectivity"
                                    description="Manage network and default behaviors"
                                />
                                <div className="grid grid-cols-2 gap-6">
                                    <FormGroup label="Default Protocol">
                                        <select
                                            value={settings.defaultProtocol}
                                            onChange={(e) =>
                                                updateSetting(
                                                    "defaultProtocol",
                                                    e.target.value
                                                )
                                            }
                                            className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none"
                                        >
                                            <option value="SSH">SSH</option>
                                            <option value="Telnet">
                                                Telnet
                                            </option>
                                            <option value="Serial">
                                                Serial
                                            </option>
                                        </select>
                                    </FormGroup>
                                    <FormGroup
                                        label={`Timeout (${settings.connectionTimeout}s)`}
                                    >
                                        <input
                                            type="range"
                                            min="5"
                                            max="120"
                                            step="5"
                                            value={settings.connectionTimeout}
                                            onChange={(e) =>
                                                updateSetting(
                                                    "connectionTimeout",
                                                    Number(e.target.value)
                                                )
                                            }
                                            className="w-full accent-slate-900"
                                        />
                                    </FormGroup>
                                </div>
                                <SwitchRow
                                    label="Auto Reconnect"
                                    description="Restore session automatically on network drop"
                                    checked={settings.autoReconnect}
                                    onChange={(checked) =>
                                        updateSetting("autoReconnect", checked)
                                    }
                                />
                            </div>
                        )}

                        {activeSection === "security" && (
                            <div className="space-y-8">
                                <SectionHeader
                                    title="Security"
                                    description="Host verification and password policies"
                                />
                                <div className="space-y-6">
                                    <SwitchRow
                                        label="Host Key Verification"
                                        description="Strict checking of remote host keys"
                                        checked={settings.hostKeyVerification}
                                        onChange={(checked) =>
                                            updateSetting(
                                                "hostKeyVerification",
                                                checked
                                            )
                                        }
                                    />
                                    <SwitchRow
                                        label="Persist Passwords"
                                        description="Store credentials in the system keychain"
                                        checked={settings.savePasswords}
                                        onChange={(checked) =>
                                            updateSetting(
                                                "savePasswords",
                                                checked
                                            )
                                        }
                                    />
                                    <hr className="border-slate-100" />
                                    <FormGroup
                                        label={`Auto-lock Idle Time (${settings.autoLockTimeout} min)`}
                                    >
                                        <input
                                            type="range"
                                            min="1"
                                            max="60"
                                            step="1"
                                            value={settings.autoLockTimeout}
                                            onChange={(e) =>
                                                updateSetting(
                                                    "autoLockTimeout",
                                                    Number(e.target.value)
                                                )
                                            }
                                            className="w-full accent-slate-900"
                                        />
                                    </FormGroup>
                                </div>
                            </div>
                        )}

                        {activeSection === "interface" && (
                            <div className="space-y-8">
                                <SectionHeader
                                    title="Application"
                                    description="General interface appearance"
                                />
                                <FormGroup label="Application Theme">
                                    <div className="grid grid-cols-3 gap-3">
                                        <ThemeCard
                                            active={settings.theme === "light"}
                                            onClick={() =>
                                                updateSetting("theme", "light")
                                            }
                                            label="Light"
                                        />
                                        <ThemeCard
                                            active={settings.theme === "dark"}
                                            onClick={() =>
                                                updateSetting("theme", "dark")
                                            }
                                            label="Dark"
                                        />
                                        <ThemeCard
                                            active={settings.theme === "auto"}
                                            onClick={() =>
                                                updateSetting("theme", "auto")
                                            }
                                            label="System"
                                        />
                                    </div>
                                </FormGroup>
                                <div className="space-y-4 pt-4">
                                    <SwitchRow
                                        label="Notifications"
                                        description="Show desktop alerts for session events"
                                        checked={settings.enableNotifications}
                                        onChange={(checked) =>
                                            updateSetting(
                                                "enableNotifications",
                                                checked
                                            )
                                        }
                                    />
                                    <SwitchRow
                                        label="System Monitor"
                                        description="Show real-time CPU/RAM usage in status bar"
                                        checked={settings.showSystemMonitor}
                                        onChange={(checked) =>
                                            updateSetting(
                                                "showSystemMonitor",
                                                checked
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        {activeSection === "keyboard" && (
                            <div className="space-y-8">
                                <SectionHeader
                                    title="Hotkeys"
                                    description="Standard application shortcuts"
                                />
                                <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                                    <ShortcutInput
                                        label="New Session"
                                        value={settings.newSession}
                                        onChange={(v) =>
                                            updateSetting("newSession", v)
                                        }
                                    />
                                    <ShortcutInput
                                        label="Close Tab"
                                        value={settings.closeSession}
                                        onChange={(v) =>
                                            updateSetting("closeSession", v)
                                        }
                                    />
                                    <ShortcutInput
                                        label="Next Tab"
                                        value={settings.nextTab}
                                        onChange={(v) =>
                                            updateSetting("nextTab", v)
                                        }
                                    />
                                    <ShortcutInput
                                        label="Previous Tab"
                                        value={settings.previousTab}
                                        onChange={(v) =>
                                            updateSetting("previousTab", v)
                                        }
                                    />
                                </div>
                                <p className="p-3 bg-amber-50 text-amber-700 text-xs rounded-md border border-amber-200">
                                    Note: Keyboard changes will apply after
                                    restarting the terminal engine.
                                </p>
                            </div>
                        )}

                        {activeSection === "advanced" && (
                            <div className="space-y-8">
                                <SectionHeader
                                    title="Advanced"
                                    description="Developer settings and telemetry"
                                />
                                <FormGroup label="Log Level">
                                    <select
                                        value={settings.logLevel}
                                        onChange={(e) =>
                                            updateSetting(
                                                "logLevel",
                                                e.target.value
                                            )
                                        }
                                        className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none"
                                    >
                                        <option value="error">
                                            Error only
                                        </option>
                                        <option value="warn">Warnings</option>
                                        <option value="info">
                                            Information
                                        </option>
                                        <option value="debug">
                                            Debug verbose
                                        </option>
                                    </select>
                                </FormGroup>
                                <SwitchRow
                                    label="Anonymous Telemetry"
                                    description="Share non-sensitive usage data to help us improve"
                                    checked={settings.telemetry}
                                    onChange={(checked) =>
                                        updateSetting("telemetry", checked)
                                    }
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
                    <button
                        onClick={handleReset}
                        className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        Reset to Defaults
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={() => onOpenChange(false)}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 shadow-sm transition-all active:scale-95"
                        >
                            Apply Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* --- Helper Components --- */

const SidebarItem: React.FC<{
    active: boolean;
    onClick: () => void;
    label: string;
    icon: React.ReactNode;
}> = ({ active, onClick, label, icon }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            active
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
        }`}
    >
        <span className={active ? "text-slate-900" : "text-slate-400"}>
            {icon}
        </span>
        {label}
    </button>
);

const SectionHeader: React.FC<{ title: string; description: string }> = ({
    title,
    description,
}) => (
    <div className="space-y-1">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
    </div>
);

const FormGroup: React.FC<{ label: string; children: React.ReactNode }> = ({
    label,
    children,
}) => (
    <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {children}
    </div>
);

const SwitchRow: React.FC<{
    label: string;
    description: string;
    checked: boolean;
    onChange: (val: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between py-2 group">
        <div className="space-y-0.5">
            <div className="text-sm font-medium text-slate-900 group-hover:text-slate-950 transition-colors">
                {label}
            </div>
            <div className="text-xs text-slate-500">{description}</div>
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 ${
                checked ? "bg-slate-900" : "bg-slate-200"
            }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    checked ? "translate-x-6" : "translate-x-1"
                }`}
            />
        </button>
    </div>
);

const ThemeCard: React.FC<{
    active: boolean;
    onClick: () => void;
    label: string;
}> = ({ active, onClick, label }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
            active
                ? "border-slate-900 bg-slate-50 shadow-sm"
                : "border-slate-100 hover:border-slate-200"
        }`}
    >
        <div
            className={`w-12 h-8 rounded-md mb-2 ${
                label === "Light"
                    ? "bg-slate-100"
                    : label === "Dark"
                    ? "bg-slate-800"
                    : "bg-gradient-to-br from-slate-100 to-slate-800"
            }`}
        />
        <span className="text-xs font-medium text-slate-600">{label}</span>
    </button>
);

const ShortcutInput: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
    <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {label}
        </label>
        <div className="relative group">
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-10 pl-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all"
            />
            <div className="absolute right-3 top-2.5 text-slate-400 group-hover:text-slate-600">
                <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                    />
                </svg>
            </div>
        </div>
    </div>
);

const TerminalPreview: React.FC<{ settings: TerminalAppearanceSettings }> = ({
    settings,
}) => {
    const theme =
        TERMINAL_THEMES[settings.theme] || TERMINAL_THEMES["vs-code-dark"];

    return (
        <div
            className="p-4 font-mono transition-all duration-300 min-h-[160px]"
            style={{
                backgroundColor: theme.background,
                color: theme.foreground,
                fontFamily: settings.fontFamily,
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
                letterSpacing: `${settings.letterSpacing}px`,
                opacity: settings.allowTransparency
                    ? settings.opacity / 100
                    : 1,
            }}
        >
            <div className="flex gap-2 mb-2">
                <span style={{ color: theme.green }}>user@workstation</span>
                <span style={{ color: theme.foreground }}>:</span>
                <span style={{ color: theme.blue }}>~/projects/api</span>
                <span style={{ color: theme.magenta }}>$</span>
                <span
                    className={`${
                        settings.cursorBlink ? "animate-pulse" : ""
                    } border-l-2 ml-1`}
                    style={{ borderColor: theme.foreground, height: "1.2em" }}
                />
            </div>
            <div style={{ color: theme.foreground }}>Listing contents...</div>
            <div className="grid grid-cols-4 gap-2 mt-2">
                <div style={{ color: theme.blue }}>src/</div>
                <div style={{ color: theme.blue }}>tests/</div>
                <div style={{ color: theme.yellow }}>package.json</div>
                <div style={{ color: theme.cyan }}>README.md</div>
            </div>
        </div>
    );
};

/* --- Icons --- */

const TerminalIcon = () => (
    <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
    </svg>
);
const GlobeIcon = () => (
    <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
    </svg>
);
const LockIcon = () => (
    <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
    </svg>
);
const MonitorIcon = () => (
    <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
    </svg>
);
const KeyboardIcon = () => (
    <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M3 10h18M7 15h1m4 0h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        />
    </svg>
);
const CpuIcon = () => (
    <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
        />
    </svg>
);
