import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, FileText, X, Clock, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { NotificationItem } from '../types';
import { fetchUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../services/api';

interface NotificationPopoverProps {
  userId: string;
  isDarkMode?: boolean;
  onOpenLeaveModal?: (leaveId?: string) => void;
  onNotificationsUpdated?: () => void;
}

export const NotificationPopover: React.FC<NotificationPopoverProps> = ({
  userId,
  isDarkMode = false,
  onOpenLeaveModal,
  onNotificationsUpdated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    if (!userId) return;
    try {
      const data = await fetchUserNotifications(userId);
      setNotifications(data || []);
      if (onNotificationsUpdated) onNotificationsUpdated();
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [userId]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      try {
        await markNotificationAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === notif.id ? { ...item, isRead: true } : item))
        );
      } catch (e) {
        console.error('Failed to mark notification read:', e);
      }
    }
    setIsOpen(false);
    if ((notif.type === 'LEAVE_REQUEST' || notif.type === 'LEAVE_STATUS_UPDATE') && onOpenLeaveModal) {
      onOpenLeaveModal(notif.relatedId);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await markAllNotificationsAsRead(userId);
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (e) {
      console.error('Failed to mark all read:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    return `${diffDays} วันที่แล้ว`;
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Notification Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="แจ้งเตือน"
        className={`relative p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${
          isDarkMode
            ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700'
            : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shadow-sm'
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-extrabold text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl border z-50 overflow-hidden backdrop-blur-md transition-all ${
            isDarkMode
              ? 'bg-slate-900/95 border-slate-800 text-slate-100'
              : 'bg-white/95 border-slate-200 text-slate-800'
          }`}
        >
          {/* Header */}
          <div
            className={`p-4 border-b flex items-center justify-between ${
              isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/80'
            }`}
          >
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Bell className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-sm">การแจ้งเตือน</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  ใหม่ {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={loading}
                  className="p-1.5 text-xs font-bold text-sky-600 hover:text-sky-500 dark:text-sky-400 flex items-center space-x-1 rounded-lg hover:bg-sky-500/10 transition-colors"
                  title="ทำเครื่องหมายอ่านแล้วทั้งหมด"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">อ่านแล้วทั้งหมด</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                <Bell className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-600" />
                <p>ไม่มีการแจ้งเตือนในขณะนี้</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 transition-all cursor-pointer flex items-start space-x-3 hover:bg-sky-500/5 ${
                    !n.isRead
                      ? isDarkMode
                        ? 'bg-slate-800/60'
                        : 'bg-sky-50/50'
                      : ''
                  }`}
                >
                  {/* Notification Type Icon */}
                  <div className="shrink-0 mt-0.5">
                    {n.type === 'LEAVE_REQUEST' ? (
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <FileText className="w-4 h-4" />
                      </div>
                    ) : n.type === 'LEAVE_STATUS_UPDATE' ? (
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        <Info className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Body Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between space-x-2">
                      <p className={`text-xs font-bold truncate ${!n.isRead ? 'text-sky-600 dark:text-sky-400 font-extrabold' : ''}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0"></span>
                      )}
                    </div>

                    <p className={`text-xs mt-0.5 line-clamp-2 leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      {n.message}
                    </p>

                    <div className="flex items-center space-x-1 mt-1.5 text-[10px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(n.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
