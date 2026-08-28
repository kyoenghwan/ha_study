/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { AlertCircle, CheckCircle2, HelpCircle, Info, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type DialogKind = 'alert' | 'confirm' | 'prompt';
type DialogTone = 'info' | 'success' | 'warning' | 'danger';

interface DialogRequest {
  id: number;
  kind: DialogKind;
  message: string;
  title?: string;
  tone?: DialogTone;
  defaultValue?: string;
  resolve: (value: boolean | string | null) => void;
}

type DialogInput = string | { message: string; title?: string; tone?: DialogTone };

let sequence = 0;
let listener: ((request: DialogRequest) => void) | null = null;
const queue: DialogRequest[] = [];

const normalize = (input: DialogInput) =>
  typeof input === 'string' ? { message: input } : input;

const enqueue = (
  kind: DialogKind,
  input: DialogInput,
  defaultValue?: string,
): Promise<boolean | string | null> => {
  const data = normalize(input);
  return new Promise((resolve) => {
    const request: DialogRequest = {
      id: ++sequence,
      kind,
      defaultValue,
      resolve,
      ...data,
    };
    if (listener) listener(request);
    else queue.push(request);
  });
};

export const showAppAlert = (input: DialogInput): Promise<void> =>
  enqueue('alert', input).then(() => undefined);

export const showAppConfirm = (input: DialogInput): Promise<boolean> =>
  enqueue('confirm', input).then((value) => value === true);

export const showAppPrompt = (input: DialogInput, defaultValue = ''): Promise<string | null> =>
  enqueue('prompt', input, defaultValue).then((value) => typeof value === 'string' ? value : null);

export function AppDialogHost() {
  const [active, setActive] = useState<DialogRequest | null>(null);
  const [pending, setPending] = useState<DialogRequest[]>([]);
  const [promptValue, setPromptValue] = useState('');
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    listener = (request) => setPending((items) => [...items, request]);
    if (queue.length > 0) {
      setPending((items) => [...items, ...queue.splice(0)]);
    }
    return () => { listener = null; };
  }, []);

  useEffect(() => {
    if (!active && pending.length > 0) {
      const [next, ...rest] = pending;
      setActive(next);
      setPromptValue(next.defaultValue || '');
      setPending(rest);
    }
  }, [active, pending]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => primaryButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        active.resolve(active.kind === 'prompt' ? null : false);
        setActive(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [active]);

  if (!active) return null;

  const tone = active.tone || 'info';
  const title = active.title || (active.kind === 'confirm' ? '확인해 주세요' : active.kind === 'prompt' ? '내용을 입력해 주세요' : '안내');
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' || tone === 'danger' ? AlertCircle : active.kind === 'confirm' ? HelpCircle : Info;
  const close = (value: boolean | string | null) => {
    active.resolve(value);
    setActive(null);
  };

  return (
    <div className="app-dialog-backdrop" role="presentation">
      <section className={`app-dialog app-dialog--${tone}`} role="dialog" aria-modal="true" aria-labelledby={`app-dialog-title-${active.id}`}>
        <button className="app-dialog__close" type="button" aria-label="팝업 닫기" onClick={() => close(active.kind === 'prompt' ? null : false)}>
          <X size={18} />
        </button>
        <div className="app-dialog__icon"><Icon size={24} /></div>
        <h2 className="app-dialog__title" id={`app-dialog-title-${active.id}`}>{title}</h2>
        <p className="app-dialog__message">{active.message}</p>
        {active.kind === 'prompt' && (
          <input
            className="app-dialog__input"
            value={promptValue}
            onChange={(event) => setPromptValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') close(promptValue); }}
          />
        )}
        <div className="app-dialog__actions">
          {active.kind !== 'alert' && (
            <button className="app-dialog__button app-dialog__button--secondary" type="button" onClick={() => close(active.kind === 'prompt' ? null : false)}>취소</button>
          )}
          <button ref={primaryButtonRef} className="app-dialog__button app-dialog__button--primary" type="button" onClick={() => close(active.kind === 'prompt' ? promptValue : true)}>확인</button>
        </div>
      </section>
    </div>
  );
}
