import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { login, register, getMe, updateProfile as updateProfileApi, forgotPassword as forgotPasswordApi, resetPassword as resetPasswordApi } from "@/services/api";
import { toast } from "sonner";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState(null);
  const errorTimerRef = useRef(null);
  const hasFetchedUser = useRef(false);
  
  // Debounced setError to prevent rapid error state updates
  const setError = useCallback((message) => {
    // Clear any pending error updates
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    
    // Only update if the message is different from current error
    if (message !== error) {
      _setError(message);
    }
    
    // Clear the error after 5 seconds
    errorTimerRef.current = setTimeout(() => {
      _setError(null);
    }, 5000);
  }, [error]);
  const navigate = useNavigate();

  // Fetch and update user profile data
  const refreshUserProfile = useCallback(async () => {
    try {
      const { data } = await getMe();
      setUser(prev => ({
        ...prev,
        ...data.data,
        settings: {
          ...prev?.settings,
          ...data.data?.settings
        }
      }));
      return data.data;
    } catch (error) {
      console.error('Error refreshing user profile:', error);
      return null;
    }
  }, []);

  // Check session on mount
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    console.log('[AuthContext] checkAuth - Token from localStorage:', token ? 'Exists' : 'Not found');
    
    if (!token) {
      console.log('[AuthContext] No token found, setting user to null');
      setUser(null);
      setLoading(false);
      hasFetchedUser.current = false;
      return false;
    }

    console.log('[AuthContext] Token found, verifying with server...');
    setLoading(true);
    try {
      // Skip if we've already fetched the user
      if (hasFetchedUser.current) {
        console.log('[AuthContext] User already fetched, skipping API call');
        setLoading(false);
        return true;
      }
      console.log('[AuthContext] Calling getMe() to verify token');
      const { data } = await getMe();
      console.log('[AuthContext] getMe response:', data);
      setUser(data || null);
      hasFetchedUser.current = true;
      console.log('[AuthContext] User set successfully');
      return true;
    } catch (error) {
      console.error('[AuthContext] Error in checkAuth:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      console.log('[AuthContext] Removing invalid token and setting user to null');
      setUser(null);
      localStorage.removeItem('accessToken');
      
      // Only set error if there isn't already an error and we're not in the middle of a login attempt
      if (!error && !window.location.pathname.includes('login')) {
        setError('Your session has expired. Please log in again.');
      }
      
      // Set a flag in session storage to show a toast on the next render
      sessionStorage.setItem('showSessionExpiredToast', 'true');
      
      return false;
    } finally {
      console.log('[AuthContext] Auth check complete');
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login
  const handleLogin = async (creds) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await login(creds);
      const token = result?.data?.token;
      
      if (!token) {
        throw new Error('No authentication token received');
      }
      
      localStorage.setItem('accessToken', token);
      
      // Reset the fetch flag to force a new user data fetch
      hasFetchedUser.current = false;
      
      // Verify the token and get user data
      const authSuccess = await checkAuth();
      if (authSuccess) {
        navigate('/groups', { replace: true });
        return true;
      }
      return false;
      
    } catch (err) {
      console.error('Login error:', err);
      
      // Skip setting error if it's already set by checkAuth
      if (error) return false;
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (err.response) {
        const { status, data } = err.response;
        
        switch (status) {
          case 400:
            errorMessage = data.message || 'Invalid request. Please check your input.';
            break;
          case 401:
            errorMessage = 'Invalid email or password. Please try again.';
            break;
          case 403:
            errorMessage = 'Your account is not verified. Please check your email.';
            break;
          case 404:
            errorMessage = 'No account found with this email. Please sign up.';
            break;
          case 429:
            errorMessage = 'Too many login attempts. Please try again later.';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later.';
            break;
          default:
            errorMessage = data?.message || `Error: ${status}. Please try again.`;
        }
      } else if (err.message === 'Network Error') {
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      return false;
      
    } finally {
      setLoading(false);
    }
  };


  // Register
  const handleRegister = async (info) => {
    setLoading(true);
    setError(null);
    try {
      const result = await register(info);
      const token = result?.data?.token;
      if (token) {
        localStorage.setItem('accessToken', token);
      }
      console.log('[Auth] Before checkAuth in handleRegister');
      try {
        await checkAuth();
        console.log('[Auth] After checkAuth, navigating to /groups');
        navigate('/groups', { replace: true });
      } catch (e) {
        console.error('[Auth] checkAuth failed after register', e);
        if (token) navigate('/groups', { replace: true }); // fallback if token present
      }
      return true;
    } catch (err) {
      // Debug log
      console.error("Register error:", err, err?.response);
      let message = err.response?.data?.message || err.message || "Registration failed";
      if (err.response && typeof err.response.data === 'object') {
        message += ` (status: ${err.response.status})`;
        message += ` | details: ${JSON.stringify(err.response.data)}`;
      }
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  };


  // Logout
  const handleLogout = async () => {
    localStorage.removeItem('accessToken');
    setUser(null);
    // Optionally: await api.post('/auth/logout');
    navigate("/signin");
  };

  // Update user profile
  const updateUserProfile = async (profileData) => {
    try {
      setLoading(true);
      // Filter out any undefined or null values
      const dataToSend = Object.fromEntries(
        Object.entries(profileData).filter(([_, v]) => v != null)
      );
      
      // Make API call to update user details
      const { data } = await updateProfileApi(dataToSend);
      
      // Update the user state with the new data
      setUser(prevUser => ({
        ...prevUser,
        ...data.data,
        data: {
          ...prevUser?.data,
          ...data.data
        },
        settings: {
          ...prevUser?.settings,
          ...(dataToSend.darkMode !== undefined ? { darkMode: dataToSend.darkMode } : {})
        }
      }));
      
      // If dark mode was updated, update the HTML class
      if (dataToSend.darkMode !== undefined) {
        if (dataToSend.darkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error updating profile:', error);
      const message = error.response?.data?.message || 'Failed to update profile';
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  // Update user settings
  const updateUserSettings = async (settings) => {
    try {
      setLoading(true);
      
      // If we're just refreshing user data
      if (settings.refresh) {
        const { data } = await getMe();
        setUser(prev => ({
          ...prev,
          ...data.data,
          settings: {
            ...prev?.settings,
            darkMode: prev?.settings?.darkMode ?? false
          }
        }));
        return data.data;
      }
      
      // If we're requesting a password change
      if (settings.requestPasswordChange) {
        // This would trigger the password reset flow
        await forgotPassword(user.email);
        return { success: true };
      }
      
      // For avatar removal, we need to ensure null is explicitly sent
      let dataToSend;
      if ('avatar' in settings && settings.avatar === null) {
        // Create a new object with only the avatar field set to null
        dataToSend = { avatar: null };
        console.log('[Auth] Sending avatar removal request with:', dataToSend);
      } else {
        // For other updates, use the provided settings
        dataToSend = { ...settings };
      }
      
      // Update the user profile with the prepared data
      const { data } = await updateProfileApi(dataToSend);
      
      // Update the user state with the new data
      setUser(prevUser => ({
        ...prevUser,
        ...data.data,
        data: {
          ...prevUser?.data,
          ...data.data
        },
        settings: {
          ...prevUser?.settings,
          ...(settings.darkMode !== undefined ? { darkMode: settings.darkMode } : {})
        }
      }));
      
      // If dark mode was updated, update the HTML class
      if (settings.darkMode !== undefined) {
        if (settings.darkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      
      toast.success('Settings updated');
      return data.data?.settings || {};
    } catch (error) {
      console.error('Error updating settings:', error);
      const message = error.response?.data?.message || 'Failed to update settings';
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Send password reset email
  const sendPasswordResetEmail = async (email) => {
    try {
      setLoading(true);
      // This would be an API call in a real app
      toast.success('Password reset email sent');
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      toast.error('Failed to send password reset email');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Forgot password
  const forgotPassword = async (email) => {
    try {
      setLoading(true);
      await forgotPasswordApi(email);
      return true;
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (token, newPassword) => {
    try {
      setLoading(true);
      await resetPasswordApi(token, newPassword);
      return true;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Delete account
  const deleteAccount = async () => {
    try {
      setLoading(true);
      // This would be an API call in a real app
      await handleLogout();
      toast.success('Your account has been deleted');
      return true;
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Initialize user settings from localStorage
  useEffect(() => {
    if (user && !user.settings) {
      const savedSettings = localStorage.getItem('userSettings');
      if (savedSettings) {
        setUser(prev => ({
          ...prev,
          settings: JSON.parse(savedSettings)
        }));
      } else {
        // Default settings
        setUser(prev => ({
          ...prev,
          settings: {
            darkMode: false,
            notifications: true,
            emailUpdates: true
          }
        }));
      }
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        updateProfile: updateUserProfile,
        updateSettings: updateUserSettings,
        forgotPassword,
        resetPassword,
        checkAuth,
        refreshUserProfile,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
