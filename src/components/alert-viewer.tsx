import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    AlertTriangle,
    Shield,
    Cpu,
    HardDrive,
    MemoryStick,
    Network,
    RefreshCw,
    Clock,
    ChevronRight,
    Activity,
    Zap,
    Server,
    Lock,
    Gauge,
    Database,
    History,
    Trash2,
    Calendar,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
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
    AlertDialogTrigger,
} from "./ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useSessionMonitoring } from "@/lib/system-monitoring-context";

// Local storage key for alert history
const ALERT_HISTORY_KEY = "ssh-app-alert-history";

interface AlertViewerProps {
    sessionId?: string;
}

type AlertSeverity = "critical" | "warning" | "info";
type AlertCategory =
    | "memory"
    | "cpu"
    | "disk"
    | "network"
    | "security"
    | "process"
    | "system";

interface SystemAlert {
    id: string;
    severity: AlertSeverity;
    category: AlertCategory;
    title: string;
    description: string;
    value?: string;
    threshold?: string;
    timestamp: Date;
    dismissed?: boolean;
}

// Interface for stored history alerts (serializable)
interface HistoryAlert {
    id: string;
    alertId: string; // Original alert ID (e.g., "cpu-critical")
    severity: AlertSeverity;
    category: AlertCategory;
    title: string;
    description: string;
    value?: string;
    threshold?: string;
    timestamp: string; // ISO string for storage
    sessionId: string;
}

// Maximum number of history entries to keep
const MAX_HISTORY_ENTRIES = 500;

// Thresholds for detecting anomalies
const THRESHOLDS = {
    memory: { warning: 80, critical: 95 },
    swap: { warning: 1, critical: 20 },
    cpu: { warning: 85, critical: 95 },
    loadAverage: { warning: 0.8, critical: 1.5 }, // multiplier of CPU cores
    disk: { warning: 85, critical: 95 },
    inodes: { warning: 80, critical: 95 },
    synRecv: { warning: 5, critical: 20 }, // SYN_RECV connections (potential SYN flood)
    timeWait: { warning: 10000, critical: 30000 },
    established: { warning: 2000, critical: 5000 },
    processMemory: { warning: 40, critical: 60 }, // single process memory %
    processCpu: { warning: 80, critical: 95 }, // single process CPU %
    iowait: { warning: 5, critical: 15 },
    sshFailedLogins: { window: "1m", warning: 5, critical: 20 }, // failed SSH attempts in last hour
    zombieProcesses: { warning: 3, critical: 10 },
    openFiles: { warning: 80, critical: 95 }, // % of max open files
};

const getCategoryIcon = (category: AlertCategory) => {
    switch (category) {
        case "memory":
            return MemoryStick;
        case "cpu":
            return Cpu;
        case "disk":
            return HardDrive;
        case "network":
            return Network;
        case "security":
            return Shield;
        case "process":
            return Activity;
        case "system":
            return Server;
        default:
            return AlertTriangle;
    }
};

const getSeverityStyles = (severity: AlertSeverity) => {
    switch (severity) {
        case "critical":
            return {
                bg: "bg-red-500/10",
                border: "border-red-500/30",
                text: "text-red-400",
                badge: "bg-red-500/20 text-red-400 border-red-500/30",
                icon: "text-red-400",
                glow: "shadow-red-500/10",
            };
        case "warning":
            return {
                bg: "bg-amber-500/10",
                border: "border-amber-500/30",
                text: "text-amber-400",
                badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
                icon: "text-amber-400",
                glow: "shadow-amber-500/10",
            };
        case "info":
            return {
                bg: "bg-blue-500/10",
                border: "border-blue-500/30",
                text: "text-blue-400",
                badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
                icon: "text-blue-400",
                glow: "shadow-blue-500/10",
            };
    }
};

