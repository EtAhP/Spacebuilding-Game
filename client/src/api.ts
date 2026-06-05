const API = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error ?? 'Request failed');
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean; llmEnabled: boolean }>('/health'),
  listEmpires: () => request<Array<{ id: string; empireName: string; tick: number }>>('/empires'),
  createEmpire: (empireName: string, playerName: string) =>
    request<import('@spacebuilding/shared').EmpireState>('/empires', {
      method: 'POST',
      body: JSON.stringify({ empireName, playerName }),
    }),
  getEmpire: (id: string) => request<import('@spacebuilding/shared').EmpireState>(`/empires/${id}`),
  resumeEmpire: (id: string) =>
    request<{ state: import('@spacebuilding/shared').EmpireState; report: import('@spacebuilding/shared').OfflineReport }>(
      `/empires/${id}/resume`,
      { method: 'POST' },
    ),
  tick: (id: string, count = 1) =>
    request<{ state: import('@spacebuilding/shared').EmpireState; events: string[] }>(
      `/empires/${id}/tick`,
      { method: 'POST', body: JSON.stringify({ count }) },
    ),
  action: (id: string, action: import('@spacebuilding/shared').GameAction) =>
    request<{ state: import('@spacebuilding/shared').EmpireState; ok: boolean; summary: string }>(
      `/empires/${id}/actions`,
      { method: 'POST', body: JSON.stringify({ action }) },
    ),
  patchCompanion: (id: string, patch: Partial<import('@spacebuilding/shared').CompanionConfig>) =>
    request<import('@spacebuilding/shared').EmpireState>(`/empires/${id}/companion`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  chat: (id: string, message: string) =>
    request<{
      state: import('@spacebuilding/shared').EmpireState;
      response: { message: string; usedLlm: boolean; actions: import('@spacebuilding/shared').GameAction[] };
    }>(`/empires/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};
