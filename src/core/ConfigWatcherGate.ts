/**
 * Gate to temporarily suspend the configuration watcher while
 * programmatic config updates are applied as a batch.
 */
let suspendCount = 0;

export function suspendConfigWatcher(): () => void {
  suspendCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suspendCount = Math.max(0, suspendCount - 1);
  };
}

export function isConfigWatcherSuspended(): boolean {
  return suspendCount > 0;
}


