import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import {
    MemoryStick,
    Cpu,
    HardDrive,
    Network,
    Shield,
    Activity,
    RotateCcw,
    Save,
    AlertTriangle,
    Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Storage key for threshold settings
const THRESHOLD_STORAGE_KEY = "ssh-app-alert-thresholds";

// Default thresholds
export const DEFAULT_THRESHOLDS = {
    memory: { warning: 80, critical: 95 },
    swap: { warning: 1, critical: 20 },
    cpu: { warning: 85, critical: 95 },
    loadAverage: { warning: 0.8, critical: 1.5 },
    disk: { warning: 85, critical: 95 },
    inodes: { warning: 80, critical: 95 },
    synRecv: { warning: 5, critical: 20 },
    timeWait: { warning: 10000, critical: 30000 },
    established: { warning: 2000, critical: 5000 },
    processMemory: { warning: 40, critical: 60 },
    processCpu: { warning: 80, critical: 95 },
    iowait: { warning: 5, critical: 15 },
    sshFailedLogins: { window: "1m", warning: 5, critical: 20 },
    zombieProcesses: { warning: 3, critical: 10 },
    openFiles: { warning: 80, critical: 95 },
};

export type AlertThresholds = typeof DEFAULT_THRESHOLDS;

// Load thresholds from localStorage
export function loadThresholds(): AlertThresholds {
    try {
        const stored = localStorage.getItem(THRESHOLD_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_THRESHOLDS, ...parsed };
        }
    } catch (error) {
        console.error("Error loading thresholds:", error);
    }
    return DEFAULT_THRESHOLDS;
}

// Save thresholds to localStorage
export function saveThresholds(thresholds: AlertThresholds): void {
    try {
        localStorage.setItem(THRESHOLD_STORAGE_KEY, JSON.stringify(thresholds));
    } catch (error) {
        console.error("Error saving thresholds:", error);
    }
}

interface ThresholdConfig {
    key: keyof AlertThresholds;
    label: string;
    description: string;
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
}

interface CategoryConfig {
    id: string;
    label: string;
    icon: React.ElementType;
    thresholds: ThresholdConfig[];
}

const categories: CategoryConfig[] = [
    {
        id: "memory",
        label: "Memory",
        icon: MemoryStick,
        thresholds: [
            {
                key: "memory",
                label: "RAM Usage",
                description: "System memory utilization",
                unit: "%",
                min: 0,
                max: 100,
            },
            {
                key: "swap",
                label: "Swap Usage",
                description: "Swap memory utilization",
                unit: "%",
                min: 0,
                max: 100,
            },
        ],
    },
    {
        id: "cpu",
        label: "CPU",
        icon: Cpu,
        thresholds: [
            {
                key: "cpu",
                label: "CPU Usage",
                description: "CPU utilization percentage",
                unit: "%",
                min: 0,
                max: 100,
            },
            {
                key: "loadAverage",
                label: "Load Average",
                description: "Load average multiplier (relative to cores)",
                unit: "x",
                min: 0.1,
                max: 10,
                step: 0.1,
            },
            {
                key: "iowait",
                label: "I/O Wait",
                description: "CPU time waiting for I/O",
                unit: "%",
                min: 0,
                max: 100,
            },
        ],
    },
    {
        id: "disk",
        label: "Disk",
        icon: HardDrive,
        thresholds: [
            {
                key: "disk",
                label: "Disk Usage",
                description: "Disk space utilization",
                unit: "%",
                min: 0,
                max: 100,
            },
            {
                key: "inodes",
                label: "Inodes Usage",
                description: "Inode utilization",
                unit: "%",
                min: 0,
                max: 100,
            },
        ],
    },
    {
        id: "network",
        label: "Network",
        icon: Network,
        thresholds: [
            {
                key: "synRecv",
                label: "SYN_RECV",
                description: "SYN_RECV connections (potential attack)",
                min: 1,
                max: 1000,
            },
            {
                key: "timeWait",
                label: "TIME_WAIT",
                description: "TIME_WAIT connections",
                min: 100,
                max: 100000,
                step: 100,
            },
            {
                key: "established",
                label: "Established",
                description: "Active TCP connections",
                min: 100,
                max: 50000,
                step: 100,
            },
        ],
    },
    {
        id: "security",
        label: "Security",
        icon: Shield,
        thresholds: [
            {
                key: "sshFailedLogins",
                label: "SSH Failed Logins",
                description: "Failed SSH login attempts",
                min: 1,
                max: 100,
            },
        ],
    },
    {
        id: "process",
        label: "Process",
        icon: Activity,
        thresholds: [
            {
                key: "processMemory",
                label: "Process Memory",
                description: "Single process memory usage",
                unit: "%",
                min: 0,
                max: 100,
            },
            {
                key: "processCpu",
                label: "Process CPU",
                description: "Single process CPU usage",
                unit: "%",
                min: 0,
                max: 100,
            },
            {
                key: "zombieProcesses",
                label: "Zombie Processes",
                description: "Number of zombie processes",
                min: 1,
                max: 100,
            },
            {
                key: "openFiles",
                label: "Open Files",
                description: "Percentage of max open files",
                unit: "%",
                min: 0,
                max: 100,
            },
        ],
    },
];

