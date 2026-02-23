'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import Tesseract from 'tesseract.js';
import { TaskSuggestionModal } from '@/components/TaskSuggestionModal';
import { extractKeyFacts, followUpSuggestion, summarizeText, mergeFacts, updateRunningSummary } from '@/lib/memory';
import { supabase } from '@/lib/supabase';
import { KeyFacts, UploadType } from '@/lib/types';

const emptyFacts: KeyFacts = { emails: [], phoneNumbers: [], companies: [], nextActions: [], dateMentions: [] };

export default function PersonDetailPage({ params }: { params: { id: string } }) {
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('sms');
  const [memorySummary, setMemorySummary] = useState('');
  const [keyFacts, setKeyFacts] = useState<KeyFacts>(emptyFacts);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  const personId = params.id;

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

  async function saveTaskDraft(title: string, dueDate: string) {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('tasks').insert({
      user_id: user.id,
      person_id: personId,
      title,
      due_date: dueDate,
      status: 'draft'
    });

    setTaskOpen(false);
    setStatus('Task draft saved.');
  }

  async function handleFileUpload(file: File, uploadType: UploadType) {
    setStatus('Uploading evidence...');
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setStatus('Please sign in before uploading evidence.');
      return;
    }

    const path = `${user.id}/${personId}/${Date.now()}-${file.name}`;
    const uploadResult = await supabase.storage.from('evidence').upload(path, file, { upsert: false });

    if (uploadResult.error) {
      setStatus(uploadResult.error.message);
      return;
    }

    const publicUrl = supabase.storage.from('evidence').getPublicUrl(path).data.publicUrl;

    const uploadInsert = await supabase
      .from('uploads')
      .insert({ person_id: personId, user_id: user.id, type: uploadType, storage_path: path, public_url: publicUrl })
      .select('id')
      .single();

    if (uploadInsert.error || !uploadInsert.data) {
      setStatus(uploadInsert.error?.message ?? 'Failed to create upload record.');
      return;
    }

    const extractedText =
      uploadType === 'image' ? await runOcr(file) : await runTranscription(file);

    await persistExtractionAndMemory(uploadInsert.data.id, extractedText, user.id);
  }

  async function runOcr(file: File): Promise<string> {
    setStatus('Running OCR with tesseract.js...');
    const result = await Tesseract.recognize(file, 'eng');
    return result.data.text || '';
  }

  async function runTranscription(file: File): Promise<string> {
    setStatus('Transcribing voice note...');
    const body = new FormData();
    body.append('file', file);
    const response = await fetch('/api/transcribe', { method: 'POST', body });
    const data = await response.json();
    return data.text ?? 'TRANSCRIPTION_NOT_CONFIGURED';
  }

  async function persistExtractionAndMemory(uploadId: string, extractedText: string, userId: string) {
    const extractionInsert = await supabase
      .from('extractions')
      .insert({ upload_id: uploadId, user_id: userId, extracted_text: extractedText })
      .select('id')
      .single();

    if (extractionInsert.error) {
      setStatus(extractionInsert.error.message);
      return;
    }

    const interactionSummary = summarizeText(extractedText) || 'Captured evidence';
    await supabase.from('interactions').insert({
      person_id: personId,
      user_id: userId,
      occurred_at: new Date().toISOString(),
      channel,
      summary: interactionSummary,
      raw_capture: extractedText
    });

    const memorySelect = await supabase
      .from('person_memory')
      .select('running_summary,key_facts_json')
      .eq('person_id', personId)
      .maybeSingle();

    const incomingFacts = extractKeyFacts(extractedText);
    const nextSummary = updateRunningSummary(memorySelect.data?.running_summary ?? null, extractedText);
    const nextFacts = mergeFacts(memorySelect.data?.key_facts_json as KeyFacts | null, incomingFacts);

    const memoryUpsert = await supabase.from('person_memory').upsert(
      {
        person_id: personId,
        user_id: userId,
        running_summary: nextSummary,
        key_facts_json: nextFacts,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'person_id' }
    );

    if (memoryUpsert.error) {
      setStatus(memoryUpsert.error.message);
      return;
    }

    setMemorySummary(nextSummary);
    setKeyFacts(nextFacts);

    const suggestion = followUpSuggestion(extractedText);
    if (suggestion) {
      setTaskTitle(suggestion.title);
      setTaskDueDate(suggestion.dueDate);
      setTaskOpen(true);
    }

    setStatus('Evidence processed and context memory updated.');
  }

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleFileUpload(file, 'image');
  };

  const handleAudioSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleFileUpload(file, 'audio');
  };

  return (
    <main className="mx-auto max-w-xl space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Person: {personId}</h1>
      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Add Evidence</h2>
        <p className="mt-1 text-sm text-slate-600">Upload screenshots or voice notes from your phone.</p>

        <label className="mt-4 block text-sm font-medium">Interaction channel</label>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 w-full rounded border p-2">
          <option value="sms">SMS</option>
          <option value="email">Email</option>
          <option value="call">Call</option>
          <option value="other">Other</option>
        </select>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="cursor-pointer rounded bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white">
            Upload Screenshot
            <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </label>
          <label className="cursor-pointer rounded bg-emerald-600 px-4 py-3 text-center text-sm font-medium text-white">
            Upload Voice Note
            <input type="file" accept="audio/*" className="hidden" onChange={handleAudioSelect} />
          </label>
        </div>
        {status && <p className="mt-3 text-sm text-slate-700">{status}</p>}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Context you have with this person</h2>
        <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm">{memorySummary || 'No memory yet.'}</pre>
        <div className="mt-4 space-y-2 text-sm">
          {keyFactRows.map(([label, values]) => (
            <div key={label as string}>
              <span className="font-medium">{label}: </span>
              <span>{(values as string[]).length ? (values as string[]).join(', ') : '—'}</span>
            </div>
          ))}
        </div>
      </section>

      <TaskSuggestionModal
        open={taskOpen}
        title={taskTitle}
        dueDate={taskDueDate}
        onClose={() => setTaskOpen(false)}
        onSave={saveTaskDraft}
        setTitle={setTaskTitle}
        setDueDate={setTaskDueDate}
      />
    </main>
  );
}
