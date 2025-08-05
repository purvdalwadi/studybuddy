import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Progress component for showing loading or progress indicators
 * @param {Object} props - Component props
 * @param {number} [props.value=0] - The current progress value (0-100)
 * @param {string} [props.className] - Additional CSS classes
 * @param {string} [props.indicatorClassName] - Additional classes for the indicator bar
 * @returns {JSX.Element} Progress component
 */
const Progress = React.forwardRef(({ 
  value = 0, 
  className = '',
  indicatorClassName = '',
  ...props 
}, ref) => {
  // Ensure value is between 0 and 100
  const progressValue = Math.min(100, Math.max(0, value));
  
  return (
    <div 
      ref={ref}
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700',
        className
      )}
      role="progressbar"
      aria-valuenow={Math.round(progressValue)}
      aria-valuemin={0}
      aria-valuemax={100}
      {...props}
    >
      <div
        className={cn(
          'h-full bg-primary-500 transition-all duration-300 ease-in-out',
          'flex items-center justify-end',
          indicatorClassName
        )}
        style={{ width: `${progressValue}%` }}
      >
        <span className="sr-only">{progressValue}%</span>
      </div>
    </div>
  );
});

Progress.displayName = 'Progress';

export { Progress };
