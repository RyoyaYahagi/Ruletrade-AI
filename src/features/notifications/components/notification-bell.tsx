"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/notifications");
      const json = await response.json();

      if (json.ok) {
        setNotifications(json.data.notifications);
      }
    }

    void load();
  }, []);

  const unreadCount = notifications.filter((n) => n.status !== "read").length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="relative rounded-md border px-3 py-2 text-sm"
      >
        通知
        {unreadCount > 0 ? (
          <span className="ml-2 rounded-full bg-black px-2 py-0.5 text-xs text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border bg-white p-3 shadow-lg">
          <NotificationList
            notifications={notifications}
            onChanged={() => {
              async function reload() {
                const response = await fetch("/api/notifications");
                const json = await response.json();
                if (json.ok) {
                  setNotifications(json.data.notifications);
                }
              }
              void reload();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

type Notification = {
  id: string;
  title: string;
  body: string;
  status: string;
  action_url: string | null;
  notification_type: string;
};

function NotificationList({
  notifications,
  onChanged,
}: {
  notifications: Notification[];
  onChanged: () => void;
}) {
  if (notifications.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">通知はありません。</p>
    );
  }

  return (
    <div className="max-h-96 space-y-2 overflow-y-auto">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function NotificationItem({
  notification,
  onChanged,
}: {
  notification: Notification;
  onChanged: () => void;
}) {
  async function markAsRead() {
    await fetch(`/api/notifications/${notification.id}/read`, {
      method: "PATCH",
    });
    onChanged();
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{notification.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {notification.body}
          </p>
        </div>
        {notification.status !== "read" ? (
          <span className="mt-1 h-2 w-2 rounded-full bg-black" />
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-3">
        {notification.action_url ? (
          <Link
            href={notification.action_url}
            onClick={() => void markAsRead()}
            className="text-xs font-medium underline"
          >
            {notification.notification_type === "rule_price_condition_met"
              ? "ルールを確認"
              : "開く"}
          </Link>
        ) : null}
        {notification.status !== "read" ? (
          <button
            type="button"
            onClick={() => void markAsRead()}
            className="text-xs text-muted-foreground underline"
          >
            既読にする
          </button>
        ) : null}
        {notification.notification_type === "rule_price_condition_met" ? (
          <>
            <button
              type="button"
              onClick={() => void resolveAlert("kept")}
              className="text-xs text-muted-foreground underline"
            >
              仮説を維持（記録する）
            </button>
            <button
              type="button"
              onClick={() => void resolveAlert("revising")}
              className="text-xs text-muted-foreground underline"
            >
              ルールを見直す
            </button>
          </>
        ) : null}
      </div>
    </div>
  );

  async function resolveAlert(resolution: "kept" | "revising") {
    await fetch(`/api/notifications/${notification.id}/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    });
    onChanged();
    if (resolution === "revising" && notification.action_url) {
      window.location.assign(notification.action_url);
    }
  }
}
