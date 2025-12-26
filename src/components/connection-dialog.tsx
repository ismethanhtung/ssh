import React, { useState, useEffect, useRef } from "react";
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
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
    ConnectionProfileManager,
    type ConnectionProfile,
} from "../lib/connection-profiles";
import { SessionStorageManager } from "../lib/session-storage";
import { toast } from "sonner";
import { Server, Key } from "lucide-react";

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
            toast.error("Password Required", {
                description:
                    "Please enter a password for password authentication.",
            });
            resetConnectionState();
            return;
        }

        if (config.authMethod === "publickey" && !config.privateKeyPath) {
            toast.error("Private Key Required", {
                description:
                    "Please select or enter the path to your SSH private key file.",
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
                    toast.error("Connection Failed", {
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>
                        {editingSession ? "Edit Session" : "New Session"}
                    </DialogTitle>
                    <DialogDescription>
                        Configure your connection settings
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="connection" className="w-full">
                    <TabsList className="grid w-full grid-cols-5 bg-transparent gap-1 p-0 h-auto mb-4">
                        <TabsTrigger
                            value="connection"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                        >
                            Connection
                        </TabsTrigger>
                        <TabsTrigger
                            value="authentication"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                        >
                            Authentication
                        </TabsTrigger>
                        <TabsTrigger
                            value="proxy"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                        >
                            Proxy
                        </TabsTrigger>
                        <TabsTrigger
                            value="tunnels"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                        >
                            SSH Tunnels
                        </TabsTrigger>
                        <TabsTrigger
                            value="advanced"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                        >
                            Advanced
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="connection" className="space-y-4">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="session-name">
                                        Session Name
                                    </Label>
                                    <Input
                                        id="session-name"
                                        placeholder="My Server"
                                        value={config.name}
                                        onChange={(e) =>
                                            updateConfig({
                                                name: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="protocol">Protocol</Label>
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
                                                port: defaultPorts[value],
                                            });
                                        }}
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
                                            <SelectItem value="Serial">
                                                Serial
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <Label htmlFor="host">Host</Label>
                                    <Input
                                        id="host"
                                        placeholder="192.168.1.100 or example.com"
                                        value={config.host}
                                        onChange={(e) =>
                                            updateConfig({
                                                host: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="port">Port</Label>
                                    <Input
                                        id="port"
                                        type="number"
                                        value={config.port}
                                        onChange={(e) =>
                                            updateConfig({
                                                port:
                                                    parseInt(e.target.value) ||
                                                    22,
                                            })
                                        }
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    placeholder="root"
                                    value={config.username}
                                    onChange={(e) =>
                                        updateConfig({
                                            username: e.target.value,
                                        })
                                    }
                                />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="authentication" className="space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Authentication Method</Label>
                                <Select
                                    value={config.authMethod}
                                    onValueChange={(
                                        value: SessionConfig["authMethod"]
                                    ) => updateConfig({ authMethod: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="password">
                                            Password
                                        </SelectItem>
                                        <SelectItem value="publickey">
                                            Public Key
                                        </SelectItem>
                                        <SelectItem value="keyboard-interactive">
                                            Keyboard Interactive
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {config.authMethod === "password" && (
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="Enter password"
                                        value={config.password}
                                        onChange={(e) =>
                                            updateConfig({
                                                password: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                            )}

                            {config.authMethod === "publickey" && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="private-key">
                                            Private Key File
                                        </Label>
                                        <Input
                                            id="private-key"
                                            placeholder="~/.ssh/id_rsa"
                                            value={config.privateKeyPath}
                                            onChange={(e) =>
                                                updateConfig({
                                                    privateKeyPath:
                                                        e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="passphrase">
                                            Passphrase (optional)
                                        </Label>
                                        <Input
                                            id="passphrase"
                                            type="password"
                                            placeholder="Enter passphrase"
                                            value={config.passphrase}
                                            onChange={(e) =>
                                                updateConfig({
                                                    passphrase: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="proxy" className="space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Proxy Type</Label>
                                <Select
                                    value={config.proxyType}
                                    onValueChange={(value: string) =>
                                        updateConfig({
                                            proxyType:
                                                value as SessionConfig["proxyType"],
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            No Proxy
                                        </SelectItem>
                                        <SelectItem value="http">
                                            HTTP Proxy
                                        </SelectItem>
                                        <SelectItem value="socks4">
                                            SOCKS4
                                        </SelectItem>
                                        <SelectItem value="socks5">
                                            SOCKS5
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {config.proxyType !== "none" && (
                                <>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2 space-y-2">
                                            <Label htmlFor="proxy-host">
                                                Proxy Host
                                            </Label>
                                            <Input
                                                id="proxy-host"
                                                placeholder="proxy.example.com"
                                                value={config.proxyHost}
                                                onChange={(e) =>
                                                    updateConfig({
                                                        proxyHost:
                                                            e.target.value,
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="proxy-port">
                                                Proxy Port
                                            </Label>
                                            <Input
                                                id="proxy-port"
                                                type="number"
                                                value={config.proxyPort}
                                                onChange={(e) =>
                                                    updateConfig({
                                                        proxyPort:
                                                            parseInt(
                                                                e.target.value
                                                            ) || 8080,
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="proxy-username">
                                                Proxy Username
                                            </Label>
                                            <Input
                                                id="proxy-username"
                                                placeholder="Optional"
                                                value={config.proxyUsername}
                                                onChange={(e) =>
                                                    updateConfig({
                                                        proxyUsername:
                                                            e.target.value,
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="proxy-password">
                                                Proxy Password
                                            </Label>
                                            <Input
                                                id="proxy-password"
                                                type="password"
                                                placeholder="Optional"
                                                value={config.proxyPassword}
                                                onChange={(e) =>
                                                    updateConfig({
                                                        proxyPassword:
                                                            e.target.value,
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="tunnels" className="space-y-4">
                        <div className="space-y-4">
                            <div className="grid grid-cols-7 gap-2 items-end">
                                <div className="col-span-2 space-y-2">
                                    <Label htmlFor="local-port">
                                        Local Port
                                    </Label>
                                    <Input
                                        id="local-port"
                                        type="number"
                                        placeholder="14333"
                                        value={newForward.localPort || ""}
                                        onChange={(e) =>
                                            setNewForward({
                                                ...newForward,
                                                localPort:
                                                    parseInt(e.target.value) ||
                                                    0,
                                            })
                                        }
                                    />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <Label htmlFor="remote-host">
                                        Remote Host
                                    </Label>
                                    <Input
                                        id="remote-host"
                                        placeholder="172.17.0.1"
                                        value={newForward.remoteHost}
                                        onChange={(e) =>
                                            setNewForward({
                                                ...newForward,
                                                remoteHost: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <Label htmlFor="remote-port">
                                        Remote Port
                                    </Label>
                                    <Input
                                        id="remote-port"
                                        type="number"
                                        placeholder="1433"
                                        value={newForward.remotePort || ""}
                                        onChange={(e) =>
                                            setNewForward({
                                                ...newForward,
                                                remotePort:
                                                    parseInt(e.target.value) ||
                                                    0,
                                            })
                                        }
                                    />
                                </div>
                                <Button
                                    type="button"
                                    className="w-full"
                                    onClick={() => {
                                        if (
                                            newForward.localPort &&
                                            newForward.remoteHost &&
                                            newForward.remotePort
                                        ) {
                                            // Check if local port is already in use in this session config
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
                                                ...(config.forwardPorts || []),
                                                { ...newForward },
                                            ];
                                            updateConfig({
                                                forwardPorts: updatedPorts,
                                            });
                                            setNewForward({
                                                localPort: 0,
                                                remoteHost: "127.0.0.1",
                                                remotePort: 0,
                                            });
                                        } else {
                                            toast.error(
                                                "Please fill all tunnel fields"
                                            );
                                        }
                                    }}
                                >
                                    Add
                                </Button>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label>Configured Tunnels (L)</Label>
                                <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                                    {config.forwardPorts &&
                                    config.forwardPorts.length > 0 ? (
                                        config.forwardPorts.map((fp, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between p-3 text-sm"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline">
                                                        L
                                                    </Badge>
                                                    <span>
                                                        {fp.localPort} :{" "}
                                                        {fp.remoteHost} :{" "}
                                                        {fp.remotePort}
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => {
                                                        const updatedPorts =
                                                            config.forwardPorts?.filter(
                                                                (_, i) =>
                                                                    i !== index
                                                            );
                                                        updateConfig({
                                                            forwardPorts:
                                                                updatedPorts,
                                                        });
                                                    }}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-muted-foreground text-sm">
                                            No port forwarding configured
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="advanced" className="space-y-4">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Enable Compression</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Compress data to improve performance
                                        over slow connections
                                    </p>
                                </div>
                                <Switch
                                    checked={config.compression}
                                    onCheckedChange={(checked) =>
                                        updateConfig({ compression: checked })
                                    }
                                />
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Keep Alive</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Send keep-alive messages to prevent
                                        connection timeout
                                    </p>
                                </div>
                                <Switch
                                    checked={config.keepAlive}
                                    onCheckedChange={(checked) =>
                                        updateConfig({ keepAlive: checked })
                                    }
                                />
                            </div>

                            {config.keepAlive && (
                                <div className="grid grid-cols-2 gap-4 ml-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="keep-alive-interval">
                                            Interval (seconds)
                                        </Label>
                                        <Input
                                            id="keep-alive-interval"
                                            type="number"
                                            value={config.keepAliveInterval}
                                            onChange={(e) =>
                                                updateConfig({
                                                    keepAliveInterval:
                                                        parseInt(
                                                            e.target.value
                                                        ) || 60,
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="max-count">
                                            Max Count
                                        </Label>
                                        <Input
                                            id="max-count"
                                            type="number"
                                            value={config.serverAliveCountMax}
                                            onChange={(e) =>
                                                updateConfig({
                                                    serverAliveCountMax:
                                                        parseInt(
                                                            e.target.value
                                                        ) || 3,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <div className="flex flex-col gap-4 w-full">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="save-session"
                                    checked={saveAsSession}
                                    onCheckedChange={setSaveAsSession}
                                />
                                <Label
                                    htmlFor="save-session"
                                    className="text-sm cursor-pointer"
                                >
                                    Save as session
                                </Label>
                            </div>
                            {saveAsSession && (
                                <Select
                                    value={sessionFolder}
                                    onValueChange={setSessionFolder}
                                >
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Select folder" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableFolders.length > 0 ? (
                                            availableFolders.map((folder) => (
                                                <SelectItem
                                                    key={folder}
                                                    value={folder}
                                                >
                                                    {folder}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem value="All Sessions">
                                                All Sessions
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={handleCancelConnectionAttempt}
                                disabled={isCancelling}
                            >
                                {isConnecting
                                    ? isCancelling
                                        ? "Cancelling..."
                                        : "Stop"
                                    : "Cancel"}
                            </Button>
                            <Button
                                onClick={handleConnect}
                                disabled={isConnecting}
                            >
                                {isConnecting
                                    ? "Connecting..."
                                    : editingSession
                                    ? "Update"
                                    : "Connect"}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
