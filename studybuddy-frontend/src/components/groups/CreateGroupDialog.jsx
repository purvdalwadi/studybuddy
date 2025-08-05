

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { X, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const groupSchema = z.object({
  // Required fields matching backend model
  title: z.string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title cannot exceed 100 characters")
    .trim(),
  subject: z.string()
    .min(2, "Subject is required")
    .max(100, "Subject name too long")
    .trim(),
  university: z.string()
    .min(2, "University is required")
    .max(100, "University name too long")
    .trim(),
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description cannot exceed 1000 characters")
    .trim(),
  
  // Enums and numbers with proper validation
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"], {
    required_error: "Please select a difficulty level",
  }),
  maxMembers: z.number()
    .int()
    .min(2, "Minimum group size is 2")
    .max(50, "Maximum group size is 50"),
    
  // Optional fields
  tags: z.array(
    z.string()
      .min(1, "Tag cannot be empty")
      .max(30, "Tag too long")
      .trim()
  ).max(8, "Maximum 8 tags allowed"),
  
  // File handling
  avatar: z
    .instanceof(File)
    .refine(file => file.size <= MAX_FILE_SIZE, "Max file size is 5MB")
    .refine(
      file => ALLOWED_FILE_TYPES.includes(file.type),
      "Only .jpg, .png, and .webp files are allowed"
    )
    .optional()
    .or(z.literal('')),
    
  // Additional optional fields
  meetingSchedule: z.string()
    .max(200, "Schedule too long")
    .optional()
    .or(z.literal('')),
});



