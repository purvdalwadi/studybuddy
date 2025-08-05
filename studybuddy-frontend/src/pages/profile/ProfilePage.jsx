import { useRef, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui';
import { Progress } from '@/components/ui/progress';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);
  
  const { 
    register, 
    handleSubmit, 
    reset, 
    setValue,
    watch,
    formState: { isSubmitting, errors } 
  } = useForm({
    defaultValues: {
      displayName: '',
      email: '',
      phoneNumber: '',
      bio: '',
    }
  });

  // Set form values when user data is available
  useEffect(() => {
    if (user) {
      setValue('displayName', user.displayName || '');
      setValue('email', user.email || '');
      setValue('phoneNumber', user.phoneNumber || '');
      setValue('bio', user.bio || '');
      setIsLoading(false);
    }
  }, [user, setValue]);

  const handleAvatarClick = () => {
    if (isEditing) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, or GIF)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB');
      return;
    }

    // Show upload progress
    setAvatarFile(file);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => setUploadProgress(0), 500);
      }
    }, 50);

    // Reset file input to allow selecting the same file again
    e.target.value = '';
  };

  const removeAvatar = async () => {
    try {
      // If there's an existing avatar URL, we'll set it to null to remove it
      if (user?.avatar?.url) {
        await updateProfile({ avatar: null });
        toast.success('Avatar removed successfully');
      }
      setAvatarFile(null);
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast.error('Failed to remove avatar. Please try again.');
    }
  };

  const onSubmit = async (data) => {
    try {
      const formData = { ...data };
      
      // If there's a new avatar file, add it to the form data
      if (avatarFile) {
        formData.avatar = avatarFile;
      } else if (avatarFile === null) {
        // If avatar was removed
        formData.avatar = null;
      }
      
      await updateProfile(formData);
      
      toast.success('Profile updated successfully');
      setIsEditing(false);
      setAvatarFile(null);
    } catch (error) {
      console.error('Error updating profile:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update profile';
      toast.error(errorMessage);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        {/* Profile Header */}
        <div className="px-6 py-8 sm:px-10 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-gray-800 dark:to-gray-800">
          <div className="flex flex-col sm:flex-row items-center">
            <div className="relative">
              {/* Avatar Display */}
              <div className="relative group">
                <div 
                  className={`relative rounded-full overflow-hidden ${isEditing ? 'ring-2 ring-offset-2 ring-primary-500' : ''}`}
                  onClick={handleAvatarClick}
                >
                  <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-white dark:border-gray-800">
                    {avatarFile ? (
                      <AvatarImage 
                        src={URL.createObjectURL(avatarFile)} 
                        alt={user.displayName || 'User'} 
                        className="object-cover"
                      />
                    ) : user?.avatar?.url ? (
                      <AvatarImage 
                        src={user.avatar.url} 
                        alt={user.displayName || 'User'}
                        className="object-cover"
                      />
                    ) : (
                      <AvatarFallback className="bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 text-3xl">
                        {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  
                  {isEditing && (
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Upload className="h-6 w-6 text-white mb-1" />
                      <span className="text-xs text-white font-medium">
                        {user?.avatar?.url ? 'Change' : 'Upload'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Remove Avatar Button */}
                {isEditing && (avatarFile || user?.avatar?.url) && (
                  <Button 
                    type="button"
                    variant="destructive" 
                    size="icon"
                    className="absolute -top-2 -right-2 rounded-full h-8 w-8 p-0 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAvatar();
                    }}
                    title="Remove avatar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Upload Button */}
              {isEditing && (
                <div className="mt-4 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={handleAvatarClick}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {user?.avatar?.url ? 'Change Avatar' : 'Upload Avatar'}
                  </Button>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    JPG, GIF or PNG. Max size 5MB
                  </p>
                </div>
              )}
              
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg, image/png, image/gif"
                className="hidden"
              />
              
              {/* Upload Progress */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="absolute -bottom-1 left-0 right-0">
                  <Progress 
                    value={uploadProgress} 
                    className="h-1 bg-gray-200 dark:bg-gray-700"
                    indicatorClassName="bg-primary-500"
                  />
                </div>
              )}
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-8 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {user.displayName || 'User'}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">{user.email}</p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Member since {new Date(user.metadata?.creationTime).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="px-6 py-8 sm:px-10">
          {!isEditing ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</Label>
                  <p className="mt-1 text-gray-900 dark:text-white">{user.displayName || 'Not set'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</Label>
                  <p className="mt-1 text-gray-900 dark:text-white">{user.email || 'Not set'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone</Label>
                  <p className="mt-1 text-gray-900 dark:text-white">{user.phoneNumber || 'Not set'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Account Status</Label>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {user.emailVerified ? 'Verified' : 'Not Verified'}
                  </p>
                </div>
              </div>
              {user.bio && (
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bio</Label>
                  <p className="mt-1 text-gray-900 dark:text-white">{user.bio}</p>
                </div>
              )}
              <div className="pt-4">
                <Button onClick={() => setIsEditing(true)}>
                  Edit Profile
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="displayName">Name *</Label>
                  <Input
                    id="displayName"
                    type="text"
                    {...register('displayName', { 
                      required: 'Name is required',
                      minLength: {
                        value: 2,
                        message: 'Name must be at least 2 characters long'
                      },
                      maxLength: {
                        value: 50,
                        message: 'Name must be less than 50 characters'
                      }
                    })}
                    className={`mt-1 ${errors.displayName ? 'border-red-500' : ''}`}
                  />
                  {errors.displayName && (
                    <p className="mt-1 text-sm text-red-600">{errors.displayName.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    disabled
                    value={user.email}
                    className="mt-1 bg-gray-100 dark:bg-gray-800"
                  />
                  {!user.emailVerified && (
                    <div className="mt-2 flex items-center">
                      <span className="text-sm text-yellow-600 dark:text-yellow-400 mr-2">
                        Email not verified
                      </span>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          // In a real app, this would send a verification email
                          toast.info('Verification email sent. Please check your inbox.');
                        }}
                      >
                        Verify Email
                      </Button>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    {...register('phoneNumber', {
                      pattern: {
                        value: /^[\+\s\d\-()]*$/,
                        message: 'Please enter a valid phone number'
                      }
                    })}
                    className={`mt-1 ${errors.phoneNumber ? 'border-red-500' : ''}`}
                    placeholder="+1 (555) 123-4567"
                  />
                  {errors.phoneNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.phoneNumber.message}</p>
                  )}
                </div>
                
                <div className="flex items-end">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/settings/security')}
                  >
                    Change Password
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <textarea
                  id="bio"
                  rows={3}
                  {...register('bio', {
                    maxLength: {
                      value: 500,
                      message: 'Bio must be less than 500 characters'
                    }
                  })}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-800 dark:border-gray-700 ${
                    errors.bio ? 'border-red-500' : ''
                  }`}
                  placeholder="Tell us about yourself..."
                />
                <div className="mt-1 flex justify-between text-sm text-gray-500 dark:text-gray-400">
                  {errors.bio ? (
                    <span className="text-red-600">{errors.bio.message}</span>
                  ) : (
                    <span>Max 500 characters</span>
                  )}
                  <span>{watch('bio')?.length || 0}/500</span>
                </div>
              </div>
              <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    reset();
                    setIsEditing(false);
                    setAvatarFile(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <div className="space-x-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate('/settings')}
                  >
                    Account Settings
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="min-w-[120px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
