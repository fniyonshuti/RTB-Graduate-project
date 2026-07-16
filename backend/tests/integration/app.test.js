import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const testFrontendOrigin = "https://rtb-graduate-project.vercel.app";
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

  it("responds to the API base endpoint", async () => {
    const { response, body } = await request("/api", {
      headers: {
        Origin: testFrontendOrigin,
      },
    });

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.message, "Skills Gap Analysis API is running");
  });
  it("allows requests from any frontend origin", async () => {
    const arbitraryFrontendOrigin = "https://example-frontend.com";
    const { response } = await request("/api/health", {
      headers: {
        Origin: arbitraryFrontendOrigin,
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), arbitraryFrontendOrigin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  });

  it("answers auth login preflight requests with CORS headers", async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "OPTIONS",
      headers: {
        Origin: testFrontendOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type, authorization",
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), testFrontendOrigin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.match(response.headers.get("access-control-allow-methods"), /POST/);
    assert.match(response.headers.get("access-control-allow-headers"), /Content-Type/);
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
    assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin-allow-popups");
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

  it("explains that Google auth browser checks must use POST", async () => {
    const { response, body } = await request("/api/auth/google", {
      headers: {
        Origin: testFrontendOrigin,
      },
    });

    assert.equal(response.status, 405);
    assert.equal(body.success, false);
    assert.match(body.message, /POST \/api\/auth\/google/);
    assert.ok(body.requestId);
  });

  it("registers the Google auth POST route", async () => {
    const { response, body } = await request("/api/auth/google", {
      method: "POST",
      headers: {
        Origin: testFrontendOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, "credential is required");
  });

  it("returns a clear Google OAuth configuration error when backend client ID is missing", async () => {
    const originalClientId = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    try {
      const { response, body } = await request("/api/auth/google", {
        method: "POST",
        headers: {
          Origin: testFrontendOrigin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credential: "fake-google-credential" }),
      });

      assert.equal(response.status, 503);
      assert.equal(body.success, false);
      assert.match(body.message, /GOOGLE_CLIENT_ID/);
      assert.ok(body.requestId);
    } finally {
      if (originalClientId === undefined) {
        delete process.env.GOOGLE_CLIENT_ID;
      } else {
        process.env.GOOGLE_CLIENT_ID = originalClientId;
      }
    }
  });

  it("returns a clear Google OAuth credential error instead of a generic internal error", async () => {
    const originalClientId = process.env.GOOGLE_CLIENT_ID;
    const originalConsoleError = console.error;
    process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
    console.error = () => {};

    try {
      const { response, body } = await request("/api/auth/google", {
        method: "POST",
        headers: {
          Origin: testFrontendOrigin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credential: "fake-google-credential" }),
      });

      assert.equal(response.status, 401);
      assert.equal(body.success, false);
      assert.match(body.message, /could not be verified/);
      assert.ok(body.requestId);
    } finally {
      console.error = originalConsoleError;
      if (originalClientId === undefined) {
        delete process.env.GOOGLE_CLIENT_ID;
      } else {
        process.env.GOOGLE_CLIENT_ID = originalClientId;
      }
    }
  });

  it("registers the repository checklist route", async () => {
    const { response, body } = await request("/api/checklists?activeOnly=false", {
      headers: {
        Origin: testFrontendOrigin,
      },
    });

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.message, "Authentication token is required");
  });

  it("registers the report update route used by the frontend", async () => {
    const { response, body } = await request("/api/reports/507f1f77bcf86cd799439011", {
      method: "PUT",
      headers: {
        Origin: testFrontendOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Updated report title" }),
    });

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.message, "Authentication token is required");
  });
});
