import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Input for StudyBuddy UI (v2 style)
 * Props:
 * - label: string (optional, shown above input)
 * - error: string (optional, shown below input)
 * - className: additional classes
 * - ...rest: input props
 */
const Input = React.forwardRef(({ className, type = 'text', label, error, ...props }, ref) => {
  return (
    <div className={cn("flex flex-col gap-1 w-full", className)}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor={props.id}>{label}</label>
      )}
      <input
        type={type}
        className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition placeholder:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
        ref={ref}
        {...props}
      />
      {error && <span className="text-xs text-danger-500 pt-1">{error}</span>}
    </div>
  );
})
Input.displayName = "Input"

export { Input }
