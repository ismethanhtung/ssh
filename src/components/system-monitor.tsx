import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    Activity,
    Terminal,
    HardDrive,
    Network,
    ArrowDownUp,
    Gauge,
    X,
    ArrowDown,
    Loader2,
    Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";
import { Button } from "./ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "./ui/alert-dialog";
import { toast } from "sonner";
import { useMonitoring } from "@/lib/system-monitoring-context";

interface CpuDetails {
    total_percent: number;
    user_percent: number;
    system_percent: number;
    iowait_percent: number;
    cores: number;
    load_average_1m: number;
    load_average_5m: number;
    load_average_15m: number;
}

interface SystemStats {
    cpu: number;
    cpu_details: CpuDetails;
    memory: number;
    memoryTotal?: number;
    memoryUsed?: number;
    swap?: number;
    swapTotal?: number;
    swapUsed?: number;
    diskUsage: number;
    uptime: string;
}

interface SystemMonitorProps {
    sessionId?: string;
    onPathClick?: (path: string) => void;
}

interface Process {
    pid: number;
    user: string;
    cpu: number;
    mem: number;
    command: string;
}

interface DiskUsage {
    path: string;
    filesystem: string;
    total: string;
    available: string;
    usage: number;
    inodes_total?: string;
    inodes_usage?: number;
}

interface LatencyData {
    time: string;
    latency: number;
    timestamp: number;
}

interface NetworkUsage {
    upload: number;
    download: number;
    uploadFormatted: string;
    downloadFormatted: string;
}

interface NetworkHistoryData {
    time: string;
    download: number;
    upload: number;
    timestamp: number;
}

interface NetworkSocketStats {
    total: number;
    tcp_total: number;
    tcp_established: number;
    tcp_timewait: number;
    tcp_synrecv: number;
    udp_total: number;
    // nf_conntrack - critical for EC2/Linux servers
    conntrack_current: number;
    conntrack_max: number;
    conntrack_percent: number;
    // Timestamp for rate calculation
    timestamp_ms: number;
}

// Global utility functions for percentage color coding
const getUsageColor = (usage: number): string => {
    if (usage >= 90) return "text-red-500";
    if (usage >= 75) return "text-orange-500";
    if (usage >= 50) return "text-yellow-500";
    return "text-green-500";
};

const getProgressColor = (usage: number): string => {
    if (usage >= 90) return "[&>div]:bg-red-500";
    if (usage >= 75) return "[&>div]:bg-orange-500";
    if (usage >= 50) return "[&>div]:bg-yellow-500";
    return "[&>div]:bg-green-500";
};

