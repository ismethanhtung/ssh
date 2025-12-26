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
import { cn } from "@/lib/utils";

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
    swap: { warning: 50, critical: 80 },
    cpu: { warning: 85, critical: 95 },
    loadAverage: { warning: 0.8, critical: 1.5 }, // multiplier of CPU cores
    disk: { warning: 85, critical: 95 },
    inodes: { warning: 80, critical: 95 },
    synRecv: { warning: 10, critical: 50 }, // SYN_RECV connections (potential SYN flood)
    timeWait: { warning: 10000, critical: 30000 },
    established: { warning: 5000, critical: 10000 },
    processMemory: { warning: 20, critical: 40 }, // single process memory %
    processCpu: { warning: 80, critical: 95 }, // single process CPU %
    iowait: { warning: 20, critical: 50 },
    sshFailedLogins: { warning: 5, critical: 20 }, // failed SSH attempts in last hour
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
    const [alerts, setAlerts] = useState<SystemAlert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [selectedCategory, setSelectedCategory] = useState<
        AlertCategory | "all"
    >("all");
    const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
    
    // New states for history feature
    const [viewMode, setViewMode] = useState<"current" | "history">("current");
    const [alertHistory, setAlertHistory] = useState<HistoryAlert[]>([]);
    const [historyExpanded, setHistoryExpanded] = useState<Record<string, boolean>>({});
    const [historyDateFilter, setHistoryDateFilter] = useState<"all" | "today" | "week">("all");

    // Refs for tracking previous data to detect anomalies
    const prevStatsRef = useRef<any>(null);
    const alertHistoryRef = useRef<Map<string, SystemAlert>>(new Map());
    const lastSavedAlertsRef = useRef<Set<string>>(new Set());

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
    const saveAlertToHistory = useCallback((alert: SystemAlert, currentSessionId: string) => {
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

        setAlertHistory(prev => {
            const updated = [historyAlert, ...prev].slice(0, MAX_HISTORY_ENTRIES);
            // Save to localStorage
            try {
                localStorage.setItem(ALERT_HISTORY_KEY, JSON.stringify(updated));
            } catch (error) {
                console.error("Error saving alert history:", error);
            }
            return updated;
        });
    }, []);

    // Clear history
    const clearHistory = useCallback(() => {
        setAlertHistory([]);
        try {
            localStorage.removeItem(ALERT_HISTORY_KEY);
        } catch (error) {
            console.error("Error clearing alert history:", error);
        }
    }, []);

    // Fetch all data needed for anomaly detection
    const fetchAnomalies = useCallback(async () => {
        if (!sessionId) return;

        setIsLoading(true);
        const newAlerts: SystemAlert[] = [];
        const now = new Date();

        try {
            // Fetch all data in parallel for better performance
            const [
                statsResult,
                socketResult,
                processResult,
                diskResult,
                securityResult,
            ] = await Promise.all([
                invoke<any>("get_system_stats", { sessionId }),
                invoke<any>("get_network_socket_stats", { sessionId }),
                invoke<any>("get_processes", {
                    sessionId,
                    sortBy: "cpu",
                }),
                invoke<any>("get_disk_usage", { sessionId }),
                // Custom security checks
                invoke<any>("ssh_execute_command", {
                    sessionId,
                    command: `echo "---SSH_FAILURES---"; grep -c "Failed password" /var/log/auth.log 2>/dev/null || grep -c "Failed password" /var/log/secure 2>/dev/null || echo "0"; echo "---ZOMBIE---"; ps aux | awk '$8=="Z"' | wc -l; echo "---OPEN_FILES---"; cat /proc/sys/fs/file-nr 2>/dev/null || echo "0 0 0"; echo "---OOM_KILLS---"; dmesg 2>/dev/null | grep -c "Out of memory" || echo "0"; echo "---DISK_IO_WAIT---"; cat /proc/stat 2>/dev/null | grep cpu | head -1 | awk '{total=$2+$3+$4+$5+$6+$7+$8; if(total>0) printf "%.1f", $6*100/total; else print "0"}'`,
                }),
            ]);

            // 1. Memory Alerts
            if (statsResult.success && statsResult.stats) {
                const memoryPercent =
                    (statsResult.stats.memory.used /
                        statsResult.stats.memory.total) *
                    100;

                if (memoryPercent >= THRESHOLDS.memory.critical) {
                    newAlerts.push({
                        id: "memory-critical",
                        severity: "critical",
                        category: "memory",
                        title: "RAM sắp cạn kiệt",
                        description:
                            "Bộ nhớ RAM đang ở mức nguy hiểm. Hệ thống có thể bị chậm hoặc crash.",
                        value: `${memoryPercent.toFixed(1)}%`,
                        threshold: `>${THRESHOLDS.memory.critical}%`,
                        timestamp: now,
                    });
                } else if (memoryPercent >= THRESHOLDS.memory.warning) {
                    newAlerts.push({
                        id: "memory-warning",
                        severity: "warning",
                        category: "memory",
                        title: "RAM sử dụng cao",
                        description:
                            "Bộ nhớ RAM đang sử dụng nhiều. Nên theo dõi và cân nhắc giải phóng bộ nhớ.",
                        value: `${memoryPercent.toFixed(1)}%`,
                        threshold: `>${THRESHOLDS.memory.warning}%`,
                        timestamp: now,
                    });
                }

                // Swap Usage
                if (statsResult.stats.swap.total > 0) {
                    const swapPercent =
                        (statsResult.stats.swap.used /
                            statsResult.stats.swap.total) *
                        100;
                    if (swapPercent >= THRESHOLDS.swap.critical) {
                        newAlerts.push({
                            id: "swap-critical",
                            severity: "critical",
                            category: "memory",
                            title: "Swap sử dụng quá cao",
                            description:
                                "Swap đang được sử dụng nhiều. Hệ thống có thể rất chậm do disk I/O.",
                            value: `${swapPercent.toFixed(1)}%`,
                            threshold: `>${THRESHOLDS.swap.critical}%`,
                            timestamp: now,
                        });
                    } else if (swapPercent >= THRESHOLDS.swap.warning) {
                        newAlerts.push({
                            id: "swap-warning",
                            severity: "warning",
                            category: "memory",
                            title: "Swap đang được sử dụng",
                            description:
                                "Hệ thống đang dùng swap, có thể do thiếu RAM.",
                            value: `${swapPercent.toFixed(1)}%`,
                            threshold: `>${THRESHOLDS.swap.warning}%`,
                            timestamp: now,
                        });
                    }
                }

                // CPU Alerts
                const cpuPercent = statsResult.stats.cpu_percent;
                if (cpuPercent >= THRESHOLDS.cpu.critical) {
                    newAlerts.push({
                        id: "cpu-critical",
                        severity: "critical",
                        category: "cpu",
                        title: "CPU quá tải",
                        description:
                            "CPU đang ở mức sử dụng cực cao. Cần kiểm tra các process ngốn CPU.",
                        value: `${cpuPercent.toFixed(1)}%`,
                        threshold: `>${THRESHOLDS.cpu.critical}%`,
                        timestamp: now,
                    });
                } else if (cpuPercent >= THRESHOLDS.cpu.warning) {
                    newAlerts.push({
                        id: "cpu-warning",
                        severity: "warning",
                        category: "cpu",
                        title: "CPU sử dụng cao",
                        description: "CPU đang hoạt động ở mức cao.",
                        value: `${cpuPercent.toFixed(1)}%`,
                        threshold: `>${THRESHOLDS.cpu.warning}%`,
                        timestamp: now,
                    });
                }

                // IO Wait
                const iowait =
                    statsResult.stats.cpu_details?.iowait_percent || 0;
                if (iowait >= THRESHOLDS.iowait.critical) {
                    newAlerts.push({
                        id: "iowait-critical",
                        severity: "critical",
                        category: "cpu",
                        title: "I/O Wait cực cao",
                        description:
                            "CPU đang phải chờ I/O rất nhiều. Có thể disk đang quá tải hoặc gặp vấn đề.",
                        value: `${iowait.toFixed(1)}%`,
                        threshold: `>${THRESHOLDS.iowait.critical}%`,
                        timestamp: now,
                    });
                } else if (iowait >= THRESHOLDS.iowait.warning) {
                    newAlerts.push({
                        id: "iowait-warning",
                        severity: "warning",
                        category: "cpu",
                        title: "I/O Wait cao",
                        description:
                            "CPU đang chờ I/O nhiều. Kiểm tra disk hoạt động.",
                        value: `${iowait.toFixed(1)}%`,
                        threshold: `>${THRESHOLDS.iowait.warning}%`,
                        timestamp: now,
                    });
                }

                // Load Average
                const cores = statsResult.stats.cpu_details?.cores || 1;
                const load1m =
                    statsResult.stats.cpu_details?.load_average_1m || 0;
                const loadRatio = load1m / cores;

                if (loadRatio >= THRESHOLDS.loadAverage.critical) {
                    newAlerts.push({
                        id: "load-critical",
                        severity: "critical",
                        category: "cpu",
                        title: "Load Average rất cao",
                        description: `Load average (${load1m.toFixed(
                            2
                        )}) vượt xa số cores (${cores}). Hệ thống đang quá tải.`,
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
                        title: "Load Average cao",
                        description: `Load average đang cao so với số cores.`,
                        value: `${load1m.toFixed(2)}`,
                        threshold: `>${(
                            cores * THRESHOLDS.loadAverage.warning
                        ).toFixed(2)}`,
                        timestamp: now,
                    });
                }
            }

            // 2. Network Socket Alerts
            if (socketResult.success && socketResult.stats) {
                const { tcp_synrecv, tcp_timewait, tcp_established } =
                    socketResult.stats;

                // SYN Flood Detection
                if (tcp_synrecv >= THRESHOLDS.synRecv.critical) {
                    newAlerts.push({
                        id: "synrecv-critical",
                        severity: "critical",
                        category: "security",
                        title: "Possible SYN Flood Attack",
                        description:
                            "Số lượng SYN_RECV connections rất cao. Có thể đang bị DDoS attack.",
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
                        description:
                            "Số SYN_RECV connections tăng cao bất thường.",
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
                        title: "TIME_WAIT connections quá nhiều",
                        description:
                            "Quá nhiều connections ở trạng thái TIME_WAIT. Có thể cạn kiệt ephemeral ports.",
                        value: `${tcp_timewait}`,
                        threshold: `>${THRESHOLDS.timeWait.critical}`,
                        timestamp: now,
                    });
                } else if (tcp_timewait >= THRESHOLDS.timeWait.warning) {
                    newAlerts.push({
                        id: "timewait-warning",
                        severity: "warning",
                        category: "network",
                        title: "TIME_WAIT connections cao",
                        description: "Số TIME_WAIT connections đang tăng.",
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
                        title: "Quá nhiều connections",
                        description:
                            "Số lượng TCP connections established rất cao.",
                        value: `${tcp_established}`,
                        threshold: `>${THRESHOLDS.established.critical}`,
                        timestamp: now,
                    });
                } else if (tcp_established >= THRESHOLDS.established.warning) {
                    newAlerts.push({
                        id: "established-warning",
                        severity: "warning",
                        category: "network",
                        title: "Nhiều connections active",
                        description:
                            "Số TCP connections đang cao hơn bình thường.",
                        value: `${tcp_established}`,
                        threshold: `>${THRESHOLDS.established.warning}`,
                        timestamp: now,
                    });
                }
            }

            // 3. Disk Alerts
            if (diskResult.success && diskResult.disks) {
                for (const disk of diskResult.disks) {
                    if (disk.usage >= THRESHOLDS.disk.critical) {
                        newAlerts.push({
                            id: `disk-critical-${disk.path}`,
                            severity: "critical",
                            category: "disk",
                            title: `Disk ${disk.path} sắp đầy`,
                            description: `Phân vùng ${disk.path} gần hết dung lượng.`,
                            value: `${disk.usage}%`,
                            threshold: `>${THRESHOLDS.disk.critical}%`,
                            timestamp: now,
                        });
                    } else if (disk.usage >= THRESHOLDS.disk.warning) {
                        newAlerts.push({
                            id: `disk-warning-${disk.path}`,
                            severity: "warning",
                            category: "disk",
                            title: `Disk ${disk.path} sử dụng nhiều`,
                            description: `Phân vùng ${disk.path} đang sử dụng nhiều.`,
                            value: `${disk.usage}%`,
                            threshold: `>${THRESHOLDS.disk.warning}%`,
                            timestamp: now,
                        });
                    }

                    // Inodes Alert
                    if (disk.inodes_usage >= THRESHOLDS.inodes.critical) {
                        newAlerts.push({
                            id: `inodes-critical-${disk.path}`,
                            severity: "critical",
                            category: "disk",
                            title: `Inodes ${disk.path} sắp hết`,
                            description: `Số inodes trên ${disk.path} gần cạn kiệt.`,
                            value: `${disk.inodes_usage}%`,
                            threshold: `>${THRESHOLDS.inodes.critical}%`,
                            timestamp: now,
                        });
                    } else if (disk.inodes_usage >= THRESHOLDS.inodes.warning) {
                        newAlerts.push({
                            id: `inodes-warning-${disk.path}`,
                            severity: "warning",
                            category: "disk",
                            title: `Inodes ${disk.path} sử dụng cao`,
                            description: `Số inodes đang sử dụng nhiều.`,
                            value: `${disk.inodes_usage}%`,
                            threshold: `>${THRESHOLDS.inodes.warning}%`,
                            timestamp: now,
                        });
                    }
                }
            }

            // 4. Process Alerts
            if (processResult.success && processResult.processes) {
                for (const proc of processResult.processes.slice(0, 5)) {
                    const cpuVal = parseFloat(proc.cpu);
                    const memVal = parseFloat(proc.mem);

                    if (cpuVal >= THRESHOLDS.processCpu.critical) {
                        newAlerts.push({
                            id: `proc-cpu-critical-${proc.pid}`,
                            severity: "critical",
                            category: "process",
                            title: `Process ngốn CPU: ${proc.command.slice(
                                0,
                                20
                            )}...`,
                            description: `PID ${proc.pid} đang sử dụng CPU rất cao.`,
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
                            title: `Process ngốn RAM: ${proc.command.slice(
                                0,
                                20
                            )}...`,
                            description: `PID ${proc.pid} đang sử dụng RAM rất cao.`,
                            value: `${memVal.toFixed(1)}%`,
                            threshold: `>${THRESHOLDS.processMemory.critical}%`,
                            timestamp: now,
                        });
                    } else if (memVal >= THRESHOLDS.processMemory.warning) {
                        newAlerts.push({
                            id: `proc-mem-warning-${proc.pid}`,
                            severity: "warning",
                            category: "process",
                            title: `Process dùng nhiều RAM: ${proc.command.slice(
                                0,
                                20
                            )}...`,
                            description: `PID ${proc.pid} đang sử dụng RAM cao.`,
                            value: `${memVal.toFixed(1)}%`,
                            threshold: `>${THRESHOLDS.processMemory.warning}%`,
                            timestamp: now,
                        });
                    }
                }
            }

            // 5. Security Alerts from custom command
            if (securityResult.success && securityResult.output) {
                const output = securityResult.output;
                const sections = output.split("---");

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
                                "Phát hiện nhiều lần đăng nhập SSH thất bại. Có thể đang bị tấn công brute force.",
                            value: `${failedLogins} lần`,
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
                                "Có một số lần đăng nhập SSH thất bại gần đây.",
                            value: `${failedLogins} lần`,
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
                            title: "Nhiều Zombie Processes",
                            description:
                                "Phát hiện nhiều zombie processes. Có thể có vấn đề với parent processes.",
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
                                "Có một số zombie processes trong hệ thống.",
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
                            title: "OOM Killer đã hoạt động",
                            description:
                                "Kernel đã kill processes do hết bộ nhớ. Cần tăng RAM hoặc giảm load.",
                            value: `${oomKills} lần`,
                            threshold: ">0",
                            timestamp: now,
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching anomalies:", error);
        }

        // Sort alerts by severity
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        newAlerts.sort(
            (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
        );

        // Save new alerts to history (avoid duplicates by checking if same alert was just saved)
        if (sessionId) {
            const currentAlertKeys = new Set(newAlerts.map(a => `${a.id}-${a.value}`));
            const newToSave = newAlerts.filter(alert => {
                const key = `${alert.id}-${alert.value}`;
                return !lastSavedAlertsRef.current.has(key);
            });
            
            // Save each new alert to history
            newToSave.forEach(alert => {
                saveAlertToHistory(alert, sessionId);
            });
            
            // Update the ref with current alert keys
            lastSavedAlertsRef.current = currentAlertKeys;
        }

        setAlerts(newAlerts);
        setLastUpdated(new Date());
        setIsLoading(false);
    }, [sessionId, saveAlertToHistory]);

    // Initial fetch and periodic refresh
    useEffect(() => {
        if (!sessionId) {
            setAlerts([]);
            setIsLoading(false);
            return;
        }

        fetchAnomalies();

        // Refresh every 15 seconds
        const interval = setInterval(fetchAnomalies, 15000);

        return () => clearInterval(interval);
    }, [sessionId, fetchAnomalies]);

    // Filter alerts by category
    const filteredAlerts = useMemo(() => {
        if (selectedCategory === "all") return alerts;
        return alerts.filter((alert) => alert.category === selectedCategory);
    }, [alerts, selectedCategory]);

    // Count by severity
    const severityCounts = useMemo(() => {
        return {
            critical: alerts.filter((a) => a.severity === "critical").length,
            warning: alerts.filter((a) => a.severity === "warning").length,
            info: alerts.filter((a) => a.severity === "info").length,
        };
    }, [alerts]);

    // Count by category
    const categoryCounts = useMemo(() => {
        const counts: Record<AlertCategory, number> = {
            memory: 0,
            cpu: 0,
            disk: 0,
            network: 0,
            security: 0,
            process: 0,
            system: 0,
        };
        alerts.forEach((alert) => {
            counts[alert.category]++;
        });
        return counts;
    }, [alerts]);

    const categories: { value: AlertCategory | "all"; label: string }[] = [
        { value: "all", label: "Tất cả" },
        { value: "security", label: "Bảo mật" },
        { value: "memory", label: "RAM" },
        { value: "cpu", label: "CPU" },
        { value: "disk", label: "Disk" },
        { value: "network", label: "Mạng" },
        { value: "process", label: "Process" },
    ];

    // Filter history by category and date
    const filteredHistory = useMemo(() => {
        let filtered = alertHistory;

        // Filter by category
        if (selectedCategory !== "all") {
            filtered = filtered.filter(h => h.category === selectedCategory);
        }

        // Filter by date
        const now = new Date();
        if (historyDateFilter === "today") {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            filtered = filtered.filter(h => new Date(h.timestamp) >= today);
        } else if (historyDateFilter === "week") {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            filtered = filtered.filter(h => new Date(h.timestamp) >= weekAgo);
        }

        return filtered;
    }, [alertHistory, selectedCategory, historyDateFilter]);

    // Group history by date for timeline view
    const groupedHistory = useMemo(() => {
        const groups: Record<string, HistoryAlert[]> = {};
        
        filteredHistory.forEach(alert => {
            const date = new Date(alert.timestamp);
            const dateKey = date.toLocaleDateString("vi-VN", {
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
        return date.toLocaleTimeString("vi-VN", {
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

        if (diffMins < 1) return "Vừa xong";
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        return `${diffDays} ngày trước`;
    };

    if (!sessionId) {
        return (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Không có session kết nối
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-2 space-y-2">
            {/* View Mode Tabs */}
            <div className="flex items-center gap-1 p-0.5 bg-muted/30 rounded-lg">
                <button
                    onClick={() => setViewMode("current")}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded-md transition-all",
                        viewMode === "current"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Activity className="h-3 w-3" />
                    Hiện tại
                    {alerts.length > 0 && (
                        <span className={cn(
                            "px-1 py-0 text-[9px] rounded-full min-w-[16px] text-center",
                            severityCounts.critical > 0 
                                ? "bg-red-500/20 text-red-400" 
                                : "bg-amber-500/20 text-amber-400"
                        )}>
                            {alerts.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setViewMode("history")}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded-md transition-all",
                        viewMode === "history"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <History className="h-3 w-3" />
                    Lịch sử
                    {alertHistory.length > 0 && (
                        <span className="px-1 py-0 text-[9px] rounded-full bg-muted text-muted-foreground min-w-[16px] text-center">
                            {alertHistory.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Header Stats - Only show in current mode */}
            {viewMode === "current" && (
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                        {severityCounts.critical > 0 && (
                            <Badge
                                variant="outline"
                                className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0"
                            >
                                {severityCounts.critical} Critical
                            </Badge>
                        )}
                        {severityCounts.warning > 0 && (
                            <Badge
                                variant="outline"
                                className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0"
                            >
                                {severityCounts.warning} Warning
                            </Badge>
                        )}
                        {alerts.length === 0 && !isLoading && (
                            <Badge
                                variant="outline"
                                className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0"
                            >
                                Hệ thống ổn định
                            </Badge>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={fetchAnomalies}
                        disabled={isLoading}
                    >
                        <RefreshCw
                            className={cn("h-3 w-3", isLoading && "animate-spin")}
                        />
                    </Button>
                </div>
            )}

            {/* History Header - Only show in history mode */}
            {viewMode === "history" && (
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
                            Tất cả
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
                            Hôm nay
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
                            7 ngày
                        </button>
                    </div>
                    {alertHistory.length > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={clearHistory}
                            title="Xóa lịch sử"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            )}

            {/* Category Filter */}
            <div className="flex flex-wrap gap-1">
                {categories.map((cat) => {
                    // Count depends on current view mode
                    const count = viewMode === "current"
                        ? (cat.value === "all" ? alerts.length : categoryCounts[cat.value])
                        : (cat.value === "all" 
                            ? alertHistory.filter(h => 
                                historyDateFilter === "all" || 
                                (historyDateFilter === "today" && new Date(h.timestamp) >= new Date(new Date().setHours(0,0,0,0))) ||
                                (historyDateFilter === "week" && new Date(h.timestamp) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                            ).length
                            : alertHistory.filter(h => 
                                h.category === cat.value &&
                                (historyDateFilter === "all" || 
                                (historyDateFilter === "today" && new Date(h.timestamp) >= new Date(new Date().setHours(0,0,0,0))) ||
                                (historyDateFilter === "week" && new Date(h.timestamp) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
                            ).length);
                    const isActive = selectedCategory === cat.value;

                    return (
                        <button
                            key={cat.value}
                            onClick={() => setSelectedCategory(cat.value)}
                            className={cn(
                                "px-2 py-0.5 text-[10px] rounded-md transition-all",
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

            {/* Alerts List - Current Mode */}
            {viewMode === "current" && (
                <ScrollArea className="flex-1">
                    <div className="space-y-1.5">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-xs text-muted-foreground">
                                    Đang kiểm tra hệ thống...
                                </span>
                            </div>
                        ) : filteredAlerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-2">
                                    <Shield className="h-5 w-5 text-green-400" />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Không phát hiện bất thường
                                </p>
                                <p className="text-[10px] text-muted-foreground/60 mt-1">
                                    Cập nhật lúc {lastUpdated.toLocaleTimeString()}
                                </p>
                            </div>
                        ) : (
                            filteredAlerts.map((alert) => {
                                const styles = getSeverityStyles(alert.severity);
                                const Icon = getCategoryIcon(alert.category);
                                const isExpanded = expandedAlertId === alert.id;

                                return (
                                    <Card
                                        key={alert.id}
                                        className={cn(
                                            "cursor-pointer transition-all duration-200 border rounded-md",
                                            styles.bg,
                                            styles.border,
                                            isExpanded && styles.glow,
                                            "hover:shadow-md"
                                        )}
                                        onClick={() =>
                                            setExpandedAlertId(
                                                isExpanded ? null : alert.id
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
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className={cn(
                                                                "text-[11px] font-medium truncate",
                                                                styles.text
                                                            )}
                                                        >
                                                            {alert.title}
                                                        </span>
                                                        <ChevronRight
                                                            className={cn(
                                                                "h-3 w-3 shrink-0 transition-transform",
                                                                styles.text,
                                                                isExpanded &&
                                                                    "rotate-90"
                                                            )}
                                                        />
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="mt-1.5 space-y-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                                                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                                {alert.description}
                                                            </p>
                                                            <div className="flex items-center gap-2 text-[9px]">
                                                                {alert.value && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={cn(
                                                                            "text-[9px] px-1 py-0 font-mono",
                                                                            styles.badge
                                                                        )}
                                                                    >
                                                                        {
                                                                            alert.value
                                                                        }
                                                                    </Badge>
                                                                )}
                                                                {alert.threshold && (
                                                                    <span className="text-muted-foreground">
                                                                        Ngưỡng:{" "}
                                                                        {
                                                                            alert.threshold
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
                                                                <Clock className="h-2.5 w-2.5" />
                                                                {alert.timestamp.toLocaleTimeString()}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {alert.value && !isExpanded && (
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-[9px] px-1 py-0 font-mono shrink-0",
                                                            styles.badge
                                                        )}
                                                    >
                                                        {alert.value}
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
            )}

            {/* History Timeline - History Mode */}
            {viewMode === "history" && (
                <ScrollArea className="flex-1">
                    {filteredHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                                <History className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Chưa có lịch sử cảnh báo
                            </p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                                Các cảnh báo sẽ được lưu tự động
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(groupedHistory).map(([dateKey, alerts]) => (
                                <div key={dateKey} className="space-y-1">
                                    {/* Date Header */}
                                    <div className="flex items-center gap-2 px-1 py-1 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-[10px] font-medium text-muted-foreground">
                                            {dateKey}
                                        </span>
                                        <span className="text-[9px] text-muted-foreground/60">
                                            ({alerts.length} cảnh báo)
                                        </span>
                                    </div>

                                    {/* Timeline */}
                                    <div className="relative pl-4 border-l-2 border-border/50 ml-1.5 space-y-1">
                                        {alerts.map((historyAlert) => {
                                            const styles = getSeverityStyles(historyAlert.severity);
                                            const Icon = getCategoryIcon(historyAlert.category);
                                            const isExpanded = historyExpanded[historyAlert.id] || false;

                                            return (
                                                <div
                                                    key={historyAlert.id}
                                                    className="relative"
                                                >
                                                    {/* Alert Card */}
                                                    <Card
                                                        className={cn(
                                                            "cursor-pointer transition-all duration-200 border rounded-md",
                                                            styles.bg,
                                                            styles.border,
                                                            isExpanded && styles.glow,
                                                            "hover:shadow-md"
                                                        )}
                                                        onClick={() =>
                                                            setHistoryExpanded(prev => ({
                                                                ...prev,
                                                                [historyAlert.id]: !isExpanded
                                                            }))
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
                                                                            {historyAlert.title}
                                                                        </span>
                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                            <span className="text-[9px] text-muted-foreground font-mono">
                                                                                {formatTime(historyAlert.timestamp)}
                                                                            </span>
                                                                            <ChevronRight
                                                                                className={cn(
                                                                                    "h-3 w-3 transition-transform",
                                                                                    styles.text,
                                                                                    isExpanded && "rotate-90"
                                                                                )}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {isExpanded && (
                                                                        <div className="mt-1.5 space-y-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                                                                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                                                {historyAlert.description}
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
                                                                                        {historyAlert.value}
                                                                                    </Badge>
                                                                                )}
                                                                                {historyAlert.threshold && (
                                                                                    <span className="text-muted-foreground">
                                                                                        Ngưỡng: {historyAlert.threshold}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
                                                                                <Clock className="h-2.5 w-2.5" />
                                                                                {formatRelativeTime(historyAlert.timestamp)}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {historyAlert.value && !isExpanded && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={cn(
                                                                            "text-[9px] px-1 py-0 font-mono shrink-0",
                                                                            styles.badge
                                                                        )}
                                                                    >
                                                                        {historyAlert.value}
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
                            ))}
                        </div>
                    )}
                </ScrollArea>
            )}

            {/* Last Updated Footer */}
            <div className="text-center text-[9px] text-muted-foreground/50 pt-1 border-t border-border/50">
                {viewMode === "current" 
                    ? `Cập nhật mỗi 15 giây • ${lastUpdated.toLocaleTimeString()}`
                    : `${filteredHistory.length} cảnh báo trong lịch sử`
                }
            </div>
        </div>
    );
}
