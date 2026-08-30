// Microsoft To Do via Microsoft Graph (IF-1/IF-2). Tasks land in the
// user's default list; the task URL is derived from its id (FR-28).

import type { ReminderProvider } from '../types';
import { getAccessToken, MICROSOFT_OAUTH } from '../oauth';
import { fetchWithTimeout } from '../http';

let defaultListId: string | null = null;

async function getDefaultListId(token: string): Promise<string> {
  if (defaultListId) return defaultListId;
  const res = await fetchWithTimeout('https://graph.microsoft.com/v1.0/me/todo/lists', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Microsoft To Do: ${res.status} ${await res.text()}`);
  const lists = (await res.json()) as { value: { id: string; wellknownListName?: string }[] };
  const list = lists.value.find((l) => l.wellknownListName === 'defaultList') ?? lists.value[0];
  if (!list) throw new Error('Microsoft To Do: no task list found.');
  defaultListId = list.id;
  return list.id;
}

export const microsoftTodoReminderProvider: ReminderProvider = {
  async createReminder(spec) {
    const token = await getAccessToken(MICROSOFT_OAUTH);
    const listId = await getDefaultListId(token);
    const res = await fetchWithTimeout(
      `https://graph.microsoft.com/v1.0/me/todo/lists/${encodeURIComponent(listId)}/tasks`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: spec.title,
          body: { contentType: 'text', content: spec.notes },
        }),
      }
    );
    if (!res.ok) throw new Error(`Microsoft To Do: ${res.status} ${await res.text()}`);
    const task = (await res.json()) as { id: string };
    return { url: `https://to-do.office.com/tasks/id/${task.id}/details`, id: task.id };
  },
};
