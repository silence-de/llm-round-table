import { nanoid } from 'nanoid';

export interface UserInterjection {
  id: string;
  content: string;
  createdAt: number;
  phaseHint?: string;
  roundHint?: number;
}

const queues = new Map<string, UserInterjection[]>();

export function enqueueInterjection(
  sessionId: string,
  payload: Omit<UserInterjection, 'id' | 'createdAt'>
): UserInterjection {
  const item: UserInterjection = {
    id: nanoid(),
    content: payload.content,
    phaseHint: payload.phaseHint,
    roundHint: payload.roundHint,
    createdAt: Date.now(),
  };

  const queue = queues.get(sessionId) ?? [];
  queue.push(item);
  queues.set(sessionId, queue);

  return item;
}

export function drainInterjections(sessionId: string): UserInterjection[] {
  const queue = queues.get(sessionId) ?? [];
  queues.set(sessionId, []);
  return queue;
}

export function clearInterjections(sessionId: string) {
  queues.delete(sessionId);
}
