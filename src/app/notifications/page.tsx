import { NotificationBell } from "@/features/notifications/components/notification-bell";

export default function NotificationsPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">通知</h1>
      <div className="mt-4">
        <NotificationBell />
      </div>
    </main>
  );
}
