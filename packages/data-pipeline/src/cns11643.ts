import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const RELEASE_URL = "https://www.cns11643.gov.tw/opendata/release.txt";
const RESOURCES = [
  { filename: "release.txt", url: RELEASE_URL, kind: "release" },
  { filename: "Properties.zip", url: "https://www.cns11643.gov.tw/opendata/Properties.zip", kind: "properties" },
  { filename: "MapingTables.zip", url: "https://www.cns11643.gov.tw/opendata/MapingTables.zip", kind: "mappings" },
  { filename: "OpenDataFilesList.csv", url: "https://www.cns11643.gov.tw/opendata/OpenDataFilesList.csv", kind: "index" }
] as const;

export interface DownloadedResource {
  filename: string;
  url: string;
  bytes: number;
  checksum: string;
  contentType: string | null;
}

export interface CnsSnapshotManifest {
  sourceId: "cns11643";
  sourceUrl: string;
  version: string;
  downloadedAt: string;
  license: "政府資料開放授權條款-第1版 / OFL-1.1";
  resources: DownloadedResource[];
}

export function extractCnsVersion(releaseText: string): string {
  const version = releaseText.match(/版本[：:]\s*(\d{8})/)?.[1];
  if (!version) throw new Error("CNS release.txt does not contain a YYYYMMDD version");
  return version;
}

async function download(url: string, fetchImpl: typeof fetch): Promise<{ content: Uint8Array; contentType: string | null }> {
  const response = await fetchImpl(url, {
    headers: { "user-agent": "NameSolver-data-pipeline/0.1 (+https://github.com/namesolver)" },
    signal: AbortSignal.timeout(90_000)
  });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  const content = new Uint8Array(await response.arrayBuffer());
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > 250 * 1024 * 1024 || content.byteLength > 250 * 1024 * 1024) {
    throw new Error(`Download exceeds the 250 MiB safety limit: ${url}`);
  }
  return { content, contentType: response.headers.get("content-type") };
}

/**
 * Downloads only the official, fixed CNS11643 open-data resources and records
 * their checksums. Raw snapshots are never overwritten because the release
 * version is part of their directory name.
 */
export async function crawlCns11643(outputRoot = "data/raw", fetchImpl: typeof fetch = fetch): Promise<CnsSnapshotManifest> {
  const release = await download(RELEASE_URL, fetchImpl);
  const releaseText = new TextDecoder("utf-8").decode(release.content);
  const version = extractCnsVersion(releaseText);
  const destination = resolve(outputRoot, "cns11643", version);
  await mkdir(destination, { recursive: true });
  const resources: DownloadedResource[] = [];

  for (const resource of RESOURCES) {
    const downloaded = resource.kind === "release" ? release : await download(resource.url, fetchImpl);
    const checksum = createHash("sha256").update(downloaded.content).digest("hex");
    await writeFile(join(destination, resource.filename), downloaded.content, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
      // Existing versioned content is immutable; write a side-by-side checksum only if it agrees.
      const existing = await import("node:fs/promises").then(({ readFile }) => readFile(join(destination, resource.filename)));
      const existingChecksum = createHash("sha256").update(existing).digest("hex");
      if (existingChecksum !== checksum) throw new Error(`Refusing to overwrite changed snapshot ${resource.filename} for release ${version}`);
    });
    resources.push({ filename: resource.filename, url: resource.url, bytes: downloaded.content.byteLength, checksum, contentType: downloaded.contentType });
  }

  const manifest: CnsSnapshotManifest = {
    sourceId: "cns11643", sourceUrl: "https://data.gov.tw/dataset/5961/", version,
    downloadedAt: new Date().toISOString(), license: "政府資料開放授權條款-第1版 / OFL-1.1", resources
  };
  await writeFile(join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "w" });
  return manifest;
}
