import { describe, expect, it } from 'vitest';
import { resolveProjectSelection, trustedPrivateFilePath, withProjectScope } from '../projectScope';

describe('project selection', () => {
  it('keeps detail IDs, filters and hashes while making project scope shareable', () => {
    expect(withProjectScope('/submitter/inspections?inspectionId=one&search=column#details', 'a'))
      .toBe('/submitter/inspections?inspectionId=one&search=column&projectId=a#details');
  });
  it('never turns a project navigation into an external link', () => {
    expect(() => withProjectScope('https://outside.invalid/path', 'a')).toThrow();
  });
  const projects = [{ id: 'a' }, { id: 'b' }];
  it('validates URL scope before the saved selection', () => {
    expect(resolveProjectSelection(projects, 'b', 'a')).toBe('b');
    expect(resolveProjectSelection(projects, 'unknown', 'a')).toBeNull();
    expect(resolveProjectSelection(projects, null, 'a')).toBe('a');
  });
  it('drops a revoked project and never selects a different project implicitly', () => {
    expect(resolveProjectSelection([{ id: 'b' }], null, 'a')).toBeNull();
    expect(resolveProjectSelection(projects, null, null)).toBeNull();
  });
});

describe('private file trust boundary', () => {
  it('only permits the authenticated API file routes', () => {
    expect(trustedPrivateFilePath('/api/drawings/files/a.pdf')).toBe('/drawings/files/a.pdf');
    expect(trustedPrivateFilePath('/api/inspections/attachments/files/a%20b.png')).toBe('/inspections/attachments/files/a%20b.png');
  });
  it.each(['https://evil.test/api/drawings/files/a.pdf', '//evil.test/a', 'data:image/png;base64,eA==', 'blob:abc', '/uploads/a.pdf',
    '/api/drawings/files/%2e%2e', '/api/drawings/files/a%2fb.pdf', '/api/drawings/files/a.pdf?token=secret', '/api/drawings/files/a.pdf#part'])('rejects %s before a token is attached', url => {
    expect(() => trustedPrivateFilePath(url)).toThrow();
  });
});
