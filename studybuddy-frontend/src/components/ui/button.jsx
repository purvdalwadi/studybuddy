import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-md",
  {
    variants: {
      variant: {
        primary: "bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600",
        secondary: "bg-secondary-100 text-primary-700 hover:bg-secondary-200",
        danger: "bg-danger-500 text-white hover:bg-danger-600",
        outline: "border border-border bg-transparent text-primary-700 hover:bg-primary-50",
        ghost: "bg-transparent text-primary-700 hover:bg-primary-50",
        // Aliases for compatibility
        default: "bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600",
        destructive: "bg-danger-500 text-white hover:bg-danger-600",
        link: "text-primary underline-offset-4 hover:underline bg-transparent",
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
        icon: "h-10 w-10",
        default: "px-4 py-2 text-base",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, fullWidth = false, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, fullWidth, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
