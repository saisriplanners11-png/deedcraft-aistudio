import { describe, expect, it } from 'vitest';
import { droppedFileError } from './file-drop-zone';

const file = (name: string, type = '') => ({ name, type });
describe('Dropped file validation', () => {
  it('accepts the advertised extensions case-insensitively', () => {
    expect(droppedFileError([file('GPA.PDF'), file('attorney.JPG')], '.pdf,.jpg', true)).toBe('');
  });
  it('accepts MIME types and images with missing MIME metadata', () => {
    expect(droppedFileError([file('scan', 'image/png'), file('photo.JPEG')], 'image/*', true)).toBe('');
    expect(droppedFileError([file('backup.json', 'application/json')], 'application/json', false)).toBe('');
  });
  it('rejects files outside the picker filter, including mixed valid/invalid batches', () => {
    expect(droppedFileError([file('template.docx'), file('program.exe')], '.docx', true)).toMatch(/supported file/);
    expect(droppedFileError([file('data.json')], 'image/*', false)).toMatch(/supported file/);
  });
  it('rejects multiple files on single-file uploads instead of silently discarding files', () => {
    expect(droppedFileError([file('one.pdf'), file('two.pdf')], '.pdf', false)).toMatch(/one file/);
    expect(droppedFileError([file('one.pdf'), file('two.pdf')], '.pdf', true)).toBe('');
  });
  it('allows an unrestricted picker', () => {
    expect(droppedFileError([file('anything.bin')], '', false)).toBe('');
  });
});
