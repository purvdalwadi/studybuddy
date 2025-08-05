import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// STEP 1: Create your own context for active tab value
const ActiveTabContext = React.createContext();

const Tabs = ({ children, value: propValue, defaultValue = "joined", onValueChange, ...props }) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  
  // Use propValue if provided (controlled), otherwise use internal state (uncontrolled)
  const activeTab = propValue !== undefined ? propValue : internalValue;
  
  // Ensure we have a valid active tab
  const activeValue = activeTab || defaultValue;
  
  const handleValueChange = (newValue) => {
    if (onValueChange) {
      onValueChange(newValue);
    }
    if (propValue === undefined) {
      // Only update internal state if component is uncontrolled
      setInternalValue(newValue);
    }
  };

  return (
    <TabsPrimitive.Root
      {...props}
      value={activeValue}
      onValueChange={handleValueChange}
      defaultValue={defaultValue}
    >
      <ActiveTabContext.Provider value={activeValue}>
        {children}
      </ActiveTabContext.Provider>
    </TabsPrimitive.Root>
  );
};

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <div className="relative inline-block">
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "relative inline-flex items-center justify-start h-9 space-x-1 border-b border-gray-200 dark:border-gray-800 px-1 pb-0",
        className
      )}
      {...props}
    />
  </div>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef(({ className, value, children, ...props }, ref) => {
  const activeTab = React.useContext(ActiveTabContext);
  const isActive = activeTab === value;

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        "relative h-full text-sm font-medium transition-all duration-200 whitespace-nowrap group",
        isActive 
          ? "text-white font-semibold shadow-sm" 
          : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      <span className="relative z-10 block px-4 py-2">
        {children}
        {isActive && (
          <motion.span
            layoutId="activeTabBackground"
            className="absolute inset-0 -z-10 rounded-md"
            style={{
              background: 'linear-gradient(90deg, #4F46E5 0%, #7C3AED 100%)',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              zIndex: -1,
            }}
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              type: "spring",
              bounce: 0.2,
              duration: 0.4,
            }}
          />
        )}
      </span>
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:zoom-in-95",
      "data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=inactive]:zoom-out-95",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
