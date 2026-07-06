import { GET } from './route';

describe('GET /api/hello', () => {
  it('returns the generator default greeting', async () => {
    const response = await GET(new Request('http://localhost/api/hello'));

    expect(await response.text()).toBe('Hello, from API!');
  });
});
