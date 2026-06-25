import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  widthClass?: string; // e.g. "max-w-[420px]" or "max-w-[480px]" or "max-w-[600px]"
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  widthClass = 'max-w-[420px]'
}) => {
  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay backdrop */}
      <div
        className="absolute inset-0 bg-black/45 transition-opacity duration-200 animate-[fadeIn_200ms_ease]"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className={`relative bg-bg-card w-full ${widthClass} rounded-[16px] shadow-popup border border-border overflow-hidden z-10 transition-transform duration-200 animate-[scaleUp_200ms_ease] flex flex-col max-h-[90vh]`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-card">
          <h3 className="text-[16px] font-medium text-text-primary sentence-case">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-danger-custom transition-colors duration-150 p-1 rounded-full hover:bg-bg-page"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};
