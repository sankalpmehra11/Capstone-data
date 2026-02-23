export type UploadType = 'image' | 'audio';

export type KeyFacts = {
  emails: string[];
  phoneNumbers: string[];
  companies: string[];
  nextActions: string[];
  dateMentions: string[];
};

export type PersonMemory = {
  running_summary: string;
  key_facts_json: KeyFacts;
};
