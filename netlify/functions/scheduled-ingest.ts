import type { Config } from "@netlify/functions";
import { fetchAllSources } from "../../lib/ingest/runner";

export default async function handler() {
  console.log("[scheduled-ingest] starting feed refresh");
  await fetchAllSources();
  console.log("[scheduled-ingest] done");
}

export const config: Config = {
  schedule: "0 * * * *",
};
