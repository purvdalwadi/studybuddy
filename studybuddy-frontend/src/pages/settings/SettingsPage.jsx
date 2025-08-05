import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile as updateProfileApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Upload, X } from 'lucide-react';
import { Loader2, Save, AlertCircle } from 'lucide-react';

// Form validation schema with enhanced validation
const profileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .trim(),
  email: z.string()
    .email('Please enter a valid email')
    .min(1, 'Email is required'),
  university: z.string()
    .min(2, 'University is required')
    .max(100, 'University name is too long')
    .trim()
    .optional()
    .or(z.literal('')),
  major: z.string()
    .min(2, 'Major is required')
    .max(100, 'Major name is too long')
    .trim()
    .optional()
    .or(z.literal('')),
  year: z.enum(['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', ''], {
    required_error: 'Please select your academic year',
  })
  .optional()
  .nullable(),
  bio: z.string()
    .max(500, 'Bio cannot exceed 500 characters')
    .optional()
    .or(z.literal('')),
});

// Default form values - initialize with empty values
const defaultValues = {
  name: '',
  email: '',
  university: '',
  major: '',
  year: '',
  bio: '',
};

const SettingsPage = () => {
  // State management - get all necessary functions from AuthContext
  const { 
    user, 
    updateSettings, // Previously called updateUserSettings
    updateProfile,  // For profile updates
    logout, 
    refreshUserProfile 
  } = useAuth();
  // Granular loading states
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);
  const [isDarkModeToggling, setIsDarkModeToggling] = useState(false);
  
  const [settings, setSettings] = useState({ darkMode: false });
  const [passwordLastChanged, setPasswordLastChanged] = useState(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  
  // Refs
  const fileInputRef = useRef(null);
  let isMounted = useRef(true);

  // Form initialization with enhanced configuration
  const { 
    register, 
    handleSubmit, 
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting } 
  } = useForm({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues,
    reValidateMode: 'onChange',
    criteriaMode: 'all',
    shouldUnregister: true
  });

  // Reset form when user data changes
  useEffect(() => {
    if (user) {
      // Create userData with all fields, ensuring year is properly handled
      const userData = {
        name: user.name || '',
        email: user.email || '',
        university: user.university || '',
        major: user.major || '',
        year: user.year || '', // Don't set a default here, let the form handle it
        bio: user.bio || ''
      };
      
      console.log('Resetting form with user data:', userData);
      
      // Reset the form with the user's data
      reset(userData, {
        keepErrors: true,
        keepDirty: true,
        keepIsSubmitted: false,
        keepTouched: false,
        keepIsValid: false,
        keepSubmitCount: false
      });
    }
  }, [user, reset]);

  // Handle form validation errors
  const onError = (errors) => {
    console.error('Form validation errors:', errors);
    
    // Show error for the first invalid field
    const firstError = Object.values(errors)[0];
    if (firstError) {
      toast.error(firstError.message || 'Please check the form for errors');
    }
    
    // Focus the first invalid input
    if (firstError?.ref) {
      firstError.ref.focus();
    }
  };
  
  // Main form submission handler with enhanced error handling and data processing
  const onSubmit = async (formData) => {
    if (!user) {
      toast.error('You must be logged in to update your profile');
      return;
    }
    
    try {
      setIsProfileSaving(true);
      const updates = {};

      // 1. Handle avatar upload if there's a new file
      if (avatarFile) {
        try {
          setIsAvatarUploading(true);
          const avatarFormData = new FormData();
          avatarFormData.append('avatar', avatarFile);
          
          const avatarResponse = await updateProfileApi(avatarFormData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          
          if (avatarResponse?.data) {
            updateProfile({
              ...user,
              ...avatarResponse.data
            });
            setAvatarFile(null);
            toast.success('Profile picture updated successfully');
          }
        } catch (avatarError) {
          console.error('Avatar upload failed:', avatarError);
          const errorMsg = avatarError.response?.data?.message || 'Failed to update profile picture';
          toast.error(errorMsg);
          throw avatarError;
        } finally {
          setIsAvatarUploading(false);
        }
      }

      // 2. Prepare clean profile updates
      Object.keys(formData).forEach(key => {
        // Only include fields that have changed and are not empty strings
        if (formData[key] !== user[key] && formData[key] !== '') {
          updates[key] = formData[key];
        }
        // Handle empty strings by setting them to null
        else if (formData[key] === '' && user[key] !== undefined) {
          updates[key] = null;
        }
      });

      // 3. Only send request if there are changes
      if (Object.keys(updates).length > 0) {
        const response = await updateProfileApi(updates);
        
        if (response?.data) {
          // Update user context with new data
          updateSettings(prev => ({
            ...prev,
            ...response.data
          }));
          
          // Reset form with new values, preserving any unsaved changes
          reset({
            ...formData,
            ...response.data
          }, { keepDirty: true });
          
          toast.success('Profile updated successfully');
        }
      } else if (!avatarFile) {
        toast.info('No changes to save');
      }
      
    } catch (error) {
      console.error('Error updating profile:', error);
      
      let errorMessage = 'Failed to update profile';
      if (error.response) {
        // Handle validation errors from backend
        if (error.response.data?.errors) {
          errorMessage = Object.values(error.response.data.errors)
            .map(err => typeof err === 'string' ? err : err.message || 'Invalid field')
            .join('\n');
        } else {
          errorMessage = error.response.data?.message || errorMessage;
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      }
      
      toast.error(errorMessage);
    } finally {
      setIsProfileSaving(false);
    }
  };

  // Function to load fresh data
  const loadFreshData = useCallback(async () => {
    if (!updateSettings) return null;
    
    try {
      setIsLoading(true);
      const userData = await refreshUserProfile();
      
      if (userData) {
        console.log('Fetched fresh user data:', userData);
        return userData;
      }
      return null;
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Failed to load user data');
      return null;
    }
    
    return () => {
      isMounted = false;
    };
  }, [updateSettings]);

  // Refs for component lifecycle
  const initialLoadComplete = useRef(false);
  const isInitialMount = useRef(true);
  
  // Load user data on component mount and user change
  useEffect(() => {
    let isMounted = true;
    
    const loadUserData = async () => {
      if (!user) return;
      
      try {
        // First update the form with current user data
        const userData = {
          name: user.name || '',
          email: user.email || '',
          university: user.university || '',
          major: user.major || '',
          year: user.year || 'Freshman',
          bio: user.bio || '',
        };
        
        reset(userData);
        
        // Set password last changed date if available
        if (user.passwordChangedAt) {
          const changeDate = new Date(user.passwordChangedAt);
          if (!isNaN(changeDate.getTime())) {
            setPasswordLastChanged(changeDate);
          }
        }
        
        // Then try to refresh data in the background if needed
        if (!initialLoadComplete.current) {
          try {
            const freshData = await refreshUserProfile();
            if (isMounted && freshData?.passwordChangedAt) {
              const changeDate = new Date(freshData.passwordChangedAt);
              if (!isNaN(changeDate.getTime())) {
                setPasswordLastChanged(changeDate);
              }
            }
          } catch (error) {
            console.error('Error refreshing user data:', error);
            // Don't show error to user for background refresh
          }
          initialLoadComplete.current = true;
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        toast.error('Failed to load user data');
      }
    };
    
    // Only load data on initial mount or when user changes
    if (isInitialMount.current || user) {
      loadUserData();
      isInitialMount.current = false;
    }
    
    return () => {
      isMounted = false;
    };
  }, [user, reset, refreshUserProfile]);

  // Handle dark mode toggle
  const handleDarkModeToggle = async (checked) => {
    const newSettings = { ...settings, darkMode: checked };
    
    // Update local state
    setSettings(newSettings);
    
    // Toggle dark mode class
    if (checked) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save to local storage for persistence
    localStorage.setItem('userSettings', JSON.stringify(newSettings));
    
    // Update server settings
    try {
      setIsDarkModeToggling(true);
      await updateSettings({ darkMode: checked });
    } catch (error) {
      console.error('Error updating dark mode:', error);
      toast.error('Failed to save dark mode preference');
    } finally {
      setIsDarkModeToggling(false);
    }
  };
  
  // Set initial dark mode from user settings
  React.useEffect(() => {
    if (user?.settings?.darkMode !== undefined) {
      setSettings(prev => ({
        ...prev,
        darkMode: user.settings.darkMode
      }));
      
      // Apply dark mode class if needed
      if (user.settings.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [user?.settings?.darkMode]);
  
  // Handle password change
  const handlePasswordChange = async (currentPassword, newPassword) => {
    if (!user) return false;
    
    try {
      setIsPasswordChanging(true);
      const success = await updateSettings({
        currentPassword,
        password: newPassword
      });
      
      if (success) {
        setPasswordLastChanged(new Date());
        toast.success('Password updated successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error changing password:', error);
      const message = error.response?.data?.message || 'Failed to update password';
      toast.error(message);
      return false;
    } finally {
      setIsPasswordChanging(false);
    }
  };

  // Handle password change success (callback)
  const handlePasswordChangeSuccess = useCallback(() => {
    if (passwordChangeHandled.current) return;

    passwordChangeHandled.current = true;
    toast.success('Password changed successfully');
    setIsChangingPassword(false);

    // Force a refresh of the user data to get the updated passwordChangedAt
    if (updateSettings) {
      refreshUserProfile().finally(() => {
        passwordChangeHandled.current = false;
      });
    }
  }, [updateSettings]);

  // Handle settings change (dark mode, etc.)
  const handleSettingChange = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      await updateSettings(newSettings);

      // Handle dark mode class toggle
      if (key === 'darkMode') {
        if (value) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }

      toast.success('Settings updated');
    } catch (error) {
      console.error('Error updating settings:', error);
      // Revert on error
      setSettings(settings);
      toast.error('Failed to update settings');
    }
  };

  // Handle avatar change
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      
      return;
    }
    
    setAvatarFile(file);
    
    // Auto-upload the avatar when selected
    handleAvatarUpload(file);
  };
  
  // Handle avatar upload
  const handleAvatarUpload = async (file) => {
    if (!file || !user) return;
    
    try {
      setIsAvatarUploading(true);
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await updateProfileApi(formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response?.data) {
        // Update the user data using updateProfile
        await updateProfile(response.data);
        setAvatarFile(file);
        
        // Refresh the user data to ensure everything is in sync
        await refreshUserProfile();
        
        toast.success('Profile picture updated successfully');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile picture');
    } finally {
      setIsAvatarUploading(false);
    }
  };

  // Handle avatar removal
  const handleRemoveAvatar = async () => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) {
      return;
    }

    try {
      setIsAvatarUploading(true);
      
      // Send request to backend to remove the avatar (backend will set default avatar)
      const response = await updateProfileApi(
        { avatar: null }, // This tells the backend to remove the current avatar
        { headers: { 'Content-Type': 'application/json' } }
      );

      // Update local state with the response from the server
      if (response?.data) {
        // Update the user data using updateProfile
        await updateProfile({
          ...user,
          ...response.data,
          settings: {
            ...user?.settings,
            avatar: null
          }
        });
        
        // Refresh the user data to ensure everything is in sync
        await refreshUserProfile();
      } else {
        // Fallback in case response.data is not available
        await updateProfile({
          ...user,
          avatar: {
            url: 'https://res.cloudinary.com/dsp5azdut/image/upload/v1752304495/default-avatar_ucj7rr.webp',
            publicId: null
          }
        });
        
        // Refresh the user data to ensure everything is in sync
        await refreshUserProfile();
      }

      // Clear any pending avatar file
      setAvatarFile(null);
      
      // Clear file input value to allow re-uploading the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      toast.success('Profile picture removed successfully');
    } catch (error) {
      console.error('Error removing avatar:', error);
      const errorMessage = error.response?.data?.message || 'Failed to remove profile picture';
      toast.error(`Error: ${errorMessage}`);
      
      // Revert the UI if the request fails
      if (user) {
        await refreshUserProfile();
      }
    } finally {
      setIsAvatarUploading(false);
    }
  };

  // handleProfileUpdate has been consolidated into the main onSubmit handler

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Show loading state only if user data hasn't loaded yet
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      
      {/* Profile Information Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Profile Information
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Update your personal information and preferences
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Avatar Upload Section */}
          <div className="flex flex-col items-center sm:items-start gap-4 mb-6">
            <div className="relative group">
              <Avatar className="h-24 w-24">
                {user?.avatar?.url || avatarFile ? (
                  <AvatarImage 
                    src={avatarFile ? URL.createObjectURL(avatarFile) : user.avatar.url} 
                    alt="Profile picture"
                    className="object-cover"
                  />
                ) : (
                  <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-2xl">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <Upload className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProfileSaving}
              >
                <Upload className="mr-2 h-4 w-4" />
                Change
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                />
              </Button>
              {(user?.avatar || avatarFile) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={isProfileSaving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              JPG, PNG, GIF or WebP. Max size 5MB
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-6">
            {/* Name Field */}
            <div className="sm:col-span-6">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                className="mt-1"
                {...register('name')}
                disabled={isProfileSaving}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.name.message}
                </p>
              )}
            </div>
            {/* Email Field */}
            <div className="sm:col-span-6">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                className="mt-1"
                disabled
                {...register('email')}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Contact support to change your email address
              </p>
            </div>

            {/* University Field */}
            <div className="sm:col-span-6">
              <Label htmlFor="university">University</Label>
              <Input
                id="university"
                type="text"
                className="mt-1"
                {...register('university')}
                disabled={isProfileSaving}
              />
              {errors.university && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.university.message}
                </p>
              )}
            </div>

            {/* Major Field */}
            <div className="sm:col-span-3">
              <Label htmlFor="major">Major</Label>
              <Input
                id="major"
                type="text"
                className="mt-1"
                {...register('major')}
                disabled={isProfileSaving}
              />
              {errors.major && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.major.message}
                </p>
              )}
            </div>

            {/* Academic Year Field */}
            <div className="sm:col-span-3">
              <Label htmlFor="year">Academic Year</Label>
              <Controller
                name="year"
                control={control}
                render={({ field }) => {
                  // Ensure the value is always a string and not undefined
                  const value = field.value || '';
                  return (
                    <Select
                      onValueChange={field.onChange}
                      value={value}
                      disabled={isProfileSaving}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select academic year" />
                      </SelectTrigger>
                      <SelectContent>
                        {['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'].map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }}
              />
              {errors.year && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.year.message}
                </p>
              )}
            </div>

            {/* Bio Field */}
            <div className="sm:col-span-6">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={3}
                className="mt-1"
                {...register('bio')}
                disabled={isProfileSaving}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Tell us a little about yourself (max 500 characters)
              </p>
              {errors.bio && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.bio.message}
                </p>
              )}
            </div>
          </div>

          {/* Submit Button with Enhanced Feedback */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
            <div className="text-sm text-muted-foreground">
              {isDirty && !isProfileSaving && (
                <div className="flex items-center text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  You have unsaved changes
                </div>
              )}
              {isProfileSaving && (
                <div className="flex items-center text-blue-600 dark:text-blue-400">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving your changes...
                </div>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="min-w-[150px] transition-all duration-200"
              disabled={isProfileSaving || !isDirty}
            >
              {isProfileSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Account Settings Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Account Settings
          </h2>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Change Password
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {passwordLastChanged
                  ? `Last changed ${formatDistanceToNow(new Date(passwordLastChanged), { addSuffix: true })}`
                  : 'You have not changed your password yet'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handlePasswordChange}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Change Password'
              )}
            </Button>
          </div>

          {/* Dark Mode Toggle */}
          <div className="mt-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Dark Mode
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Toggle between light and dark theme
              </p>
            </div>
            <Switch
              checked={settings.darkMode}
              onCheckedChange={(checked) => setSettings({ ...settings, darkMode: checked })}
            />
          </div>

          {/* Logout Button */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="destructive"
              onClick={() => {
                logout();
              }}
              className="w-full sm:w-auto"
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

};

export default SettingsPage;