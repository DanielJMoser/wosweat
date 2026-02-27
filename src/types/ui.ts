export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'accent';
  onClick?: () => void;
  href?: string;
  target?: string;
}

export interface DebugInfo {
  eventsCount: number;
  lastUpdated: Date | null;
  cacheStatus: 'hit' | 'miss' | 'expired';
  loadingState: boolean;
  errorMessage?: string;
}

export interface DebugPanelProps {
  visible: boolean;
  debugInfo: DebugInfo;
  onClose?: () => void;
}