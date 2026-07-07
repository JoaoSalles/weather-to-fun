import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rankActivities, GQL_URL } from '../../app/graphql/client';
import { RANK_ACTIVITIES } from '../../app/graphql/operations';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('graphql-request', () => ({ request: requestMock }));

describe('rankActivities client', () => {
  beforeEach(() => requestMock.mockReset());

  it('defaults GQL_URL to localhost:4000', () => {
    expect(GQL_URL).toBe('http://localhost:4000/');
  });

  it('calls graphql-request with the document and variables and returns rankActivities', async () => {
    const payload = { location: { name: 'London' }, rankings: [] };
    requestMock.mockResolvedValueOnce({ rankActivities: payload });

    const result = await rankActivities('London');

    expect(requestMock).toHaveBeenCalledWith(GQL_URL, RANK_ACTIVITIES, { city: 'London' });
    expect(result).toBe(payload);
  });

  it('propagates errors thrown by graphql-request', async () => {
    requestMock.mockRejectedValueOnce(new Error('City not found'));
    await expect(rankActivities('Nowhere')).rejects.toThrow('City not found');
  });
});
