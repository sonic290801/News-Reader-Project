import cron, { ScheduledTask } from "node-cron";
import { prisma } from "@/lib/db";
import { fetchRssFeed } from "./rss";
import { fetchRedditFeed } from "./reddit";
import { fetchYouTubeFeed } from "./youtube";
import { fetchWebSource } from "./web";

// Track active cron tasks so we can reschedule when sources change
const activeTasks = new Map<string, ScheduledTask>();

// Convert minutes to a cron expression (capped to hourly minimum for sanity)
function minutesToCron(minutes: number): string {
  const clamped = Math.max(15, minutes);
  if (clamped < 60) return `*/${clamped} * * * *`;
  const hours = Math.round(clamped / 60);
  return `0 */${hours} * * *`;
}

async function runSource(sourceId: string): Promise<void> {
  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source || !source.enabled) return;

  try {
    if (source.type === "RSS") {
      await fetchRssFeed(source);
    } else if (source.type === "REDDIT") {
      await fetchRedditFeed(source);
    } else if (source.type === "YOUTUBE") {
      await fetchYouTubeFeed(source);
    } else if (source.type === "WEB") {
      await fetchWebSource(source);
    }
  } catch {
    // Errors already logged and written to source health by each fetcher
  }
}

export function startScheduler(): void {
  // Skip in Netlify serverless environment — scheduled functions handle it there
  if (process.env.NETLIFY) return;

  console.log("[scheduler] starting...");

  prisma.source
    .findMany({ where: { enabled: true } })
    .then((sources) => {
      for (const source of sources) {
        if (source.type !== "RSS" && source.type !== "REDDIT") continue;
        scheduleSource(source.id, source.fetchIntervalMinutes);
      }
      console.log(
        `[scheduler] scheduled ${sources.length} source(s)`
      );
    })
    .catch((err) => {
      console.error("[scheduler] failed to load sources:", err);
    });
}

export function scheduleSource(sourceId: string, intervalMinutes: number): void {
  // Cancel existing task for this source if any
  activeTasks.get(sourceId)?.stop();

  const task = cron.schedule(minutesToCron(intervalMinutes), () => {
    runSource(sourceId).catch(() => {});
  });

  activeTasks.set(sourceId, task);
}

export function unscheduleSource(sourceId: string): void {
  activeTasks.get(sourceId)?.stop();
  activeTasks.delete(sourceId);
}

// Trigger a source immediately (used by manual refresh API)
export async function runSourceNow(sourceId: string): Promise<void> {
  await runSource(sourceId);
}
