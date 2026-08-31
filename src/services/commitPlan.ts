// Phase E commit (FR-24..FR-28): persist the reviewed tasks locally,
// then hand them to the configured calendar/reminder services.
// External delivery lives in src/providers; without a configured
// service the tasks are simply kept in the app (still fully usable).

import type { GeneratedTask } from '../domain/planning';
import type { Task } from '../domain/types';
import { useDataStore } from '../store/dataStore';
import { usePlanningSession } from '../store/planningSession';

export interface CommitResult {
  created: number;
  /** Filled in by the provider layer (FR-25/FR-27); 0 when not configured. */
  calendarEvents: number;
  reminders: number;
  /** Per-task delivery failures — surfaced to the user, never swallowed. */
  pushErrors: string[];
}

export async function commitPlan(generated: GeneratedTask[]): Promise<CommitResult> {
  const store = useDataStore.getState();

  // Resolve tag names to Tag records; new tags join the batch's category
  // (FR-6). Tags without a category land in "Uncategorized" (DR-4 requires
  // every tag to belong to exactly one category).
  let fallbackCategoryId: string | null = null;
  const fallbackCategory = () => {
    if (!fallbackCategoryId) {
      const existing = Object.values(store.categories).find(
        (c) => !c._deleted && c.name === 'Uncategorized'
      );
      fallbackCategoryId = existing ? existing.id : store.createCategory('Uncategorized').id;
    }
    return fallbackCategoryId;
  };

  const tagIdsFor = (t: GeneratedTask): string[] =>
    t.tagNames.map((name) => store.findOrCreateTag(name, t.categoryId ?? fallbackCategory()).id);

  const planningSessionId = usePlanningSession.getState().cloudId;
  const toTaskSpec = (t: GeneratedTask): Omit<Task, 'id'> => ({
    planningSessionId,
    description: t.description,
    completed: false, // FR-8
    taskType: t.taskType,
    priority: t.priority,
    tagIds: tagIdsFor(t),
    notes: t.notes,
    hours: t.hours,
    dueDate: t.dueDate,
    startDate: t.startDate ?? null,
    startTime: t.startTime ?? null,
    externalLink: null,
    parentTaskId: null,
  });

  // Two passes so preparation/follow-up tasks can reference their parent's id.
  const parents = generated.filter((t) => !t.parentLocalId);
  const children = generated.filter((t) => t.parentLocalId);

  const createdParents = store.createTasks(parents.map(toTaskSpec));
  const idByLocal = new Map(parents.map((t, i) => [t.localId, createdParents[i].id]));

  const createdChildren = useDataStore.getState().createTasks(
    children.map((t) => ({ ...toTaskSpec(t), parentTaskId: idByLocal.get(t.parentLocalId!) ?? null }))
  );

  // FR-25..FR-28: deliver to external services (no-op until configured).
  const { pushTasksToServices } = await import('../providers/push');
  const pushed = await pushTasksToServices([...createdParents, ...createdChildren]);

  return {
    created: createdParents.length + createdChildren.length,
    calendarEvents: pushed.calendarEvents,
    reminders: pushed.reminders,
    pushErrors: pushed.errors,
  };
}
