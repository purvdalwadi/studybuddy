import React, { useEffect, useState, useRef, useCallback, useMemo,memo } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { 
  Home, 
  Users, 
  MessageCircle, 
  Calendar, 
  LogOut, 
  LogIn, 
  UserPlus, 
  Menu, 
  User, 
  Settings, 
  ChevronDown,
  ChevronRight,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { extractUserAvatar, getUserInitials } from "@/utils/avatarUtils";

// Navigation links for both desktop and mobile
const navLinks = [
  { to: "/groups", label: "Find Groups", icon: <Home size={20} /> },
  { to: "/my-groups", label: "My Groups", icon: <Users size={20} /> },
  { to: "/messages", label: "Messages", icon: <MessageCircle size={20} /> },
  { to: "/schedule", label: "Schedule", icon: <Calendar size={20} /> },
];

// Account related links
const accountLinks = [
  { to: "/settings", label: "Settings", icon: <Settings size={18} /> },
];

// Shared layout animation ID for the active background
const ACTIVE_BG_ID = 'activeNavBackground';

// Background highlight component with fixed height and sliding animation
const BackgroundHighlight = ({ className = '' }) => (
  <motion.div
    layoutId={ACTIVE_BG_ID}
    className={`absolute inset-0 bg-gradient-to-r from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-900/10 rounded-xl ${className}`}
    initial={false}
    transition={{
      type: 'spring',
      stiffness: 300,
      damping: 25,
      mass: 0.5
    }}
    style={{
      zIndex: 0,
      borderRadius: '0.75rem',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
    }}
  />
);

const NavItem = ({ to, icon, label, isActive, onClick, className = '' }) => {
  const location = useLocation();
  const navRef = useRef(null);
  const isActiveRoute = isActive || location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  
  const handleClick = (e) => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <motion.li 
      ref={navRef}
      className="relative mx-2 mb-1 overflow-visible list-none h-12 flex items-center"
      initial={false}
      whileHover={{ 
        scale: 1.02,
        transition: { duration: 0.15 }
      }}
      whileTap={{ 
        scale: 0.98,
        transition: { duration: 0.1 }
      }}
    >
      <NavLink
        to={to}
        className={`relative w-full h-full flex items-center px-4 rounded-lg select-none ${className} ${
          isActiveRoute 
            ? 'text-primary-700 dark:text-primary-300 font-medium' 
            : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
        }`}
        onClick={handleClick}
      >
        {() => (
          <>
            {/* Active background with fixed height and sliding animation */}
            {isActiveRoute && (
              <BackgroundHighlight className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-900/10" />
            )}
            
            {/* Content */}
            <motion.span 
              className="relative flex items-center z-10 w-full"
              initial={false}
              animate={{
                x: isActiveRoute ? 2 : 0,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25
              }}
            >
              {React.cloneElement(icon, { 
                className: `h-5 w-5 mr-3 transition-all duration-300 ${
                  isActiveRoute 
                    ? 'text-primary-600 dark:text-primary-400' 
                    : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'
                }` 
              })}
              <span className="relative">{label}</span>
            </motion.span>
          </>
        )}
      </NavLink>
    </motion.li>
  );
};

