import { runOne } from './run-one.js';
runOne('trycua').catch((error) => { console.error(error); process.exitCode = 1; });

