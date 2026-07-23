import {
  clearHistoryRecords,
  deleteHistoryRecord,
  readHistoryRecords,
} from "@/lib/historyStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const records = await readHistoryRecords(request);

    return Response.json(
      { records },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to load history. Please try again later.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const clearAll = url.searchParams.get("all") === "1";

    if (clearAll) {
      const records = await clearHistoryRecords(request);
      return Response.json({ records });
    }

    if (!id) {
      return Response.json({ message: "History record ID is required." }, { status: 400 });
    }

    const result = await deleteHistoryRecord(id, request);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to delete history. Please try again later.",
      },
      { status: 500 },
    );
  }
}
