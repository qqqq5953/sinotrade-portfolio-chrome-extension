const STYLE_ID = 'portfolio-vti-status-style';
const MASK_ID = 'portfolio-vti-status';
const STOP_EVENT = 'pvs_stop_and_reset';

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${MASK_ID} {
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  pointer-events: auto;
}
#${MASK_ID} .card {
  background: #ffffff;
  color: #111827;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  overflow: hidden;
  min-width: 320px;
  max-width: calc(100vw - 32px);
  pointer-events: auto;
}
#${MASK_ID} .hdr {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid #f3f4f6;
  font-weight: 700;
  font-size: 14px;
}
#${MASK_ID} .body {
  padding: 14px 16px;
  font-size: 13px;
  color: #374151;
  line-height: 1.5;
  white-space: pre-wrap;
}
#${MASK_ID} .spin {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border: 2px solid #e5e7eb;
  border-top-color: #111827;
  border-radius: 999px;
  animation: pvs_spin 0.9s linear infinite;
}
@keyframes pvs_spin { to { transform: rotate(360deg); } }
#${MASK_ID} .stop {
  margin: 0 16px 14px;
  width: calc(100% - 32px);
  max-width: 200px;
  display: block;
  margin-left: auto;
  margin-right: auto;
  margin-bottom: 14px;
  border: 1px solid #d9dde3;
  background: #fff;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #3f5372;
}
#${MASK_ID} .stop:hover {
  background: #f5f6f8;
}
`;
  document.head.appendChild(style);
}

function removeMask(): void {
  const mask = document.getElementById(MASK_ID);
  mask?.remove();
}

function ensureMask(): HTMLDivElement {
  ensureStyle();
  const existing = document.getElementById(MASK_ID) as HTMLDivElement | null;
  if (existing) return existing;

  const div = document.createElement('div');
  div.id = MASK_ID;
  div.setAttribute('role', 'dialog');
  div.setAttribute('aria-busy', 'true');
  div.setAttribute('aria-label', '豐存股折線圖處理中');
  div.innerHTML = `
    <div class="card">
      <div class="hdr">
        <div class="spin" data-spin="1"></div>
        <span>豐存股折線圖</span>
      </div>
      <div class="body" data-body="1">準備中…</div>
      <button class="stop" type="button">停止</button>
    </div>
  `;
  div.querySelector<HTMLButtonElement>('button.stop')!.onclick = () => {
    window.dispatchEvent(new CustomEvent(STOP_EVENT));
  };
  document.body.appendChild(div);
  return div;
}

export function setStatus(text: string, opts: { spinning?: boolean } = {}): void {
  const mask = ensureMask();
  const body = mask.querySelector('[data-body="1"]') as HTMLElement;
  body.textContent = text;
  const spin = mask.querySelector('[data-spin="1"]') as HTMLElement | null;
  const spinning = opts.spinning ?? true;
  if (spin) spin.style.display = spinning ? 'inline-block' : 'none';
}

const MASK_DISMISS_MS = 400;

export function setStatusDone(text = '已完成'): void {
  setStatus(text, { spinning: false });
  setTimeout(removeMask, MASK_DISMISS_MS);
}

export function setStatusError(text: string): void {
  const mask = ensureMask();
  const body = mask.querySelector('[data-body="1"]') as HTMLElement;
  body.textContent = text;
  body.style.color = '#991b1b';
  const spin = mask.querySelector('[data-spin="1"]') as HTMLElement | null;
  if (spin) spin.style.display = 'none';
  setTimeout(removeMask, MASK_DISMISS_MS);
}

export function getStopEventName(): string {
  return STOP_EVENT;
}

