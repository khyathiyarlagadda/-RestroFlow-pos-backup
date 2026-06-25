import React from 'react';
import { HelpCircle } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  ctaText?: string;
  onCtaClick?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: IconComponent = HelpCircle,
  title,
  subtitle,
  ctaText,
  onCtaClick
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 py-16 bg-bg-card rounded-card border border-border max-w-md mx-auto my-8">
      <div className="mb-4 text-[#C4B8B0]">
        <IconComponent className="w-12 h-12" />
      </div>
      <h3 className="text-[16px] font-medium text-text-primary mb-2 sentence-case">
        {title}
      </h3>
      <p className="text-[14px] text-text-muted mb-6 max-w-xs sentence-case">
        {subtitle}
      </p>
      {ctaText && onCtaClick && (
        <button
          onClick={onCtaClick}
          className="h-[36px] px-4 rounded-btn font-medium text-[14px] bg-primary text-white hover:bg-primary-dark transition-all duration-150"
        >
          {ctaText}
        </button>
      )}
    </div>
  );
};
