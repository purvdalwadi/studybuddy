import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 bg-background rounded-lg shadow-sm border border-border/50", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-6 sm:space-x-6 sm:space-y-0",
        month: "space-y-4 min-w-[280px]",
        caption: "flex justify-center pt-1 relative items-center h-9 mb-4 w-full",
        caption_label: "text-base font-semibold text-foreground mx-4",
        caption_dropdowns: "flex items-center space-x-2",
        nav: "flex items-center space-x-1",
        nav_button: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-8 w-8 p-0 rounded-full hover:bg-accent hover:text-accent-foreground"
        ),
        nav_button_previous: "absolute left-1 z-10",
        nav_button_next: "absolute right-1 z-10",
        table: "w-full border-collapse space-y-1 mt-3",
        head_row: "flex justify-between",
        head_cell: "text-muted-foreground rounded-md w-9 h-9 font-normal text-xs flex items-center justify-center",
        row: "flex w-full mt-2 justify-between",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-transparent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal rounded-md transition-colors",
          "hover:bg-accent/50 hover:text-accent-foreground"
        ),
        day_range_start: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_range_end: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent/50 text-accent-foreground font-medium border border-border",
        day_outside: "text-muted-foreground/40 aria-selected:bg-accent/30 aria-selected:text-muted-foreground/60",
        day_disabled: "text-muted-foreground/30 pointer-events-none",
        day_range_middle: "aria-selected:bg-accent/30 aria-selected:text-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
        Dropdown: (props) => (
          <div className="relative">
            <select
              className={cn(
                "appearance-none bg-transparent border-none text-sm font-medium text-foreground pr-6 pl-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "cursor-pointer hover:bg-accent/50"
              )}
              {...props}
            />
            <MoreHorizontal className="absolute right-1 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-50 pointer-events-none" />
          </div>
        ),
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
