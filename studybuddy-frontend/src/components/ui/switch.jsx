import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Switch for StudyBuddy UI (v2 style)
 * Props:
 * - checked: boolean
 * - onChange: function
 * - label: string (optional, shown right of switch)
 * - className: additional classes
 * - ...rest: input props
 */
const Switch = React.forwardRef(({ checked, onChange, label, className, ...props }, ref) => {
  return (
    <label className={cn("inline-flex items-center cursor-pointer gap-2", className)}>
      <span className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange?.(e.target.checked)}
          ref={ref}
          className="sr-only peer"
          {...props}
        />
        <span className="block w-10 h-6 bg-gray-300 rounded-full peer-checked:bg-indigo-500 transition" />
        <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
      </span>
      {label && <span className="text-sm text-gray-700 dark:text-gray-200 select-none">{label}</span>}
    </label>
  );
})
Switch.displayName = "Switch"

export { Switch }
