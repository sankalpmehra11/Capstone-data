import { KeyFacts } from './types';

const monthWords = /(january|february|march|april|may|june|july|august|september|october|november|december)/i;

export function summarizeText(input: string): string {
  const cleaned = input.replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 180);
}

export function extractKeyFacts(input: string): KeyFacts {
  const emails = [...new Set(input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])];
  const phoneNumbers = [...new Set(input.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/g) ?? [])];
  const companyMatches = [...input.matchAll(/\b(?:at|from)\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*)*)/g)].map((m) => m[1]);
  const lines = input.split('\n').map((line) => line.trim()).filter(Boolean);
  const nextActions = lines.filter((line) => /(send|share|follow up|remind|check|intro)/i.test(line));
  const dateMentions = [
    ...lines.filter((line) => /(tomorrow|next week)/i.test(line)),
    ...lines.filter((line) => monthWords.test(line))
  ];

  return {
    emails,
    phoneNumbers,
    companies: [...new Set(companyMatches)],
    nextActions: [...new Set(nextActions)],
    dateMentions: [...new Set(dateMentions)]
  };
}

export function mergeFacts(current: KeyFacts | null, incoming: KeyFacts): KeyFacts {
  return {
    emails: [...new Set([...(current?.emails ?? []), ...incoming.emails])],
    phoneNumbers: [...new Set([...(current?.phoneNumbers ?? []), ...incoming.phoneNumbers])],
    companies: [...new Set([...(current?.companies ?? []), ...incoming.companies])],
    nextActions: [...new Set([...(current?.nextActions ?? []), ...incoming.nextActions])].slice(-20),
    dateMentions: [...new Set([...(current?.dateMentions ?? []), ...incoming.dateMentions])].slice(-20)
  };
}

export function updateRunningSummary(currentSummary: string | null, extractedText: string): string {
  const entry = `- ${new Date().toISOString().slice(0, 10)}: ${summarizeText(extractedText)}`;
  const currentBullets = (currentSummary ?? '').split('\n').filter((b) => b.trim().startsWith('- '));
  return [entry, ...currentBullets].slice(0, 20).join('\n');
}

export function followUpSuggestion(text: string): { title: string; dueDate: string } | null {
  if (!/(follow up|checking in|let me know|circling back|remind)/i.test(text)) {
    return null;
  }
  const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { title: 'Follow up based on new evidence', dueDate: due };
}
