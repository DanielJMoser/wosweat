import React from 'react';
import { IonCard } from '@ionic/react';
import { GlassCardProps } from '../../types/ui';
import './GlassCard.scss';

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  variant = 'primary',
  onClick,
  href,
  target
}) => {
  const cardClasses = `glass-card glass-card--${variant} ${className}`;

  const commonProps = {
    className: cardClasses,
    onClick
  };

  if (href) {
    return (
      <IonCard {...commonProps} href={href} target={target}>
        {children}
      </IonCard>
    );
  }

  return (
    <IonCard {...commonProps}>
      {children}
    </IonCard>
  );
};