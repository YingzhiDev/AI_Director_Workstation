import {
  clearAssetRecords,
  deleteAssetRecord,
  readAssetRecords,
  upsertAssetRecord,
} from "@/lib/assetStore";
import { isDemoMode } from "@/lib/demoMode";
import type { AssetKind, PromptKind } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (isDemoMode()) {
      return Response.json({ assets: [] });
    }

    const assets = await readAssetRecords();

    return Response.json({ assets });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to load assets. Please try again later.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (isDemoMode()) {
      return Response.json(
        { message: "Demo assets are stored only for the current browser session." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      name?: string;
      promptText?: string;
      sourcePromptKind?: PromptKind;
      assetKind?: AssetKind;
    };
    const asset = await upsertAssetRecord({
      name: body.name ?? "",
      promptText: body.promptText ?? "",
      sourcePromptKind: body.sourcePromptKind,
      assetKind: body.assetKind,
    });

    return Response.json({ asset });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to save the asset. Please try again later.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (isDemoMode()) {
      return Response.json({ deleted: false, assets: [] });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const clearAll = url.searchParams.get("all") === "1";

    if (clearAll) {
      const assets = await clearAssetRecords();
      return Response.json({ assets });
    }

    if (!id) {
      return Response.json({ message: "Asset ID is required." }, { status: 400 });
    }

    const result = await deleteAssetRecord(id);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to delete the asset. Please try again later.",
      },
      { status: 500 },
    );
  }
}
