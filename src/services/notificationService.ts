import { createId } from "../utils/id";

export type NotificationType = "info" | "success" | "error";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  createdAt: number;
};

type Listener = (notification: Notification) => void;

const listeners = new Set<Listener>();

export const notificationService = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  notify(type: NotificationType, title: string, message?: string) {
    const notification: Notification = {
      id: createId("notice"),
      type,
      title,
      message,
      createdAt: Date.now()
    };
    listeners.forEach((listener) => listener(notification));
  }
};
