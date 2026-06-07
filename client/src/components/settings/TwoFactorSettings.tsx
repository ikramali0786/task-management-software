import { useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, Copy, Check, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { authService } from '@/services/authService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const RecoveryCodes = ({ codes, onDone }: { codes: string[]; onDone: () => void }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <p className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400">Save your recovery codes</p>
      <p className="mb-3 text-xs text-amber-700/80 dark:text-amber-400/80">
        Each code works once if you lose your authenticator. Store them somewhere safe — you won’t see them again.
      </p>
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-white p-3 font-mono text-sm text-slate-800 dark:bg-slate-900 dark:text-slate-200">
        {codes.map((c) => <span key={c}>{c}</span>)}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={async () => { await navigator.clipboard.writeText(codes.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy all'}
        </button>
        <Button onClick={onDone} className="ml-auto">Done</Button>
      </div>
    </div>
  );
};

export const TwoFactorSettings = () => {
  const { user, updateUser } = useAuthStore();
  const { addToast, showConfirm } = useUIStore();
  const enabled = Boolean((user as any)?.twoFactorEnabled);

  const [step, setStep] = useState<'idle' | 'setup' | 'codes'>('idle');
  const [qr, setQr] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const startSetup = async () => {
    setBusy(true);
    try {
      const data = await authService.setup2fa();
      setQr({ qrDataUrl: data.qrDataUrl, secret: data.secret });
      setStep('setup');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not start setup', message: err?.response?.data?.message });
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const { recoveryCodes } = await authService.enable2fa(code.trim());
      setRecoveryCodes(recoveryCodes);
      setStep('codes');
      setCode('');
      updateUser({ twoFactorEnabled: true } as any);
      addToast({ type: 'success', title: 'Two-factor enabled' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Verification failed', message: err?.response?.data?.message });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    const token = window.prompt('Enter a current authenticator code (or a recovery code) to disable 2FA:');
    if (!token) return;
    setBusy(true);
    try {
      await authService.disable2fa(token.trim());
      updateUser({ twoFactorEnabled: false } as any);
      addToast({ type: 'success', title: 'Two-factor disabled' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not disable', message: err?.response?.data?.message });
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    const token = window.prompt('Enter a current authenticator code to generate new recovery codes:');
    if (!token) return;
    setBusy(true);
    try {
      const { recoveryCodes } = await authService.regenerateRecoveryCodes(token.trim());
      setRecoveryCodes(recoveryCodes);
      setStep('codes');
      addToast({ type: 'success', title: 'New recovery codes generated' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Could not regenerate', message: err?.response?.data?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="mb-1 flex items-center gap-2">
        {enabled ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 text-slate-400" />}
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Two-factor authentication</h3>
        {enabled && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">On</span>}
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Add a one-time code from an authenticator app (Google Authenticator, 1Password, Authy) to your sign-in.
      </p>

      {step === 'codes' ? (
        <RecoveryCodes codes={recoveryCodes} onDone={() => { setStep('idle'); setRecoveryCodes([]); }} />
      ) : step === 'setup' && qr ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <img src={qr.qrDataUrl} alt="2FA QR code" className="h-44 w-44 rounded-lg bg-white p-1" />
            <p className="text-center text-xs text-slate-400">
              Scan with your authenticator app, or enter this key manually:
            </p>
            <code className="break-all rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">{qr.secret}</code>
          </div>
          <Input
            label="Enter the 6-digit code to confirm"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button onClick={confirmEnable} disabled={busy || !code.trim()} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enable
            </Button>
            <button onClick={() => { setStep('idle'); setQr(null); setCode(''); }} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </div>
      ) : enabled ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={regenerate} disabled={busy}>Regenerate recovery codes</Button>
          <Button variant="danger" onClick={disable} disabled={busy}>Disable 2FA</Button>
        </div>
      ) : (
        <Button onClick={startSetup} disabled={busy} className="gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Enable two-factor auth
        </Button>
      )}
    </div>
  );
};
