import { runOne } from './run-one.js';
runOne('computer-use').catch((error) => { console.error(error); process.exitCode = 1; });

