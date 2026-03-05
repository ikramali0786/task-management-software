import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Lock, Zap, Hash, AlertCircle, Check, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { teamService } from '@/services/teamService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface FormData {
  name: string;
  email: string;
  password: string;
  teamCode?: string;
}

/* ── Password requirement row ─────────────────────────────────────────── */
const Req = ({
  met,
  optional,
  label,
}: {
  met: boolean;
  optional?: boolean;
  label: string;
}) => (
  <div className="flex items-center gap-2">
    <span
      className={cn(
        'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-white transition-colors duration-200',
        met
          ? 'bg-emerald-500'
          : optional
          ? 'bg-slate-200 dark:bg-slate-700'
          : 'bg-slate-200 dark:bg-slate-700'
      )}
    >
      {met ? (
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      ) : optional ? (
        <span className="h-1 w-1 rounded-full bg-slate-400 dark:bg-slate-500" />
      ) : (
        <X className="h-2.5 w-2.5 text-slate-400" strokeWidth={3} />
      )}
    </span>
    <span
      className={cn(
        'text-xs transition-colors duration-200',
        met
          ? 'text-emerald-600 dark:text-emerald-400'
          : optional
          ? 'text-slate-400'
          : 'text-slate-500 dark:text-slate-400'
      )}
    >
      {label}
      {optional && (
        <span className="ml-1 rounded-sm bg-slate-100 px-1 py-px text-[10px] text-slate-400 dark:bg-slate-800">
          optional
        </span>
      )}
    </span>
  </div>
);

/* ── Page ─────────────────────────────────────────────────────────────── */
export const RegisterPage = () => {
  const { register: registerUser, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [pwFocused, setPwFocused] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>();

  const password = watch('password', '');

  /* requirements */
  const lengthOk = password.length >= 8 && password.length <= 14;
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const showHints = pwFocused || password.length > 0;

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    try {
      await registerUser(data.name, data.email, data.password);
      if (data.teamCode?.trim()) {
        try {
          await teamService.joinByCode(data.teamCode.trim());
        } catch {
          // Non-fatal — user created, team join skipped
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
        {/* Heading */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex rounded-2xl bg-brand-500 p-3">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Create account</h2>
          <p className="mt-1 text-sm text-slate-500">Start managing your team's tasks today</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <Input
            label="Full Name"
            type="text"
            placeholder="John Doe"
            leftIcon={<User className="h-4 w-4" />}
            error={errors.name?.message}
            {...register('name', {
              required: 'Name is required',
              minLength: { value: 2, message: 'Min 2 characters' },
            })}
          />

          {/* Email */}
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            leftIcon={<Mail className="h-4 w-4" />}
            error={errors.email?.message}
            {...register('email', { required: 'Email is required' })}
          />

          {/* Password + live requirements */}
          <div className="space-y-2">
            <Input
              label="Password"
              type="password"
              placeholder="8–14 characters"
              leftIcon={<Lock className="h-4 w-4" />}
              error={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters.' },
                maxLength: { value: 14, message: 'Password must be no more than 14 characters.' },
              })}
              onFocus={() => setPwFocused(true)}
              onBlur={() => setPwFocused(false)}
            />

            {/* Requirements checklist */}
            <AnimatePresence>
              {showHints && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60"
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Requirements
                  </p>
                  <div className="space-y-1.5">
                    <Req met={lengthOk} label="8–14 characters" />
                    <Req met={hasNumber} optional label="Contains a number (0–9)" />
                    <Req met={hasSpecial} optional label="Contains a special character (!@#$…)" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Team invite code (optional) */}
          <div className="space-y-1">
            <Input
              label="Team Invite Code (optional)"
              type="text"
              placeholder="Paste code to join a team instantly"
              leftIcon={<Hash className="h-4 w-4" />}
              {...register('teamCode')}
            />
            <p className="pl-1 text-xs text-slate-400">
              Leave blank — you can create or join teams later
            </p>
          </div>

          {/* Server error */}
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
