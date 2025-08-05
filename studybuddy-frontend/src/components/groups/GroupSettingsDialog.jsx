import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GroupSettingsForm from './GroupSettingsForm';
import MemberManagement from './MemberManagement';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function GroupSettingsDialog({ 
  open, 
  onOpenChange, 
  onClose, 
  group = {}, 
  onSave 
}) {
  const [activeTab, setActiveTab] = useState('settings');
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  
  const handleCancel = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);
  
  const handleMemberRemoved = useCallback((updatedGroup) => {
    // Notify parent component about the update
    if (onSave) {
      onSave(updatedGroup, false, { isMemberUpdate: true });
    }
    
    // Optimistically update the groups query data
    queryClient.setQueryData(['groups'], (oldData) => {
      if (!oldData) return oldData;
      
      return oldData.map(group => {
        if (group._id === updatedGroup._id) {
          return {
            ...group,
            members: updatedGroup.members,
            memberCount: updatedGroup.members?.length || 0
          };
        }
        return group;
      });
    });
    
    // Invalidate groups query to refresh the data in the background
    queryClient.invalidateQueries(['groups']);
    toast.success('Member removed successfully');
  }, [queryClient, onSave]);
  
  const handleSave = useCallback(async (updatedGroup) => {
    if (!onSave) return;
    
    setIsSaving(true);
    try {
      await onSave(updatedGroup);
      queryClient.invalidateQueries(['groups']);
      if (onClose) onClose();
      toast.success('Group updated successfully');
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error(error?.response?.data?.message || 'Failed to update group');
    } finally {
      setIsSaving(false);
    }
  }, [onSave, onClose, queryClient]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <h2 className="text-xl font-semibold">
            {group?.title ? `Settings: ${group.title}` : 'Group Settings'}
          </h2>
          <p className="text-sm text-gray-500">
            {group?.description || 'Manage your group details and members'}
          </p>
        </DialogHeader>

        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
          defaultValue="settings"
        >
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="settings">Group Settings</TabsTrigger>
            <TabsTrigger value="members">
              Members {group?.members?.length > 0 ? `(${group.members.length})` : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <GroupSettingsForm 
              group={group} 
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </TabsContent>

          <TabsContent value="members">
            <MemberManagement 
              group={group} 
              onMemberRemoved={handleMemberRemoved}
              currentUserId={group?.currentUserId}
              currentUserRole={group?.currentUserRole}
              isAdmin={group?.isCurrentUserAdmin}
              isCreator={group?.isCurrentUserCreator}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