export function AlertViewer({ sessionId }: AlertViewerProps) {
    const monitoringData = useSessionMonitoring(sessionId || "");
    const [alerts, setAlerts] = useState<SystemAlert[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [selectedCategory, setSelectedCategory] = useState<
        AlertCategory | "all"
    >("all");

    // History feature states
    const [alertHistory, setAlertHistory] = useState<HistoryAlert[]>([]);
    const [historyExpanded, setHistoryExpanded] = useState<
        Record<string, boolean>
    >({});
    const [historyDateFilter, setHistoryDateFilter] = useState<
        "all" | "today" | "week"
    >("all");
    const [isClearHistoryDialogOpen, setIsClearHistoryDialogOpen] =
        useState(false);

    // Refs for tracking previous data to detect anomalies
    const alertHistoryRef = useRef<Map<string, SystemAlert>>(new Map());
    const lastSavedAlertsRef = useRef<Set<string>>(new Set());
    // Track the last timestamp processed from context to avoid redundant processing
    const lastProcessedRef = useRef<number>(0);

    // Load history from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(ALERT_HISTORY_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as HistoryAlert[];
                setAlertHistory(parsed);
            }
        } catch (error) {
            console.error("Error loading alert history:", error);
        }
    }, []);

    // Save alert to history
    const saveAlertToHistory = useCallback(
        (alert: SystemAlert, currentSessionId: string) => {
            const historyAlert: HistoryAlert = {
                id: `${alert.id}-${Date.now()}`,
                alertId: alert.id,
                severity: alert.severity,
                category: alert.category,
                title: alert.title,
                description: alert.description,
                value: alert.value,
                threshold: alert.threshold,
                timestamp: alert.timestamp.toISOString(),
                sessionId: currentSessionId,
            };

            setAlertHistory((prev) => {
                const updated = [historyAlert, ...prev].slice(
                    0,
                    MAX_HISTORY_ENTRIES
                );
                // Save to localStorage
                try {
                    localStorage.setItem(
                        ALERT_HISTORY_KEY,
                        JSON.stringify(updated)
                    );
                } catch (error) {
                    console.error("Error saving alert history:", error);
                }
                return updated;
            });
        },
        []
    );

    // Clear history
    const clearHistory = useCallback(() => {
        setAlertHistory([]);
        try {
            localStorage.removeItem(ALERT_HISTORY_KEY);
        } catch (error) {
            console.error("Error clearing alert history:", error);
        }
    }, []);

    // Helper to process raw data into alerts
    const processMonitoringData = useCallback(
        (data: any, securityOutput?: string) => {
            if (!sessionId) return;

            const newAlerts: SystemAlert[] = [];
            const now = new Date();

            // 1. Memory Alerts
            if (data.stats) {
                const { memory, swap, cpu_percent, cpu_details } = data.stats;

                const memoryPercent =
                    memory.total > 0 ? (memory.used / memory.total) * 100 : 0;

                if (memoryPercent >= THRESHOLDS.memory.critical) {
                    newAlerts.push({
                        id: "memory-critical",
                        severity: "critical",
                        category: "memory",
                        title: "RAM running low",
                        description:
                            "RAM usage is at a dangerous level. System may slow down or crash.",
                        value: `${memoryPercent.toFixed(1)}%`,
                        threshold: `>${THRESHOLDS.memory.critical}%`,
                        timestamp: now,
                    });
                } else if (memoryPercent >= THRESHOLDS.memory.warning) {
                    newAlerts.push({
                        id: "memory-warning",
                        severity: "warning",
                        category: "memory",
                        title: "High RAM usage",
                        description:
                            "High RAM usage detected. Consider monitoring or freeing up memory.",
                        value: `${memoryPercent.toFixed(1)}%`,
                        threshold: `>${THRESHOLDS.memory.warning}%`,
                        timestamp: now,
                    });
                }

                // Swap Usage
                if (swap && swap.total > 0) {
                    const swapPercent = (swap.used / swap.total) * 100;
                    if (swapPercent >= THRESHOLDS.swap.critical) {
                        newAlerts.push({
                            id: "swap-critical",
                            severity: "critical",
                            category: "memory",
                            title: "Swap usage too high",
                            description:
                                "High swap usage. System performance may degrade due to disk I/O.",
                            value: `${swapPercent.toFixed(1)}%`,
                            threshold: `>${THRESHOLDS.swap.critical}%`,
                            timestamp: now,
                        });
                    } else if (swapPercent >= THRESHOLDS.swap.warning) {
                        newAlerts.push({
                            id: "swap-warning",
                            severity: "warning",
                            category: "memory",
                            title: "Swap currently in use",
                            description:
                                "System is using swap, potentially due to low physical memory.",
                            value: `${swapPercent.toFixed(1)}%`,
                            threshold: `>${THRESHOLDS.swap.warning}%`,
                            timestamp: now,
                        });
                    }
                }

                // CPU Alerts
                if (cpu_percent >= THRESHOLDS.cpu.critical) {
                    newAlerts.push({
                        id: "cpu-critical",
                        severity: "critical",
                        category: "cpu",
                        title: "CPU overloaded",
                        description:
                            "CPU usage is extremely high. Check for CPU-intensive processes.",
                        value: `${cpu_percent.toFixed(1)}%`,
                        threshold: `>${THRESHOLDS.cpu.critical}%`,
                        timestamp: now,
                    });
                } else if (cpu_percent >= THRESHOLDS.cpu.warning) {
                    newAlerts.push({
                        id: "cpu-warning",
                        severity: "warning",
                        category: "cpu",
                        title: "High CPU usage",
                        description: "CPU is operating at a high level.",
                        value: `${cpu_percent.toFixed(1)}%`,
                        threshold: `>${THRESHOLDS.cpu.warning}%`,
                        timestamp: now,
                    });
                }

                // IO Wait
                const iowait = cpu_details?.iowait_percent || 0;
                if (iowait >= THRESHOLDS.iowait.critical) {
                    newAlerts.push({
                        id: "iowait-critical",
                        severity: "critical",
                        category: "cpu",
                        title: "Extremely high I/O Wait",
                        description:
                            "CPU is waiting heavily on I/O. Disk might be overloaded or experiencing issues.",
                        value: `${iowait.toFixed(1)}%`,
                        threshold: `>${THRESHOLDS.iowait.critical}%`,
                        timestamp: now,
                    });
                } else if (iowait >= THRESHOLDS.iowait.warning) {
                    newAlerts.push({
                        id: "iowait-warning",
                        severity: "warning",
                        category: "cpu",
                        title: "High I/O Wait",
                        description:
                            "CPU is waiting on I/O. Check disk activity.",
                        value: `${iowait.toFixed(1)}%`,
                        threshold: `>${THRESHOLDS.iowait.warning}%`,
                        timestamp: now,
                    });
                }

                // Load Average
                const cores = cpu_details?.cores || 1;
                const load1m = cpu_details?.load_average_1m || 0;
                const loadRatio = load1m / cores;

                if (loadRatio >= THRESHOLDS.loadAverage.critical) {
                    newAlerts.push({
                        id: "load-critical",
                        severity: "critical",
                        category: "cpu",
                        title: "Very high Load Average",
                        description: `Load average (${load1m.toFixed(
                            2
                        )}) far exceeds the number of cores (${cores}). System is overloaded.`,
                        value: `${load1m.toFixed(2)}`,
                        threshold: `>${(
                            cores * THRESHOLDS.loadAverage.critical
                        ).toFixed(2)}`,
                        timestamp: now,
                    });
                } else if (loadRatio >= THRESHOLDS.loadAverage.warning) {
                    newAlerts.push({
                        id: "load-warning",
                        severity: "warning",
                        category: "cpu",
                        title: "High Load Average",
                        description: `Load average is high relative to the number of cores.`,
                        value: `${load1m.toFixed(2)}`,
                        threshold: `>${(
                            cores * THRESHOLDS.loadAverage.warning
                        ).toFixed(2)}`,
                        timestamp: now,
                    });
                }
            }

            // 2. Network Socket Alerts
            if (data.socketStats) {
                const { tcp_synrecv, tcp_timewait, tcp_established } =
                    data.socketStats;

                // SYN Flood Detection
                if (tcp_synrecv >= THRESHOLDS.synRecv.critical) {
                    newAlerts.push({
                        id: "synrecv-critical",
                        severity: "critical",
                        category: "security",
                        title: "Possible SYN Flood Attack",
                        description:
                            "Extremely high number of SYN_RECV connections. Potential DDoS attack.",
                        value: `${tcp_synrecv}`,
                        threshold: `>${THRESHOLDS.synRecv.critical}`,
                        timestamp: now,
                    });
                } else if (tcp_synrecv >= THRESHOLDS.synRecv.warning) {
                    newAlerts.push({
                        id: "synrecv-warning",
                        severity: "warning",
                        category: "security",
                        title: "SYN_RECV Spike",
                        description: "Abnormal spike in SYN_RECV connections.",
                        value: `${tcp_synrecv}`,
                        threshold: `>${THRESHOLDS.synRecv.warning}`,
                        timestamp: now,
                    });
                }

                // TIME_WAIT Alert
                if (tcp_timewait >= THRESHOLDS.timeWait.critical) {
                    newAlerts.push({
                        id: "timewait-critical",
                        severity: "critical",
                        category: "network",
                        title: "Too many TIME_WAIT connections",
                        description:
                            "Too many connections in TIME_WAIT state. Risk of ephemeral port exhaustion.",
                        value: `${tcp_timewait}`,
                        threshold: `>${THRESHOLDS.timeWait.critical}`,
                        timestamp: now,
                    });
                } else if (tcp_timewait >= THRESHOLDS.timeWait.warning) {
                    newAlerts.push({
                        id: "timewait-warning",
                        severity: "warning",
                        category: "network",
                        title: "High TIME_WAIT connections",
                        description:
                            "Number of TIME_WAIT connections is increasing.",
                        value: `${tcp_timewait}`,
                        threshold: `>${THRESHOLDS.timeWait.warning}`,
                        timestamp: now,
                    });
                }

                // Established connections
                if (tcp_established >= THRESHOLDS.established.critical) {
                    newAlerts.push({
                        id: "established-critical",
                        severity: "critical",
                        category: "network",
                        title: "Too many connections",
                        description:
                            "Very high number of established TCP connections.",
                        value: `${tcp_established}`,
                        threshold: `>${THRESHOLDS.established.critical}`,
                        timestamp: now,
                    });
                } else if (tcp_established >= THRESHOLDS.established.warning) {
                    newAlerts.push({
                        id: "established-warning",
                        severity: "warning",
                        category: "network",
                        title: "Many active connections",
                        description:
                            "Number of active TCP connections is higher than normal.",
                        value: `${tcp_established}`,
                        threshold: `>${THRESHOLDS.established.warning}`,
                        timestamp: now,
                    });
                }
            }

            // 3. Disk Alerts
            if (data.disks) {
                for (const disk of data.disks) {
                    if (disk.usage >= THRESHOLDS.disk.critical) {
                        newAlerts.push({
                            id: `disk-critical-${disk.path}`,
                            severity: "critical",
                            category: "disk",
                            title: `Disk ${disk.path} almost full`,
                            description: `Partition ${disk.path} is running out of space.`,
                            value: `${disk.usage}%`,
                            threshold: `>${THRESHOLDS.disk.critical}%`,
                            timestamp: now,
                        });
                    } else if (disk.usage >= THRESHOLDS.disk.warning) {
                        newAlerts.push({
                            id: `disk-warning-${disk.path}`,
                            severity: "warning",
                            category: "disk",
                            title: `High usage on disk ${disk.path}`,
                            description: `Partition ${disk.path} has high disk usage.`,
                            value: `${disk.usage}%`,
                            threshold: `>${THRESHOLDS.disk.warning}%`,
                            timestamp: now,
                        });
                    }

                    // Inodes Alert
                    if (
                        disk.inodes_usage !== undefined &&
                        disk.inodes_usage >= THRESHOLDS.inodes.critical
                    ) {
                        newAlerts.push({
                            id: `inodes-critical-${disk.path}`,
                            severity: "critical",
                            category: "disk",
                            title: `Inodes ${disk.path} running low`,
                            description: `Inodes on ${disk.path} are nearly exhausted.`,
                            value: `${disk.inodes_usage}%`,
                            threshold: `>${THRESHOLDS.inodes.critical}%`,
                            timestamp: now,
                        });
                    } else if (
                        disk.inodes_usage !== undefined &&
                        disk.inodes_usage >= THRESHOLDS.inodes.warning
                    ) {
                        newAlerts.push({
                            id: `inodes-warning-${disk.path}`,
                            severity: "warning",
                            category: "disk",
                            title: `High Inode usage on ${disk.path}`,
                            description: `High number of inodes are in use.`,
                            value: `${disk.inodes_usage}%`,
                            threshold: `>${THRESHOLDS.inodes.warning}%`,
                            timestamp: now,
                        });
                    }
                }
            }

            // 4. Process Alerts
            if (data.processes) {
                for (const proc of data.processes.slice(0, 5)) {
                    const cpuVal = parseFloat(proc.cpu);
                    const memVal = parseFloat(proc.mem);

                    if (cpuVal >= THRESHOLDS.processCpu.critical) {
                        newAlerts.push({
                            id: `proc-cpu-critical-${proc.pid}`,
                            severity: "critical",
                            category: "process",
                            title: `CPU intensive process: ${proc.command.slice(
                                0,
                                20
                            )}...`,
                            description: `Process "${proc.command}" (PID ${
                                proc.pid
                            }) is using ${cpuVal.toFixed(1)}% CPU.`,
                            value: `${cpuVal.toFixed(1)}%`,
                            threshold: `>${THRESHOLDS.processCpu.critical}%`,
                            timestamp: now,
                        });
                    }

                    if (memVal >= THRESHOLDS.processMemory.critical) {
                        newAlerts.push({
                            id: `proc-mem-critical-${proc.pid}`,
                            severity: "critical",
                            category: "process",
                            title: `RAM intensive process: ${proc.command.slice(
                                0,
                                20
                            )}...`,
                            description: `Process "${proc.command}" (PID ${
                                proc.pid
                            }) is using ${memVal.toFixed(1)}% RAM.`,
                            value: `${memVal.toFixed(1)}%`,
                            threshold: `>${THRESHOLDS.processMemory.critical}%`,
                            timestamp: now,
                        });
                    } else if (memVal >= THRESHOLDS.processMemory.warning) {
                        newAlerts.push({
                            id: `proc-mem-warning-${proc.pid}`,
                            severity: "warning",
                            category: "process",
                            title: `High RAM usage process: ${proc.command.slice(
                                0,
                                20
                            )}...`,
                            description: `Process "${proc.command}" (PID ${
                                proc.pid
                            }) is using ${memVal.toFixed(1)}% RAM.`,
                            value: `${memVal.toFixed(1)}%`,
                            threshold: `>${THRESHOLDS.processMemory.warning}%`,
                            timestamp: now,
                        });
                    }
                }
            }

            // 5. Security Alerts from custom command (only if securityOutput is provided)
            if (securityOutput) {
                const sections = securityOutput.split("---");

                // SSH Failed Logins
                const sshSection = sections.find((s: string) =>
                    s.includes("SSH_FAILURES")
                );
                if (sshSection) {
                    const match = sshSection.match(/\d+/);
                    const failedLogins = match ? parseInt(match[0]) : 0;

                    if (failedLogins >= THRESHOLDS.sshFailedLogins.critical) {
                        newAlerts.push({
                            id: "ssh-attack-critical",
                            severity: "critical",
                            category: "security",
                            title: "SSH Brute Force Attack",
                            description:
                                "Multiple failed SSH login attempts detected. Potential brute force attack.",
                            value: `${failedLogins} times`,
                            threshold: `>${THRESHOLDS.sshFailedLogins.critical}`,
                            timestamp: now,
                        });
                    } else if (
                        failedLogins >= THRESHOLDS.sshFailedLogins.warning
                    ) {
                        newAlerts.push({
                            id: "ssh-attack-warning",
                            severity: "warning",
                            category: "security",
                            title: "SSH Login Failures",
                            description:
                                "Several failed SSH login attempts detected recently.",
                            value: `${failedLogins} times`,
                            threshold: `>${THRESHOLDS.sshFailedLogins.warning}`,
                            timestamp: now,
                        });
                    }
                }

                // Zombie Processes
                const zombieSection = sections.find((s: string) =>
                    s.includes("ZOMBIE")
                );
                if (zombieSection) {
                    const match = zombieSection.match(/\d+/);
                    const zombies = match ? parseInt(match[0]) : 0;

                    if (zombies >= THRESHOLDS.zombieProcesses.critical) {
                        newAlerts.push({
                            id: "zombie-critical",
                            severity: "critical",
                            category: "process",
                            title: "Multiple Zombie Processes",
                            description:
                                "Multiple zombie processes detected. Potential issue with parent processes.",
                            value: `${zombies}`,
                            threshold: `>${THRESHOLDS.zombieProcesses.critical}`,
                            timestamp: now,
                        });
                    } else if (zombies >= THRESHOLDS.zombieProcesses.warning) {
                        newAlerts.push({
                            id: "zombie-warning",
                            severity: "warning",
                            category: "process",
                            title: "Zombie Processes",
                            description:
                                "Some zombie processes detected in the system.",
                            value: `${zombies}`,
                            threshold: `>${THRESHOLDS.zombieProcesses.warning}`,
                            timestamp: now,
                        });
                    }
                }

                // OOM Kills
                const oomSection = sections.find((s: string) =>
                    s.includes("OOM_KILLS")
                );
                if (oomSection) {
                    const match = oomSection.match(/\d+/);
                    const oomKills = match ? parseInt(match[0]) : 0;

                    if (oomKills > 0) {
                        newAlerts.push({
                            id: "oom-kill",
                            severity: "critical",
                            category: "memory",
                            title: "OOM Killer triggered",
                            description:
                                "Kernel killed processes due to lack of memory. Consider increasing RAM or reducing load.",
                            value: `${oomKills} times`,
                            threshold: ">0",
                            timestamp: now,
                        });
                    }
                }
            }

            // Sort alerts by severity
            const severityOrder = { critical: 0, warning: 1, info: 2 };
            newAlerts.sort(
                (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
            );

            // Save new alerts to history (avoid duplicates by checking if same alert was just saved)
            const currentAlertKeys = new Set(
                newAlerts.map((a) => `${a.id}-${a.value}`)
            );
            const newToSave = newAlerts.filter((alert) => {
                const key = `${alert.id}-${alert.value}`;
                return !lastSavedAlertsRef.current.has(key);
            });

            // Save each new alert to history
            newToSave.forEach((alert) => {
                saveAlertToHistory(alert, sessionId);
            });

            // Update the ref with current alert keys
            lastSavedAlertsRef.current = currentAlertKeys;

            setAlerts(newAlerts);
            setLastUpdated(new Date());
        },
        [sessionId, saveAlertToHistory]
    );

    // Manual fetch - fetches everything including security
    const fetchAnomalies = useCallback(async () => {
        if (!sessionId) return;

        setIsLoading(true);
        try {
            // Fetch everything manually for a full refresh
            const statsResult = await invoke<any>("get_system_stats", {
                sessionId,
            });
            const socketResult = await invoke<any>("get_network_socket_stats", {
                sessionId,
            });
            const processResult = await invoke<any>("get_processes", {
                sessionId,
                sortBy: "cpu",
            });
            const diskResult = await invoke<any>("get_disk_usage", {
                sessionId,
            });
            const securityResult = await invoke<any>("ssh_execute_command", {
                sessionId,
                command: `echo "---SSH_FAILURES---"; grep -c "Failed password" /var/log/auth.log 2>/dev/null || grep -c "Failed password" /var/log/secure 2>/dev/null || echo "0"; echo "---ZOMBIE---"; ps aux | awk '$8=="Z"' | wc -l; echo "---OPEN_FILES---"; cat /proc/sys/fs/file-nr 2>/dev/null || echo "0 0 0"; echo "---OOM_KILLS---"; dmesg 2>/dev/null | grep -c "Out of memory" || echo "0"; echo "---DISK_IO_WAIT---"; cat /proc/stat 2>/dev/null | grep cpu | head -1 | awk '{total=$2+$3+$4+$5+$6+$7+$8; if(total>0) printf "%.1f", $6*100/total; else print "0"}'`,
            });

            const combinedData = {
                stats: statsResult.success ? statsResult.stats : null,
                socketStats: socketResult.success ? socketResult.stats : null,
                processes: processResult.success
                    ? processResult.processes
                    : null,
                disks: diskResult.success ? diskResult.disks : null,
            };

            processMonitoringData(
                combinedData,
                securityResult.success ? securityResult.output : undefined
            );
        } catch (error) {
            console.error("Error manual fetching anomalies:", error);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, processMonitoringData]);

    // Effect to react to monitoring data changes from context
    useEffect(() => {
        if (
            monitoringData &&
            monitoringData.lastUpdated.getTime() > lastProcessedRef.current
        ) {
            lastProcessedRef.current = monitoringData.lastUpdated.getTime();
            processMonitoringData(monitoringData);
            setIsLoading(false);
        }
    }, [monitoringData, processMonitoringData]);

    // Initial check when session opens
    useEffect(() => {
        if (!sessionId) {
            setAlerts([]);
            setIsLoading(false);
            return;
        }

        // Only show loading for the very first time
        if (alerts.length === 0) {
            setIsLoading(true);
        }
    }, [sessionId]);

    // Filter alerts by category (for history view)
    const filteredHistory = useMemo(() => {
        let filtered = alertHistory;

        // Filter by category
        if (selectedCategory !== "all") {
            filtered = filtered.filter((h) => h.category === selectedCategory);
        }

        // Filter by date
        const now = new Date();
        if (historyDateFilter === "today") {
            const today = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate()
            );
            filtered = filtered.filter((h) => new Date(h.timestamp) >= today);
        } else if (historyDateFilter === "week") {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            filtered = filtered.filter((h) => new Date(h.timestamp) >= weekAgo);
        }

        return filtered;
    }, [alertHistory, selectedCategory, historyDateFilter]);

    const categories: { value: AlertCategory | "all"; label: string }[] = [
        { value: "all", label: "All" },
        { value: "security", label: "Security" },
        { value: "memory", label: "RAM" },
        { value: "cpu", label: "CPU" },
        { value: "disk", label: "Disk" },
        { value: "network", label: "Network" },
        { value: "process", label: "Process" },
    ];

    // Group history by date for timeline view
    const groupedHistory = useMemo(() => {
        const groups: Record<string, HistoryAlert[]> = {};

        filteredHistory.forEach((alert) => {
            const date = new Date(alert.timestamp);
            const dateKey = date.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            });

            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(alert);
        });

        return groups;
    }, [filteredHistory]);

    // Format time for display
    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    // Format relative time
    const formatRelativeTime = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        return `${diffDays} days ago`;
    };

    if (!sessionId) {
        return (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No active session
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header section with padding */}
            <div className="flex-none p-2 space-y-2">
                {/* Category Filter */}
                <div className="flex flex-wrap gap-1">
                    {categories.map((cat) => {
                        // Count for history view
                        const count =
                            cat.value === "all"
                                ? filteredHistory.length
                                : filteredHistory.filter(
                                      (h) => h.category === cat.value
                                  ).length;
                        const isActive = selectedCategory === cat.value;

                        return (
                            <button
                                key={cat.value}
                                onClick={() => setSelectedCategory(cat.value)}
                                className={cn(
                                    "px-2 py-0.5 text-[10px] rounded-sm transition-all",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                )}
                            >
                                {cat.label}
                                {count > 0 && (
                                    <span className="ml-1 opacity-60">
                                        ({count})
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* History Header */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        {/* Date Filter */}
                        <button
                            onClick={() => setHistoryDateFilter("all")}
                            className={cn(
                                "px-1.5 py-0.5 text-[9px] rounded transition-all",
                                historyDateFilter === "all"
                                    ? "bg-primary/20 text-primary"
                                    : "text-muted-foreground hover:bg-muted"
                            )}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setHistoryDateFilter("today")}
                            className={cn(
                                "px-1.5 py-0.5 text-[9px] rounded transition-all",
                                historyDateFilter === "today"
                                    ? "bg-primary/20 text-primary"
                                    : "text-muted-foreground hover:bg-muted"
                            )}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setHistoryDateFilter("week")}
                            className={cn(
                                "px-1.5 py-0.5 text-[9px] rounded transition-all",
                                historyDateFilter === "week"
                                    ? "bg-primary/20 text-primary"
                                    : "text-muted-foreground hover:bg-muted"
                            )}
                        >
                            7 days
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            Updated {lastUpdated.toLocaleTimeString()}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={fetchAnomalies}
                            disabled={isLoading}
                            title="Refresh data"
                        >
                            <RefreshCw
                                className={cn(
                                    "h-3 w-3",
                                    isLoading && "animate-spin"
                                )}
                            />
                        </Button>
                        {alertHistory.length > 0 && (
                            <AlertDialog
                                open={isClearHistoryDialogOpen}
                                onOpenChange={setIsClearHistoryDialogOpen}
                            >
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        title="Clear history"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Confirm Clear History
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to delete all
                                            alert history ({alertHistory.length}{" "}
                                            items)? This action cannot be
                                            undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => {
                                                clearHistory();
                                                setIsClearHistoryDialogOpen(
                                                    false
                                                );
                                            }}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Clear All
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </div>
            </div>

            {/* Content area - Scrollable */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {/* History Timeline */}
                <ScrollArea className="h-full">
                    <div className="p-2">
                        {filteredHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
                                    <History className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    No alert history yet
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {Object.entries(groupedHistory).map(
                                    ([dateKey, alerts]) => (
                                        <div
                                            key={dateKey}
                                            className="space-y-1"
                                        >
                                            {/* Date Header */}
                                            <div className="flex items-center gap-2 px-1 py-1 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-[10px] font-medium text-muted-foreground">
                                                    {dateKey}
                                                </span>
                                                <span className="text-[9px] text-muted-foreground/60">
                                                    ({alerts.length} alerts)
                                                </span>
                                            </div>

                                            {/* Timeline */}
                                            <div className="relative space-y-1">
                                                {alerts.map((historyAlert) => {
                                                    const styles =
                                                        getSeverityStyles(
                                                            historyAlert.severity
                                                        );
                                                    const Icon =
                                                        getCategoryIcon(
                                                            historyAlert.category
                                                        );
                                                    const isExpanded =
                                                        historyExpanded[
                                                            historyAlert.id
                                                        ] || false;

                                                    return (
                                                        <div
                                                            key={
                                                                historyAlert.id
                                                            }
                                                            className="relative"
                                                        >
                                                            {/* Alert Card */}
                                                            <Card
                                                                className={cn(
                                                                    "cursor-pointer transition-all duration-200 border rounded-md",
                                                                    styles.bg,
                                                                    styles.border,
                                                                    isExpanded &&
                                                                        styles.glow,
                                                                    "hover:shadow-md"
                                                                )}
                                                                onClick={() =>
                                                                    setHistoryExpanded(
                                                                        (
                                                                            prev
                                                                        ) => ({
                                                                            ...prev,
                                                                            [historyAlert.id]:
                                                                                !isExpanded,
                                                                        })
                                                                    )
                                                                }
                                                            >
                                                                <CardContent className="p-2">
                                                                    <div className="flex items-start gap-2">
                                                                        <div
                                                                            className={cn(
                                                                                "mt-0.5 shrink-0",
                                                                                styles.icon
                                                                            )}
                                                                        >
                                                                            <Icon className="h-3.5 w-3.5" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center justify-between gap-1">
                                                                                <span
                                                                                    className={cn(
                                                                                        "text-[11px] font-medium truncate",
                                                                                        styles.text
                                                                                    )}
                                                                                >
                                                                                    {
                                                                                        historyAlert.title
                                                                                    }
                                                                                </span>
                                                                                <div className="flex items-center gap-1 shrink-0">
                                                                                    <span className="text-[9px] text-muted-foreground font-mono">
                                                                                        {formatTime(
                                                                                            historyAlert.timestamp
                                                                                        )}
                                                                                    </span>
                                                                                    <ChevronRight
                                                                                        className={cn(
                                                                                            "h-3 w-3 transition-transform",
                                                                                            styles.text,
                                                                                            isExpanded &&
                                                                                                "rotate-90"
                                                                                        )}
                                                                                    />
                                                                                </div>
                                                                            </div>

                                                                            {isExpanded && (
                                                                                <div className="mt-1.5 space-y-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                                                                                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                                                        {
                                                                                            historyAlert.description
                                                                                        }
                                                                                    </p>
                                                                                    <div className="flex flex-wrap items-center gap-2 text-[9px]">
                                                                                        {historyAlert.value && (
                                                                                            <Badge
                                                                                                variant="outline"
                                                                                                className={cn(
                                                                                                    "text-[9px] px-1 py-0 font-mono",
                                                                                                    styles.badge
                                                                                                )}
                                                                                            >
                                                                                                {
                                                                                                    historyAlert.value
                                                                                                }
                                                                                            </Badge>
                                                                                        )}
                                                                                        {historyAlert.threshold && (
                                                                                            <span className="text-muted-foreground">
                                                                                                Threshold:{" "}
                                                                                                {
                                                                                                    historyAlert.threshold
                                                                                                }
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
                                                                                        <Clock className="h-2.5 w-2.5" />
                                                                                        {formatRelativeTime(
                                                                                            historyAlert.timestamp
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {historyAlert.value &&
                                                                            !isExpanded && (
                                                                                <Badge
                                                                                    variant="outline"
                                                                                    className={cn(
                                                                                        "text-[9px] px-1 py-0 font-mono shrink-0",
                                                                                        styles.badge
                                                                                    )}
                                                                                >
                                                                                    {
                                                                                        historyAlert.value
                                                                                    }
                                                                                </Badge>
                                                                            )}
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
