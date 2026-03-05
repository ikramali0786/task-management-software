import { useState, useEffect } from 'react';
import { Plus, Trash2, Lock, Pencil, Check, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomRole, RolePermissions } from '@/types';
import { teamRoleService, BuiltInRole } from '@/services/teamRoleService';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

const PERM_LABELS: { key: keyof RolePermissions; label: string; group: string }[] = [
  { key: 'createTask', label: 'Create tasks', group: 'Tasks' },
  { key: 'editOwnTask', label: 'Edit own tasks', group: 'Tasks' },
  { key: 'editAnyTask', label: 'Edit any task', group: 'Tasks' },
  { key: 'deleteOwnTask', label: 'Delete own tasks', group: 'Tasks' },
  { key: 'deleteAnyTask', label: 'Delete any task', group: 'Tasks' },
  { key: 'commentOnTasks', label: 'Comment on tasks', group: 'Tasks' },
  { key: 'inviteMembers', label: 'Invite members', group: 'Team' },
  { key: 'manageMembers', label: 'Manage members', group: 'Team' },
  { key: 'manageTeamSettings', label: 'Manage settings', group: 'Team' },
  { key: 'viewWorkload', label: 'View workload', group: 'Team' },
];

const DEFAULT_PERMS: RolePermissions = {
  createTask: true,
  editOwnTask: true,
  editAnyTask: false,
  deleteOwnTask: true,
  deleteAnyTask: false,
  manageMembers: false,
  manageTeamSettings: false,
  inviteMembers: false,
  commentOnTasks: true,
  viewWorkload: true,
};

const ROLE_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#0ea5e9', '#f59e0b', '#64748b'];

const PermBadge = ({ has }: { has: boolean }) =>
  has ? (
    <Check className="h-4 w-4 text-green-500" />
  ) : (
    <X className="h-4 w-4 text-slate-300 dark:text-slate-600" />
  );

interface Props {
  teamId: string;
  isAdmin: boolean;
}

