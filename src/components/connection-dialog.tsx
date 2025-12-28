import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent } from "./ui/card";
import {
    ConnectionProfileManager,
    type ConnectionProfile,
} from "../lib/connection-profiles";
import { SessionStorageManager } from "../lib/session-storage";
import { toast } from "sonner";
import {
    Server,
    Key,
    Globe,
    Shield,
    Network,
    Settings2,
    Plus,
    Trash2,
    FolderOpen,
    Loader2,
    ArrowRightLeft,
    ChevronRight,
} from "lucide-react";
import { cn } from "./ui/utils";

interface ConnectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConnect: (config: SessionConfig) => void;
    editingSession?: SessionConfig | null;
}

export interface SessionConfig {
    id?: string;
    name: string;
    protocol: "SSH" | "Telnet" | "Raw" | "Serial";
    host: string;
    port: number;
    username: string;
    authMethod: "password" | "publickey" | "keyboard-interactive";
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
    folder?: string;

    // Advanced options
    proxyType?: "none" | "http" | "socks4" | "socks5";
    proxyHost?: string;
    proxyPort?: number;
    proxyUsername?: string;
    proxyPassword?: string;

    // SSH specific
    compression?: boolean;
    keepAlive?: boolean;
    keepAliveInterval?: number;
    serverAliveCountMax?: number;
    forwardPorts?: {
        localPort: number;
        remoteHost: string;
        remotePort: number;
    }[];
}

