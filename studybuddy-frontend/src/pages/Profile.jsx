import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMe, updateProfile } from "@/services/api";
import UserProfileForm from "@/components/user/UserProfileForm";
import { toast } from "sonner";

export default function Profile() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: getMe
  });
  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      toast.success("Profile updated!");
      queryClient.invalidateQueries(["me"]);
    },
    onError: () => {
      toast.error("Failed to update profile.");
    }
  });
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleProfileUpdate = (data) => {
    mutation.mutate(data);
    setDialogOpen(false);
  };

  if (isLoading) return (
    <div className="p-8 max-w-xl mx-auto" aria-label="Profile Page">
      <div role="status" className="mt-4 text-gray-500">Loading profile...</div>
    </div>
  );
  if (error) return (
    <div className="p-8 max-w-xl mx-auto" aria-label="Profile Page">
      <div role="alert" className="mt-4 text-red-600">Failed to load profile.</div>
    </div>
  );

  return (
    <div className="p-8 max-w-xl mx-auto" aria-label="Profile Page">
      <div className="flex items-center gap-6 mb-8">
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary-300 to-blue-200 flex items-center justify-center text-3xl font-bold text-primary-800">
          {(user?.data?.name || user?.name || "?")[0]}
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-primary-700 dark:text-primary-100 mb-1" id="profile-heading">My Profile</h1>
          <div className="text-gray-500">View and edit your account details</div>
        </div>
        <Button className="ml-auto" onClick={() => setDialogOpen(true)} aria-label="Edit profile">Edit</Button>
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700 dark:text-gray-200">Name:</span>
            <span>{user?.data?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700 dark:text-gray-200">Email:</span>
            <span>{user?.data?.email}</span>
          </div>
        </div>
      </div>
      <ProfileDialog open={dialogOpen} onOpenChange={setDialogOpen} user={user?.data} onSuccess={handleProfileUpdate} aria-label="Edit Profile Dialog" />
      {isLoading && <div role="status" className="mt-4 text-gray-500">Loading profile...</div>}
      {error && <div role="alert" className="mt-4 text-red-600">Failed to load profile.</div>}
    </div>
  );
}