export const RolesManager = ({ teamId, isAdmin }: Props) => {
  const { addToast } = useUIStore();
  const [builtIn, setBuiltIn] = useState<BuiltInRole[]>([]);
  const [custom, setCustom] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New role form state
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(ROLE_COLORS[0]);
  const [newPerms, setNewPerms] = useState<RolePermissions>({ ...DEFAULT_PERMS });

  // Edit state
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editPerms, setEditPerms] = useState<RolePermissions>({ ...DEFAULT_PERMS });

  useEffect(() => {
    setLoading(true);
    teamRoleService.getRoles(teamId)
      .then(({ builtIn: bi, custom: c }) => {
        setBuiltIn(bi);
        setCustom(c);
      })
      .catch(() => addToast({ type: 'error', title: 'Failed to load roles' }))
      .finally(() => setLoading(false));
  }, [teamId]);

  const startEdit = (role: CustomRole) => {
    setEditingId(role._id);
    setEditName(role.name);
    setEditColor(role.color);
    setEditPerms({ ...role.permissions });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (roleId: string) => {
    setSaving(true);
    try {
      const updated = await teamRoleService.updateRole(teamId, roleId, {
        name: editName,
        color: editColor,
        permissions: editPerms,
      });
      setCustom(updated);
      setEditingId(null);
      addToast({ type: 'success', title: 'Role updated' });
    } catch {
      addToast({ type: 'error', title: 'Failed to update role' });
    } finally {
      setSaving(false);
    }
  };

  const createRole = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const updated = await teamRoleService.createRole(teamId, {
        name: newName.trim(),
        color: newColor,
        permissions: newPerms,
      });
      setCustom(updated);
      setCreating(false);
      setNewName('');
      setNewColor(ROLE_COLORS[0]);
      setNewPerms({ ...DEFAULT_PERMS });
      addToast({ type: 'success', title: 'Role created' });
    } catch (err: any) {
      addToast({ type: 'error', title: err.response?.data?.message || 'Failed to create role' });
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (roleId: string) => {
    setSaving(true);
    try {
      const updated = await teamRoleService.deleteRole(teamId, roleId);
      setCustom(updated);
      setDeleteConfirm(null);
      addToast({ type: 'success', title: 'Role deleted. Members reassigned to Member.' });
    } catch {
      addToast({ type: 'error', title: 'Failed to delete role' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Built-in roles */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Lock className="h-4 w-4 text-slate-400" />
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Built-in Roles</h4>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
            Read-only
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-slate-500">Role</th>
                {PERM_LABELS.map((p) => (
                  <th key={p.key} className="px-2 py-2.5 text-center text-xs font-medium text-slate-500" title={p.label}>
                    <span className="hidden lg:block">{p.label}</span>
                    <span className="lg:hidden">{p.label.split(' ')[0]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {builtIn.map((role) => (
                <tr key={role._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">{role.name}</span>
                    </div>
                  </td>
                  {PERM_LABELS.map((p) => (
                    <td key={p.key} className="px-2 py-3 text-center">
                      <div className="flex justify-center">
                        <PermBadge has={role.permissions[p.key]} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom roles */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-500" />
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Custom Roles</h4>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              {custom.length}
            </span>
          </div>
          {isAdmin && !creating && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Role
            </button>
          )}
        </div>

        {custom.length === 0 && !creating && (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
            <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400">No custom roles yet.</p>
            {isAdmin && (
              <p className="text-xs text-slate-400 mt-1">Create a custom role to give members specific permissions.</p>
            )}
          </div>
        )}

        {/* New role form */}
        <AnimatePresence>
          {creating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden rounded-xl border border-brand-200 bg-brand-50/50 dark:border-brand-800 dark:bg-brand-500/5"
            >
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-500">Role Name</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Designer, QA Engineer"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Color</label>
                    <div className="flex gap-1.5">
                      {ROLE_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColor(c)}
                          className={cn(
                            'h-6 w-6 rounded-full border-2 transition-all',
                            newColor === c ? 'border-white scale-110 shadow-md' : 'border-transparent'
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-500">Permissions</label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {PERM_LABELS.map((p) => (
                      <label key={p.key} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={newPerms[p.key]}
                          onChange={(e) => setNewPerms((prev) => ({ ...prev, [p.key]: e.target.checked }))}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={createRole}
                    disabled={!newName.trim() || saving}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                  >
                    {saving ? <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" /> : <Check className="h-3.5 w-3.5" />}
                    Create Role
                  </button>
                  <button
                    onClick={() => setCreating(false)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom roles list */}
        {custom.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-slate-500">Role</th>
                  {PERM_LABELS.map((p) => (
                    <th key={p.key} className="px-2 py-2.5 text-center text-xs font-medium text-slate-500" title={p.label}>
                      <span className="hidden lg:block">{p.label}</span>
                      <span className="lg:hidden">{p.label.split(' ')[0]}</span>
                    </th>
                  ))}
                  {isAdmin && <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                <AnimatePresence>
                  {custom.map((role) => {
                    const isEditing = editingId === role._id;
                    return (
                      <motion.tr
                        key={role._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                {ROLE_COLORS.map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setEditColor(c)}
                                    className={cn(
                                      'h-4 w-4 rounded-full border transition-all',
                                      editColor === c ? 'border-white scale-110 shadow' : 'border-transparent'
                                    )}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-28 rounded border border-slate-200 bg-white px-2 py-0.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-brand-400"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                              <span className="font-medium text-slate-800 dark:text-slate-200">{role.name}</span>
                            </div>
                          )}
                        </td>
                        {PERM_LABELS.map((p) => (
                          <td key={p.key} className="px-2 py-3 text-center">
                            {isEditing ? (
                              <div className="flex justify-center">
                                <input
                                  type="checkbox"
                                  checked={editPerms[p.key]}
                                  onChange={(e) => setEditPerms((prev) => ({ ...prev, [p.key]: e.target.checked }))}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                                />
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <PermBadge has={role.permissions[p.key]} />
                              </div>
                            )}
                          </td>
                        ))}
                        {isAdmin && (
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => saveEdit(role._id)}
                                  disabled={saving}
                                  className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10"
                                  title="Save"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => startEdit(role)}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                                  title="Edit"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                {deleteConfirm === role._id ? (
                                  <>
                                    <button
                                      onClick={() => deleteRole(role._id)}
                                      disabled={saving}
                                      className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                      title="Confirm delete"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(null)}
                                      className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirm(role._id)}
                                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                                    title="Delete role"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
