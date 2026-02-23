'use client';

type Props = {
  open: boolean;
  title: string;
  dueDate: string;
  onClose: () => void;
  onSave: (title: string, dueDate: string) => Promise<void>;
  setTitle: (value: string) => void;
  setDueDate: (value: string) => void;
};

export function TaskSuggestionModal({ open, title, dueDate, onClose, onSave, setTitle, setDueDate }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg">
        <h3 className="text-lg font-semibold">Suggested follow-up task</h3>
        <p className="mt-1 text-sm text-slate-600">Edit before saving.</p>
        <label className="mt-3 block text-sm font-medium">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border p-2" />
        <label className="mt-3 block text-sm font-medium">Due date</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded border p-2" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-2 text-sm">Cancel</button>
          <button onClick={() => onSave(title, dueDate)} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">Save Task</button>
        </div>
      </div>
    </div>
  );
}
