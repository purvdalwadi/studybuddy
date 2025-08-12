import * as React from "react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onOpenChange, children }) {
  const [isOpen, setIsOpen] = React.useState(open ?? false);
  
  React.useEffect(() => {
    const isCurrentlyOpen = open ?? false;
    setIsOpen(isCurrentlyOpen);
    
    // Prevent body scroll when dialog is open
    if (isCurrentlyOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);
  
  const handleOpenChange = React.useCallback((next) => {
    if (next === isOpen) return; // Prevent unnecessary updates
    
    setIsOpen(next);
    onOpenChange?.(next);
  }, [isOpen, onOpenChange]);
  
  const handleBackdropClick = React.useCallback((e) => {
    e.stopPropagation();
    handleOpenChange(false);
  }, [handleOpenChange]);
  
  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleOpenChange(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleOpenChange]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      {React.Children.map(children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child, { 
              open: isOpen,
              onOpenChange: handleOpenChange,
            })
          : child
      )}
    </div>
  );
}

export function DialogTrigger({ asChild, children, onOpenChange }) {
  const child = React.Children.only(children);
  
  // Debug log to check the child being rendered
  console.log('DialogTrigger rendering child:', {
    type: child.type,
    props: { ...child.props, children: '[...]' },
    hasOnClick: !!child.props.onClick,
    hasOnOpenChange: !!onOpenChange
  });
  
  return React.cloneElement(child, {
    onClick: (e) => {
      console.log('DialogTrigger onClick fired');
      child.props.onClick?.(e);
      if (onOpenChange) {
        console.log('Calling onOpenChange with true');
        onOpenChange(true);
      }
    }
  });
}

export function DialogContent({ 
  children, 
  className, 
  onOpenChange, 
  ...props 
}) {
  const handleClick = (e) => {
    // Prevent clicks inside the dialog from closing it
    e.stopPropagation();
  };

  // Filter out non-DOM props before spreading
  const safeProps = {
    ...props,
    role: 'dialog',
    'aria-modal': 'true',
    onClick: handleClick,
    className: cn(
      "relative z-50", // Removed fixed positioning as it's now handled by the parent
      "bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6",
      "border border-gray-200/80 dark:border-gray-700/80",
      "transition-all duration-200 ease-out animate-fade-in",
      "w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
      className
    )
  };
  
  return (
    <div {...safeProps}>
      {children}
    </div>
  );
}

export function DialogHeader({ children }) {
  return <div className="mb-4 text-lg font-semibold">{children}</div>;
}
export function DialogTitle({ children }) {
  return <div className="mb-4 text-lg font-semibold">{children}</div>;
}
export function DialogFooter({ children }) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>;
}

export function DialogDescription({ children, className, ...props }) {
  return (
    <p 
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  );
}
