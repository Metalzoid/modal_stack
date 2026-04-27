// Tiny static server for the modal_stack JS demo.
//
//   bun examples/serve.js
//
// Then open http://localhost:4321/

const ROOT = new URL("..", import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 4321);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname === "/" ? "/examples/demo.html" : url.pathname;

    if (path.includes("..")) {
      return new Response("nope", { status: 400 });
    }

    const filePath = `${ROOT}${path}`;
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return new Response(`not found: ${path}`, { status: 404 });
    }

    const ext = path.slice(path.lastIndexOf("."));
    const headers = { "Cache-Control": "no-store" };
    if (MIME[ext]) headers["Content-Type"] = MIME[ext];

    return new Response(file, { headers });
  },
});

console.log(`modal_stack demo → http://localhost:${PORT}/`);
