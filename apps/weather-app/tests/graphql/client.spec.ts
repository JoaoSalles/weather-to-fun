import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rankActivities, getLocationName, GQL_URL } from '../../app/graphql/client';
import { RANK_ACTIVITIES, GET_LOCATION_NAME } from '../../app/graphql/operations';

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

  // it does not test the actuall query, just that the client forwards the options as query variables
  it('forwards field-toggle options as query variables', async () => {
    requestMock.mockResolvedValueOnce({ rankActivities: { location: { name: 'London' }, rankings: [] } });

    await rankActivities('London', { includeLocationDetails: false, includeWeather: false });

    expect(requestMock).toHaveBeenCalledWith(GQL_URL, RANK_ACTIVITIES, {
      city: 'London',
      includeLocationDetails: false,
      includeWeather: false,
    });
  });

  it('propagates errors thrown by graphql-request', async () => {
    requestMock.mockRejectedValueOnce(new Error('City not found'));
    await expect(rankActivities('Nowhere')).rejects.toThrow('City not found');
  });
});

describe('getLocationName client', () => {
  beforeEach(() => requestMock.mockReset());

  it('calls graphql-request with the GET_LOCATION_NAME document and returns the location', async () => {
    const location = { name: 'London' };
    requestMock.mockResolvedValueOnce({ rankActivities: { location } });

    const result = await getLocationName('London');

    expect(requestMock).toHaveBeenCalledWith(GQL_URL, GET_LOCATION_NAME, { city: 'London' });
    expect(result).toBe(location);
  });
});
