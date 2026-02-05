import { specError } from '../core/errors';

export function mustQuery<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector(selector);
  if (!el) throw specError('DOM_NOT_FOUND', `Missing element: ${selector}`, { selector });
  return el as T;
}

export async function sleep(ms: number): Promise<void> {
  console.log('sleep', ms);
  await new Promise((r) => setTimeout(r, ms));
}

export async function waitFor<T>(
  fn: () => T | null | undefined,
  opts: { timeoutMs?: number; intervalMs?: number; debugName?: string } = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const intervalMs = opts.intervalMs ?? 200;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = fn();
    if (v) return v;
    await sleep(intervalMs);
  }
  throw specError('WAIT_TIMEOUT', `Timeout waiting for ${opts.debugName ?? 'condition'}`, opts);
}

export function dispatchEnter(input: HTMLInputElement): void {
  console.log('dispatchEnter', input);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
}

