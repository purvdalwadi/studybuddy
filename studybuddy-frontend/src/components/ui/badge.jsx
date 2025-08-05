import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold transition",
  {
    variants: {
      variant: {
        default: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
        blue: "bg-blue-100 text-blue-800",
        success: "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-200",
        warning: "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-200",
        danger: "bg-danger-100 text-danger-700 dark:bg-danger-900 dark:text-danger-200",
        info: "bg-secondary-100 text-secondary-700 dark:bg-secondary-900 dark:text-secondary-200",
        outline: "border border-gray-300 dark:border-gray-700 bg-transparent text-gray-700 dark:text-gray-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
