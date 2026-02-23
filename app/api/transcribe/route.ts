import { NextResponse } from 'next/server';

async function transcribeAudio(_file: File): Promise<string> {
  return 'TRANSCRIPTION_NOT_CONFIGURED';
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing audio file' }, { status: 400 });
  }

  const text = await transcribeAudio(file);

  return NextResponse.json({
    text,
    message:
      'Transcription provider is not configured. To enable real transcription, wire transcribeAudio() to whisper.cpp or a hosted API provider.'
  });
}
