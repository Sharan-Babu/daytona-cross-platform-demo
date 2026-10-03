import { DaytonaNotFoundError } from '@daytona/sdk';
import { assertManagedSandbox, createClient, sandboxName } from './common.js';

async function main() {
  const daytona = createClient();
  try {
    const sandbox = await daytona.get(sandboxName);
    assertManagedSandbox(sandbox);
    await daytona.delete(sandbox, 180, true);
    console.log(`Deleted ${sandboxName} (${sandbox.id}).`);
  } catch (error) {
    if (error instanceof DaytonaNotFoundError) {
      console.log(`No sandbox named ${sandboxName} exists.`);
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

