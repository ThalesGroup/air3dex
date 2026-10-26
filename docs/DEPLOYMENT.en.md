# Deploying the Air3Dex interface

[Français](DEPLOYMENT.md) | [English](DEPLOYMENT.en.md)

Air3Dex is a static web application made of an HTML page and JavaScript, CSS,
and image assets. It requires an HTTP server, but no Visual Studio Code
extension or virtual machine.

## Requirements

- Node.js 20.19.0 or later;
- npm;
- a recent browser with WebGL enabled;
- access to the public CDNs used by the interface.

```bash
node --version
npm --version
```

The minimum Node.js version matches the constraints of the Cesium and ESLint
versions locked in `package-lock.json`.

## Install the project

From the repository root:

```bash
npm ci
```

`npm ci` installs the exact versions recorded in `package-lock.json`. The
Python processing pipeline has a separate installation procedure, described in
the [English README](../README.en.md#install-the-python-preprocessing-pipeline).

## Run the interface locally

```bash
npm start
```

Then open:

```text
http://127.0.0.1:8000/
```

The server automatically redirects to
`/src/air3dex/templates/index.html`. `npm run serve` is an alias for
`npm start`.

The `scripts/serve.mjs` server only uses built-in Node.js modules. It serves the
repository root so that the paths from `index.html` to `../static/` remain
valid.

To select another port:

```bash
PORT=8080 npm start
```

To listen on all network interfaces:

```bash
HOST=0.0.0.0 npm start
```

The server listens on `127.0.0.1` by default. Only use `0.0.0.0` on a trusted
network or behind a properly configured reverse proxy.

Do not open `index.html` directly through a `file://` URL. ES modules and
application assets must be loaded in an HTTP context.

## Load data

The interface lets users select a local file:

- `.json` for data converted by Air3Dex;
- `.czml` for Cesium-compatible data.

The browser reads the selected file directly. The analyzed repository does not
contain an upload backend.


## Configure Cesium Ion

The viewer uses Cesium World Terrain and therefore requires a Cesium Ion token.

`src/air3dex/static/viewer.js` currently uses the public evaluation token
supplied with CesiumJS. It is not a project-specific secret, so its presence in
the repository does not constitute a credential leak. However, it is intended
for evaluation and demonstrations rather than a long-running production
service.

For production:

1. create a dedicated Cesium Ion token for Air3Dex;
2. limit its permissions to the required resources;
3. restrict its allowed URLs to the deployment domains;
4. define a configuration mechanism suitable for the deployment target.

A value used by the browser remains visible to users. Protection therefore
relies on minimal permissions and domain restrictions, not on keeping frontend
code confidential.

The final configuration mechanism requires a maintainer decision: the
repository does not currently provide a frontend configuration generation
system. The evaluation token may be kept for local development.

## Verify the deployment

After running `npm start`, check that:

1. the local URL opens Air3Dex;
2. the logo, icons, and styles are displayed;
3. the Cesium globe and Leaflet minimap appear;
4. the browser console contains no JavaScript errors or 404 responses;
5. a representative JSON or CZML file can be loaded;
6. the timeline, statistics, legend, and charts respond correctly;
7. `npm run lint` completes successfully.

## Deploy to production

The supplied Node.js server is intended for local development and
demonstrations. In production, publish the frontend through an institutional
static server or an HTTPS reverse proxy.

The published root must preserve this structure:

```text
src/air3dex/
├── templates/
│   └── index.html
└── static/
    ├── assets/
    ├── styles.css
    └── *.js
```

The production server must:

- use HTTPS;
- serve `.js` files with a JavaScript MIME type;
- serve `.json` and `.czml` files with a JSON-compatible MIME type;
- preserve relative paths between `templates` and `static`;
- apply a security policy compatible with the approved external services;
- avoid exposing Python sources, tests, or data that the frontend does not need.

The exact configuration depends on the selected target and requires human
validation. No production platform is defined in the repository.

## Update an installation

```bash
npm ci
npm run lint
npm start
```

Then test a representative dataset. Any npm dependency update must commit
`package.json` and `package-lock.json` together and align the corresponding URLs
in `index.html` while the project continues to use CDNs.
