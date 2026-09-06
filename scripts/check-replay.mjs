import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
for(const name of ['provisions','sources','inventory'])assert((await readFile(`data/${name}.json`)).equals(await readFile(`tmp/replay/${name}.json`)),`${name}: replay differs from canonical bytes`);
console.log('Offline PDF replay matches all three canonical files byte for byte.');
