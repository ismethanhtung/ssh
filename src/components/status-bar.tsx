import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

interface StatusBarProps {
  activeSession?: {
    name: string;
    protocol: string;
    host?: string;
    status: 'connected' | 'connecting' | 'disconnected';
  };
}

export function StatusBar({ activeSession }: StatusBarProps) {
  const { t } = useTranslation();

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return t('status.connected');
      case 'connecting': return t('status.connecting');
      case 'disconnected': return t('status.disconnected');
      default: return status;
    }
  };

  return (
    <div className="bg-muted border-t border-border px-4 py-1 flex items-center justify-between text-sm">
      <div className="flex items-center gap-4">
        {activeSession && (
          <>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                activeSession.status === 'connected' ? 'bg-green-500' :
                activeSession.status === 'connecting' ? 'bg-yellow-500' :
                'bg-red-500'
              }`} />
              <span>{activeSession.name}</span>
            </div>

            <Separator orientation="vertical" className="h-4" />

            <Badge variant="outline" className="text-xs">
              {activeSession.protocol}
            </Badge>

            {activeSession.host && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-muted-foreground">{activeSession.host}</span>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-muted-foreground">
          {t("status.ready")}
        </div>
      </div>
    </div>
  );
}