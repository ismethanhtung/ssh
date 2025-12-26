import React from "react";
import {
    X,
    Plus,
    XCircle,
    ArrowRight,
    ArrowLeft,
    Terminal,
} from "lucide-react";
import { Button } from "./ui/button";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "./ui/context-menu";

interface SessionTab {
    id: string;
    name: string;
    protocol?: string;
    isActive: boolean;
}

interface SessionTabsProps {
    tabs: SessionTab[];
    onTabSelect: (tabId: string) => void;
    onTabClose: (tabId: string) => void;
    onNewTab: () => void;
    onCloseAll?: () => void;
    onCloseOthers?: (tabId: string) => void;
    onCloseToRight?: (tabId: string) => void;
    onCloseToLeft?: (tabId: string) => void;
}

export function SessionTabs({
    tabs,
    onTabSelect,
    onTabClose,
    onNewTab,
    onCloseAll,
    onCloseOthers,
    onCloseToRight,
    onCloseToLeft,
}: SessionTabsProps) {
    return (
        <div className="bg-muted/30 p-1.5 flex items-center gap-1.5 overflow-hidden">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1">
                {tabs.map((tab, index) => (
                    <ContextMenu key={tab.id}>
                        <ContextMenuTrigger>
                            <div
                                className={`
                                    group relative flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-md cursor-pointer transition-all duration-200 border select-none max-w-[240px] min-w-[140px]
                                    ${
                                        tab.isActive
                                            ? "bg-background shadow-sm text-foreground border-border/50 ring-1 ring-black/5 dark:ring-white/5"
                                            : "border-transparent text-muted-foreground hover:bg-background/50 hover:text-foreground"
                                    }
                                `}
                                onClick={() => onTabSelect(tab.id)}
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {/* Connection Status Dot */}
                                    <div
                                        className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                                            tab.protocol === "SSH"
                                                ? "bg-emerald-500/80"
                                                : tab.protocol === "PowerShell"
                                                ? "bg-blue-500/80"
                                                : "bg-gray-500/80"
                                        } ${
                                            !tab.isActive &&
                                            "opacity-70 group-hover:opacity-100"
                                        }`}
                                    />

                                    {/* Protocol Icon (optional, if you want more visual hint) */}
                                    {/* <Terminal className="w-3 h-3 opacity-50 shrink-0" /> */}

                                    <span className="text-xs font-medium truncate flex-1">
                                        {tab.name}
                                    </span>
                                </div>

                                {/* Close Button */}
                                <div
                                    role="button"
                                    className={`
                                        opacity-0 group-hover:opacity-100 p-0.5 rounded-sm hover:bg-muted-foreground/10 transition-all shrink-0
                                        ${
                                            tab.isActive
                                                ? "opacity-0 group-hover:opacity-100"
                                                : ""
                                        }
                                    `}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTabClose(tab.id);
                                    }}
                                >
                                    <X className="w-3 h-3 text-muted-foreground/70" />
                                </div>
                            </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                            <ContextMenuItem onClick={() => onTabClose(tab.id)}>
                                <X className="mr-2 h-4 w-4" />
                                Close Tab
                            </ContextMenuItem>
                            {onCloseOthers && tabs.length > 1 && (
                                <ContextMenuItem
                                    onClick={() => onCloseOthers(tab.id)}
                                >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Close Other Tabs
                                </ContextMenuItem>
                            )}
                            <ContextMenuSeparator />
                            {onCloseToLeft && index > 0 && (
                                <ContextMenuItem
                                    onClick={() => onCloseToLeft(tab.id)}
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Close Tabs to the Left
                                </ContextMenuItem>
                            )}
                            {onCloseToRight && index < tabs.length - 1 && (
                                <ContextMenuItem
                                    onClick={() => onCloseToRight(tab.id)}
                                >
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                    Close Tabs to the Right
                                </ContextMenuItem>
                            )}
                            {onCloseAll && tabs.length > 0 && (
                                <>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem onClick={onCloseAll}>
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Close All Tabs
                                    </ContextMenuItem>
                                </>
                            )}
                        </ContextMenuContent>
                    </ContextMenu>
                ))}
            </div>

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80 shrink-0"
                onClick={onNewTab}
                title="New Tab"
            >
                <Plus className="w-4 h-4" />
            </Button>
        </div>
    );
}
