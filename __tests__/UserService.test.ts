import { UserService } from '../src/services/UserService';

describe('UserService.upgradeUserToPremium', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('uses JWT auth first and falls back to admin bearer on auth failure', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
      }) as unknown as typeof fetch;

    const result = await UserService.upgradeUserToPremium(
      'user-1',
      'aaa.bbb.ccc',
    );

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.theorytestbangla.co.uk/api/admin/users/user-1/role',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer aaa.bbb.ccc',
        }),
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.theorytestbangla.co.uk/api/admin/users/user-1/role',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer theorytestbangla.admin.superaccess',
        }),
      }),
    );
  });

  test('marks 500 errors as retryable', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Server error',
    }) as unknown as typeof fetch;

    const result = await UserService.upgradeUserToPremium('user-2', null);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.statusCode).toBe(500);
  });

  test('marks network failures as retryable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network down')) as unknown as typeof fetch;

    const result = await UserService.upgradeUserToPremium('user-3', null);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.message).toContain('Network down');
  });
});