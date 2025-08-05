import * as React from "react"
import { cn } from "@/lib/utils"

const AvatarContext = React.createContext({
  size: 'md',
  isLoaded: false,
  onImageLoadingStatusChange: () => {},
});

const Avatar = React.forwardRef(({ size = 'md', className, ...props }, ref) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
  };

  return (
    <AvatarContext.Provider
      value={{
        size,
        isLoaded,
        onImageLoadingStatusChange: (status) => setIsLoaded(status === 'loaded'),
      }}
    >
      <span
        ref={ref}
        className={cn(
          'relative flex shrink-0 overflow-hidden rounded-full',
          sizes[size],
          className
        )}
        {...props}
      />
    </AvatarContext.Provider>
  );
});

const AvatarImage = React.forwardRef(({ className, ...props }, ref) => {
  const { onImageLoadingStatusChange } = React.useContext(AvatarContext);

  return (
    <img
      ref={ref}
      className={cn('aspect-square h-full w-full object-cover', className)}
      onLoadingStatusChange={(status) => onImageLoadingStatusChange(status)}
      {...props}
    />
  );
});

const AvatarFallback = React.forwardRef(({ className, ...props }, ref) => {
  const { size, isLoaded } = React.useContext(AvatarContext);
  const sizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  return isLoaded ? null : (
    <div
      ref={ref}
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800',
        sizes[size],
        className
      )}
      {...props}
    />
  );
});

export { Avatar, AvatarImage, AvatarFallback };
