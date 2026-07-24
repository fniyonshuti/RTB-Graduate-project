import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  extractUploadedProjectZip,
  summarizeUploadedProject,
} from "../../src/services/githubService.js";
import { buildTestZip, toZipDataUrl } from "../helpers/zipFixtures.js";

async function extractAndCleanup(entries, run) {
  const extracted = await extractUploadedProjectZip({
    name: "project.zip",
    dataUrl: toZipDataUrl(entries),
  });

  try {
    await run(extracted);
  } finally {
    await fs.rm(extracted.localPath, { recursive: true, force: true }).catch(() => null);
  }
}

test("extractUploadedProjectZip extracts a valid zip and reports file/byte counts", async () => {
  await extractAndCleanup(
    [
      { name: "README.md", content: "# Sample project" },
      { name: "src/index.js", content: "console.log('hi');" },
    ],
    async (extracted) => {
      assert.equal(extracted.meta.fileName, "project.zip");
      assert.equal(extracted.meta.fileCount, 2);
      assert.ok(extracted.meta.totalBytes > 0);

      const readme = await fs.readFile(
        `${extracted.localPath}/README.md`,
        "utf8",
      );
      assert.equal(readme, "# Sample project");
    },
  );
});

test("extractUploadedProjectZip rejects a zip-slip entry", async () => {
  await assert.rejects(
    () =>
      extractUploadedProjectZip({
        name: "malicious.zip",
        dataUrl: toZipDataUrl([{ name: "../escaped.txt", content: "gotcha" }]),
      }),
    /could not be extracted/,
  );
});

test("extractUploadedProjectZip rejects a non-.zip file name", async () => {
  await assert.rejects(
    () =>
      extractUploadedProjectZip({
        name: "project.tar",
        dataUrl: toZipDataUrl([{ name: "a.txt", content: "x" }]),
      }),
    /must be a \.zip file/,
  );
});

test("extractUploadedProjectZip rejects an empty zip", async () => {
  await assert.rejects(
    () => extractUploadedProjectZip({ name: "empty.zip", dataUrl: toZipDataUrl([]) }),
    /did not contain any files/,
  );
});

test("extractUploadedProjectZip rejects a zip over the 10MB raw limit", async () => {
  const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 1);
  const zipBuffer = buildTestZip([{ name: "big.bin", content: largeBuffer }]);

  await assert.rejects(
    () =>
      extractUploadedProjectZip({
        name: "big.zip",
        dataUrl: `data:application/zip;base64,${zipBuffer.toString("base64")}`,
      }),
    /too large/,
  );
});

test("extractUploadedProjectZip strips nested node_modules and .git before returning", async () => {
  await extractAndCleanup(
    [
      { name: "src/app.js", content: "module.exports = {};" },
      { name: "node_modules/some-lib/index.js", content: "module.exports = 1;" },
      { name: ".git/config", content: "[core]" },
    ],
    async (extracted) => {
      assert.equal(extracted.meta.fileCount, 1);

      const entries = await fs.readdir(extracted.localPath);
      assert.deepEqual(entries.sort(), ["src"]);
    },
  );
});

test("summarizeUploadedProject mirrors summarizeGitHubRepository's field shape from local files", async () => {
  await extractAndCleanup(
    [
      { name: "README.md", content: "# Todo App\nA simple todo list manager." },
      {
        name: "package.json",
        content: JSON.stringify({ scripts: { test: "jest", build: "vite build" } }),
      },
      { name: "src/index.js", content: "function login() { return fetch('/api/login'); }" },
      { name: "tests/index.test.js", content: "test('works', () => {});" },
    ],
    async (extracted) => {
      const summary = await summarizeUploadedProject(extracted.localPath, extracted.meta);

      assert.equal(summary.isValid, true);
      assert.equal(summary.readmeFound, true);
      assert.match(summary.readmeExcerpt, /Todo App/);
      assert.equal(summary.setupFileFound, true);
      assert.equal(summary.testFileFound, true);
      assert.equal(summary.testScriptFound, true);
      assert.equal(summary.buildScriptFound, true);
      assert.equal(summary.supportedFileCount, 4);
      assert.ok(summary.sampledSourceFiles.length > 0);
      assert.equal(summary.repo, "project");

      // GitHub-only signals are not derivable from a local upload and must be
      // hard-defaulted rather than fabricated.
      assert.equal(summary.stars, 0);
      assert.equal(summary.forks, 0);
      assert.deepEqual(summary.recentCommits, []);
      assert.equal(summary.ciRunFound, false);
      assert.equal(summary.ciPassing, false);
    },
  );
});

test("summarizeUploadedProject reports missing README/test/build signals honestly", async () => {
  await extractAndCleanup(
    [{ name: "src/index.js", content: "console.log('no readme, no tests');" }],
    async (extracted) => {
      const summary = await summarizeUploadedProject(extracted.localPath, extracted.meta);

      assert.equal(summary.readmeFound, false);
      assert.equal(summary.testFileFound, false);
      assert.equal(summary.setupFileFound, false);
      assert.equal(summary.testScriptFound, false);
      assert.equal(summary.buildScriptFound, false);
    },
  );
});
