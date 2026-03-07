import type { ReactNode } from 'react';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import type { SiteContextFeatures } from '@/types/api';

interface FeatureGateProps {
  feature: keyof SiteContextFeatures;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const { context } = useSiteContextData();

  if (!context.features[feature]) {
    return fallback;
  }

  return children;
}