export function ConnectionDialog({
    open,
    onOpenChange,
    onConnect,
    editingSession,
}: ConnectionDialogProps) {
    const { t } = useTranslation();
    const [config, setConfig] = useState<SessionConfig>({
        name: "",
        protocol: "SSH",
        host: "",
        port: 22,
        username: "",
        authMethod: "password",
        password: "",
        privateKeyPath: "",
        passphrase: "",
        proxyType: "none",
        proxyHost: "",
        proxyPort: 8080,
        proxyUsername: "",
        proxyPassword: "",
        compression: true,
        keepAlive: true,
        keepAliveInterval: 60,
        serverAliveCountMax: 3,
        forwardPorts: [],
        ...editingSession,
    });

    const [isConnecting, setIsConnecting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [savedProfiles, setSavedProfiles] = useState<ConnectionProfile[]>([]);
    const [showSaveProfile, setShowSaveProfile] = useState(false);
    const [saveAsSession, setSaveAsSession] = useState(true);
    const [sessionFolder, setSessionFolder] = useState("All Sessions");
    const [availableFolders, setAvailableFolders] = useState<string[]>([]);
    const [newForward, setNewForward] = useState<{
        localPort: number;
        remoteHost: string;
        remotePort: number;
    }>({
        localPort: 0,
        remoteHost: "127.0.0.1",
        remotePort: 0,
    });

    const sessionIdRef = useRef<string | null>(null);
    const cancelRequestedRef = useRef(false);

    // Load saved profiles and folders when dialog opens
    useEffect(() => {
        if (open) {
            setSavedProfiles(ConnectionProfileManager.getProfiles());

            // Load all available folders
            const folders = SessionStorageManager.getFolders();
            const folderPaths = folders.map((f) => f.path).sort();
            setAvailableFolders(folderPaths);
        }
    }, [open]);

    // Reset config when editingSession changes
    useEffect(() => {
        if (editingSession) {
            // Load existing session data
            setConfig({
                name: editingSession.name || "",
                protocol: editingSession.protocol || "SSH",
                host: editingSession.host || "",
                port: editingSession.port || 22,
                username: editingSession.username || "",
                authMethod: editingSession.authMethod || "password",
                password: editingSession.password || "",
                privateKeyPath: editingSession.privateKeyPath || "",
                passphrase: editingSession.passphrase || "",
                proxyType: editingSession.proxyType || "none",
                proxyHost: editingSession.proxyHost || "",
                proxyPort: editingSession.proxyPort || 8080,
                proxyUsername: editingSession.proxyUsername || "",
                proxyPassword: editingSession.proxyPassword || "",
                compression:
                    editingSession.compression !== undefined
                        ? editingSession.compression
                        : true,
                keepAlive:
                    editingSession.keepAlive !== undefined
                        ? editingSession.keepAlive
                        : true,
                keepAliveInterval: editingSession.keepAliveInterval || 60,
                serverAliveCountMax: editingSession.serverAliveCountMax || 3,
                forwardPorts: editingSession.forwardPorts || [],
            });
            setSessionFolder(editingSession.folder || "All Sessions");
        } else {
            // Reset to defaults for new session
            setConfig({
                name: "",
                protocol: "SSH",
                host: "",
                port: 22,
                username: "",
                authMethod: "password",
                password: "",
                privateKeyPath: "",
                passphrase: "",
                proxyType: "none",
                proxyHost: "",
                proxyPort: 8080,
                proxyUsername: "",
                proxyPassword: "",
                compression: true,
                keepAlive: true,
                keepAliveInterval: 60,
                serverAliveCountMax: 3,
                forwardPorts: [],
            });
            setSessionFolder("All Sessions");
        }
    }, [editingSession]);

    const handleSaveProfile = () => {
        try {
            const profile = ConnectionProfileManager.saveProfile({
                name: config.name,
                host: config.host,
                port: config.port,
                username: config.username,
                authMethod:
                    config.authMethod === "publickey" ? "key" : "password",
                password: config.password,
                privateKey: config.privateKeyPath,
                forwardPorts: config.forwardPorts,
            });
            setSavedProfiles(ConnectionProfileManager.getProfiles());
            toast.success(`Saved profile: ${profile.name}`);
            setShowSaveProfile(false);
        } catch (error) {
            toast.error("Failed to save profile");
        }
    };

    const handleLoadProfile = (profile: ConnectionProfile) => {
        setConfig({
            ...config,
            name: profile.name,
            host: profile.host,
            port: profile.port,
            username: profile.username,
            authMethod: profile.authMethod === "key" ? "publickey" : "password",
            password: profile.password,
            privateKeyPath: profile.privateKey,
            forwardPorts: profile.forwardPorts || [],
        });
        toast.success(`Loaded profile: ${profile.name}`);
    };

    const handleDeleteProfile = (id: string) => {
        if (ConnectionProfileManager.deleteProfile(id)) {
            setSavedProfiles(ConnectionProfileManager.getProfiles());
            toast.success("Profile deleted");
        }
    };

    const handleToggleFavorite = (id: string) => {
        const profile = ConnectionProfileManager.getProfile(id);
        if (profile) {
            ConnectionProfileManager.updateProfile(id, {
                favorite: !profile.favorite,
            });
            setSavedProfiles(ConnectionProfileManager.getProfiles());
        }
    };

    const resetConnectionState = () => {
        setIsConnecting(false);
        setIsCancelling(false);
        sessionIdRef.current = null;
        cancelRequestedRef.current = false;
    };

    const handleConnect = async () => {
        if (isConnecting) {
            return;
        }

        setIsConnecting(true);
        setIsCancelling(false);
        cancelRequestedRef.current = false;
        const sessionId = editingSession?.id || `session-${Date.now()}`;
        sessionIdRef.current = sessionId;

        // Basic validation
        if (!config.name || !config.host || !config.username) {
            toast.error("Missing Required Fields", {
                description:
                    "Please fill in all required fields: Session Name, Host, and Username.",
            });
            resetConnectionState();
            return;
        }

        // Validate authentication method specific fields
        if (config.authMethod === "password" && !config.password) {
            toast.error(t("connection.passwordRequired"), {
                description: t("connection.passwordRequiredDesc"),
            });
            resetConnectionState();
            return;
        }

        if (config.authMethod === "publickey" && !config.privateKeyPath) {
            toast.error(t("connection.keyRequired"), {
                description: t("connection.keyRequiredDesc"),
            });
            resetConnectionState();
            return;
        }

        try {
            // Actually connect to SSH server
            const result = await invoke<{
                success: boolean;
                session_id?: string;
                error?: string;
            }>("ssh_connect", {
                request: {
                    session_id: sessionId,
                    host: config.host,
                    port: config.port || 22,
                    username: config.username,
                    auth_method: config.authMethod || "password",
                    password: config.password || "",
                    key_path: config.privateKeyPath || null,
                    passphrase: config.passphrase || null,
                    forward_ports:
                        config.forwardPorts?.map((fp) => ({
                            local_port: fp.localPort,
                            remote_host: fp.remoteHost,
                            remote_port: fp.remotePort,
                        })) || null,
                },
            });

            if (result.success) {
                // Save session if checkbox is checked
                if (saveAsSession) {
                    if (editingSession?.id) {
                        // Update existing session
                        SessionStorageManager.updateSession(editingSession.id, {
                            name: config.name,
                            host: config.host,
                            port: config.port || 22,
                            username: config.username,
                            protocol: config.protocol,
                            folder: sessionFolder,
                            authMethod: config.authMethod,
                            password: config.password,
                            privateKeyPath: config.privateKeyPath,
                            passphrase: config.passphrase,
                            forwardPorts: config.forwardPorts,
                        });
                    } else {
                        // Save new session
                        SessionStorageManager.saveSession({
                            name: config.name,
                            host: config.host,
                            port: config.port || 22,
                            username: config.username,
                            protocol: config.protocol,
                            folder: sessionFolder,
                            authMethod: config.authMethod,
                            password: config.password,
                            privateKeyPath: config.privateKeyPath,
                            passphrase: config.passphrase,
                            forwardPorts: config.forwardPorts,
                        });
                    }
                }

                // Update last connected timestamp if editing existing session
                if (editingSession?.id) {
                    SessionStorageManager.updateLastConnected(
                        editingSession.id
                    );
                }

                onConnect({
                    ...config,
                    id: sessionId,
                });
                onOpenChange(false);

                // Reset form if creating new session
                if (!editingSession) {
                    setConfig({
                        name: "",
                        protocol: "SSH",
                        host: "",
                        port: 22,
                        username: "",
                        authMethod: "password",
                        password: "",
                        privateKeyPath: "",
                        passphrase: "",
                        proxyType: "none",
                        proxyHost: "",
                        proxyPort: 8080,
                        proxyUsername: "",
                        proxyPassword: "",
                        compression: true,
                        keepAlive: true,
                        keepAliveInterval: 60,
                        serverAliveCountMax: 3,
                    });
                    setSessionFolder("All Sessions");
                }
            } else {
                // Show error toast
                console.error("Connection failed:", result.error);
                if (
                    cancelRequestedRef.current &&
                    result.error?.toLowerCase().includes("cancelled")
                ) {
                    toast.info("Connection cancelled");
                } else {
                    toast.error(t("connection.connectionFailed"), {
                        description:
                            result.error ||
                            "Unable to connect to the server. Please check your credentials and try again.",
                        duration: 5000,
                    });
                }
            }
        } catch (error) {
            console.error("Connection error:", error);
            if (cancelRequestedRef.current) {
                toast.info("Connection cancelled");
            } else {
                toast.error("Connection Error", {
                    description:
                        error instanceof Error
                            ? error.message
                            : "An unexpected error occurred while connecting.",
                    duration: 5000,
                });
            }
        } finally {
            resetConnectionState();
        }
    };

    const handleCancelConnectionAttempt = async () => {
        if (!isConnecting) {
            onOpenChange(false);
            return;
        }

        if (isCancelling) {
            return;
        }

        const sessionId = sessionIdRef.current;
        if (!sessionId) {
            resetConnectionState();
            return;
        }

        cancelRequestedRef.current = true;
        setIsCancelling(true);

        try {
            const response = await invoke<{ success: boolean; error?: string }>(
                "ssh_cancel_connect",
                {
                    session_id: sessionId,
                }
            );
            if (response.success) {
                toast.info("Cancelling connection...");
            } else if (response.error) {
                toast.info(response.error);
            }
        } catch (error) {
            console.error("Failed to cancel connection:", error);
            cancelRequestedRef.current = false;
            toast.error("Unable to cancel connection", {
                description:
                    error instanceof Error
                        ? error.message
                        : "Please try again in a moment.",
            });
            setIsCancelling(false);
        }
    };

    const updateConfig = (updates: Partial<SessionConfig>) => {
        setConfig((prev) => ({ ...prev, ...updates }));
    };

    // Compact input styles matching Monitor/Logs/Alerts
    const inputClassName =
        "h-8 !text-[12px] !font-normal bg-background/40 border-border/40 focus:border-primary/40 focus:bg-background/80 transition-all placeholder:text-muted-foreground/40";
    const labelClassName =
        "text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-1 block";
    const selectTriggerClassName =
        "h-8 text-[11px] font-medium bg-background/40 border-border/40 transition-all hover:bg-background/60 shadow-none";
    const cardContentClassName = "p-4 space-y-4";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden border border-border/50">
                {/* Compact Header */}
                <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                    <div className="flex items-center gap-2">
                        <div>
                            <DialogTitle className="text-sm font-semibold py-1">
                                {editingSession
                                    ? "Edit Session"
                                    : "New Session"}
                            </DialogTitle>
                        </div>
                    </div>
                </div>

                {/* Compact Tabs */}
                <Tabs defaultValue="connection" className="flex-1">
                    <div className="px-3 py-1.5 border-b border-border/30 bg-muted/5">
                        <TabsList className="h-8 w-full justify-start bg-transparent p-0 gap-0.5">
                            <TabsTrigger
                                value="connection"
                                className="px-3 h-7 text-[10px] font-semibold rounded-md data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-border/50 text-muted-foreground/70 hover:text-foreground transition-all"
                            >
                                Connection
                            </TabsTrigger>
                            <TabsTrigger
                                value="authentication"
                                className="px-3 h-7 text-[10px] font-semibold rounded-md data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-border/50 text-muted-foreground/70 hover:text-foreground transition-all"
                            >
                                Auth
                            </TabsTrigger>
                            <TabsTrigger
                                value="proxy"
                                className="px-3 h-7 text-[10px] font-semibold rounded-md data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-border/50 text-muted-foreground/70 hover:text-foreground transition-all"
                            >
                                Proxy
                            </TabsTrigger>
                            <TabsTrigger
                                value="tunnels"
                                className="px-3 h-7 text-[10px] font-semibold rounded-md data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-border/50 text-muted-foreground/70 hover:text-foreground transition-all"
                            >
                                Tunnels
                            </TabsTrigger>
                            <TabsTrigger
                                value="advanced"
                                className="px-3 h-7 text-[10px] font-semibold rounded-md data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-border/50 text-muted-foreground/70 hover:text-foreground transition-all"
                            >
                                Advanced
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="h-[220px]">
                        <div className="px-1">
                            <TabsContent
                                value="connection"
                                className="mt-0 outline-none"
                            >
                                <div className={cardContentClassName}>
                                    <div className="grid grid-cols-5 gap-4">
                                        <div className="col-span-3 space-y-1">
                                            <Label className={labelClassName}>
                                                Session Name
                                            </Label>
                                            <Input
                                                placeholder="e.g. Production Web"
                                                value={config.name}
                                                onChange={(e) =>
                                                    updateConfig({
                                                        name: e.target.value,
                                                    })
                                                }
                                                className={inputClassName}
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <Label className={labelClassName}>
                                                Protocol
                                            </Label>
                                            <Select
                                                value={config.protocol}
                                                onValueChange={(
                                                    value: SessionConfig["protocol"]
                                                ) => {
                                                    const defaultPorts = {
                                                        SSH: 22,
                                                        Telnet: 23,
                                                        Raw: 23,
                                                        Serial: 0,
                                                    };
                                                    updateConfig({
                                                        protocol: value,
                                                        port: defaultPorts[
                                                            value
                                                        ],
                                                    });
                                                }}
                                            >
                                                <SelectTrigger
                                                    className={cn(
                                                        selectTriggerClassName,
                                                        "max-h-8 w-full"
                                                    )}
                                                >
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
                                                    <SelectItem value="Serial">
                                                        Serial
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-6 gap-4">
                                        <div className="col-span-4 space-y-1">
                                            <Label className={labelClassName}>
                                                Host Address
                                            </Label>
                                            <Input
                                                placeholder="192.168.1.1 or domain"
                                                value={config.host}
                                                onChange={(e) =>
                                                    updateConfig({
                                                        host: e.target.value,
                                                    })
                                                }
                                                className={inputClassName}
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <Label className={labelClassName}>
                                                Port
                                            </Label>
                                            <Input
                                                type="number"
                                                value={config.port}
                                                onChange={(e) =>
                                                    updateConfig({
                                                        port:
                                                            parseInt(
                                                                e.target.value
                                                            ) || 22,
                                                    })
                                                }
                                                className={cn(
                                                    inputClassName,
                                                    "text-center font-mono"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className={labelClassName}>
                                            Username
                                        </Label>
                                        <Input
                                            placeholder="root / ubuntu / admin"
                                            value={config.username}
                                            onChange={(e) =>
                                                updateConfig({
                                                    username: e.target.value,
                                                })
                                            }
                                            className={inputClassName}
                                        />
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Authentication Tab */}
                            <TabsContent
                                value="authentication"
                                className="mt-0 space-y-4"
                            >
                                <CardContent className="p-3 space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className={labelClassName}>
                                            Authentication Method
                                        </Label>
                                        <Select
                                            value={config.authMethod}
                                            onValueChange={(
                                                value: SessionConfig["authMethod"]
                                            ) =>
                                                updateConfig({
                                                    authMethod: value,
                                                })
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
                                                    value="password"
                                                    className="text-xs"
                                                >
                                                    Password
                                                </SelectItem>
                                                <SelectItem
                                                    value="publickey"
                                                    className="text-xs"
                                                >
                                                    Public Key
                                                </SelectItem>
                                                <SelectItem
                                                    value="keyboard-interactive"
                                                    className="text-xs"
                                                >
                                                    Keyboard Interactive
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Separator className="my-2 bg-border/30" />

                                    {config.authMethod === "password" && (
                                        <div className="space-y-1.5">
                                            <Label className={labelClassName}>
                                                Password
                                            </Label>
                                            <Input
                                                type="password"
                                                placeholder="Enter password"
                                                value={config.password}
                                                onChange={(e) =>
                                                    updateConfig({
                                                        password:
                                                            e.target.value,
                                                    })
                                                }
                                                className={inputClassName}
                                            />
                                        </div>
                                    )}

                                    {config.authMethod === "publickey" && (
                                        <div className="space-y-3">
                                            <div className="space-y-1.5">
                                                <Label
                                                    className={labelClassName}
                                                >
                                                    Private Key File
                                                </Label>
                                                <Input
                                                    placeholder="~/.ssh/id_rsa"
                                                    value={
                                                        config.privateKeyPath
                                                    }
                                                    onChange={(e) =>
                                                        updateConfig({
                                                            privateKeyPath:
                                                                e.target.value,
                                                        })
                                                    }
                                                    className={inputClassName}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label
                                                    className={labelClassName}
                                                >
                                                    Passphrase (optional)
                                                </Label>
                                                <Input
                                                    type="password"
                                                    placeholder="Enter passphrase"
                                                    value={config.passphrase}
                                                    onChange={(e) =>
                                                        updateConfig({
                                                            passphrase:
                                                                e.target.value,
                                                        })
                                                    }
                                                    className={inputClassName}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </TabsContent>

                            {/* Proxy Tab */}
                            <TabsContent
                                value="proxy"
                                className="mt-0 space-y-4"
                            >
                                <CardContent className="p-3 space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className={labelClassName}>
                                            Proxy Type
                                        </Label>
                                        <Select
                                            value={config.proxyType}
                                            onValueChange={(value: string) =>
                                                updateConfig({
                                                    proxyType:
                                                        value as SessionConfig["proxyType"],
                                                })
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
                                                    value="none"
                                                    className="text-xs"
                                                >
                                                    No Proxy
                                                </SelectItem>
                                                <SelectItem
                                                    value="http"
                                                    className="text-xs"
                                                >
                                                    HTTP Proxy
                                                </SelectItem>
                                                <SelectItem
                                                    value="socks4"
                                                    className="text-xs"
                                                >
                                                    SOCKS4
                                                </SelectItem>
                                                <SelectItem
                                                    value="socks5"
                                                    className="text-xs"
                                                >
                                                    SOCKS5
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {config.proxyType !== "none" && (
                                        <>
                                            <Separator className="my-2 bg-border/30" />

                                            <div className="grid grid-cols-4 gap-3">
                                                <div className="col-span-3 space-y-1.5">
                                                    <Label
                                                        className={
                                                            labelClassName
                                                        }
                                                    >
                                                        Proxy Host
                                                    </Label>
                                                    <Input
                                                        placeholder="proxy.example.com"
                                                        value={config.proxyHost}
                                                        onChange={(e) =>
                                                            updateConfig({
                                                                proxyHost:
                                                                    e.target
                                                                        .value,
                                                            })
                                                        }
                                                        className={
                                                            inputClassName
                                                        }
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label
                                                        className={
                                                            labelClassName
                                                        }
                                                    >
                                                        Port
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        value={config.proxyPort}
                                                        onChange={(e) =>
                                                            updateConfig({
                                                                proxyPort:
                                                                    parseInt(
                                                                        e.target
                                                                            .value
                                                                    ) || 8080,
                                                            })
                                                        }
                                                        className={cn(
                                                            inputClassName,
                                                            "text-center"
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label
                                                        className={
                                                            labelClassName
                                                        }
                                                    >
                                                        Username
                                                    </Label>
                                                    <Input
                                                        placeholder="Optional"
                                                        value={
                                                            config.proxyUsername
                                                        }
                                                        onChange={(e) =>
                                                            updateConfig({
                                                                proxyUsername:
                                                                    e.target
                                                                        .value,
                                                            })
                                                        }
                                                        className={
                                                            inputClassName
                                                        }
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label
                                                        className={
                                                            labelClassName
                                                        }
                                                    >
                                                        Password
                                                    </Label>
                                                    <Input
                                                        type="password"
                                                        placeholder="Optional"
                                                        value={
                                                            config.proxyPassword
                                                        }
                                                        onChange={(e) =>
                                                            updateConfig({
                                                                proxyPassword:
                                                                    e.target
                                                                        .value,
                                                            })
                                                        }
                                                        className={
                                                            inputClassName
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </TabsContent>

                            {/* Tunnels Tab */}
                            <TabsContent
                                value="tunnels"
                                className="mt-0 space-y-4"
                            >
                                <CardContent className="p-3 space-y-3">
                                    {/* Add New Tunnel */}
                                    <div className="space-y-2">
                                        <Label className={labelClassName}>
                                            Add Port Forward
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                placeholder="Local"
                                                value={
                                                    newForward.localPort || ""
                                                }
                                                onChange={(e) =>
                                                    setNewForward({
                                                        ...newForward,
                                                        localPort:
                                                            parseInt(
                                                                e.target.value
                                                            ) || 0,
                                                    })
                                                }
                                                className={cn(
                                                    inputClassName,
                                                    "w-20 text-center"
                                                )}
                                            />
                                            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                            <Input
                                                placeholder="Remote Host"
                                                value={newForward.remoteHost}
                                                onChange={(e) =>
                                                    setNewForward({
                                                        ...newForward,
                                                        remoteHost:
                                                            e.target.value,
                                                    })
                                                }
                                                className={cn(
                                                    inputClassName,
                                                    "flex-1"
                                                )}
                                            />
                                            <span className="text-muted-foreground text-xs">
                                                :
                                            </span>
                                            <Input
                                                type="number"
                                                placeholder="Port"
                                                value={
                                                    newForward.remotePort || ""
                                                }
                                                onChange={(e) =>
                                                    setNewForward({
                                                        ...newForward,
                                                        remotePort:
                                                            parseInt(
                                                                e.target.value
                                                            ) || 0,
                                                    })
                                                }
                                                className={cn(
                                                    inputClassName,
                                                    "w-20 text-center"
                                                )}
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => {
                                                    if (
                                                        newForward.localPort &&
                                                        newForward.remoteHost &&
                                                        newForward.remotePort
                                                    ) {
                                                        if (
                                                            config.forwardPorts?.some(
                                                                (fp) =>
                                                                    fp.localPort ===
                                                                    newForward.localPort
                                                            )
                                                        ) {
                                                            toast.error(
                                                                `Local port ${newForward.localPort} is already configured`
                                                            );
                                                            return;
                                                        }
                                                        const updatedPorts = [
                                                            ...(config.forwardPorts ||
                                                                []),
                                                            { ...newForward },
                                                        ];
                                                        updateConfig({
                                                            forwardPorts:
                                                                updatedPorts,
                                                        });
                                                        setNewForward({
                                                            localPort: 0,
                                                            remoteHost:
                                                                "127.0.0.1",
                                                            remotePort: 0,
                                                        });
                                                    } else {
                                                        toast.error(
                                                            "Please fill all tunnel fields"
                                                        );
                                                    }
                                                }}
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    <Separator className="my-2 bg-border/30" />

                                    {/* Configured Tunnels List */}
                                    <div className="space-y-1.5">
                                        <Label className={labelClassName}>
                                            Configured Tunnels (
                                            {config.forwardPorts?.length || 0})
                                        </Label>
                                        <div className="rounded-md border border-border/30 divide-y divide-border/30 max-h-[140px] overflow-y-auto bg-background/30">
                                            {config.forwardPorts &&
                                            config.forwardPorts.length > 0 ? (
                                                config.forwardPorts.map(
                                                    (fp, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors group"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[9px] h-4 px-1.5 font-mono"
                                                                >
                                                                    L
                                                                </Badge>
                                                                <span className="text-xs font-mono text-foreground/80">
                                                                    {
                                                                        fp.localPort
                                                                    }
                                                                </span>
                                                                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                                                <span className="text-xs font-mono text-foreground/80">
                                                                    {
                                                                        fp.remoteHost
                                                                    }
                                                                    :
                                                                    {
                                                                        fp.remotePort
                                                                    }
                                                                </span>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                                                                onClick={() => {
                                                                    const updatedPorts =
                                                                        config.forwardPorts?.filter(
                                                                            (
                                                                                _,
                                                                                i
                                                                            ) =>
                                                                                i !==
                                                                                index
                                                                        );
                                                                    updateConfig(
                                                                        {
                                                                            forwardPorts:
                                                                                updatedPorts,
                                                                        }
                                                                    );
                                                                }}
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    )
                                                )
                                            ) : (
                                                <div className="px-3 py-4 text-center text-muted-foreground text-[10px]">
                                                    No port forwarding
                                                    configured
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </TabsContent>

                            {/* Advanced Tab */}
                            <TabsContent
                                value="advanced"
                                className="mt-0 space-y-4"
                            >
                                <CardContent className="p-3 space-y-3">
                                    {/* Compression Toggle */}
                                    <div className="flex items-center justify-between py-1">
                                        <div className="space-y-0.5">
                                            <Label className="text-xs font-medium">
                                                Compression
                                            </Label>
                                            <p className="text-[10px] text-muted-foreground">
                                                Compress data for slow
                                                connections
                                            </p>
                                        </div>
                                        <Switch
                                            checked={config.compression}
                                            onCheckedChange={(checked) =>
                                                updateConfig({
                                                    compression: checked,
                                                })
                                            }
                                            className="scale-90"
                                        />
                                    </div>

                                    <Separator className="my-1 bg-border/30" />

                                    {/* Keep Alive Toggle */}
                                    <div className="flex items-center justify-between py-1">
                                        <div className="space-y-0.5">
                                            <Label className="text-xs font-medium">
                                                Keep Alive
                                            </Label>
                                            <p className="text-[10px] text-muted-foreground">
                                                Prevent connection timeout
                                            </p>
                                        </div>
                                        <Switch
                                            checked={config.keepAlive}
                                            onCheckedChange={(checked) =>
                                                updateConfig({
                                                    keepAlive: checked,
                                                })
                                            }
                                            className="scale-90"
                                        />
                                    </div>

                                    {config.keepAlive && (
                                        <>
                                            <Separator className="my-1 bg-border/30" />
                                            <div className="grid grid-cols-2 gap-3 pl-4">
                                                <div className="space-y-1.5">
                                                    <Label
                                                        className={
                                                            labelClassName
                                                        }
                                                    >
                                                        Interval (sec)
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        value={
                                                            config.keepAliveInterval
                                                        }
                                                        onChange={(e) =>
                                                            updateConfig({
                                                                keepAliveInterval:
                                                                    parseInt(
                                                                        e.target
                                                                            .value
                                                                    ) || 60,
                                                            })
                                                        }
                                                        className={
                                                            inputClassName
                                                        }
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label
                                                        className={
                                                            labelClassName
                                                        }
                                                    >
                                                        Max Count
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        value={
                                                            config.serverAliveCountMax
                                                        }
                                                        onChange={(e) =>
                                                            updateConfig({
                                                                serverAliveCountMax:
                                                                    parseInt(
                                                                        e.target
                                                                            .value
                                                                    ) || 3,
                                                            })
                                                        }
                                                        className={
                                                            inputClassName
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </TabsContent>
                        </div>
                    </ScrollArea>
                </Tabs>

                {/* Compact Footer */}
                <div className="px-4 py-3 ">
                    <div className="flex flex-col gap-3">
                        {/* Save Session Options */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="save-session"
                                    checked={saveAsSession}
                                    onCheckedChange={setSaveAsSession}
                                    className="scale-90"
                                />
                                <Label
                                    htmlFor="save-session"
                                    className="text-[11px] cursor-pointer text-muted-foreground"
                                >
                                    Save session
                                </Label>
                            </div>
                            {saveAsSession && (
                                <Select
                                    value={sessionFolder}
                                    onValueChange={setSessionFolder}
                                >
                                    <SelectTrigger className="w-[156px] h-7 text-[10px] bg-background/50 border-border/50 max-h-8">
                                        <FolderOpen className="w-3 h-3 mr-1.5 text-muted-foreground" />
                                        <SelectValue placeholder="Select folder" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableFolders.length > 0 ? (
                                            availableFolders.map((folder) => (
                                                <SelectItem
                                                    key={folder}
                                                    value={folder}
                                                    className="text-xs"
                                                >
                                                    {folder}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem
                                                value="All Sessions"
                                                className="text-xs"
                                            >
                                                All Sessions
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelConnectionAttempt}
                                disabled={isCancelling}
                                className="h-8 px-4 text-xs"
                            >
                                {isConnecting
                                    ? isCancelling
                                        ? "Cancelling..."
                                        : "Stop"
                                    : "Cancel"}
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleConnect}
                                disabled={isConnecting}
                                className="h-8 px-4 text-xs gap-1.5"
                            >
                                {isConnecting ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Connecting...
                                    </>
                                ) : editingSession ? (
                                    "Update"
                                ) : (
                                    "Connect"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