interface AlertThresholdsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onThresholdsChange?: (thresholds: AlertThresholds) => void;
}

export function AlertThresholdsModal({
    open,
    onOpenChange,
    onThresholdsChange,
}: AlertThresholdsModalProps) {
    const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS);
    const [hasChanges, setHasChanges] = useState(false);
    const [activeCategory, setActiveCategory] = useState("memory");

    // Load thresholds when modal opens
    useEffect(() => {
        if (open) {
            const loaded = loadThresholds();
            setThresholds(loaded);
            setHasChanges(false);
        }
    }, [open]);

    const updateThreshold = (
        key: keyof AlertThresholds,
        level: "warning" | "critical",
        value: number
    ) => {
        setThresholds((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                [level]: value,
            },
        }));
        setHasChanges(true);
    };

    const handleSave = () => {
        saveThresholds(thresholds);
        onThresholdsChange?.(thresholds);
        setHasChanges(false);
        onOpenChange(false);
    };

    const handleReset = () => {
        setThresholds(DEFAULT_THRESHOLDS);
        setHasChanges(true);
    };

    // Compact styles matching ConnectionDialog and SettingsModal
    const inputClassName =
        "h-8 !text-[12px] !font-normal bg-background/40 border-border/40 focus:border-primary/40 focus:bg-background/80 transition-all text-center font-mono";
    const labelClassName =
        "text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-1.5 block";
    const sectionTitleClassName =
        "text-[11px] font-bold text-foreground/90 uppercase tracking-wider mb-0.5";
    const sectionDescClassName =
        "text-[10px] text-muted-foreground/60 leading-relaxed";

    const activeCategoryConfig = categories.find((c) => c.id === activeCategory);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[620px] h-[75vh] max-h-[630px] overflow-hidden p-0 gap-0 flex flex-col border border-border/50">
                <div className="flex flex-col flex-1 min-h-0">
                    {/* Compact Header */}
                    <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                        <div className="flex items-center gap-2">

                            <div>
                                <DialogTitle className="text-sm font-semibold">
                                    Alert Thresholds
                                </DialogTitle>
                                <DialogDescription className="text-[10px] text-muted-foreground/70 mt-0.5">
                                    Configure warning and critical thresholds for system alerts
                                </DialogDescription>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                        {/* Sidebar Navigation */}
                        <div className="w-36 border-r border-border/40 bg-muted/10 flex flex-col shrink-0">
                            <ScrollArea className="flex-1">
                                <nav className="p-2 space-y-0.5">
                                    {categories.map((category) => {
                                        const Icon = category.icon;
                                        return (
                                            <button
                                                key={category.id}
                                                onClick={() => setActiveCategory(category.id)}
                                                className={cn(
                                                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[11px] font-semibold transition-all",
                                                    activeCategory === category.id
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
                                    {activeCategoryConfig && (
                                        <div className="space-y-4">
                                            {/* Category Title */}
                                            <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                                                <div>
                                                    <h3 className={sectionTitleClassName}>
                                                        {activeCategoryConfig.label} Thresholds
                                                    </h3>
                                                    <p className={sectionDescClassName}>
                                                        Set warning and critical levels for {activeCategoryConfig.label.toLowerCase()} metrics
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Threshold Items */}
                                            <div className="space-y-4">
                                                {activeCategoryConfig.thresholds.map((config) => {
                                                    const threshold = thresholds[config.key];
                                                    const warningValue = threshold.warning;
                                                    const criticalValue = threshold.critical;

                                                    return (
                                                        <div
                                                            key={config.key}
                                                            className="p-3 rounded-lg border border-border/30 bg-muted/5 hover:bg-muted/10 transition-colors"
                                                        >
                                                            {/* Threshold Label */}
                                                            <div className="mb-3">
                                                                <div className="text-[12px] font-semibold text-foreground/90">
                                                                    {config.label}
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground/60">
                                                                    {config.description}
                                                                </div>
                                                            </div>

                                                            {/* Inputs Row */}
                                                            <div className="grid grid-cols-2 gap-4">
                                                                {/* Warning Input */}
                                                                <div className="space-y-1.5">
                                                                    <Label className={cn(labelClassName, "text-amber-500/80 flex items-center gap-1.5")}>
                                                                        <AlertTriangle className="h-2.5 w-2.5" />
                                                                        Warning
                                                                    </Label>
                                                                    <div className="flex items-center gap-2">
                                                                        <Input
                                                                            type="number"
                                                                            value={warningValue}
                                                                            onChange={(e) =>
                                                                                updateThreshold(
                                                                                    config.key,
                                                                                    "warning",
                                                                                    parseFloat(e.target.value) || 0
                                                                                )
                                                                            }
                                                                            min={config.min}
                                                                            max={config.max}
                                                                            step={config.step || 1}
                                                                            className={cn(
                                                                                inputClassName,
                                                                                "border-amber-500/20 focus:border-amber-500/40"
                                                                            )}
                                                                        />
                                                                        {config.unit && (
                                                                            <span className="text-[10px] text-muted-foreground/60 min-w-[16px]">
                                                                                {config.unit}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Critical Input */}
                                                                <div className="space-y-1.5">
                                                                    <Label className={cn(labelClassName, "text-red-500/80 flex items-center gap-1.5")}>
                                                                        <AlertTriangle className="h-2.5 w-2.5" />
                                                                        Critical
                                                                    </Label>
                                                                    <div className="flex items-center gap-2">
                                                                        <Input
                                                                            type="number"
                                                                            value={criticalValue}
                                                                            onChange={(e) =>
                                                                                updateThreshold(
                                                                                    config.key,
                                                                                    "critical",
                                                                                    parseFloat(e.target.value) || 0
                                                                                )
                                                                            }
                                                                            min={config.min}
                                                                            max={config.max}
                                                                            step={config.step || 1}
                                                                            className={cn(
                                                                                inputClassName,
                                                                                "border-red-500/20 focus:border-red-500/40"
                                                                            )}
                                                                        />
                                                                        {config.unit && (
                                                                            <span className="text-[10px] text-muted-foreground/60 min-w-[16px]">
                                                                                {config.unit}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-border/50 bg-muted/10 flex items-center justify-between gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleReset}
                            className="h-8 text-[11px] text-muted-foreground hover:text-foreground gap-1.5"
                        >
                            Reset to Default
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onOpenChange(false)}
                                className="h-8 text-[11px]"
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                className="h-8 text-[11px] gap-1.5"
                                disabled={!hasChanges}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
