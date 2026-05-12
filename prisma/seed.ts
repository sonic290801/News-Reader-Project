import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Upsert sources so seed is idempotent
  await prisma.source.upsert({
    where: { url: "https://www.reddit.com/r/worldnews/.rss" },
    update: {},
    create: {
      type: "REDDIT",
      url: "https://www.reddit.com/r/worldnews/.rss",
      label: "r/worldnews",
      category: "News",
      fetchIntervalMinutes: 30,
    },
  });

  await prisma.source.upsert({
    where: { url: "https://pizzint.com" },
    update: {},
    create: {
      type: "WEB",
      url: "https://pizzint.com",
      label: "pizzint.com",
      category: "News",
      fetchIntervalMinutes: 60,
    },
  });

  // YouTube — The Enforcer channel RSS feed
  await prisma.source.upsert({
    where: { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ" },
    update: {},
    create: {
      type: "YOUTUBE",
      url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ",
      channelId: "UCBJycsmduvYEL83R_U4JriQ",
      label: "The Enforcer",
      category: "YouTube",
      fetchIntervalMinutes: 120,
      autoFetchTranscript: false,
    },
  });

  // Ensure default settings row exists
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  console.log("Seed complete — 3 sources created.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
