const STYLE_ID = 'portfolio-vti-status-style';
const PANEL_ID = 'portfolio-vti-status';
const STOP_EVENT = 'pvs_stop_and_reset';

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${PANEL_ID} {
  position: fixed;
  right: 16px;
  bottom: 64px;
  z-index: 999999;
  width: 320px;
  max-width: calc(100vw - 32px);
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #111827;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.10);
  overflow: hidden;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
}
#${PANEL_ID} .hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #f3f4f6;
  font-weight: 700;
  font-size: 14px;
}
#${PANEL_ID} .body {
  padding: 10px 12px;
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
}
#${PANEL_ID} .row {
  display: flex;
  gap: 8px;
  align-items: center;
}
#${PANEL_ID} .spin {
  width: 14px;
  height: 14px;
  border: 2px solid #e5e7eb;
  border-top-color: #111827;
  border-radius: 999px;
  animation: pvs_spin 0.9s linear infinite;
}
@keyframes pvs_spin { to { transform: rotate(360deg); } }
#${PANEL_ID} .close {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 8px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
}
#${PANEL_ID} .stop {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 8px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
}
#${PANEL_ID} .btns {
  display: flex;
  gap: 8px;
  align-items: center;
}
`;
  document.head.appendChild(style);
}

function ensurePanel(): HTMLDivElement {
  ensureStyle();
  const existing = document.getElementById(PANEL_ID) as HTMLDivElement | null;
  if (existing) return existing;

  const div = document.createElement('div');
  div.id = PANEL_ID;
  div.innerHTML = `
    <div class="hdr">
      <div class="row"><div class="spin" data-spin="1"></div><div>豐存股折線圖</div></div>
      <div class="btns">
        <button class="stop" type="button">停止</button>
        <button class="close" type="button">關閉</button>
      </div>
    </div>
    <div class="body" data-body="1">準備中…</div>
  `;
  div.querySelector<HTMLButtonElement>('button.stop')!.onclick = () => {
    window.dispatchEvent(new CustomEvent(STOP_EVENT));
  };
  div.querySelector<HTMLButtonElement>('button.close')!.onclick = () => div.remove();
  document.body.appendChild(div);
  return div;
}

export function setStatus(text: string, opts: { spinning?: boolean } = {}): void {
  const panel = ensurePanel();
  const body = panel.querySelector('[data-body="1"]') as HTMLElement;
  body.textContent = text;
  const spin = panel.querySelector('[data-spin="1"]') as HTMLElement | null;
  const spinning = opts.spinning ?? true;
  if (spin) spin.style.display = spinning ? 'inline-block' : 'none';
}

export function setStatusDone(text = '已完成'): void {
  setStatus(text, { spinning: false });
}

export function setStatusError(text: string): void {
  const panel = ensurePanel();
  const body = panel.querySelector('[data-body="1"]') as HTMLElement;
  body.textContent = text;
  body.style.color = '#991b1b';
  const spin = panel.querySelector('[data-spin="1"]') as HTMLElement | null;
  if (spin) spin.style.display = 'none';
}

export function getStopEventName(): string {
  return STOP_EVENT;
}

