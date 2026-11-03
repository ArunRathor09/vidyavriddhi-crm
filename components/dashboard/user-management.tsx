"use client";

import { useState } from "react";
import {
  Crown,
  Shield,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  Sparkles,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, type AuthUser } from "@/lib/auth/auth-context";
import {
  ALL_MODULES,
  MODULE_CATALOG,
  MODULE_GROUPS,
  type ModuleKey,
  type UserRole,
} from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function UserManagementView() {
  const { user: currentUser, users, upsertUser, removeUser, switchUser } = useAuth();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("admin");
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>([
    "dashboard",
    "leads",
    "follow-ups",
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function openCreateModal() {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("admin");
    setSelectedModules(["dashboard", "leads", "follow-ups"]);
    setModalOpen(true);
  }

  function openEditModal(userToEdit: AuthUser) {
    setEditingUser(userToEdit);
    setFormName(userToEdit.fullName ?? "");
    setFormEmail(userToEdit.email);
    setFormPassword("");
    setFormRole(userToEdit.role);
    setSelectedModules(
      userToEdit.role === "super_admin"
        ? [...ALL_MODULES]
        : [...userToEdit.allowedModules],
    );
    setModalOpen(true);
  }

  function toggleModule(mod: ModuleKey) {
    if (mod === "dashboard") return; // Dashboard is always accessible
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  }

  function selectAllModules() {
    setSelectedModules([...ALL_MODULES]);
  }

  function clearAllModules() {
    setSelectedModules(["dashboard"]);
  }

  function applyPreset(preset: "counsellor" | "admissions" | "viewer") {
    if (preset === "counsellor") {
      setSelectedModules(["dashboard", "leads", "follow-ups", "students", "activities"]);
    } else if (preset === "admissions") {
      setSelectedModules(["dashboard", "colleges", "applications", "documents", "payments"]);
    } else if (preset === "viewer") {
      setSelectedModules(["dashboard", "reports"]);
    }
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!formEmail.trim()) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!editingUser && !formPassword.trim()) {
      toast.error("Please provide an initial password");
      return;
    }

    setIsSubmitting(true);
    try {
      const allowedModules =
        formRole === "super_admin" ? [...ALL_MODULES] : selectedModules;

      const res = await upsertUser({
        id: editingUser?.id,
        email: formEmail.trim(),
        fullName: formName.trim() || undefined,
        role: formRole,
        allowedModules,
      });

      if (res.success) {
        toast.success(
          editingUser
            ? `Admin permissions updated for ${formEmail}`
            : `New ${formRole === "super_admin" ? "Super Admin" : "Admin"} created successfully!`,
        );
        setModalOpen(false);
      } else {
        toast.error(res.error || "Failed to save user");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error saving user");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(userId: string, email: string) {
    if (userId === currentUser?.id) {
      toast.error("You cannot delete the active account you are currently logged into.");
      return;
    }
    if (confirm(`Are you sure you want to delete user ${email}?`)) {
      const res = await removeUser(userId);
      if (res.success) {
        toast.success(`User ${email} removed.`);
      } else {
        toast.error(res.error || "Could not delete user.");
      }
    }
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.fullName && u.fullName.toLowerCase().includes(search.toLowerCase()));
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const superAdminCount = users.filter((u) => u.role === "super_admin").length;
  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 text-white shadow-md sm:p-8">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300">
                <Crown className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300">
                Administration & Access Control
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              User & Role-Based Access Management
            </h1>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-300">
              Create and manage CRM administrators. As Super Admin, you determine exactly which modules
              each admin can access — non-assigned modules are hidden from their sidebar.
            </p>
          </div>
          <Button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-teal-500 font-semibold text-white shadow-lg shadow-teal-500/30 hover:bg-teal-400"
          >
            <Plus className="h-4 w-4" />
            Create New Admin
          </Button>
        </div>

        {/* Stats Row */}
        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
          <div className="rounded-xl bg-white/5 p-3 backdrop-blur-xs">
            <p className="text-[10px] font-medium text-slate-400">Total Users</p>
            <p className="mt-1 text-xl font-bold text-white">{users.length}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 backdrop-blur-xs">
            <p className="text-[10px] font-medium text-amber-300/80">Super Admins</p>
            <p className="mt-1 text-xl font-bold text-amber-400">{superAdminCount}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 backdrop-blur-xs">
            <p className="text-[10px] font-medium text-sky-300/80">Role-Limited Admins</p>
            <p className="mt-1 text-xl font-bold text-sky-400">{adminCount}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 backdrop-blur-xs">
            <p className="text-[10px] font-medium text-teal-300/80">Available Modules</p>
            <p className="mt-1 text-xl font-bold text-teal-300">{ALL_MODULES.length}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search admins by name or email..."
            className="h-9 rounded-lg border-slate-200 pl-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">Filter:</span>
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            <button
              onClick={() => setRoleFilter("all")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                roleFilter === "all"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter("super_admin")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                roleFilter === "super_admin"
                  ? "bg-amber-600 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Super Admin ({superAdminCount})
            </button>
            <button
              onClick={() => setRoleFilter("admin")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                roleFilter === "admin"
                  ? "bg-sky-600 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Admins ({adminCount})
            </button>
          </div>
        </div>
      </div>

      {/* Users Grid / List */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredUsers.map((userItem) => {
          const isSA = userItem.role === "super_admin";
          const isActive = currentUser?.id === userItem.id;
          const assignedCount = isSA ? ALL_MODULES.length : userItem.allowedModules.length;

          return (
            <div
              key={userItem.id}
              className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all ${
                isActive
                  ? "border-teal-500 bg-teal-50/20 shadow-md ring-2 ring-teal-500/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              {/* Card Header */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold shadow-2xs ${
                        isSA
                          ? "bg-gradient-to-br from-amber-100 to-yellow-100 text-amber-800 ring-1 ring-amber-300"
                          : "bg-gradient-to-br from-sky-100 to-blue-100 text-sky-800 ring-1 ring-sky-300"
                      }`}
                    >
                      {isSA ? <Crown className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {userItem.fullName || "Admin User"}
                        </h3>
                        {isActive && (
                          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[9px] font-bold text-teal-800">
                            Active (You)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{userItem.email}</p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`gap-1 text-[10px] font-semibold ${
                      isSA
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-sky-300 bg-sky-50 text-sky-800"
                    }`}
                  >
                    {isSA ? "Super Admin" : "Admin"}
                  </Badge>
                </div>

                {/* Modules Assigned Preview */}
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">Assigned Tasks / Modules</span>
                    <span className="font-bold text-teal-700">
                      {assignedCount} / {ALL_MODULES.length}
                    </span>
                  </div>

                  {isSA ? (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                      <Sparkles className="h-3.5 w-3.5" />
                      Full unrestricted access to all CRM modules
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {userItem.allowedModules.map((modKey) => (
                        <span
                          key={modKey}
                          className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 shadow-2xs"
                        >
                          {MODULE_CATALOG[modKey]?.label ?? modKey}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/40 px-5 py-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditModal(userItem)}
                    className="h-8 gap-1.5 rounded-lg border-slate-200 text-xs font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                    Permissions
                  </Button>
                  {!isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(userItem.id, userItem.email)}
                      className="h-8 rounded-lg text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Live Switch Button: test sidebar permissions instantly */}
                {!isActive ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      switchUser(userItem.id);
                      toast.info(`Switched active view to ${userItem.fullName || userItem.email}. Notice how sidebar modules update!`);
                    }}
                    className="h-8 gap-1 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Switch & View
                  </Button>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-teal-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Current User
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Admin User Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              {editingUser ? (
                <>
                  <Edit2 className="h-5 w-5 text-teal-600" />
                  Edit Admin Permissions
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 text-teal-600" />
                  Create New Admin User
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure the user&apos;s details, assign their role, and select the specific CRM tasks
              and modules they are authorized to access.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="admin-name" className="text-xs font-semibold">
                  Full Name
                </Label>
                <Input
                  id="admin-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-xs font-semibold">
                  Email Address *
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="rahul@vidyavriddhi.com"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {!editingUser && (
              <div className="space-y-1.5">
                <Label htmlFor="admin-password" className="text-xs font-semibold">
                  Initial Password *
                </Label>
                <Input
                  id="admin-password"
                  type="password"
                  required
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="h-9 text-xs"
                />
              </div>
            )}

            {/* Role Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Assign Role</Label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setFormRole("admin")}
                  className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                    formRole === "admin"
                      ? "border-sky-500 bg-sky-50/50 shadow-xs ring-2 ring-sky-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-sky-600" />
                    <span className="text-xs font-bold text-slate-900">Admin</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Restricted view. Only sees assigned modules in the sidebar.
                  </p>
                </div>

                <div
                  onClick={() => setFormRole("super_admin")}
                  className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                    formRole === "super_admin"
                      ? "border-amber-500 bg-amber-50/50 shadow-xs ring-2 ring-amber-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-900">Super Admin</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Full control. Can create admins, assign access, and sees all modules.
                  </p>
                </div>
              </div>
            </div>

            {/* Module Permissions Picker (only if role is admin) */}
            {formRole === "admin" ? (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Label className="text-xs font-bold text-slate-900">
                      Module & Task Permissions
                    </Label>
                    <p className="text-[11px] text-slate-500">
                      Select which sections will appear in this admin&apos;s sidebar:
                    </p>
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyPreset("counsellor")}
                      className="h-6 rounded-md px-2 text-[10px]"
                    >
                      Counsellor
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyPreset("admissions")}
                      className="h-6 rounded-md px-2 text-[10px]"
                    >
                      Admissions
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={selectAllModules}
                      className="h-6 rounded-md px-2 text-[10px]"
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearAllModules}
                      className="h-6 rounded-md px-2 text-[10px]"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Modules Grouped */}
                <div className="space-y-3 pt-2">
                  {MODULE_GROUPS.map((group) => (
                    <div key={group.label} className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {group.label}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {group.modules.map((modKey) => {
                          const info = MODULE_CATALOG[modKey];
                          const isSelected = selectedModules.includes(modKey);
                          const isDashboard = modKey === "dashboard";

                          return (
                            <div
                              key={modKey}
                              onClick={() => !isDashboard && toggleModule(modKey)}
                              className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition-all ${
                                isDashboard
                                  ? "cursor-not-allowed border-slate-200 bg-slate-100/70 opacity-80"
                                  : isSelected
                                  ? "cursor-pointer border-teal-500 bg-teal-50/70 text-teal-900 shadow-2xs"
                                  : "cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              <div
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                  isSelected
                                    ? "border-teal-600 bg-teal-600 text-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold leading-tight">
                                  {info.label}
                                  {isDashboard && (
                                    <span className="ml-1 text-[9px] font-normal text-slate-400">
                                      (Default)
                                    </span>
                                  )}
                                </p>
                                <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">
                                  {info.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
                <div className="flex items-center gap-2 font-semibold">
                  <Crown className="h-4 w-4 text-amber-600" />
                  Super Admin has unrestricted access
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                  Super Admins automatically receive access to all {ALL_MODULES.length} modules
                  including administrative user management.
                </p>
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-teal-600 text-xs font-semibold text-white hover:bg-teal-700"
              >
                {isSubmitting ? "Saving..." : editingUser ? "Save Permissions" : "Create Admin User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
