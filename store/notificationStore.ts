// Store Zustand — Notifications en temps réel
import { create } from "zustand";
import type { Notification } from "@/types";

interface NotificationStore {
  notifications: Notification[];
  nonLues: number;
  ajouter: (notification: Omit<Notification, "id" | "lu" | "createdAt">) => void;
  marquerCommeLue: (id: string) => void;
  toutMarquerCommeLu: () => void;
  supprimer: (id: string) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  nonLues: 0,

  ajouter: (notification) => {
    const nouvelle: Notification = {
      ...notification,
      id: Math.random().toString(36).slice(2),
      lu: false,
      createdAt: new Date(),
    };
    set((state) => ({
      notifications: [nouvelle, ...state.notifications].slice(0, 50),
      nonLues: state.nonLues + 1,
    }));
  },

  marquerCommeLue: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, lu: true } : n
      ),
      nonLues: Math.max(0, state.nonLues - 1),
    })),

  toutMarquerCommeLu: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, lu: true })),
      nonLues: 0,
    })),

  supprimer: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      nonLues: state.nonLues - (state.notifications.find((n) => n.id === id && !n.lu) ? 1 : 0),
    })),
}));
