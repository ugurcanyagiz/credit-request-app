import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

const VIDEO_PATH = path.join(process.cwd(), "components", "credit.mp4");
const VIDEO_CONTENT_TYPE = "video/mp4";

function parseRange(range: string | null, fileSize: number) {
  if (!range?.startsWith("bytes=")) {
    return null;
  }

  const [startValue, endValue] = range.replace("bytes=", "").split("-");
  let start = startValue ? Number.parseInt(startValue, 10) : 0;
  let end = endValue ? Number.parseInt(endValue, 10) : fileSize - 1;

  if (!startValue && endValue) {
    const suffixLength = Number.parseInt(endValue, 10);
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end < start || start >= fileSize) {
    return null;
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const videoStats = await stat(VIDEO_PATH);
  const range = parseRange(request.headers.get("range"), videoStats.size);

  if (range) {
    const chunkSize = range.end - range.start + 1;
    const videoFile = await open(VIDEO_PATH, "r");
    const chunkBuffer = Buffer.alloc(chunkSize);

    try {
      await videoFile.read(chunkBuffer, 0, chunkSize, range.start);
    } finally {
      await videoFile.close();
    }

    return new Response(chunkBuffer, {
      status: 206,
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
        "Content-Length": chunkSize.toString(),
        "Content-Range": `bytes ${range.start}-${range.end}/${videoStats.size}`,
        "Content-Type": VIDEO_CONTENT_TYPE,
      },
    });
  }

  const videoBuffer = await readFile(VIDEO_PATH);

  return new Response(videoBuffer, {
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "Content-Length": videoStats.size.toString(),
      "Content-Type": VIDEO_CONTENT_TYPE,
    },
  });
}