export default function CreateGroupDialog({ onCreate, open, onOpenChange }) {
  const defaultValues = {
    title: "",
    subject: "",
    university: "",
    description: "",
    difficulty: "Beginner", // Default to capitalized value
    tags: [],
    maxMembers: 10, // Default from backend model
    isActive: true, // Default from backend model
    avatar: undefined,
    meetingSchedule: ""
  };
  
  // Initialize form with proper configuration
  const { 
    register, 
    handleSubmit, 
    control, 
    setValue, 
    watch, 
    reset,
    trigger,
    getValues,
    formState: { errors, isSubmitting } 
  } = useForm({
    resolver: zodResolver(groupSchema),
    mode: 'onChange',
    defaultValues,
    reValidateMode: 'onChange'
  });

  // Watch the difficulty value from form
  const selectedLevel = watch('difficulty', 'Beginner');

  const tags = watch('tags') || [];
  const avatar = watch('avatar');
  const fileInputRef = useRef(null);
  const [tagInput, setTagInput] = useState('');
  
  // Handle dialog open/close
  // Reset form only when dialog is first opened
  const isInitialMount = useRef(true);
  
  useEffect(() => {
    if (open && isInitialMount.current) {
      // Reset form to default values only on first open
      reset(defaultValues);
      isInitialMount.current = false;
    }
    
    return () => {
      if (!open) {
        isInitialMount.current = true;
      }
    };
  }, [open, reset, defaultValues]);

  const onSubmit = async (formData) => {
    try {
      console.log('[CreateGroupDialog] Raw form data:', formData);
      
      // Create FormData object
      const formDataObj = new FormData();
      
      // Add all form fields to FormData
      formDataObj.append('title', formData.title?.trim() || '');
      formDataObj.append('subject', formData.subject?.trim() || '');
      formDataObj.append('university', formData.university?.trim() || '');
      formDataObj.append('description', formData.description?.trim() || '');
      formDataObj.append('difficulty', formData.difficulty || 'Beginner');
      formDataObj.append('maxMembers', formData.maxMembers ? parseInt(formData.maxMembers, 10) : 10);
      
      // Add tags as JSON string
      const tags = Array.isArray(formData.tags) 
        ? formData.tags.map(tag => typeof tag === 'string' ? tag.trim() : '').filter(Boolean)
        : [];
      formDataObj.append('tags', JSON.stringify(tags));
      
      // Add meeting schedule if present
      if (formData.meetingSchedule?.trim()) {
        formDataObj.append('meetingSchedule', formData.meetingSchedule.trim());
      }
      
      // Add avatar file if present
      if (formData.avatar instanceof File) {
        formDataObj.append('avatar', formData.avatar);
      }
      
      console.log('[CreateGroupDialog] FormData prepared for submission');
      
      // Pass FormData to parent component
      await onCreate(formDataObj);
      
      // Only reset after successful submission
      reset(defaultValues);
      
      // Close the dialog
      onOpenChange?.(false);
      
    } catch (error) {
      console.error('Error creating group:', {
        error,
        message: error.message,
        response: error.response?.data
      });
      toast.error(error.response?.data?.message || 'Failed to create group');
      // Don't rethrow the error - let the form stay open for correction
    }
  };
  
  // Handle dialog close
  const handleClose = () => {
    onOpenChange?.(false);
  };

  // Handle tag management
  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag) && tags.length < 8) {
      const newTags = [...tags, tag];
      setValue('tags', newTags);
      setTagInput('');
      trigger('tags');
    }
  }, [tags, tagInput, setValue, trigger]);

  const handleRemoveTag = useCallback((tagToRemove) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    setValue('tags', newTags);
    trigger('tags');
  }, [tags, setValue, trigger]);

  // Handle file upload
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue('avatar', file);
      trigger('avatar');
    }
  }, [setValue, trigger]);

  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleKeyDown = useCallback((e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      handleAddTag();
    }
  }, [tagInput, handleAddTag]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      } else {
        onOpenChange?.(true);
      }
    }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="primary" onClick={() => onOpenChange?.(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Group
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Study Group</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Fill in the details below to create your study group</p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <Input 
                  label="Group Title" 
                  placeholder="e.g., CS101 Study Group"
                  {...register("title")} 
                  error={errors.title?.message} 
                  required 
                />
              </div>
              
              <div>
                <Input 
                  label="Subject" 
                  placeholder="e.g., Computer Science"
                  {...register("subject")} 
                  error={errors.subject?.message} 
                  required 
                />
              </div>
              
              <div>
                <Input 
                  label="University" 
                  placeholder="e.g., Stanford University"
                  {...register("university")} 
                  error={errors.university?.message} 
                  required 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Difficulty Level <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="difficulty"
                  control={control}
                  defaultValue="Beginner"
                  render={({ field: { onChange, value } }) => (
                    <Select 
                      value={value}
                      onValueChange={(selectedValue) => {
                        console.log('Selected value:', selectedValue);
                        onChange(selectedValue);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select difficulty level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Beginner">Beginner</SelectItem>
                        <SelectItem value="Intermediate">Intermediate</SelectItem>
                        <SelectItem value="Advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.difficulty?.message && (
                  <p className="mt-1 text-sm text-red-600">{errors.difficulty.message}</p>
                )}
              </div>
            </div>
            
            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Group Avatar (optional)
                </label>
                <div className="flex items-center gap-4">
                  <div 
                    onClick={handleAvatarClick}
                    className="cursor-pointer group relative"
                  >
                    <Avatar 
                      size="lg" 
                      src={avatar ? URL.createObjectURL(avatar) : undefined} 
                      fallback={
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                          <span className="text-2xl font-bold text-blue-600">
                            {watch('title')?.[0]?.toUpperCase() || 'G'}
                          </span>
                        </div>
                      } 
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      className="hidden" 
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={handleAvatarClick}
                    >
                      {avatar ? 'Change' : 'Upload'} Photo
                    </Button>
                    <p className="mt-1 text-xs text-gray-500">JPG, PNG or WebP. Max 5MB.</p>
                    {errors.avatar?.message && (
                      <p className="mt-1 text-sm text-red-600">{errors.avatar.message}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <Input
                  label="Max Members"
                  type="number"
                  min={2}
                  max={50}
                  {...register("maxMembers", { valueAsNumber: true })}
                  error={errors.maxMembers?.message}
                  required
                />
              </div>
              
              <div>
                <Input 
                  label="Meeting Schedule (optional)" 
                  placeholder="e.g., Every Monday 6-8 PM"
                  {...register("meetingSchedule")} 
                  error={errors.meetingSchedule?.message} 
                />
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
              rows={4}
              placeholder="Tell us about your study group..."
              {...register('description')}
            />
            {errors.description?.message && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tags
                <span className="ml-1 text-xs text-gray-500">(Max 8)</span>
              </label>
              <span className="text-xs text-gray-500">
                {tags.length}/8 tags
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2 p-2 border border-gray-300 dark:border-gray-700 rounded-md min-h-[42px]">
              {tags.map((tag) => (
                <span 
                  key={tag} 
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 focus:outline-none"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {tags.length < 8 && (
                <div className="flex items-center">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleAddTag}
                    placeholder="Add a tag..."
                    className="border-0 p-0 text-sm focus:ring-0 bg-transparent focus:outline-none flex-1 min-w-[100px]"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    disabled={!tagInput.trim()}
                    className="ml-2 p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            {errors.tags?.message && (
              <p className="mt-1 text-sm text-red-600">{errors.tags.message}</p>
            )}
            
            <p className="mt-1 text-xs text-gray-500">
              Press Enter or comma to add a tag
            </p>
          </div>
          
          <DialogFooter className="border-t border-gray-200 dark:border-gray-800 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

