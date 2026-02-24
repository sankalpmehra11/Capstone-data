function toIcsDate(value: string) {
  const date = new Date(value);
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${date.getUTCDate()}`.padStart(2, '0');
  return `${y}${m}${d}`;
}

export function taskToIcs(title: string, dueDate: string, description = '') {
  const uid = `${crypto.randomUUID()}@personal-crm`;
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
  const dtstart = toIcsDate(dueDate);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PersonalCRM//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `SUMMARY:${title.replace(/\n/g, ' ')}`,
    `DESCRIPTION:${description.replace(/\n/g, ' ')}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}
