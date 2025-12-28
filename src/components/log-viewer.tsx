import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    FileText,
    RefreshCw,
    Download,
    Search,
    X,
    Loader2,
    Check,
    Terminal,
    Activity,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LogViewerProps {
    sessionId?: string;
}

interface LogFile {
    path: string;
    name: string;
}

export function LogViewer({ sessionId }: LogViewerProps) {
    const [logFiles, setLogFiles] = useState<LogFile[]>([]);
    const [selectedLogPath, setSelectedLogPath] = useState<string>("");
    const [logContent, setLogContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [lineCount, setLineCount] = useState<number>(50);
    const [lineCountInput, setLineCountInput] = useState<string>("50");
    const [scrollLocked, setScrollLocked] = useState(true); // Auto-scroll to bottom when locked
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadSuccess, setDownloadSuccess] = useState(false);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const lastScrollTop = useRef<number>(0);

    // Fetch available log files
    const fetchLogFiles = useCallback(async () => {
        if (!sessionId) return;

        setIsLoadingFiles(true);
        try {
            const result = await invoke<{
                success: boolean;
                output?: string;
                error?: string;
            }>("list_log_files", { sessionId });

            if (result.success && result.output) {
                const files = result.output
                    .split("\n")
                    .filter((path) => path.trim())
                    .map((path) => ({
                        path: path.trim(),
                        name: path.split("/").pop() || path,
                    }));
                setLogFiles(files);
            }
        } catch (error) {
            console.error("Failed to fetch log files:", error);
            toast.error("Failed to Load Log Files", {
                description:
                    error instanceof Error
                        ? error.message
                        : "Unable to fetch log file list from server.",
            });
        } finally {
            setIsLoadingFiles(false);
        }
    }, [sessionId]);

    // Fetch log content with smooth update
    const fetchLogContent = useCallback(
        async (isAutoRefresh = false) => {
            if (!sessionId || !selectedLogPath) return;

            if (!isAutoRefresh) {
                setIsLoading(true);
            }

            try {
                const result = await invoke<{
                    success: boolean;
                    output?: string;
                    error?: string;
                }>("tail_log", {
                    sessionId,
                    logPath: selectedLogPath,
                    lines: lineCount,
                });

                if (result.success && result.output) {
                    // Store scroll position before update
                    const scrollContainer =
                        scrollAreaRef.current?.querySelector(
                            "[data-radix-scroll-area-viewport]"
                        );
                    const wasAtBottom = scrollContainer
                        ? scrollContainer.scrollHeight -
                              scrollContainer.scrollTop -
                              scrollContainer.clientHeight <
                          50
                        : true;

                    setLogContent(result.output);

                    // Restore scroll position or scroll to bottom if locked
                    if (scrollLocked || wasAtBottom) {
                        setTimeout(() => {
                            if (scrollContainer) {
                                scrollContainer.scrollTop =
                                    scrollContainer.scrollHeight;
                            }
                        }, 10);
                    }
                } else {
                    setLogContent(
                        `Error: ${result.error || "Failed to fetch log"}`
                    );
                    if (!isAutoRefresh) {
                        toast.error("Failed to Load Log Content", {
                            description:
                                result.error ||
                                "Unable to fetch log content from server.",
                        });
                    }
                }
            } catch (error) {
                setLogContent(`Error: ${error}`);
                if (!isAutoRefresh) {
                    toast.error("Failed to Load Log Content", {
                        description:
                            error instanceof Error
                                ? error.message
                                : "An unexpected error occurred.",
                    });
                }
            } finally {
                if (!isAutoRefresh) {
                    setIsLoading(false);
                }
            }
        },
        [sessionId, selectedLogPath, lineCount, scrollLocked]
    );

    // Load log files on mount
    useEffect(() => {
        if (sessionId) {
            fetchLogFiles();
        }
    }, [sessionId, fetchLogFiles]);

    // Sync lineCountInput with lineCount on mount
    useEffect(() => {
        setLineCountInput(lineCount.toString());
    }, []);

    // Fetch log content when log file is selected (Static mode) or line count changes
    useEffect(() => {
        if (selectedLogPath && !autoRefresh) {
            fetchLogContent(false);
        }
    }, [selectedLogPath, lineCount, autoRefresh]);

    // Auto-refresh log content
    useEffect(() => {
        if (!autoRefresh || !selectedLogPath) return;

        const interval = setInterval(() => fetchLogContent(true), 5000); // Increased to 5 seconds
        return () => clearInterval(interval);
    }, [autoRefresh, selectedLogPath, fetchLogContent]);

    // Memoized log lines to prevent unnecessary re-renders
    const logLines = useMemo(() => {
        return logContent.split("\n");
    }, [logContent]);

    // Filter log lines based on search term
    const filteredLogLines = useMemo(() => {
        if (!searchTerm) return logLines;
        const lowerSearch = searchTerm.toLowerCase();
        return logLines.filter((line) =>
            line.toLowerCase().includes(lowerSearch)
        );
    }, [logLines, searchTerm]);

    // Highlight log levels - memoized function
    const highlightLogLine = useCallback((line: string) => {
        const lowerLine = line.toLowerCase();
        if (
            lowerLine.includes("error") ||
            lowerLine.includes("err") ||
            lowerLine.includes("fail") ||
            lowerLine.includes("panic")
        ) {
            return "text-red-400 font-medium";
        } else if (
            lowerLine.includes("warn") ||
            lowerLine.includes("warning")
        ) {
            return "text-amber-400";
        } else if (lowerLine.includes("info")) {
            return "text-blue-400";
        } else if (
            lowerLine.includes("success") ||
            lowerLine.includes("ok") ||
            lowerLine.includes("complete")
        ) {
            return "text-emerald-400";
        } else if (lowerLine.includes("debug") || lowerLine.includes("trace")) {
            return "text-muted-foreground/50";
        }
        return "text-foreground/90";
    }, []);

    // Detect user scroll to unlock auto-scroll
    // Use useEffect to attach scroll listener to Radix viewport
    useEffect(() => {
        const viewport = scrollAreaRef.current?.querySelector(
            "[data-radix-scroll-area-viewport]"
        );
        if (!viewport) return;

        const onScroll = () => {
            const target = viewport as HTMLElement;
            const isAtBottom =
                target.scrollHeight - target.scrollTop - target.clientHeight <
                50;

            // Auto-lock when user scrolls to bottom, unlock when scrolling up
            if (isAtBottom && !scrollLocked) {
                setScrollLocked(true);
            } else if (
                !isAtBottom &&
                scrollLocked &&
                target.scrollTop < lastScrollTop.current
            ) {
                setScrollLocked(false);
            }

            lastScrollTop.current = target.scrollTop;
        };

        viewport.addEventListener("scroll", onScroll);
        return () => viewport.removeEventListener("scroll", onScroll);
    }, [scrollLocked]);

    // Download logs
    const downloadLogs = async () => {
        if (!logContent || isDownloading) return;

        setIsDownloading(true);
        setDownloadSuccess(false);

        try {
            // Simulate a small delay to show loading state
            await new Promise((resolve) => setTimeout(resolve, 300));

            const blob = new Blob([logContent], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const fileName = `${selectedLogPath
                .split("/")
                .pop()}_${new Date().toISOString()}.log`;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);

            // Show success state
            setDownloadSuccess(true);
            toast.success("Download thành công", {
                description: `File ${fileName} đã được tải xuống`,
            });

            // Reset success state after 2 seconds
            setTimeout(() => {
                setDownloadSuccess(false);
            }, 2000);
        } catch (error) {
            toast.error("Download thất bại", {
                description:
                    error instanceof Error
                        ? error.message
                        : "Không thể tải xuống file log",
            });
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-background">
            {/* Professional Integrated Toolbar */}
            <div className="flex-none border-b border-border bg-muted/20 px-3 py-2 flex flex-col gap-2">
                <div className="flex items-center w-full">
                    <div className="flex items-center gap-2 w-full">
                        <Select
                            value={selectedLogPath}
                            onValueChange={setSelectedLogPath}
                        >
                            <SelectTrigger className="h-7 w-full flex-1 bg-background/50 border-border/50 text-[10px] font-medium transition-all hover:bg-background overflow-hidden [&>span]:truncate min-h-0 max-h-7 py-0">
                                <SelectValue placeholder="Select log file..." />
                            </SelectTrigger>
                            <SelectContent>
                                {logFiles.map((file) => (
                                    <SelectItem
                                        key={file.path}
                                        value={file.path}
                                        className="text-[10px]"
                                    >
                                        {file.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 border-border/50 bg-background/50"
                            onClick={fetchLogFiles}
                            title="Refresh log file list"
                        >
                            <RefreshCw
                                className={cn(
                                    "w-3 h-3",
                                    isLoadingFiles && "animate-spin"
                                )}
                            />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="
                                pl-8 h-7
                                !text-[12px] !font-normal 
                                bg-background/50 border-border/50

                                placeholder:text-[10px]
                            "
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-background/50 border border-border/50 rounded-md px-2 h-7">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase">
                            Lines
                        </span>
                        <input
                            type="text"
                            value={lineCountInput}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === "" || /^\d+$/.test(value)) {
                                    setLineCountInput(value);
                                    const num = parseInt(value, 10);
                                    if (
                                        !isNaN(num) &&
                                        num >= 1 &&
                                        num <= 2000
                                    ) {
                                        setLineCount(num);
                                    }
                                }
                            }}
                            className="w-8 bg-transparent border-none text-[10px] focus:ring-0 text-center font-mono font-medium"
                        />
                    </div>

                    <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                            "h-7 px-3 text-[10px] font-medium border-border/50 bg-background/50",
                            autoRefresh &&
                                "bg-primary/10 text-primary border-primary/20"
                        )}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        disabled={!selectedLogPath}
                    >
                        <div
                            className={cn(
                                "w-1 h-1 rounded-full mr-1.5",
                                autoRefresh
                                    ? "bg-primary animate-pulse"
                                    : "bg-muted-foreground/50"
                            )}
                        />
                        {autoRefresh ? "Live" : "Static"}
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0 border-border/50 bg-background/50"
                        onClick={downloadLogs}
                        disabled={!logContent || isDownloading}
                    >
                        {isDownloading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Download className="w-3.5 h-3.5" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Structured Log View Area */}
            <div className="flex-1 relative min-h-0 bg-background">
                <ScrollArea className="h-full" ref={scrollAreaRef}>
                    <div className="flex flex-col min-w-full">
                        {!selectedLogPath ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center">
                                <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                                    <FileText className="w-5 h-5 text-muted-foreground/20" />
                                </div>
                                <h3 className="text-[11px]    ">
                                    No Source Selected
                                </h3>
                            </div>
                        ) : isLoading && !autoRefresh ? (
                            <div className="p-8 flex items-center justify-center gap-2 text-muted-foreground/50 italic text-[10px]">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Initializing data stream...
                            </div>
                        ) : filteredLogLines.length > 0 ? (
                            <div className="divide-y divide-border/20 border-b border-border/20">
                                {filteredLogLines.map((line, i) => {
                                    if (
                                        !line.trim() &&
                                        i === filteredLogLines.length - 1
                                    )
                                        return null;

                                    // Severity analysis for structured visual cues
                                    const lower = line.toLowerCase();
                                    const isError =
                                        lower.includes("error") ||
                                        lower.includes("err") ||
                                        lower.includes("fail") ||
                                        lower.includes("panic");
                                    const isWarn = lower.includes("warn");
                                    const isInfo = lower.includes("info");
                                    const isDebug =
                                        lower.includes("debug") ||
                                        lower.includes("trace");

                                    return (
                                        <div
                                            key={`${selectedLogPath}-${i}`}
                                            className={cn(
                                                "group flex items-start gap-1 p-0 transition-all hover:bg-muted/30",
                                                isError && "bg-red-500/5",
                                                isWarn && "bg-amber-500/5"
                                            )}
                                        >
                                            {/* Severity Indicator Bar */}
                                            <div
                                                className={cn(
                                                    "w-0.5 self-stretch shrink-0",
                                                    isError
                                                        ? "bg-red-500"
                                                        : isWarn
                                                        ? "bg-amber-500"
                                                        : isInfo
                                                        ? "bg-blue-500"
                                                        : "bg-transparent group-hover:bg-muted"
                                                )}
                                            />

                                            <div className="flex-1 flex gap-3 px-2 py-1.5 overflow-hidden items-center">
                                                <span className="text-muted-foreground/30 text-[9px]  select-none font-mono tabular-nums leading-none flex items-center justify-end h-5">
                                                    {i + 1}
                                                </span>
                                                <div className="min-w-0 flex-1 flex items-center">
                                                    <span
                                                        className={cn(
                                                            "font-mono text-[10px] leading-5 whitespace-pre-wrap break-all tabular-nums tracking-tight",
                                                            isError
                                                                ? "text-red-400 font-medium"
                                                                : isWarn
                                                                ? "text-amber-400"
                                                                : isInfo
                                                                ? "text-blue-400"
                                                                : isDebug
                                                                ? "text-muted-foreground/50"
                                                                : "text-foreground/80"
                                                        )}
                                                    >
                                                        {line || " "}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-12 flex flex-col items-center justify-center text-muted-foreground/20 italic">
                                <Search className="w-6 h-6 mb-2 opacity-5" />
                                <span className="text-[10px] font-medium tracking-tighter">
                                    No logs match criteria
                                </span>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
