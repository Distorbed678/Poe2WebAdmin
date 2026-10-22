// Generates src/lib/api/schema.d.ts from the server's OpenAPI document.
//
//   npm run gen:api                       reads the server repo's docs/openapi.json: inside Poe2Server
//                                         (modules/web-admin) ../../docs/openapi.json, inside the hub
//                                         Poe2ModdingProject (modules/web-admin) ../server/docs/openapi.json
//   npm run gen:api -- path/to/openapi.json
//   npm run gen:api -- http://127.0.0.1:8080/api/v1/openapi.json   (a running server)
//
// The OPENAPI_SPEC environment variable works too.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  resolve(root, '../../docs/openapi.json'), // Poe2Server/modules/web-admin
  resolve(root, '../server/docs/openapi.json'), // Poe2ModdingProject/modules/web-admin
];
const arg = process.argv[2] ?? process.env.OPENAPI_SPEC;

let spec = arg;
if (!spec) {
  spec = candidates.find((c) => existsSync(c));
  if (!spec) {
    console.error(
      'No OpenAPI document found. Pass a path or URL: npm run gen:api -- <openapi.json>\n' +
        `(looked for ${candidates.join(' and ')})`,
    );
    process.exit(1);
  }
}
const out = resolve(root, 'src/lib/api/schema.d.ts');
const bin = resolve(root, 'node_modules/.bin/openapi-typescript');
console.log(`openapi-typescript ${spec} -> ${out}`);
execFileSync(bin, [spec, '-o', out], { stdio: 'inherit' });