export function SystemMonitor({ sessionId, onPathClick }: SystemMonitorProps) {
    const { updateMonitoringData } = useMonitoring();
    const [stats, setStats] = useState<SystemStats>({
        cpu: 0,
        cpu_details: {
            total_percent: 0,
            user_percent: 0,
            system_percent: 0,
            iowait_percent: 0,
            cores: 0,
            load_average_1m: 0,
            load_average_5m: 0,
            load_average_15m: 0,
        },
        memory: 0,
        diskUsage: 0,
        uptime: "0:00:00",
    });
    const [processes, setProcesses] = useState<Process[]>([]);
    const [processToKill, setProcessToKill] = useState<Process | null>(null);
    const [processSortBy, setProcessSortBy] = useState<"cpu" | "mem">("cpu");
    const [disks, setDisks] = useState<DiskUsage[]>([]);
    const [socketStats, setSocketStats] = useState<NetworkSocketStats | null>(
        null
    );
    // Store previous snapshot for rate calculation
    const prevSocketStatsRef = useRef<NetworkSocketStats | null>(null);
    const [networkRates, setNetworkRates] = useState<{
        connectionsPerSec: number;
        synPerSec: number;
    }>({ connectionsPerSec: 0, synPerSec: 0 });

    // Refs to track fetching state and prevent concurrent requests
    const isFetchingStats = useRef(false);
    const isFetchingProcesses = useRef(false);
    const isFetchingBandwidth = useRef(false);
    const isFetchingLatency = useRef(false);

    // Fetch system stats from backend - OPTIMIZED with concurrent request prevention
    const fetchSystemStats = useCallback(async () => {
        if (!sessionId || isFetchingStats.current) return;

        isFetchingStats.current = true;
        try {
            const response = await invoke<{
                success: boolean;
                stats: {
                    cpu_percent: number;
                    cpu_details: {
                        total_percent: number;
                        user_percent: number;
                        system_percent: number;
                        iowait_percent: number;
                        cores: number;
                        load_average_1m: number;
                        load_average_5m: number;
                        load_average_15m: number;
                    };
                    memory: {
                        total: number;
                        used: number;
                        free: number;
                        available: number;
                    };
                    swap: {
                        total: number;
                        used: number;
                        free: number;
                        available: number;
                    };
                    disk: {
                        total: string;
                        used: string;
                        available: string;
                        use_percent: number;
                    };
                    uptime: string;
                    load_average?: string;
                };
                error?: string;
            }>("get_system_stats", { sessionId });

            if (!response.success) {
                console.error("Failed to fetch system stats:", response.error);
                return;
            }

            const stats = response.stats;

            // Calculate memory percentage
            const memoryPercent =
                stats.memory.total > 0
                    ? (stats.memory.used / stats.memory.total) * 100
                    : 0;

            // Calculate swap percentage
            const swapPercent =
                stats.swap.total > 0
                    ? (stats.swap.used / stats.swap.total) * 100
                    : 0;

            setStats({
                cpu: stats.cpu_percent,
                cpu_details: {
                    total_percent: stats.cpu_details.total_percent,
                    user_percent: stats.cpu_details.user_percent,
                    system_percent: stats.cpu_details.system_percent,
                    iowait_percent: stats.cpu_details.iowait_percent,
                    cores: stats.cpu_details.cores,
                    load_average_1m: stats.cpu_details.load_average_1m,
                    load_average_5m: stats.cpu_details.load_average_5m,
                    load_average_15m: stats.cpu_details.load_average_15m,
                },
                memory: memoryPercent,
                memoryTotal: stats.memory.total,
                memoryUsed: stats.memory.used,
                swap: swapPercent,
                swapTotal: stats.swap.total,
                swapUsed: stats.swap.used,
                diskUsage: stats.disk.use_percent,
                uptime: stats.uptime,
            });

            // Update context
            updateMonitoringData(sessionId, { stats });
        } catch (error) {
            console.error("Failed to fetch system stats:", error);
        } finally {
            isFetchingStats.current = false;
        }
    }, [sessionId]);

    // Fetch process list from backend - OPTIMIZED with concurrent request prevention
    const fetchProcesses = useCallback(async () => {
        if (!sessionId || isFetchingProcesses.current) return;

        isFetchingProcesses.current = true;
        try {
            const result = await invoke<{
                success: boolean;
                processes?: Array<{
                    pid: string;
                    user: string;
                    cpu: string;
                    mem: string;
                    command: string;
                }>;
                error?: string;
            }>("get_processes", {
                sessionId: sessionId,
                sortBy: processSortBy,
            });

            if (result.success && result.processes) {
                // Convert string values to numbers
                const processesWithNumbers = result.processes.map((p) => ({
                    pid: parseInt(p.pid),
                    user: p.user,
                    cpu: parseFloat(p.cpu),
                    mem: parseFloat(p.mem),
                    command: p.command,
                }));
                setProcesses(processesWithNumbers);

                // Update context
                updateMonitoringData(sessionId, {
                    processes: result.processes,
                });
            }
        } catch (error) {
            console.error("Failed to fetch processes:", error);
        } finally {
            isFetchingProcesses.current = false;
        }
    }, [sessionId, processSortBy]);

    // Kill a process
    const handleKillProcess = async (process: Process) => {
        if (!sessionId) return;

        try {
            const result = await invoke<{
                success: boolean;
                output?: string;
                error?: string;
            }>("kill_process", {
                sessionId: sessionId,
                pid: process.pid,
                signal: 15, // SIGTERM
            });

            if (result.success) {
                toast.success(`Process ${process.pid} terminated successfully`);
                // Refresh process list
                await fetchProcesses();
            } else {
                toast.error(
                    `Failed to kill process: ${result.error || "Unknown error"}`
                );
            }
        } catch (error) {
            console.error("Failed to kill process:", error);
            toast.error(`Failed to kill process: ${error}`);
        }

        setProcessToKill(null);
    };

    // Poll system stats - HEAVILY OPTIMIZED for smooth, fast updates
    useEffect(() => {
        if (!sessionId) {
            // Clear data when no session
            setStats({
                cpu: 0,
                cpu_details: {
                    total_percent: 0,
                    user_percent: 0,
                    system_percent: 0,
                    iowait_percent: 0,
                    cores: 0,
                    load_average_1m: 0,
                    load_average_5m: 0,
                    load_average_15m: 0,
                },
                memory: 0,
                diskUsage: 0,
                uptime: "0:00:00",
            });
            setProcesses([]);
            return;
        }

        // Fetch immediately when session changes
        fetchSystemStats();
        fetchProcesses();

        // OPTIMIZED: Balanced intervals for smooth monitoring without being too aggressive
        const statsInterval = setInterval(() => {
            fetchSystemStats();
        }, 4000); // 4 seconds - good balance for CPU/Memory monitoring

        const processInterval = setInterval(() => {
            fetchProcesses();
        }, 5000); // 5 seconds - reasonable for process list

        return () => {
            clearInterval(statsInterval);
            clearInterval(processInterval);
        };
    }, [sessionId, fetchSystemStats, fetchProcesses]);

    // Fetch disk usage data - OPTIMIZED
    const fetchDiskUsage = useCallback(async () => {
        if (!sessionId) {
            setDisks([]);
            return;
        }

        try {
            const result = await invoke<{
                success: boolean;
                disks: Array<{
                    filesystem: string;
                    path: string;
                    total: string;
                    available: string;
                    usage: number;
                    inodes_total: string;
                    inodes_usage: number;
                }>;
                error?: string;
            }>("get_disk_usage", { sessionId });

            if (result.success) {
                setDisks(result.disks);
                // Update context
                updateMonitoringData(sessionId, { disks: result.disks });
            } else {
                console.error("Failed to fetch disk usage:", result.error);
            }
        } catch (error) {
            console.error("Failed to fetch disk usage:", error);
        }
    }, [sessionId]);

    // Fetch disk usage on mount and when session changes
    // Disk usage changes slowly, so longer interval is fine
    useEffect(() => {
        if (!sessionId) return;

        fetchDiskUsage();

        // Refresh disk usage every 30 seconds
        const interval = setInterval(() => {
            fetchDiskUsage();
        }, 30000);

        return () => clearInterval(interval);
    }, [sessionId, fetchDiskUsage]);

    // Fetch network socket stats - OPTIMIZED
    const fetchSocketStats = useCallback(async () => {
        if (!sessionId) return;

        try {
            const result = await invoke<{
                success: boolean;
                stats: NetworkSocketStats;
                error?: string;
            }>("get_network_socket_stats", { sessionId });

            if (result.success && result.stats) {
                const currentStats = result.stats;

                // Calculate rates if we have previous snapshot
                if (
                    prevSocketStatsRef.current &&
                    currentStats.timestamp_ms > 0 &&
                    prevSocketStatsRef.current.timestamp_ms > 0
                ) {
                    const timeDeltaSec =
                        (currentStats.timestamp_ms -
                            prevSocketStatsRef.current.timestamp_ms) /
                        1000;
                    if (timeDeltaSec > 0) {
                        const connDelta =
                            currentStats.total -
                            prevSocketStatsRef.current.total;
                        const synDelta =
                            currentStats.tcp_synrecv -
                            prevSocketStatsRef.current.tcp_synrecv;

                        setNetworkRates({
                            connectionsPerSec: Math.max(
                                0,
                                connDelta / timeDeltaSec
                            ),
                            synPerSec: Math.max(0, synDelta / timeDeltaSec),
                        });
                    }
                }

                // Store current as previous for next calculation
                prevSocketStatsRef.current = currentStats;

                setSocketStats(currentStats);
                // Update context
                updateMonitoringData(sessionId, { socketStats: currentStats });
            } else {
                console.error(
                    "Backend failed to get socket stats:",
                    result.error
                );
                // Set empty stats to stop spinner if error occurs
                setSocketStats({
                    total: 0,
                    tcp_total: 0,
                    tcp_established: 0,
                    tcp_timewait: 0,
                    tcp_synrecv: 0,
                    udp_total: 0,
                    conntrack_current: 0,
                    conntrack_max: 0,
                    conntrack_percent: 0,
                    timestamp_ms: 0,
                });
            }
        } catch (error) {
            console.error("Failed to fetch socket stats:", error);
        }
    }, [sessionId, updateMonitoringData]);

    useEffect(() => {
        if (!sessionId) return;

        fetchSocketStats();
        const interval = setInterval(fetchSocketStats, 10000); // 10 seconds for network health

        return () => clearInterval(interval);
    }, [sessionId, fetchSocketStats]);

    const [latencyData, setLatencyData] = useState<LatencyData[]>([]);
    const [networkUsage, setNetworkUsage] = useState<NetworkUsage>({
        upload: 0,
        download: 0,
        uploadFormatted: "0 KB/s",
        downloadFormatted: "0 KB/s",
    });
    const [networkHistory, setNetworkHistory] = useState<NetworkHistoryData[]>(
        []
    );
    const [systemInfo, setSystemInfo] = useState<{
        os: string;
        kernel: string;
        hostname: string;
        architecture: string;
    }>({
        os: "",
        kernel: "",
        hostname: "",
        architecture: "",
    });

    // System information monitoring - only fetch once per session
    useEffect(() => {
        if (!sessionId) {
            setSystemInfo({
                os: "",
                kernel: "",
                hostname: "",
                architecture: "",
            });
            return;
        }

        const fetchSystemInfo = async () => {
            // Only fetch if we don't already have the data
            if (systemInfo.os !== "") return;

            try {
                const result = await invoke<{
                    success: boolean;
                    os?: string;
                    kernel?: string;
                    hostname?: string;
                    architecture?: string;
                    error?: string;
                }>("get_system_info", { sessionId });

                if (result.success) {
                    setSystemInfo({
                        os: result.os || "Unknown",
                        kernel: result.kernel || "Unknown",
                        hostname: result.hostname || "Unknown",
                        architecture: result.architecture || "Unknown",
                    });
                }
            } catch (error) {
                console.error("Failed to fetch system info:", error);
            }
        };

        fetchSystemInfo();
        // No interval needed - system info doesn't change during session
    }, [sessionId]);

    // Network usage monitoring - HEAVILY OPTIMIZED for real-time updates
    useEffect(() => {
        if (!sessionId) {
            setNetworkHistory([]);
            return;
        }

        const fetchBandwidth = async () => {
            if (isFetchingBandwidth.current) return;

            isFetchingBandwidth.current = true;
            try {
                const result = await invoke<{
                    success: boolean;
                    bandwidth: Array<{
                        interface: string;
                        rx_bytes_per_sec: number;
                        tx_bytes_per_sec: number;
                    }>;
                    error?: string;
                }>("get_network_bandwidth", { sessionId });

                if (result.success && result.bandwidth.length > 0) {
                    // Sum all interfaces for total bandwidth
                    let totalDownload = 0;
                    let totalUpload = 0;

                    result.bandwidth.forEach((iface) => {
                        totalDownload += iface.rx_bytes_per_sec;
                        totalUpload += iface.tx_bytes_per_sec;
                    });

                    // Convert bytes/sec to KB/s
                    const downloadKBps = totalDownload / 1024;
                    const uploadKBps = totalUpload / 1024;

                    const formatSpeed = (kbps: number): string => {
                        if (kbps >= 1024) {
                            return `${(kbps / 1024).toFixed(1)} MB/s`;
                        }
                        return `${kbps.toFixed(0)} KB/s`;
                    };

                    setNetworkUsage({
                        upload: uploadKBps,
                        download: downloadKBps,
                        uploadFormatted: formatSpeed(uploadKBps),
                        downloadFormatted: formatSpeed(downloadKBps),
                    });

                    // Update history
                    const now = new Date();
                    const newHistoryPoint: NetworkHistoryData = {
                        time: now.toLocaleTimeString().slice(0, 8),
                        download: Math.round(downloadKBps),
                        upload: Math.round(uploadKBps),
                        timestamp: now.getTime(),
                    };

                    setNetworkHistory((prev) => {
                        const updated = [...prev, newHistoryPoint];
                        // Keep only last 60 data points (2 minutes) - reduced for better performance
                        return updated.slice(-60);
                    });
                }
            } catch (error) {
                console.error("Failed to fetch network bandwidth:", error);
            } finally {
                isFetchingBandwidth.current = false;
            }
        };

        // Initial fetch
        fetchBandwidth();

        // OPTIMIZED: 3-second interval for balanced network monitoring
        const interval = setInterval(() => {
            fetchBandwidth();
        }, 3000);

        return () => clearInterval(interval);
    }, [sessionId]);

    // Network latency monitoring - OPTIMIZED for responsive updates
    useEffect(() => {
        if (!sessionId) {
            setLatencyData([]);
            return;
        }

        const fetchLatency = async () => {
            if (isFetchingLatency.current) return;

            isFetchingLatency.current = true;
            try {
                const result = await invoke<{
                    success: boolean;
                    latency_ms?: number;
                    error?: string;
                }>("get_network_latency", {
                    sessionId,
                    target: "8.8.8.8", // Ping Google DNS
                });

                if (result.success && result.latency_ms !== undefined) {
                    const now = new Date();
                    const newDataPoint: LatencyData = {
                        time: now.toLocaleTimeString().slice(0, 8),
                        latency: Math.round(result.latency_ms * 10) / 10,
                        timestamp: now.getTime(),
                    };

                    setLatencyData((prev) => {
                        const updated = [...prev, newDataPoint];
                        // Keep only last 30 data points - reduced for better performance
                        return updated.slice(-30);
                    });
                }
            } catch (error) {
                console.error("Failed to fetch network latency:", error);
            } finally {
                isFetchingLatency.current = false;
            }
        };

        // Initial fetch
        fetchLatency();

        // OPTIMIZED: 30-second interval - reasonable for network latency monitoring
        const interval = setInterval(() => {
            fetchLatency();
        }, 30000);

        return () => clearInterval(interval);
    }, [sessionId]);

    // Memoize formatted values to prevent unnecessary re-renders
    const formattedStats = useMemo(
        () => ({
            cpu: stats.cpu.toFixed(1),
            memory: stats.memory.toFixed(1),
            swap: (stats.swap || 0).toFixed(1),
            cpuUser: stats.cpu_details?.user_percent?.toFixed(1) || "0.0",
            cpuSystem: stats.cpu_details?.system_percent?.toFixed(1) || "0.0",
            cpuIowait: stats.cpu_details?.iowait_percent?.toFixed(1) || "0.0",
            loadAvg1: stats.cpu_details?.load_average_1m?.toFixed(2) || "0.00",
            loadAvg5: stats.cpu_details?.load_average_5m?.toFixed(2) || "0.00",
            loadAvg15:
                stats.cpu_details?.load_average_15m?.toFixed(2) || "0.00",
        }),
        [stats]
    );

    // Memoize network chart data transformation
    const networkChartData = useMemo(
        () =>
            networkHistory.map((item) => ({
                ...item,
                uploadPositive: item.upload,
                downloadNegative: -item.download,
            })),
        [networkHistory]
    );

    return (
        <ScrollArea className="h-full">
            <div className="space-y-2.5">
                {/* System Overview */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <Activity className="w-3 h-3 shrink-0" />
                        <h3 className="text-xs font-medium truncate">
                            System Overview
                        </h3>
                    </div>
                    <Card>
                        <CardContent className="p-2 space-y-1.5">
                            <div className="space-y-1">
                                <div className="flex justify-between items-center gap-1">
                                    <span className="text-xs font-medium">
                                        Memory
                                    </span>
                                    <span
                                        className={`text-xs font-semibold ${getUsageColor(
                                            stats.memory
                                        )} truncate`}
                                        title={
                                            stats.memoryUsed &&
                                            stats.memoryTotal
                                                ? `${stats.memoryUsed}MB / ${stats.memoryTotal}MB`
                                                : ""
                                        }
                                    >
                                        {formattedStats.memory}%
                                    </span>
                                </div>
                                <Progress
                                    value={stats.memory}
                                    className={`h-1.5 ${getProgressColor(
                                        stats.memory
                                    )}`}
                                />
                                {stats.memoryUsed && stats.memoryTotal && (
                                    <div className="text-[9px] text-muted-foreground text-right leading-tight">
                                        {stats.memoryUsed}MB /{" "}
                                        {stats.memoryTotal}MB
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium">
                                        CPU
                                    </span>
                                    <span
                                        className={`text-xs font-semibold ${getUsageColor(
                                            stats.cpu
                                        )}`}
                                    >
                                        {formattedStats.cpu}%
                                    </span>
                                </div>
                                <Progress
                                    value={stats.cpu}
                                    className={`h-1.5 ${getProgressColor(
                                        stats.cpu
                                    )}`}
                                />

                                {/* CPU Usage Breakdown */}
                                <div className="grid grid-cols-3 gap-1">
                                    <div className="text-center">
                                        <div
                                            className={`text-[9px] font-semibold ${getUsageColor(
                                                stats.cpu_details
                                                    ?.user_percent || 0
                                            )}`}
                                        >
                                            {formattedStats.cpuUser}%
                                        </div>
                                        <div className="text-[8px] text-muted-foreground">
                                            User
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div
                                            className={`text-[9px] font-semibold ${getUsageColor(
                                                stats.cpu_details
                                                    ?.system_percent || 0
                                            )}`}
                                        >
                                            {formattedStats.cpuSystem}%
                                        </div>
                                        <div className="text-[8px] text-muted-foreground">
                                            System
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div
                                            className={`text-[9px] font-semibold ${getUsageColor(
                                                stats.cpu_details
                                                    ?.iowait_percent || 0
                                            )}`}
                                        >
                                            {formattedStats.cpuIowait}%
                                        </div>
                                        <div className="text-[8px] text-muted-foreground">
                                            I/O Wait
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CPU Cores and Load Average */}
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                                <div className="text-center">
                                    <div className="text-[10px] font-medium text-muted-foreground">
                                        CPU Cores
                                    </div>
                                    <div className="text-[9px] font-mono">
                                        {stats.cpu_details?.cores || "N/A"}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] font-medium text-muted-foreground">
                                        Load Average
                                    </div>
                                    <div className="text-[9px] font-mono">
                                        {formattedStats.loadAvg1} /{" "}
                                        {formattedStats.loadAvg5} /{" "}
                                        {formattedStats.loadAvg15}
                                    </div>
                                </div>
                            </div>

                            {/* Swap Space - Only show if swap exists */}
                            {stats.swapTotal !== undefined &&
                                stats.swapTotal > 0 && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center gap-1">
                                            <span className="text-xs font-medium">
                                                Swap
                                            </span>
                                            <span
                                                className={`text-xs font-semibold ${getUsageColor(
                                                    stats.swap || 0
                                                )} truncate`}
                                                title={
                                                    stats.swapUsed !==
                                                        undefined &&
                                                    stats.swapTotal
                                                        ? `${stats.swapUsed}MB / ${stats.swapTotal}MB`
                                                        : ""
                                                }
                                            >
                                                {formattedStats.swap}%
                                            </span>
                                        </div>
                                        <Progress
                                            value={stats.swap || 0}
                                            className={`h-1.5 ${getProgressColor(
                                                stats.swap || 0
                                            )}`}
                                        />
                                        {stats.swapUsed !== undefined &&
                                            stats.swapTotal && (
                                                <div className="text-[9px] text-muted-foreground text-right leading-tight">
                                                    {stats.swapUsed}MB /{" "}
                                                    {stats.swapTotal}MB
                                                </div>
                                            )}
                                    </div>
                                )}
                        </CardContent>
                    </Card>
                </div>

                {/* System Information */}

                {/* Running Processes */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <Terminal className="w-3 h-3 shrink-0" />
                        <h3 className="text-xs font-medium truncate">
                            Running Processes
                        </h3>
                    </div>
                    <Card className="border-0">
                        <CardContent className="p-0">
                            <div className="rounded-md border h-48 overflow-auto">
                                <table className="w-full caption-bottom text-sm">
                                    <thead className="[&_tr]:border-b">
                                        <tr className="border-b transition-colors">
                                            <th className="sticky top-0 z-10 bg-background text-foreground h-8 px-1 text-left align-middle font-medium whitespace-nowrap text-xs">
                                                PID
                                            </th>
                                            <th
                                                className="sticky top-0 z-10 bg-background text-foreground h-8 px-1 text-left align-middle font-medium whitespace-nowrap text-xs cursor-pointer hover:bg-muted/50 select-none"
                                                onClick={() =>
                                                    setProcessSortBy("cpu")
                                                }
                                            >
                                                <div className="flex items-center gap-0.5">
                                                    CPU
                                                    {processSortBy ===
                                                        "cpu" && (
                                                        <ArrowDown className="w-2.5 h-2.5" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                className="sticky top-0 z-10 bg-background text-foreground h-8 px-1 text-left align-middle font-medium whitespace-nowrap text-xs cursor-pointer hover:bg-muted/50 select-none"
                                                onClick={() =>
                                                    setProcessSortBy("mem")
                                                }
                                            >
                                                <div className="flex items-center gap-0.5">
                                                    Mem
                                                    {processSortBy ===
                                                        "mem" && (
                                                        <ArrowDown className="w-2.5 h-2.5" />
                                                    )}
                                                </div>
                                            </th>
                                            <th className="sticky top-0 z-10 bg-background text-foreground h-8 px-1 text-left align-middle font-medium whitespace-nowrap text-xs">
                                                Command
                                            </th>
                                            <th className="sticky top-0  bg-background text-foreground h-8 px-1 text-left align-middle font-medium whitespace-nowrap text-xs w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&_tr:last-child]:border-0">
                                        {processes
                                            .slice(0, 8)
                                            .map((process) => (
                                                <tr
                                                    key={process.pid}
                                                    className="hover:bg-muted/50 border-b transition-colors"
                                                >
                                                    <td className="p-1 align-middle whitespace-nowrap text-[10px]">
                                                        {process.pid}
                                                    </td>
                                                    <td
                                                        className={`p-1 align-middle whitespace-nowrap text-[10px] font-semibold ${getUsageColor(
                                                            process.cpu
                                                        )}`}
                                                    >
                                                        {process.cpu.toFixed(0)}
                                                        %
                                                    </td>
                                                    <td
                                                        className={`p-1 align-middle whitespace-nowrap text-[10px] font-semibold ${getUsageColor(
                                                            process.mem
                                                        )}`}
                                                    >
                                                        {process.mem.toFixed(0)}
                                                        %
                                                    </td>
                                                    <td
                                                        className="p-1 align-middle whitespace-nowrap text-[10px] font-mono truncate max-w-0"
                                                        title={process.command}
                                                    >
                                                        {process.command}
                                                    </td>
                                                    <td className="p-1 align-middle whitespace-nowrap text-xs">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-4 w-4"
                                                            onClick={() =>
                                                                setProcessToKill(
                                                                    process
                                                                )
                                                            }
                                                            title="Kill process"
                                                        >
                                                            <X className="h-2.5 w-2.5" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Disk Usage */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <HardDrive className="w-3 h-3 shrink-0" />
                        <h3 className="text-xs font-medium truncate">
                            Disk Usage
                        </h3>
                    </div>
                    <Card className="border-0">
                        <CardContent className="p-0">
                            {disks.length === 0 ? (
                                <div className="p-2 text-[10px] text-muted-foreground">
                                    No disk information available
                                </div>
                            ) : (
                                <div className="rounded-md border h-48 overflow-auto">
                                    <table className="w-full caption-bottom text-sm">
                                        <thead className="[&_tr]:border-b">
                                            <tr className="border-b transition-colors">
                                                <th className="sticky top-0 z-10 bg-background text-foreground h-7 px-1 text-left align-middle font-medium text-xs">
                                                    Filesystem
                                                </th>
                                                <th className="sticky top-0 z-10 bg-background text-foreground h-7 px-1 text-left align-middle font-medium text-xs">
                                                    Mounted on
                                                </th>
                                                <th className="sticky top-0 z-10 bg-background text-foreground h-7 px-1 text-right align-middle font-medium text-xs">
                                                    Size
                                                </th>
                                                <th className="sticky top-0 z-10 bg-background text-foreground h-7 px-1 text-right align-middle font-medium text-xs">
                                                    Inodes
                                                </th>
                                                <th className="sticky top-0  bg-background text-foreground h-7 px-1 text-right align-middle font-medium text-xs">
                                                    Usage
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="[&_tr:last-child]:border-0">
                                            {disks.map((disk, index) => (
                                                <tr
                                                    key={index}
                                                    className="hover:bg-muted/50 border-b transition-colors group"
                                                >
                                                    <td className="p-1 align-middle font-mono text-[10px] truncate max-w-0">
                                                        {disk.filesystem}
                                                    </td>
                                                    <td
                                                        className={`p-1 align-middle font-medium text-[10px] truncate max-w-0 ${
                                                            onPathClick
                                                                ? "cursor-pointer hover:text-blue-500 hover:underline"
                                                                : ""
                                                        }`}
                                                        title={`${disk.path} (${disk.filesystem}) - Click to explore`}
                                                        onClick={() =>
                                                            onPathClick?.(
                                                                disk.path
                                                            )
                                                        }
                                                    >
                                                        {disk.path}
                                                    </td>
                                                    <td className="p-1 align-middle text-right font-mono text-[10px] whitespace-nowrap">
                                                        {disk.total}
                                                    </td>
                                                    <td className="p-1 align-middle text-right">
                                                        <div
                                                            className="flex flex-col items-end gap-0"
                                                            title={`Inodes: ${disk.inodes_total}`}
                                                        >
                                                            <span
                                                                className={`font-mono text-[10px] font-semibold ${getUsageColor(
                                                                    disk.inodes_usage ||
                                                                        0
                                                                )}`}
                                                            >
                                                                {
                                                                    disk.inodes_usage
                                                                }
                                                                %
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-1 align-middle text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span
                                                                className={`font-mono text-[10px] font-semibold ${getUsageColor(
                                                                    disk.usage
                                                                )}`}
                                                            >
                                                                {disk.usage}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Network Usage */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <ArrowDownUp className="w-3 h-3 shrink-0" />
                        <h3 className="text-xs font-medium truncate">
                            Network Usage
                        </h3>
                    </div>
                    <Card>
                        <CardContent className="p-2 space-y-2">
                            {/* Current Speeds */}
                            <div className="grid grid-cols-2 gap-1.5">
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] shrink-0" />
                                        <div className="text-[9px] text-muted-foreground">
                                            Down
                                        </div>
                                    </div>
                                    <div
                                        className="font-medium text-[10px] truncate"
                                        title={networkUsage.downloadFormatted}
                                    >
                                        {networkUsage.downloadFormatted}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />
                                        <div className="text-[9px] text-muted-foreground">
                                            Up
                                        </div>
                                    </div>
                                    <div
                                        className="font-medium text-[10px] truncate"
                                        title={networkUsage.uploadFormatted}
                                    >
                                        {networkUsage.uploadFormatted}
                                    </div>
                                </div>
                            </div>

                            {/* Usage History Chart */}
                            <div>
                                <div className="text-[9px] text-muted-foreground mb-1">
                                    History
                                </div>
                                <div className="h-24">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <AreaChart
                                            data={networkChartData}
                                            margin={{
                                                top: 5,
                                                right: 2,
                                                left: 0,
                                                bottom: 5,
                                            }}
                                        >
                                            <defs>
                                                <linearGradient
                                                    id="uploadGradient"
                                                    x1="0"
                                                    y1="0"
                                                    x2="0"
                                                    y2="1"
                                                >
                                                    <stop
                                                        offset="0%"
                                                        stopColor="#ef4444"
                                                        stopOpacity={0.3}
                                                    />
                                                    <stop
                                                        offset="100%"
                                                        stopColor="#ef4444"
                                                        stopOpacity={0.05}
                                                    />
                                                </linearGradient>
                                                <linearGradient
                                                    id="downloadGradient"
                                                    x1="0"
                                                    y1="0"
                                                    x2="0"
                                                    y2="1"
                                                >
                                                    <stop
                                                        offset="0%"
                                                        stopColor="#3b82f6"
                                                        stopOpacity={0.05}
                                                    />
                                                    <stop
                                                        offset="100%"
                                                        stopColor="#3b82f6"
                                                        stopOpacity={0.3}
                                                    />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                className="stroke-border"
                                                opacity={0.2}
                                            />
                                            <XAxis
                                                dataKey="time"
                                                axisLine={true}
                                                tick={{
                                                    fontSize: 8,
                                                    fill: "hsl(var(--muted-foreground))",
                                                }}
                                                stroke="hsl(var(--muted-foreground))"
                                                tickLine={false}
                                                interval="preserveStartEnd"
                                                minTickGap={50}
                                            />
                                            <YAxis
                                                tick={{
                                                    fontSize: 9,
                                                    fill: "hsl(var(--muted-foreground))",
                                                }}
                                                stroke="hsl(var(--muted-foreground))"
                                                domain={[-1500, 1500]}
                                                ticks={[
                                                    -1228.8, -614.4, 0, 614.4,
                                                    1228.8,
                                                ]}
                                                tickFormatter={(value) => {
                                                    const absValue =
                                                        Math.abs(value);
                                                    if (absValue === 0)
                                                        return "0";
                                                    if (absValue >= 1024) {
                                                        return `${(
                                                            absValue / 1024
                                                        ).toFixed(1)} MB/s`;
                                                    }
                                                    return `${absValue.toFixed(
                                                        0
                                                    )} KB/s`;
                                                }}
                                                width={50}
                                                tickLine={false}
                                            />
                                            <ReferenceLine
                                                y={0}
                                                stroke="hsl(var(--muted-foreground))"
                                                strokeWidth={1.5}
                                            />
                                            <RechartsTooltip
                                                contentStyle={{
                                                    backgroundColor:
                                                        "hsl(var(--popover))",
                                                    border: "1px solid hsl(var(--border))",
                                                    borderRadius: "6px",
                                                    fontSize: "11px",
                                                }}
                                                formatter={(
                                                    value: any,
                                                    name: string
                                                ) => {
                                                    const kbps = Math.abs(
                                                        Number(value)
                                                    );
                                                    const formatted =
                                                        kbps >= 1024
                                                            ? `${(
                                                                  kbps / 1024
                                                              ).toFixed(
                                                                  1
                                                              )} MB/s`
                                                            : `${kbps.toFixed(
                                                                  0
                                                              )} KB/s`;
                                                    return [
                                                        formatted,
                                                        name ===
                                                        "uploadPositive"
                                                            ? "Upload"
                                                            : "Download",
                                                    ];
                                                }}
                                                labelFormatter={(label) =>
                                                    `${label}`
                                                }
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="uploadPositive"
                                                stroke="#ef4444"
                                                strokeWidth={2}
                                                fill="url(#uploadGradient)"
                                                dot={false}
                                                activeDot={{
                                                    r: 3,
                                                    fill: "#ef4444",
                                                    stroke: "#ef4444",
                                                }}
                                                isAnimationActive={true}
                                                animationDuration={300}
                                                animationEasing="ease-in-out"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="downloadNegative"
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                fill="url(#downloadGradient)"
                                                dot={false}
                                                activeDot={{
                                                    r: 3,
                                                    fill: "#3b82f6",
                                                    stroke: "#3b82f6",
                                                }}
                                                isAnimationActive={true}
                                                animationDuration={300}
                                                animationEasing="ease-in-out"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Network Health */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <Activity className="w-3 h-3 shrink-0" />
                        <h3 className="text-xs font-medium truncate">
                            Network Health
                        </h3>
                    </div>
                    <Card>
                        <CardContent className="p-2 space-y-2">
                            {socketStats ? (
                                <>
                                    {/* Rate Metrics - Critical for spike detection */}
                                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-border">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1">
                                                <div className="text-[9px] text-muted-foreground uppercase font-semibold">
                                                    Conn/sec
                                                </div>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="text-xs">Số kết nối mới mỗi giây</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <div
                                                className={`text-[11px] font-mono font-bold ${
                                                    networkRates.connectionsPerSec >
                                                    100
                                                        ? "text-red-500 animate-pulse"
                                                        : networkRates.connectionsPerSec >
                                                          50
                                                        ? "text-orange-500"
                                                        : "text-green-500"
                                                }`}
                                            >
                                                {networkRates.connectionsPerSec.toFixed(
                                                    1
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1">
                                                <div className="text-[9px] text-muted-foreground uppercase font-semibold">
                                                    SYN/sec
                                                </div>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="text-xs">Số gói SYN mỗi giây (bắt đầu TCP handshake)</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <div
                                                className={`text-[11px] font-mono font-bold ${
                                                    networkRates.synPerSec > 10
                                                        ? "text-red-500 animate-pulse"
                                                        : networkRates.synPerSec >
                                                          5
                                                        ? "text-orange-500"
                                                        : "text-green-500"
                                                }`}
                                            >
                                                {networkRates.synPerSec.toFixed(
                                                    1
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Socket States */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1">
                                                <div className="text-[9px] text-muted-foreground uppercase font-semibold">
                                                    Established
                                                </div>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="text-xs">Active TCP connections</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <div
                                                className={`text-[11px] font-mono font-bold ${
                                                    socketStats.tcp_established >
                                                    5000
                                                        ? "text-red-500"
                                                        : socketStats.tcp_established >
                                                          1000
                                                        ? "text-orange-500"
                                                        : "text-green-500"
                                                }`}
                                            >
                                                {socketStats.tcp_established}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1">
                                                <div className="text-[9px] text-muted-foreground uppercase font-semibold">
                                                    SYN_RECV
                                                </div>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="text-xs">Pending handshakes</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <div
                                                className={`text-[11px] font-mono font-bold ${
                                                    socketStats.tcp_synrecv > 20
                                                        ? "text-red-500 animate-pulse"
                                                        : socketStats.tcp_synrecv >
                                                          5
                                                        ? "text-orange-500"
                                                        : "text-green-500"
                                                }`}
                                            >
                                                {socketStats.tcp_synrecv}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1">
                                                <div className="text-[9px] text-muted-foreground uppercase font-semibold">
                                                    TIME_WAIT
                                                </div>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="text-xs">Closed connections waiting - Normal for busy servers</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <div
                                                className={`text-[11px] font-mono font-bold ${
                                                    socketStats.tcp_timewait >
                                                    20000
                                                        ? "text-red-500"
                                                        : socketStats.tcp_timewait >
                                                          5000
                                                        ? "text-orange-500"
                                                        : "text-blue-500"
                                                }`}
                                            >
                                                {socketStats.tcp_timewait}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1">
                                                <div className="text-[9px] text-muted-foreground uppercase font-semibold">
                                                    Total Sockets
                                                </div>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="text-xs">Tổng socket kernel đang quản lý</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <div className="text-[11px] font-mono font-bold">
                                                {socketStats.total}
                                            </div>
                                        </div>
                                    </div>

                                    {/* nf_conntrack - Critical for EC2/Linux */}
                                    {socketStats.conntrack_max > 0 && (
                                        <div className="pt-2 border-t border-border space-y-1">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-1">
                                                    <div className="text-[9px] text-muted-foreground uppercase font-semibold">
                                                        Conntrack Usage
                                                    </div>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="max-w-xs">
                                                                Khả năng kernel
                                                                nhận và quản lý
                                                                KẾT NỐI MỚI
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                                <div
                                                    className={`text-[10px] font-mono font-bold ${
                                                        socketStats.conntrack_percent >=
                                                        90
                                                            ? "text-red-500 animate-pulse"
                                                            : socketStats.conntrack_percent >=
                                                              75
                                                            ? "text-orange-500"
                                                            : socketStats.conntrack_percent >=
                                                              50
                                                            ? "text-yellow-500"
                                                            : "text-green-500"
                                                    }`}
                                                    title={`nf_conntrack: ${socketStats.conntrack_current} / ${socketStats.conntrack_max} - If full, network dies even with low CPU/RAM!`}
                                                >
                                                    {socketStats.conntrack_percent.toFixed(
                                                        1
                                                    )}
                                                    %
                                                </div>
                                            </div>
                                            <Progress
                                                value={
                                                    socketStats.conntrack_percent
                                                }
                                                className={`h-1.5 ${
                                                    socketStats.conntrack_percent >=
                                                    90
                                                        ? "[&>div]:bg-red-500"
                                                        : socketStats.conntrack_percent >=
                                                          75
                                                        ? "[&>div]:bg-orange-500"
                                                        : socketStats.conntrack_percent >=
                                                          50
                                                        ? "[&>div]:bg-yellow-500"
                                                        : "[&>div]:bg-green-500"
                                                }`}
                                            />
                                            <div className="text-[8px] text-muted-foreground text-right">
                                                {socketStats.conntrack_current.toLocaleString()}{" "}
                                                /{" "}
                                                {socketStats.conntrack_max.toLocaleString()}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center justify-center py-2">
                                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Network Latency */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <Gauge className="w-3 h-3 shrink-0" />
                        <h3 className="text-xs font-medium truncate">
                            Network Latency
                        </h3>
                    </div>
                    <Card>
                        <CardContent className="p-2">
                            <div className="h-24">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={latencyData}
                                        margin={{
                                            top: 5,
                                            right: 2,
                                            left: -10,
                                            bottom: 5,
                                        }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            className="stroke-border"
                                            opacity={0.2}
                                        />
                                        <defs>
                                            <linearGradient
                                                id="latencyGradient"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="0%"
                                                    stopColor="#3b82f6"
                                                    stopOpacity={0.3}
                                                />
                                                <stop
                                                    offset="95%"
                                                    stopColor="#3b82f6"
                                                    stopOpacity={0}
                                                />
                                            </linearGradient>
                                        </defs>
                                        <XAxis
                                            dataKey="time"
                                            tick={{
                                                fontSize: 8,
                                                fill: "hsl(var(--muted-foreground))",
                                            }}
                                            stroke="hsl(var(--muted-foreground))"
                                            strokeWidth={0.5}
                                        />
                                        <YAxis
                                            tick={{
                                                fontSize: 8,
                                                fill: "hsl(var(--muted-foreground))",
                                            }}
                                            stroke="hsl(var(--muted-foreground))"
                                            strokeWidth={0.5}
                                            width={30}
                                        />
                                        <RechartsTooltip
                                            contentStyle={{
                                                backgroundColor:
                                                    "hsl(var(--popover))",
                                                border: "1px solid hsl(var(--border))",
                                                borderRadius: "6px",
                                                fontSize: "12px",
                                            }}
                                            formatter={(value: any) => [
                                                `${value}ms`,
                                                "Latency",
                                            ]}
                                            labelFormatter={(label: any) =>
                                                `Time: ${label}`
                                            }
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="latency"
                                            stroke="#3b82f6"
                                            strokeWidth={3}
                                            fill="url(#latencyGradient)"
                                            dot={false}
                                            activeDot={{
                                                r: 5,
                                                fill: "#3b82f6",
                                                stroke: "#fff",
                                                strokeWidth: 2,
                                                filter: "drop-shadow(0 2px 4px rgba(59, 130, 246, 0.4))",
                                            }}
                                            isAnimationActive={true}
                                            animationDuration={300}
                                            animationEasing="ease-in-out"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <Info className="w-3 h-3 shrink-0" />
                        <h3 className="text-xs font-medium truncate">
                            System Information
                        </h3>
                    </div>
                    <Card>
                        <CardContent className="p-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div>
                                    <div className="text-muted-foreground">
                                        OS
                                    </div>
                                    <div
                                        className="font-medium truncate"
                                        title={systemInfo.os}
                                    >
                                        {systemInfo.os || "Loading..."}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">
                                        Kernel
                                    </div>
                                    <div
                                        className="font-medium truncate"
                                        title={systemInfo.kernel}
                                    >
                                        {systemInfo.kernel || "Loading..."}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">
                                        Hostname
                                    </div>
                                    <div
                                        className="font-medium truncate"
                                        title={systemInfo.hostname}
                                    >
                                        {systemInfo.hostname || "Loading..."}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">
                                        Architecture
                                    </div>
                                    <div
                                        className="font-medium truncate"
                                        title={systemInfo.architecture}
                                    >
                                        {systemInfo.architecture ||
                                            "Loading..."}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Kill Process Confirmation Dialog */}
            <AlertDialog
                open={!!processToKill}
                onOpenChange={(open) => !open && setProcessToKill(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Terminate Process?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to terminate process{" "}
                            <strong>{processToKill?.pid}</strong>?
                            <br />
                            <span className="text-xs font-mono mt-2 block">
                                {processToKill?.command}
                            </span>
                            <br />
                            This will send SIGTERM (signal 15) to the process.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() =>
                                processToKill &&
                                handleKillProcess(processToKill)
                            }
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Terminate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </ScrollArea>
    );
}
