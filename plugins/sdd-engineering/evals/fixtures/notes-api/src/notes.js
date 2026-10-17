const notes = new Map();
let nextId = 1;

export function listNotes() {
  return [...notes.values()];
}

export function createNote({ title, body }) {
  if (typeof title !== 'string' || title.trim() === '') {
    throw new ValidationError('title is required');
  }
  const note = { id: nextId++, title: title.trim(), body: body ?? '', createdAt: new Date().toISOString() };
  notes.set(note.id, note);
  return note;
}

export function getNote(id) {
  return notes.get(id) ?? null;
}

export function resetNotes() {
  notes.clear();
  nextId = 1;
}

export class ValidationError extends Error {}
