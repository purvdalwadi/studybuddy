import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  university: z.string().min(2).max(100),
  major: z.string().min(2).max(100),
  year: z.enum(["Freshman","Sophomore","Junior","Senior","Graduate","Other"]),
  avatar: z.any().optional(),
  bio: z.string().max(500).optional(),
});

export default function UserProfileForm({ user = {}, onSave, onCancel }) {
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: user.name || "",
      email: user.email || "",
      university: user.university || "",
      major: user.major || "",
      year: user.year || "Freshman",
      avatar: undefined,
      bio: user.bio || "",
    }
  });

  const avatarFile = watch('avatar');
  const previewAvatar = React.useMemo(() => {
    if (avatarFile?.[0]) {
      return URL.createObjectURL(avatarFile[0]);
    }
    return defaultValues?.photoURL || '';
  }, [avatarFile, defaultValues?.photoURL]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: 'File too large',
          description: 'Please select an image smaller than 5MB',
          variant: 'destructive',
        });
        return;
      }
      setValue('avatar', [file], { shouldDirty: true });
    }
  };

  const handleRemoveAvatar = (e) => {
    e.stopPropagation();
    setValue('avatar', null, { shouldDirty: true });
    // Clear file input
    const fileInput = document.getElementById('avatar-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleFormSubmit = async (data) => {
    try {
      const formData = new FormData();
      
      // Append all form data
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'avatar' && value?.[0]) {
          formData.append('avatar', value[0]);
        } else if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });
      
      await onSubmit(formData);
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    }
  };

  const getInitials = (firstName = '', lastName = '') => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'U';
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="avatar-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Profile Picture
        </Label>
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-2 border-gray-200 dark:border-gray-700">
              {previewAvatar ? (
                <>
                  <AvatarImage src={previewAvatar} alt="Profile" />
                  <AvatarFallback>
                    {getInitials(watch('firstName'), watch('lastName'))}
                  </AvatarFallback>
                </>
              ) : (
                <div className="h-full w-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-gray-400" />
                </div>
              )}
            </Avatar>
            {previewAvatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                aria-label="Remove avatar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Label 
              htmlFor="avatar-upload"
              className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Upload className="h-4 w-4 mr-2" />
              {previewAvatar ? 'Change photo' : 'Upload photo'}
            </Label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              JPG, GIF or PNG. Max size 5MB
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            placeholder="John"
            {...register('firstName', { required: 'First name is required' })}
            error={errors.firstName?.message}
          />
          {errors.firstName && (
            <p className="text-sm text-red-500">{errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            placeholder="Doe"
            {...register('lastName', { required: 'Last name is required' })}
            error={errors.lastName?.message}
          />
          {errors.lastName && (
            <p className="text-sm text-red-500">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="john@example.com"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          })}
          error={errors.email?.message}
          disabled
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          placeholder="Tell us a bit about yourself..."
          className="min-h-[100px]"
          {...register('bio')}
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onCancel();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
}
