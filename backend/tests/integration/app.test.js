import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const testFrontendOrigin = "https://rtb-graduate-project.vercel.app";
process.env.CORS_ORIGINS = testFrontendOrigin;
process.env.FRONTEND_URL = testFrontendOrigin;

const { default: app } = await import("../../src/app.js");

let server;
let baseUrl;

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();

  return { response, body };
}

describe("Express app integration", () => {
  before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("responds to the health endpoint", async () => {
    const { response, body } = await request("/api/health", {
      headers: {
        Origin: testFrontendOrigin,
      },
    });

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.message, "Skills Gap Analysis API is running");
  });

  it("adds request IDs and security headers", async () => {
    const { response } = await request("/api/health", {
      headers: {
        "X-Request-Id": "test-request-id",
        Origin: testFrontendOrigin,
      },
    });

    assert.equal(response.headers.get("x-request-id"), "test-request-id");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
  });

  it("returns a structured 404 response for unknown routes", async () => {
    const { response, body } = await request("/api/does-not-exist", {
      headers: {
        Origin: testFrontendOrigin,
      },
    });

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.match(body.message, /Route not found/);
    assert.ok(body.requestId);
  });
});
