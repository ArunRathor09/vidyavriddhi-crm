"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import {
  type UserRole,
  type ModuleKey,
  ALL_MODULES,
  getAccessibleModules,
  isSuperAdmin,
  isAdmin,
} from "@/lib/auth/roles";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  allowedModules: ModuleKey[];
  fullName?: string;
  createdAt?: string;
};

// Initial sample users for demo & immediate role testing
export const INITIAL_DEMO_USERS: AuthUser[] = [
  {
    id: "usr_superadmin",
    email: "superadmin@vidyavriddhi.com",
    fullName: "Arun Rathor (Super Admin)",
    role: "super_admin",
    allowedModules: [...ALL_MODULES],
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr_counsellor",
    email: "counsellor@vidyavriddhi.com",
    fullName: "Priya Sharma (Counsellor Admin)",
    role: "admin",
    allowedModules: ["dashboard", "leads", "follow-ups", "students"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr_admissions",
    email: "admissions@vidyavriddhi.com",
    fullName: "Vikram Mehta (Admissions Admin)",
    role: "admin",
    allowedModules: ["dashboard", "colleges", "applications", "documents", "payments"],
    createdAt: new Date().toISOString(),
  },
];

const LOCAL_STORAGE_USERS_KEY = "nexora_admin_users_v1";
const LOCAL_STORAGE_ACTIVE_USER_KEY = "nexora_active_user_id_v1";

type AuthContextValue = {
  user: AuthUser | null;
  users: AuthUser[];
  loading: boolean;
  /** Check if the current user can access a specific module. */
  canAccess: (moduleKey: ModuleKey) => boolean;
  /** Whether the current user is a super admin. */
  isSuperAdmin: boolean;
  /** Whether the current user is an admin. */
  isAdmin: boolean;
  /** Reload user data. */
  refresh: () => void;
  /** Switch active user (useful for live preview/testing between super admin and admins). */
  switchUser: (userId: string) => void;
  /** Create or update an admin user with assigned modules. */
  upsertUser: (userData: {
    id?: string;
    email: string;
    fullName?: string;
    role: UserRole;
    allowedModules: ModuleKey[];
  }) => Promise<{ success: boolean; error?: string }>;
  /** Delete an admin user. */
  removeUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  users: [],
  loading: true,
  canAccess: () => false,
  isSuperAdmin: false,
  isAdmin: false,
  refresh: () => {},
  switchUser: () => {},
  upsertUser: async () => ({ success: false }),
  removeUser: async () => ({ success: false }),
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Load stored users from localStorage or fallback
  const loadStoredUsers = useCallback((): AuthUser[] => {
    if (typeof window === "undefined") return INITIAL_DEMO_USERS;
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore JSON parse error
    }
    return INITIAL_DEMO_USERS;
  }, []);

  const saveStoredUsers = useCallback((newUsers: AuthUser[]) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(newUsers));
    } catch {
      // ignore storage error
    }
  }, []);

  const loadUser = useCallback(async () => {
    const config = getSupabaseConfig();
    const storedUsersList = loadStoredUsers();
    setUsers(storedUsersList);

    if (!config) {
      // Supabase is not configured — use local demo users
      const activeUserId = typeof window !== "undefined"
        ? localStorage.getItem(LOCAL_STORAGE_ACTIVE_USER_KEY)
        : null;

      const activeUser = storedUsersList.find((u) => u.id === activeUserId) ?? storedUsersList[0];
      setUser(activeUser);
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        // Fallback to first user in local store if no active session
        const activeUserId = typeof window !== "undefined"
          ? localStorage.getItem(LOCAL_STORAGE_ACTIVE_USER_KEY)
          : null;
        const activeUser = storedUsersList.find((u) => u.id === activeUserId) ?? storedUsersList[0];
        setUser(activeUser);
        setLoading(false);
        return;
      }

      const meta = data.user.user_metadata ?? {};
      const role: UserRole = meta.role === "admin" ? "admin" : "super_admin";
      const assignedModules: string[] = Array.isArray(meta.allowed_modules)
        ? meta.allowed_modules
        : [];

      const currentAuthUser: AuthUser = {
        id: data.user.id,
        email: data.user.email ?? "",
        role,
        allowedModules: getAccessibleModules(role, assignedModules),
        fullName: meta.full_name ?? meta.name ?? undefined,
        createdAt: data.user.created_at,
      };

      // Ensure current user is in users list
      const existingIndex = storedUsersList.findIndex((u) => u.id === currentAuthUser.id || u.email === currentAuthUser.email);
      let updatedList = [...storedUsersList];
      if (existingIndex >= 0) {
        updatedList[existingIndex] = { ...updatedList[existingIndex], ...currentAuthUser };
      } else {
        updatedList = [currentAuthUser, ...updatedList];
      }
      setUsers(updatedList);
      saveStoredUsers(updatedList);
      setUser(currentAuthUser);
    } catch {
      const fallbackUser = storedUsersList[0];
      setUser(fallbackUser);
    } finally {
      setLoading(false);
    }
  }, [loadStoredUsers, saveStoredUsers]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const canAccess = useCallback(
    (moduleKey: ModuleKey) => {
      if (!user) return false;
      // Super admin can access everything
      if (isSuperAdmin(user.role)) return true;
      // Admin can only access what has been assigned
      return user.allowedModules.includes(moduleKey);
    },
    [user],
  );

  const switchUser = useCallback(
    (userId: string) => {
      const targetUser = users.find((u) => u.id === userId);
      if (targetUser) {
        setUser(targetUser);
        if (typeof window !== "undefined") {
          localStorage.setItem(LOCAL_STORAGE_ACTIVE_USER_KEY, targetUser.id);
        }
      }
    },
    [users],
  );

  const upsertUser = useCallback(
    async (userData: {
      id?: string;
      email: string;
      fullName?: string;
      role: UserRole;
      allowedModules: ModuleKey[];
    }): Promise<{ success: boolean; error?: string }> => {
      const normalizedEmail = userData.email.trim().toLowerCase();
      const allowedModules = getAccessibleModules(userData.role, userData.allowedModules);

      // Also try API if configured
      if (getSupabaseConfig()) {
        try {
          if (userData.id && !userData.id.startsWith("usr_")) {
            await fetch("/api/admin", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: userData.id,
                allowedModules,
                role: userData.role,
                fullName: userData.fullName,
              }),
            });
          }
        } catch {
          // ignore API error, maintain local state
        }
      }

      setUsers((prevUsers) => {
        let updated: AuthUser[];
        const existingIdx = prevUsers.findIndex(
          (u) => (userData.id && u.id === userData.id) || u.email.toLowerCase() === normalizedEmail,
        );

        if (existingIdx >= 0) {
          const updatedUser: AuthUser = {
            ...prevUsers[existingIdx],
            email: normalizedEmail,
            fullName: userData.fullName || prevUsers[existingIdx].fullName,
            role: userData.role,
            allowedModules,
          };
          updated = [...prevUsers];
          updated[existingIdx] = updatedUser;
          // If editing currently active user, update current user state too
          if (user?.id === updatedUser.id) {
            setUser(updatedUser);
          }
        } else {
          const newUser: AuthUser = {
            id: userData.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            email: normalizedEmail,
            fullName: userData.fullName || normalizedEmail.split("@")[0],
            role: userData.role,
            allowedModules,
            createdAt: new Date().toISOString(),
          };
          updated = [newUser, ...prevUsers];
        }

        saveStoredUsers(updated);
        return updated;
      });

      return { success: true };
    },
    [user, saveStoredUsers],
  );

  const removeUser = useCallback(
    async (userId: string): Promise<{ success: boolean; error?: string }> => {
      if (user?.id === userId) {
        return { success: false, error: "Cannot delete the currently logged in user." };
      }

      if (getSupabaseConfig()) {
        try {
          await fetch(`/api/admin?id=${encodeURIComponent(userId)}`, { method: "DELETE" });
        } catch {
          // continue with local removal
        }
      }

      setUsers((prevUsers) => {
        const updated = prevUsers.filter((u) => u.id !== userId);
        saveStoredUsers(updated);
        return updated;
      });

      return { success: true };
    },
    [user, saveStoredUsers],
  );

  const isSA = isSuperAdmin(user?.role);
  const isAdm = isAdmin(user?.role);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      users,
      loading,
      canAccess,
      isSuperAdmin: isSA,
      isAdmin: isAdm,
      refresh: () => void loadUser(),
      switchUser,
      upsertUser,
      removeUser,
    }),
    [user, users, loading, canAccess, isSA, isAdm, loadUser, switchUser, upsertUser, removeUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
