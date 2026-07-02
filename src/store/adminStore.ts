import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  getAdminHealth,
  getAdminKafkaLag,
  getAdminOutboxStats,
  getAdminSystemStats,
  runAdminCleanup
} from "../api/adminApi";
import type { AdminCleanupResult, AdminOverview } from "../types/admin";
import { useSettingsStore } from "./settingsStore";

type AdminState = {
  adminToken: string;
  overview: AdminOverview | null;
  cleanupResult: AdminCleanupResult | null;
  isLoading: boolean;
  error: string | null;
  setAdminToken: (token: string) => void;
  clearAdminToken: () => void;
  loadOverview: () => Promise<void>;
  runCleanup: (dryRun: boolean) => Promise<void>;
};

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      adminToken: "",
      overview: null,
      cleanupResult: null,
      isLoading: false,
      error: null,
      setAdminToken: (adminToken) => set({ adminToken, overview: null, cleanupResult: null, error: null }),
      clearAdminToken: () => set({ adminToken: "", overview: null, cleanupResult: null, error: null }),
      loadOverview: async () => {
        const adminToken = get().adminToken.trim();
        if (!adminToken) {
          set({ error: "Admin token is required." });
          return;
        }
        const baseUrl = useSettingsStore.getState().bridgeHttpUrl;
        set({ isLoading: true, error: null });
        try {
          const [health, systemStats, outboxStats, kafkaLag] = await Promise.all([
            getAdminHealth(baseUrl, adminToken),
            getAdminSystemStats(baseUrl, adminToken),
            getAdminOutboxStats(baseUrl, adminToken),
            getAdminKafkaLag(baseUrl, adminToken)
          ]);
          set({
            overview: { health, systemStats, outboxStats, kafkaLag },
            isLoading: false,
            error: null
          });
        } catch (error) {
          set({
            isLoading: false,
            overview: null,
            cleanupResult: null,
            error: error instanceof Error ? error.message : "Failed to load admin overview."
          });
        }
      },
      runCleanup: async (dryRun) => {
        const adminToken = get().adminToken.trim();
        if (!adminToken) {
          set({ error: "Admin token is required." });
          return;
        }
        const baseUrl = useSettingsStore.getState().bridgeHttpUrl;
        set({ isLoading: true, error: null });
        try {
          const cleanupResult = await runAdminCleanup(baseUrl, adminToken, dryRun);
          set({ cleanupResult, isLoading: false, error: null });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Cleanup request failed."
          });
        }
      }
    }),
    {
      name: "nebulaim-admin",
      partialize: (state) => ({ adminToken: state.adminToken })
    }
  )
);
