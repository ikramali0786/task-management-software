import { useForm } from 'react-hook-form';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { teamService } from '@/services/teamService';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import { joinTeamRooms } from '@/lib/socket';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  name: string;
  description: string;
}

export const CreateTeamModal = ({ isOpen, onClose }: Props) => {
  const { addTeam, setActiveTeam } = useTeamStore();
  const { addToast } = useUIStore();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      const team = await teamService.createTeam(data);
      addTeam(team);
      setActiveTeam(team);
      joinTeamRooms([team._id]);
      addToast({ type: 'success', title: `Team "${team.name}" created!` });
      reset();
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', title: err.response?.data?.message || 'Failed to create team' });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Team">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Team Name"
          placeholder="e.g. Design Team"
          error={errors.name?.message}
          {...register('name', { required: 'Team name is required', minLength: { value: 2, message: 'Min 2 characters' } })}
        />
        <Input
          label="Description (optional)"
          placeholder="What does this team work on?"
          {...register('description')}
        />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="flex-1">
            Create Team
          </Button>
        </div>
      </form>
    </Modal>
  );
};
