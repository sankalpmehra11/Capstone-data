'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [message, setMessage] = useState('');

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      setMessage('Browser notifications are not supported on this device.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setMessage('Notifications enabled. We currently use in-app reminders and local browser notifications.');
      new Notification('Personal CRM', { body: 'Notifications are enabled.' });
    } else {
      setMessage('Notifications were not enabled.');
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Android and desktop are fully supported. iOS can be added later with push service worker integration.</p>
        <button onClick={enableNotifications} className="mt-3 rounded bg-blue-600 px-4 py-2 text-white">Enable notifications</button>
        {message && <p className="mt-3 text-sm">{message}</p>}
      </section>
    </main>
  );
}
