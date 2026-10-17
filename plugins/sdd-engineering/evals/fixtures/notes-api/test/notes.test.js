import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createNote, getNote, listNotes, resetNotes, ValidationError } from '../src/notes.js';

beforeEach(() => resetNotes());

test('creates a note with a trimmed title', () => {
  const note = createNote({ title: '  Hello ', body: 'x' });
  assert.equal(note.title, 'Hello');
  assert.deepEqual(getNote(note.id), note);
});

test('rejects an empty title', () => {
  assert.throws(() => createNote({ title: ' ' }), ValidationError);
});

test('lists notes', () => {
  createNote({ title: 'a' });
  createNote({ title: 'b' });
  assert.equal(listNotes().length, 2);
});