// UserAccount component that re-renders when user data changes
const UserAccount = ({ user, onLogout, isMobile = false }) => {
  // Format user data
  const displayUser = (() => {
    if (!user) return null;
    
    // Handle both user.data and direct user properties
    const userData = user.data || user;
    const userName = userData?.name || 'User';
    
    return {
      name: userName,
      email: userData?.email || '',
      avatar: userData?.avatar,
      university: userData?.university,
      major: userData?.major,
      year: userData?.year,
      isVerified: userData?.isVerified || user?.isVerified || false,
      // Generate initials safely
      initials: (userName || '').split(' ')
        .filter(Boolean) // Filter out any empty strings
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2) || 'U'
    };
  })();
  
  if (!user) {
    return (
      <div className="flex items-center">
        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
        <span className="ml-3 font-medium">Account</span>
      </div>
    );
  }
  
  return (
      <div className="flex items-center w-full">
        <Avatar className="h-8 w-8">
          {displayUser.avatar ? (
            <>
              <AvatarImage 
                src={extractUserAvatar(displayUser)} 
                alt={displayUser.name || 'User'}
                className="object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <AvatarFallback className="bg-gradient-to-br from-primary-500 to-indigo-600 text-white text-xs">
                {getUserInitials(displayUser.name || 'U')}
              </AvatarFallback>
            </>
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-indigo-600">
              <span className="text-white text-xs font-medium">
                {getUserInitials(displayUser.name || 'U')}
              </span>
            </div>
          )}
        </Avatar>
        <div className="ml-3 overflow-hidden flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {displayUser.name}
            {displayUser.isVerified && (
              <svg className="w-3.5 h-3.5 ml-1 inline text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 0 1 2.745 0l5.5 2.75a3.066 3.066 0 0 1 1.71 2.75v5.5a3.066 3.066 0 0 1-1.71 2.75l-5.5 2.75a3.066 3.066 0 0 1-2.745 0l-5.5-2.75a3.066 3.066 0 0 1-1.71-2.75v-5.5a3.066 3.066 0 0 1 1.71-2.75l5.5-2.75zM8 7a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V8a1 1 0 0 0-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {displayUser.email}
          </p>
          {(displayUser.university || displayUser.major || displayUser.year) && (
            <div className="flex flex-wrap gap-1 mt-1">
              {displayUser.university && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-200">
                  {displayUser.university}
                </span>
              )}
              {displayUser.major && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-800/30 dark:text-purple-200">
                  {displayUser.major}
                </span>
              )}
              {displayUser.year && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-200">
                  {displayUser.year}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
};

const Sidebar = () => {
  // Get auth state at the top level - user data is now managed in AuthContext
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // State for UI
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isMobileAccountOpen, setIsMobileAccountOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const sidebarRef = useRef(null);
  
  // Use the user directly from AuthContext - it will be updated by the context
  const userData = user;

  // Memoize event handlers to prevent unnecessary re-renders
  const handleAccountClickOutside = useCallback((event) => {
    if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
      setIsAccountOpen(false);
      setIsMobileAccountOpen(false);
    }
  }, []);

  const handleMobileMenuClickOutside = useCallback((e) => {
    const mobileMenu = document.querySelector('.mobile-menu-container');
    const menuButton = document.querySelector('.mobile-menu-button');
    
    if (mobileMenu && !mobileMenu.contains(e.target) && menuButton && !menuButton.contains(e.target)) {
      setIsMobileMenuOpen(false);
    }
  }, []);

  const handleRouteChange = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  // Handle all click-outside and route change behaviors
  useEffect(() => {
    // Add event listeners
    const eventOptions = { passive: true };
    
    // For account menus
    document.addEventListener('mousedown', handleAccountClickOutside, eventOptions);
    document.addEventListener('touchstart', handleAccountClickOutside, eventOptions);
    
    // For mobile menu
    document.addEventListener('mousedown', handleMobileMenuClickOutside, eventOptions);
    document.addEventListener('touchstart', handleMobileMenuClickOutside, eventOptions);
    
    // For route changes
    window.addEventListener('popstate', handleRouteChange);

    // Cleanup function
    return () => {
      // Remove account menu listeners
      document.removeEventListener('mousedown', handleAccountClickOutside);
      document.removeEventListener('touchstart', handleAccountClickOutside);
      
      // Remove mobile menu listeners
      document.removeEventListener('mousedown', handleMobileMenuClickOutside);
      document.removeEventListener('touchstart', handleMobileMenuClickOutside);
      
      // Remove route change listener
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [handleAccountClickOutside, handleMobileMenuClickOutside, handleRouteChange]);

  // Memoize handlers to prevent unnecessary re-renders
  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      toast.success('Successfully logged out');
      setIsMobileMenuOpen(false);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
    } finally {
      setIsLoggingOut(false);
    }
  }, [logout, navigate]);

  const toggleAccountMenu = useCallback((isMobile = false) => {
    if (isMobile) {
      setIsMobileAccountOpen(prev => !prev);
    } else {
      setIsAccountOpen(prev => !prev);
    }
  }, []);



  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        ref={sidebarRef}
        className={`hidden md:flex md:flex-col fixed left-0 top-0 h-screen w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 z-30 transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 flex-1 flex flex-col">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white px-4 py-2">StudyBuddy</h2>
          
          {/* Main Navigation */}
          <nav className="mt-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 mb-2">Navigation</h3>
            <ul className="space-y-1">
              {navLinks.map((link) => (
                <NavItem
                  key={link.to}
                  to={link.to}
                  icon={link.icon}
                  label={link.label}
                  isActive={location.pathname === link.to}
                />
              ))}
            </ul>
          </nav>

          {/* Account Section */}
          <div className="mt-auto">
            <div className="border-t border-gray-200 dark:border-gray-800 my-4"></div>
            
            <div className="relative">
              <button 
                onClick={() => toggleAccountMenu()}
                className="w-full flex items-center justify-between px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <UserAccount user={userData} onLogout={handleLogout} />
                <ChevronDown 
                  className={`h-4 w-4 ml-2 transition-transform duration-200 ${
                    isAccountOpen ? 'rotate-180' : ''
                  }`} 
                />
              </button>
              <motion.div
                className="overflow-hidden"
                initial="closed"
                animate={isAccountOpen ? "open" : "closed"}
                variants={{
                  open: { height: "auto", opacity: 1 },
                  closed: { height: 0, opacity: 0 }
                }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                {accountLinks.map((link) => (
                  <NavItem
                    key={link.to}
                    to={link.to}
                    icon={link.icon}
                    label={link.label}
                    isActive={location.pathname === link.to}
                    className="text-sm py-2"
                  />
                ))}
                  <motion.button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full flex items-center px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isLoggingOut ? (
                      <>
                        <div className="h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin mr-3" />
                        Signing out...
                      </>
                    ) : (
                      <>
                        <LogOut className="h-4 w-4 mr-3" />
                        Sign out
                      </>
                    )}
                  </motion.button>
                </motion.div>
              
            </div>
          </div>

          {/* Auth Buttons - Only shown when not logged in */}
          {!userData && (
            <div className="mt-auto">
              <div className="border-t border-gray-200 dark:border-gray-800 my-4"></div>
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full flex items-center justify-center px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Log in
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="w-full flex items-center justify-center px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Sign up
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            className="md:hidden fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-40" 
            onClick={() => setIsMobileMenuOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div 
              className="mobile-menu-container absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl p-5 overflow-hidden"
              onClick={e => e.stopPropagation()}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ 
                type: 'spring', 
                damping: 30, 
                stiffness: 400, 
                mass: 0.8 
              }}
              style={{
                // Take up to 85% of viewport height, leaving space at the top
                maxHeight: '85vh',
                // Ensure content is not hidden behind browser UI on mobile
                paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)'
              }}
            >
              {/* Scrollable content area with proper spacing */}
              <div className="h-full overflow-y-auto pr-1 -mr-1">
                {/* Add a small drag handle at the top */}
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>
              {/* Menu Header */}
              <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {user ? 'Account' : 'Menu'}
                </h3>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* User Profile Section */}
              {authLoading ? (
                <div className="p-4 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : user ? (
                <div className="mb-6">
                  <div className="flex items-center p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 mb-4">
                    <div className="relative">
                      <Avatar className="h-14 w-14 border-2 border-white dark:border-gray-700">
                        {user.data?.avatar || user.avatar ? (
                          <>
                            <AvatarImage 
                              src={extractUserAvatar(user.data || user)}
                              alt={user.data?.name || user.name || 'User'}
                              className="object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <AvatarFallback className="bg-gradient-to-br from-primary-500 to-indigo-600 text-white text-lg">
                              {getUserInitials(user.data?.name || user.name || 'U')}
                            </AvatarFallback>
                          </>
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-indigo-600">
                            <span className="text-white text-lg font-medium">
                              {getUserInitials(user.data?.name || user.name || 'U')}
                            </span>
                          </div>
                        )}
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900"></div>
                    </div>
                    <div className="ml-4 flex-1 min-w-0">
                      <div className="flex items-center">
                        <p className="font-semibold text-gray-900 dark:text-white text-base truncate">
                          {user.data?.name || user.name || 'User'}
                        </p>
                        {(user.data?.isVerified || user.isVerified) && (
                          <svg className="flex-shrink-0 w-4 h-4 ml-1.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 0 1 2.745 0l5.5 2.75a3.066 3.066 0 0 1 1.71 2.75v5.5a3.066 3.066 0 0 1-1.71 2.75l-5.5 2.75a3.066 3.066 0 0 1-2.745 0l-5.5-2.75a3.066 3.066 0 0 1-1.71-2.75v-5.5a3.066 3.066 0 0 1 1.71-2.75l5.5-2.75zM8 7a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V8a1 1 0 0 0-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                        {user.data?.email || user.email || ''}
                      </p>
                      <div className="flex flex-wrap items-center mt-1 gap-1">
                        {user.data?.university || user.university ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-200 truncate max-w-full">
                            {user.data?.university || user.university}
                          </span>
                        ) : null}
                        {user.data?.major || user.major ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-800/30 dark:text-purple-200 truncate max-w-full">
                            {user.data?.major || user.major}
                          </span>
                        ) : null}
                        {user.data?.year || user.year ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-200">
                            {user.data?.year || user.year}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-6">
                    {accountLinks.map((link) => (
                      <NavItem
                        key={link.to}
                        to={link.to}
                        icon={link.icon}
                        label={link.label}
                        isActive={location.pathname === link.to}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="px-4 py-3 text-base"
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Navigation Links */}
              <div className="mb-6">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 mb-2">
                  Navigation
                </h4>
                <nav className="space-y-1">
                  {navLinks.map((link) => (
                    <NavItem
                      key={link.to}
                      to={link.to}
                      icon={React.cloneElement(link.icon, { 
                        className: 'h-5 w-5 text-gray-500 dark:text-gray-400' 
                      })}
                      label={link.label}
                      isActive={location.pathname === link.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="px-4 py-3 text-base"
                    />
                  ))}
                </nav>
              </div>

              {/* Auth Buttons - Show login/signup if not logged in, logout if logged in */}
              {user ? (
                <div className="border-t border-gray-200 dark:border-gray-800 pt-4 mt-4">
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors text-base font-medium"
                  >
                    <LogOut className="h-5 w-5 mr-2" />
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  <button
                    onClick={() => {
                      navigate('/login');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors text-base font-medium"
                  >
                    <LogIn className="h-5 w-5 mr-2" />
                    Log in
                  </button>
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                    Don't have an account?{' '}
                    <button
                      onClick={() => {
                        navigate('/register');
                        setIsMobileMenuOpen(false);
                      }}
                      className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                    >
                      Sign up
                    </button>
                  </div>
                </div>
              )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation with Sliding Background */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200/80 dark:border-gray-800/80 z-30 shadow-lg">
        <div className="flex justify-around items-center p-1.5 relative">
          {/* Sliding background */}
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to));
            return isActive ? (
              <motion.div
                key="active-bg"
                layoutId="mobile-nav-bg"
                className="absolute inset-0 bg-primary-50 dark:bg-primary-900/20 rounded-xl mx-1.5"
                initial={false}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 30,
                  mass: 0.6
                }}
                style={{
                  height: 'calc(100% - 12px)',
                  top: '6px',
                  zIndex: 0,
                  width: `calc(${100 / navLinks.length}% - 12px)`,
                  left: `calc(${(100 / navLinks.length) * navLinks.findIndex(l => l.to === link.to)}% + 6px)`,
                }}
              />
            ) : null;
          })}
          
          {/* Navigation items */}
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to));
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className="relative flex-1 flex flex-col items-center p-2.5 rounded-xl text-xs font-medium z-10"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <motion.span
                  className="flex flex-col items-center"
                  initial={false}
                  animate={{
                    y: isActive ? -2 : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25
                  }}
                >
                  {React.cloneElement(link.icon, { 
                    className: `h-5 w-5 mb-1.5 transition-colors ${
                      isActive 
                        ? 'text-primary-600 dark:text-primary-400' 
                        : 'text-gray-600 dark:text-gray-400'
                    }` 
                  })}
                  <span className={`text-[11px] font-medium transition-colors ${
                    isActive 
                      ? 'text-primary-600 dark:text-primary-400' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {link.label.split(' ')[0]}
                  </span>
                </motion.span>
              </NavLink>
            );
          })}
          
          {/* Menu button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsMobileMenuOpen(prev => !prev);
            }}
            className={`relative flex-1 flex flex-col items-center p-2.5 rounded-xl text-xs z-10 ${
              isMobileMenuOpen 
                ? 'text-primary-600 dark:text-primary-400' 
                : 'text-gray-600 dark:text-gray-400'
            }`}
            aria-label="Menu"
          >
            <motion.span
              className="flex flex-col items-center"
              initial={false}
              animate={{
                y: isMobileMenuOpen ? -2 : 0,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25
              }}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5 mb-1.5 transition-colors" />
              ) : (
                <Menu className="h-5 w-5 mb-1.5 transition-colors" />
              )}
              <span className="text-[11px] font-medium">
                {isMobileMenuOpen ? 'Close' : 'Menu'}
              </span>
            </motion.span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;
