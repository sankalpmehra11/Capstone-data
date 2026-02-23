'use client';

import { ChangeEvent, DragEvent, useEffect, useMemo, useCallback, useState } from 'react';
import Tesseract from 'tesseract.js';
import { CHANNELS, InteractionChannel } from '@/lib/constants';
import { extractKeyFacts, mergeFacts, summarizeText, updateRunningSummary } from '@/lib/memory';
import { supabase } from '@/lib/supabase';
import { KeyFacts } from '@/lib/types';
import { useRequireUser } from '@/lib/useRequireUser';

const emptyFacts: KeyFacts = { emails: [], phoneNumbers: [], companies: [], nextActions: [], dateMentions: [] };

type Interaction = { id: string; occurred_at: string; channel: string; summary: string; raw_capture: string | null };
type PersonRow = { id: string; name: string; cadence_days: number; phone: string | null; whatsapp_phone: string | null };

function isoDate(daysFromNow = 0) {
  const date = new Date(Date.now() + daysFromNow * 86400000);
  return date.toISOString().slice(0, 10);
}

export default function PersonDetailPage({ params }: { params: { id: string } }) {
  const personId = params.id;
  const { user, loading } = useRequireUser();
  const [status, setStatus] = useState('');
  const [processing, setProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [person, setPerson] = useState<PersonRow | null>(null);
  const [channel, setChannel] = useState<InteractionChannel>('message');
  const [memorySummary, setMemorySummary] = useState('');
  const [keyFacts, setKeyFacts] = useState<KeyFacts>(emptyFacts);
  const [interactions, setInteractions] = useState<Interaction[]>([]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  const [confirmOccurredAt, setConfirmOccurredAt] = useState(new Date().toISOString().slice(0, 16));
  const [confirmText, setConfirmText] = useState('');
  const [confirmSummary, setConfirmSummary] = useState('');
  const [confirmTask, setConfirmTask] = useState(false);
  const [confirmTaskDue, setConfirmTaskDue] = useState(isoDate(7));

  const [manualOccurredAt, setManualOccurredAt] = useState(new Date().toISOString().slice(0, 16));
  const [manualRaw, setManualRaw] = useState('');
  const [manualSummary, setManualSummary] = useState('');
  const [manualTask, setManualTask] = useState(false);
  const [manualTaskDue, setManualTaskDue] = useState(isoDate(7));

  const [mediaRecorderSupported, setMediaRecorderSupported] = useState(false);

  useEffect(() => {
    setMediaRecorderSupported(typeof window !== 'undefined' && 'MediaRecorder' in window);
  }, []);

  const keyFactRows = useMemo(
    () => [
      ['Emails', keyFacts.emails],
      ['Phone numbers', keyFacts.phoneNumbers],
      ['Companies', keyFacts.companies],
      ['Next actions', keyFacts.nextActions],
      ['Date mentions', keyFacts.dateMentions]
    ],
    [keyFacts]
  );

  const loadData = useCallback(async () => {
    if (!user) return;

    await supabase.from('people').upsert({ id: personId, user_id: user.id, name: personId, status: 'active', cadence_days: 30 }, { onConflict: 'user_id,id' });

    const [personRes, memoryRes, interactionRes] = await Promise.all([
      supabase.from('people').select('id,name,cadence_days,phone,whatsapp_phone').eq('id', personId).eq('user_id', user.id).single(),
      supabase.from('person_memory').select('running_summary,key_facts_json').eq('user_id', user.id).eq('person_id', personId).maybeSingle(),
      supabase.from('interactions').select('id,occurred_at,channel,summary,raw_capture').eq('person_id', personId).eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(20)
    ]);

    setPerson((personRes.data as PersonRow) ?? null);
    setMemorySummary(memoryRes.data?.running_summary ?? '');
    setKeyFacts((memoryRes.data?.key_facts_json as KeyFacts) ?? emptyFacts);
    setInteractions((interactionRes.data as Interaction[]) ?? []);
  }, [personId, user]);

  useEffect(() => {
    if (!loading && user) loadData();
  }, [loading, user, loadData]);

  async function uploadToStorage(file: File, folder: 'images' | 'audio') {
    if (!user) throw new Error('Please sign in.');
    const ext = file.name.split('.').pop() ?? (folder === 'images' ? 'png' : 'webm');
    const path = `${user.id}/${personId}/${folder}/${crypto.randomUUID()}.${ext}`;
    const result = await supabase.storage.from('evidence').upload(path, file, { upsert: false });
    if (result.error) throw result.error;
    const publicUrl = supabase.storage.from('evidence').getPublicUrl(path).data.publicUrl;
    const insert = await supabase.from('uploads').insert({
      person_id: personId,
      user_id: user.id,
      type: folder === 'images' ? 'image' : 'audio',
      storage_path: path,
      public_url: publicUrl
    }).select('id').single();
    if (insert.error || !insert.data) throw new Error(insert.error?.message ?? 'Failed to create upload row');
    return insert.data.id;
  }

  async function openConfirmForImage(file: File) {
    try {
      setProcessing(true);
      setStatus('Uploading image...');
      const uploadId = await uploadToStorage(file, 'images');
      setPendingUploadId(uploadId);
      setStatus('Running OCR...');
      const result = await Tesseract.recognize(file, 'eng');
      const text = result.data.text || '';
      setConfirmText(text);
      setConfirmSummary(summarizeText(text).slice(0, 160));
      setConfirmOpen(true);
      setStatus('OCR complete. Confirm interaction.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setProcessing(false);
    }
  }

  async function recordVoiceNote() {
    if (!mediaRecorderSupported) {
      setStatus('MediaRecorder not supported. Use audio file upload fallback.');
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.start();
    setStatus('Recording... 4 seconds');

    setTimeout(async () => {
      recorder.stop();
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        try {
          const uploadId = await uploadToStorage(file, 'audio');
          await supabase.from('extractions').insert({ upload_id: uploadId, user_id: user?.id, extracted_text: 'TRANSCRIPTION_NOT_CONFIGURED' });
          setConfirmText('TRANSCRIPTION_NOT_CONFIGURED');
          setConfirmSummary('Voice note captured. Add summary manually.');
          setPendingUploadId(uploadId);
          setConfirmOpen(true);
          setStatus('Voice note saved. Add summary to continue.');
        } catch (error) {
          setStatus(error instanceof Error ? error.message : 'Audio upload failed.');
        }
      };
    }, 4000);
  }

  async function audioFileFallback(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    try {
      const uploadId = await uploadToStorage(file, 'audio');
      setPendingUploadId(uploadId);
      setConfirmText('TRANSCRIPTION_NOT_CONFIGURED');
      setConfirmSummary('Voice note uploaded. Add summary manually.');
      setConfirmOpen(true);
    } finally {
      setProcessing(false);
    }
  }

  async function persistInteraction(rawText: string, summary: string, occurredAtIso: string, createTask: boolean, dueDate: string) {
    if (!user) return;
    const occurredAt = new Date(occurredAtIso).toISOString();
    const interactionInsert = await supabase.from('interactions').insert({
      person_id: personId,
      user_id: user.id,
      occurred_at: occurredAt,
      channel,
      raw_capture: rawText,
      summary: summary || summarizeText(rawText)
    }).select('id').single();

    if (interactionInsert.error) {
      setStatus(interactionInsert.error.message);
      return;
    }

    if (pendingUploadId) {
      await supabase.from('extractions').insert({
        upload_id: pendingUploadId,
        user_id: user.id,
        extracted_text: rawText
      });
    }

    const memorySelect = await supabase.from('person_memory').select('running_summary,key_facts_json').eq('user_id', user.id).eq('person_id', personId).maybeSingle();
    const nextSummary = updateRunningSummary(memorySelect.data?.running_summary ?? '', rawText);
    const nextFacts = mergeFacts(memorySelect.data?.key_facts_json as KeyFacts | null, extractKeyFacts(rawText));

    await supabase.from('person_memory').upsert({
      user_id: user.id,
      person_id: personId,
      running_summary: nextSummary,
      key_facts_json: nextFacts,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,person_id' });

    if (createTask) {
      await supabase.from('tasks').insert({
        user_id: user.id,
        person_id: personId,
        title: `Follow up with ${person?.name ?? personId}`,
        due_date: dueDate,
        status: 'open'
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const nextTouchDate = createTask ? dueDate : isoDate(person?.cadence_days ?? 30);
    await supabase.from('people').update({ last_contacted: today, next_touch_date: nextTouchDate }).eq('id', personId).eq('user_id', user.id);

    setConfirmOpen(false);
    setPendingUploadId(null);
    setManualRaw('');
    setManualSummary('');
    await loadData();
    setStatus('Interaction saved.');
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    await openConfirmForImage(file);
  };

  if (loading) return <main className="p-4">Loading...</main>;

  const whatsappLink = person?.whatsapp_phone ? `https://wa.me/${person.whatsapp_phone}?text=${encodeURIComponent('Quick follow up from Personal CRM')}` : null;
  const smsLink = person?.phone ? `sms:${person.phone}?&body=${encodeURIComponent('Hey, checking in!')}` : null;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold">{person?.name ?? personId}</h1>
        <p className="text-sm text-slate-500">Upload evidence or add interaction manually.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {whatsappLink && <a href={whatsappLink} target="_blank" className="rounded border px-2 py-1 text-sm" rel="noreferrer">WhatsApp</a>}
          {smsLink && <a href={smsLink} className="rounded border px-2 py-1 text-sm">SMS/iMessage</a>}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">Upload evidence</h2>
          <label className="mt-3 block text-sm">Channel</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value as InteractionChannel)} className="mt-1 w-full rounded border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-950">
            {CHANNELS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <div
            onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`mt-3 rounded-xl border-2 border-dashed p-5 text-center text-sm ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-slate-800' : 'border-slate-300 dark:border-slate-700'}`}
          >
            Drag & drop screenshot here (desktop)
            <div className="mt-3">
              <label className="inline-block cursor-pointer rounded bg-blue-600 px-3 py-2 text-white">
                Choose screenshot (mobile/desktop)
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && openConfirmForImage(e.target.files[0])} />
              </label>
            </div>
          </div>

          <div className="mt-3 space-y-2 rounded border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-sm font-medium">Voice note (optional MVP)</p>
            <button onClick={recordVoiceNote} className="rounded bg-emerald-600 px-3 py-2 text-sm text-white">Record 4s voice note</button>
            <label className="ml-2 inline-block cursor-pointer rounded border px-3 py-2 text-sm">Upload audio fallback
              <input type="file" accept="audio/*" className="hidden" onChange={audioFileFallback} />
            </label>
            <p className="text-xs text-slate-500">Transcription is optional. You can always type summary manually.</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">Add interaction (type)</h2>
          <div className="mt-3 space-y-2">
            <input type="datetime-local" value={manualOccurredAt} onChange={(e) => setManualOccurredAt(e.target.value)} className="w-full rounded border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-950" />
            <textarea value={manualRaw} onChange={(e) => setManualRaw(e.target.value)} rows={4} placeholder="Notes / raw text" className="w-full rounded border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-950" />
            <input value={manualSummary} onChange={(e) => setManualSummary(e.target.value)} placeholder="Summary" className="w-full rounded border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-950" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={manualTask} onChange={(e) => setManualTask(e.target.checked)} /> Create follow-up task</label>
            {manualTask && <input type="date" value={manualTaskDue} onChange={(e) => setManualTaskDue(e.target.value)} className="w-full rounded border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-950" />}
            <button disabled={processing} onClick={() => persistInteraction(manualRaw, manualSummary, manualOccurredAt, manualTask, manualTaskDue)} className="rounded bg-slate-900 px-3 py-2 text-sm text-white dark:bg-slate-100 dark:text-slate-900">Save interaction</button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">Memory</h2>
          <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm dark:bg-slate-950">{memorySummary || 'No memory yet.'}</pre>
          <div className="mt-3 space-y-1 text-sm">
            {keyFactRows.map(([label, values]) => (
              <p key={label as string}><span className="font-medium">{label}: </span>{(values as string[]).length ? (values as string[]).join(', ') : '—'}</p>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">Recent interactions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {interactions.map((item) => (
              <li key={item.id} className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <p className="font-medium">{new Date(item.occurred_at).toLocaleString()} · {item.channel}</p>
                <p>{item.summary}</p>
              </li>
            ))}
            {!interactions.length && <li className="text-slate-500">No interactions yet.</li>}
          </ul>
        </div>
      </section>

      {status && <p className="text-sm text-slate-600 dark:text-slate-300">{status}</p>}

      {confirmOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 dark:bg-slate-900">
            <h3 className="font-semibold">Confirm interaction</h3>
            <label className="mt-2 block text-sm">Occurred at</label>
            <input type="datetime-local" value={confirmOccurredAt} onChange={(e) => setConfirmOccurredAt(e.target.value)} className="mt-1 w-full rounded border p-2 dark:border-slate-700 dark:bg-slate-950" />
            <label className="mt-2 block text-sm">Extracted text (editable)</label>
            <textarea rows={5} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1 w-full rounded border p-2 dark:border-slate-700 dark:bg-slate-950" />
            <label className="mt-2 block text-sm">Summary</label>
            <input value={confirmSummary} onChange={(e) => setConfirmSummary(e.target.value)} className="mt-1 w-full rounded border p-2 dark:border-slate-700 dark:bg-slate-950" />
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmTask} onChange={(e) => setConfirmTask(e.target.checked)} /> Create follow-up task</label>
            {confirmTask && <input type="date" value={confirmTaskDue} onChange={(e) => setConfirmTaskDue(e.target.value)} className="mt-1 w-full rounded border p-2 dark:border-slate-700 dark:bg-slate-950" />}
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} className="rounded border px-3 py-2 text-sm">Cancel</button>
              <button onClick={() => persistInteraction(confirmText, confirmSummary, confirmOccurredAt, confirmTask, confirmTaskDue)} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">Confirm & save</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
