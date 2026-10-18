import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { RefreshQueueFile, RefreshQueueItem } from './types';

export const DEFAULT_REFRESH_QUEUE_PATH = 'content/keywords/refresh-queue.json';

/**
 * Loads the persistent refresh queue from disk.
 * Returns a clean default file structure if the file does not yet exist.
 */
export function loadRefreshQueue(filePath = DEFAULT_REFRESH_QUEUE_PATH): RefreshQueueFile {
  const resolved = resolve(process.cwd(), filePath);
  if (!existsSync(resolved)) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      items: [],
    };
  }

  try {
    const raw = readFileSync(resolved, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version ?? 1,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch (err) {
    console.warn(`[refresh:queue] Failed to parse ${filePath}, returning empty queue:`, err);
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      items: [],
    };
  }
}

/**
 * Saves the refresh queue to disk.
 */
export function saveRefreshQueue(
  queue: RefreshQueueFile,
  filePath = DEFAULT_REFRESH_QUEUE_PATH
): void {
  const resolved = resolve(process.cwd(), filePath);
  mkdirSync(dirname(resolved), { recursive: true });
  queue.updatedAt = new Date().toISOString();
  writeFileSync(resolved, JSON.stringify(queue, null, 2) + '\n', 'utf8');
}

/**
 * Upserts a list of new items into an existing queue.
 * - Deduplicates by unique item ID.
 * - Preserves status and appliedAt for existing 'applied' or 'quarantined' items.
 * - Updates priority and diagnostics for 'pending' items.
 */
export function upsertRefreshQueue(
  existing: RefreshQueueFile,
  newItems: RefreshQueueItem[]
): RefreshQueueFile {
  const itemMap = new Map<string, RefreshQueueItem>();

  for (const item of existing.items) {
    itemMap.set(item.id, item);
  }

  for (const newItem of newItems) {
    const current = itemMap.get(newItem.id);
    if (!current) {
      itemMap.set(newItem.id, newItem);
    } else {
      // If already applied or quarantined, keep existing status and history
      if (current.status === 'applied' || current.status === 'quarantined') {
        // preserve terminal status
        itemMap.set(newItem.id, {
          ...newItem,
          status: current.status,
          appliedAt: current.appliedAt,
        });
      } else {
        // Pending: update diagnostics and priority to current run's metrics
        itemMap.set(newItem.id, {
          ...current,
          priority: newItem.priority,
          diagnostics: newItem.diagnostics,
          suggestedActions: newItem.suggestedActions,
        });
      }
    }
  }

  return {
    version: existing.version,
    updatedAt: new Date().toISOString(),
    items: Array.from(itemMap.values()),
  };
}

/**
 * Convenience helper to upsert a single item into the persistent queue file.
 */
export function upsertRefreshQueueItem(
  item: RefreshQueueItem,
  filePath = DEFAULT_REFRESH_QUEUE_PATH
): void {
  const queue = loadRefreshQueue(filePath);
  const updated = upsertRefreshQueue(queue, [item]);
  saveRefreshQueue(updated, filePath);
}

/**
 * Updates the status of an existing queue item (e.g. marked as 'applied' or 'quarantined').
 */
export function updateRefreshItemStatus(
  id: string,
  status: 'applied' | 'quarantined',
  filePath = DEFAULT_REFRESH_QUEUE_PATH
): void {
  const queue = loadRefreshQueue(filePath);
  const target = queue.items.find((it) => it.id === id);
  if (target) {
    target.status = status;
    if (status === 'applied') {
      target.appliedAt = new Date().toISOString();
    }
    saveRefreshQueue(queue, filePath);
  }
}
