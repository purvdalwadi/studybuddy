import React from 'react';
import { cn } from '@/lib/utils';

/**
 * A reusable label component for form elements
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The label text
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.required] - Whether the field is required
 * @param {string} [props.htmlFor] - The ID of the form element this label is for
 * @returns {JSX.Element} Label component
 */
const Label = React.forwardRef(({ 
  children, 
  className = '', 
  required = false, 
  htmlFor, 
  ...props 
}, ref) => {
  return (
    <label
      ref={ref}
      htmlFor={htmlFor}
      className={cn(
        'block text-sm font-medium text-gray-700 dark:text-gray-300',
        'mb-1',
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
});

Label.displayName = 'Label';

export { Label };
