import React, { createContext, useContext, useState, useCallback } from "react";

export interface CpuDetails {
    total_percent: number;
    user_percent: number;
    system_percent: number;
    iowait_percent: number;
    cores: number;
    load_average_1m: number;
    load_average_5m: number;
    load_average_15m: number;
}

export interface SystemStats {
    cpu_percent: number;
    cpu_details: CpuDetails;
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
}

export interface Process {
    pid: string;
    user: string;
    cpu: string;
    mem: string;
    command: string;
}

export interface DiskUsage {
    path: string;
    filesystem: string;
    total: string;
    available: string;
    usage: number;
    inodes_total?: string;
    inodes_usage?: number;
}

export interface NetworkSocketStats {
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

export interface MonitoringData {
    stats?: SystemStats;
    processes?: Process[];
    disks?: DiskUsage[];
    socketStats?: NetworkSocketStats;
    lastUpdated: Date;
}

interface MonitoringContextType {
    sessionsData: Record<string, MonitoringData>;
    updateMonitoringData: (sessionId: string, data: Partial<MonitoringData>) => void;
}

const MonitoringContext = createContext<MonitoringContextType | undefined>(undefined);

export function MonitoringProvider({ children }: { children: React.ReactNode }) {
    const [sessionsData, setSessionsData] = useState<Record<string, MonitoringData>>({});

    const updateMonitoringData = useCallback((sessionId: string, data: Partial<MonitoringData>) => {
        setSessionsData((prev) => {
            const current = prev[sessionId] || { lastUpdated: new Date() };
            return {
                ...prev,
                [sessionId]: {
                    ...current,
                    ...data,
                    lastUpdated: new Date(),
                },
            };
        });
    }, []);

    return (
        <MonitoringContext.Provider value={{ sessionsData, updateMonitoringData }}>
            {children}
        </MonitoringContext.Provider>
    );
}

export function useMonitoring() {
    const context = useContext(MonitoringContext);
    if (context === undefined) {
        throw new Error("useMonitoring must be used within a MonitoringProvider");
    }
    return context;
}

export function useSessionMonitoring(sessionId: string) {
    const { sessionsData } = useMonitoring();
    return sessionsData[sessionId];
}

