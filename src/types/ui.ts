export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'accent';
  onClick?: () => void;
  href?: string;
  target?: string;
}

export interface AnimationConfig {
  intensity: number;
  speed: number;
  particleCount: number;
  mouseInfluence: number;
  gravityStrength?: number;
  maxGravityDistance?: number;
  mode?: 'abstract' | 'nightsky';
  showConstellationLines?: boolean;
  showConstellationLabels?: boolean;
  magnitudeLimit?: number;
}

export interface MousePosition {
  x: number;
  y: number;
}

export interface DebugInfo {
  eventsCount: number;
  lastUpdated: Date | null;
  cacheStatus: 'hit' | 'miss' | 'expired';
  loadingState: boolean;
  errorMessage?: string;
}

export interface HeaderProps {
  title: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

export interface DebugPanelProps {
  visible: boolean;
  debugInfo: DebugInfo;
  onClose?: () => void;
}