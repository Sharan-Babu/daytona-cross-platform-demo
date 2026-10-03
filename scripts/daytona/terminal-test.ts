import { runOne } from './run-one.js';
runOne('terminal').catch((error) => { console.error(error); process.exitCode = 1; });

