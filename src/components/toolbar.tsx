import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
    Plus,
    FolderOpen,
    Save,
    Copy,
    Clipboard,
    Search,
    Settings,
    Lock,
    Palette,
    Globe,
    FileText,
    RotateCcw,
    MoreHorizontal,
    PanelRightClose,
    PanelRightOpen,
    PanelLeftClose,
    PanelLeftOpen,
    PanelBottomClose,
    PanelBottomOpen,
    Maximize2,
    LayoutGrid,
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface ToolbarProps {
    onNewSession?: () => void;
    onOpenSession?: () => void;
    onOpenSFTP?: () => void;
    onOpenSettings?: () => void;
    onToggleLeftSidebar?: () => void;
    onToggleRightSidebar?: () => void;
    onToggleBottomPanel?: () => void;
    onToggleZenMode?: () => void;
    onApplyPreset?: (preset: string) => void;
    leftSidebarVisible?: boolean;
    rightSidebarVisible?: boolean;
    bottomPanelVisible?: boolean;
    zenMode?: boolean;
}

export function Toolbar({
    onNewSession,
    onOpenSession,
    onOpenSFTP,
    onOpenSettings,
    onToggleLeftSidebar,
    onToggleRightSidebar,
    onToggleBottomPanel,
    onToggleZenMode,
    onApplyPreset,
    leftSidebarVisible,
    rightSidebarVisible,
    bottomPanelVisible,
    zenMode,
}: ToolbarProps) {
    const { t } = useTranslation();

    return (
        <TooltipProvider>
            <div className="border-b border-border bg-background px-2 py-3.5 flex items-center gap-1">
                {/* <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onNewSession}
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>New Session</TooltipContent>
                </Tooltip> */}

                {/* 
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm">
              <Save className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save Session</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm">
              <Copy className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm">
              <Clipboard className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Paste</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm">
              <Search className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Find</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm">
              <Lock className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Lock Session</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm">
              <Palette className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Color Scheme</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm">
              <Globe className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>SSH Tunneling</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onOpenSFTP}>
              <FileText className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>File Transfer</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reconnect</TooltipContent>
        </Tooltip> */}
                {/* 
                <Separator orientation="vertical" className="h-4 mx-1" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onOpenSettings}
                        >
                            <Settings className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Options</TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-4 mx-1" /> */}

                {/* Layout Controls */}
                {/* <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onToggleLeftSidebar}
                            className={!leftSidebarVisible ? "opacity-50" : ""}
                        >
                            {leftSidebarVisible ? (
                                <PanelLeftClose className="w-4 h-4" />
                            ) : (
                                <PanelLeftOpen className="w-4 h-4" />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {leftSidebarVisible ? "Hide" : "Show"} Session Manager
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onToggleBottomPanel}
                            className={!bottomPanelVisible ? "opacity-50" : ""}
                        >
                            {bottomPanelVisible ? (
                                <PanelBottomClose className="w-4 h-4" />
                            ) : (
                                <PanelBottomOpen className="w-4 h-4" />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {bottomPanelVisible ? "Hide" : "Show"} File Browser
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onToggleRightSidebar}
                            className={!rightSidebarVisible ? "opacity-50" : ""}
                        >
                            {rightSidebarVisible ? (
                                <PanelRightClose className="w-4 h-4" />
                            ) : (
                                <PanelRightOpen className="w-4 h-4" />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {rightSidebarVisible ? "Hide" : "Show"} Monitor Panel
                    </TooltipContent>
                </Tooltip> */}

                {/* <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>More Tools</TooltipContent>
        </Tooltip> */}
            </div>
        </TooltipProvider>
    );
}
