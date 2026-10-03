import { runOne } from './run-one.js';
runOne('playwright').catch((error) => { console.error(error); process.exitCode = 1; });

