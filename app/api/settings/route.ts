import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db/settings";

export async function GET() {
  const settings = await getSettings();
  // Never expose the Gemini API key to the client in full
  return NextResponse.json({
    ...settings,
    geminiApiKey: settings.geminiApiKey ? "••••••••" : "",
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  // If the masked placeholder is sent back, don't overwrite the real key
  if (body.geminiApiKey === "••••••••") {
    delete body.geminiApiKey;
  }
  const settings = await updateSettings(body);
  return NextResponse.json({
    ...settings,
    geminiApiKey: settings.geminiApiKey ? "••••••••" : "",
  });
}
