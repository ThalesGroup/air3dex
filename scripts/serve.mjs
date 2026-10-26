// Copyright (c) 2025-2026 Thales Services Numeriques (TSN).
// SPDX-License-Identifier: Apache-2.0

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number.parseInt(process.env.PORT ?? "8000", 10);
const host = process.env.HOST ?? "127.0.0.1";
const appPath = "/src/air3dex/templates/index.html";

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".czml", "application/json; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? host}`);

    if (requestUrl.pathname === "/") {
      response.writeHead(302, { Location: appPath });
      response.end();
      return;
    }

    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const filePath = resolve(projectRoot, `.${decodedPath}`);
    if (filePath !== projectRoot && !filePath.startsWith(`${projectRoot}${sep}`)) {
      sendText(response, 403, "Accès interdit.\n");
      return;
    }

    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      sendText(response, 404, "Fichier introuvable.\n");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes.get(extname(filePath).toLowerCase()) ?? "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error?.code === "ENOENT") {
      sendText(response, 404, "Fichier introuvable.\n");
      return;
    }
    sendText(response, 500, "Erreur interne du serveur.\n");
  }
});

server.listen(port, host, () => {
  console.log(`Air3Dex est disponible sur http://${host}:${port}/`);
});
