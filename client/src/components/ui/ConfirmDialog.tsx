import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

export const ConfirmDialog = () => {
  const { confirmDialog } = useUIStore();

  // Escape key cancels the dialog
  useEffect(() => {
    if (!confirmDialog?.isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') confirmDialog.onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [confirmDialog]);

  const isOpen = !!confirmDialog?.isOpen;

  return (
    <AnimatePresence>
      {isOpen && confirmDialog && (
        <>
          {/* Backdrop */}
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={confirmDialog.onCancel}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            key="confirm-dialog"
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4"
            // Stop clicks on the dialog from bubbling to the backdrop
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
              {/* Icon + content */}
              <div className="p-6">
                <div className="flex gap-4">
                  {/* Icon */}
                  <div
                    className={
                      confirmDialog.variant === 'danger'
                        ? 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20'
                        : 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20'
                    }
                  >
                    {confirmDialog.variant === 'danger' ? (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    )}
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      {confirmDialog.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {confirmDialog.message}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                <button
                  onClick={confirmDialog.onCancel}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {confirmDialog.cancelLabel}
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className={
                    confirmDialog.variant === 'danger'
                      ? 'rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
                      : 'rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2'
                  }
                >
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
