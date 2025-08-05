import React from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { uploadResource } from "@/services/api";
import ResourceUploadDialog from "@/components/resources/ResourceUploadDialog";
import { toast } from "sonner";

export default function Resources() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: uploadResource,
    onSuccess: () => {
      toast.success("Resource uploaded!");
      queryClient.invalidateQueries(["resources"]);
    },
    onError: () => {
      toast.error("Failed to upload resource.");
    }
  });
  // Extract resources array from backend response
  // TODO: Replace with actual fetch logic
  const resources = [];
  // Example: const resources = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Resources</h1>
        <ResourceUploadDialog onUpload={mutation.mutate} />
      </div>
      {/* TODO: Resource list table/grid goes here */}
      <div className="text-gray-500 mt-8">Resource list coming soon...</div>
    </div>
  );
}
