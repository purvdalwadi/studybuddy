import React from 'react';

export function Alert({ variant = 'default', className = '', children, ...props }) {
  const baseStyles = 'p-4 rounded-lg border';
  const variantStyles = {
    default: 'bg-white border-gray-200 text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white',
    destructive: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-200',
  };

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      role="alert"
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertTitle({ className = '', ...props }) {
  return (
    <h3
      className={`text-lg font-medium leading-none tracking-tight mb-1 ${className}`}
      {...props}
    />
  );
}

export function AlertDescription({ className = '', ...props }) {
  return (
    <div
      className={`text-sm [&_p]:leading-relaxed ${className}`}
      {...props}
    />
  );
}