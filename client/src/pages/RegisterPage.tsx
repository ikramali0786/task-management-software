import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Zap, Hash, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { teamService } from '@/services/teamService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface FormData {
  name: string;
  email: string;
  password: string;
  teamCode?: string;
}

export const RegisterPage = () => {
  const { register: registerUser, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    try {
      await registerUser(data.name, data.email, data.password);
      // Optionally join a team immediately after registration
      if (data.teamCode?.trim()) {
        try {
          await teamService.joinByCode(data.teamCode.trim());
        } catch {
          // Non-fatal — user is created, just couldn't join team with that code
        }
      }
      navigate('/');
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex rounded-2xl bg-brand-500 p-3">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Create account</h2>
          <p className="mt-1 text-sm text-slate-500">Start managing your team's tasks today</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            placeholder="John Doe"
            leftIcon={<User className="h-4 w-4" />}
            error={errors.name?.message}
            {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Min 2 characters' } })}
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            leftIcon={<Mail className="h-4 w-4" />}
            error={errors.email?.message}
            {...register('email', { required: 'Email is required' })}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Min 8 characters"
            leftIcon={<Lock className="h-4 w-4" />}
            error={errors.password?.message}
            {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })}
          />

          {/* Optional team invite code */}
          <div className="space-y-1">
            <Input
              label="Team Invite Code (optional)"
              type="text"
              placeholder="Paste code to join a team instantly"
              leftIcon={<Hash className="h-4 w-4" />}
              {...register('teamCode')}
            />
            <p className="pl-1 text-xs text-slate-400">Leave blank — you can create or join teams later</p>
          </div>

          {/* Inline error */}
          {formError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 dark:border-red-800/50 dark:bg-red-500/10"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
            </motion.div>
          )}

          <Button type="submit" className="w-full" isLoading={isLoading}>
            Create Account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-500 hover:text-brand-600">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
};
