import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  getAdminHealth,
  getAdminAuditEvents,
  getAdminKafkaLag,
  getAdminOutboxStats,
  getAdminServiceOverview,
  getAdminSystemStats,
  runAdminCleanup
} from "../api/adminApi";
import type { AdminCleanupResult, AdminOverview } from "../types/admin";
import { useSettingsStore } from "./settingsStore";
import { translate, type TranslationKey } from "../i18n";

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

function tr(key: TranslationKey) {
  return translate(useSettingsStore.getState().language, key);
}

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
          set({ error: tr("store.adminTokenRequired") });
          return;
        }
        const baseUrl = useSettingsStore.getState().bridgeHttpUrl;
        set({ isLoading: true, error: null });
        try {
          const [health, systemStats, outboxStats, kafkaLag, serviceOverview, auditEvents] = await Promise.all([
            getAdminHealth(baseUrl, adminToken),
            getAdminSystemStats(baseUrl, adminToken),
            getAdminOutboxStats(baseUrl, adminToken),
            getAdminKafkaLag(baseUrl, adminToken),
            getAdminServiceOverview(baseUrl, adminToken),
            getAdminAuditEvents(baseUrl, adminToken, 20)
          ]);
          set({
            overview: { health, systemStats, outboxStats, kafkaLag, serviceOverview, auditEvents },
            isLoading: false,
            error: null
          });
        } catch (error) {
          set({
            isLoading: false,
            overview: null,
            cleanupResult: null,
            error: error instanceof Error ? error.message : tr("store.failedAdminOverview")
          });
        }
      },
      runCleanup: async (dryRun) => {
        const adminToken = get().adminToken.trim();
        if (!adminToken) {
          set({ error: tr("store.adminTokenRequired") });
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
            error: error instanceof Error ? error.message : tr("store.cleanupFailed")
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
