import { areReferenceUploadsEnabled } from "@/lib/demoMode";
import {
  deleteReferenceFile,
  saveReferenceFiles,
} from "@/lib/referenceFileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!areReferenceUploadsEnabled()) {
      return Response.json(
        { message: "Reference uploads are paused in the public demo." },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (!files.length) {
      return Response.json({ message: "Upload at least one file." }, { status: 400 });
    }

    const attachments = await saveReferenceFiles(files);

    return Response.json({ attachments });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to upload reference files. Please try again later.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!areReferenceUploadsEnabled()) {
      return Response.json(
        { message: "Reference uploads are not enabled in this environment." },
        { status: 403 },
      );
    }

    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return Response.json({ message: "Reference file ID is required." }, { status: 400 });
    }

    const deleted = await deleteReferenceFile(id);

    return Response.json({ deleted });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to delete the reference file. Please try again later.",
      },
      { status: 400 },
    );
  }
}
