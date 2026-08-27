export function canSerial(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export function isFramed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

type SerialPortLike = {
  open: (opts: { baudRate: number }) => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  close: () => Promise<void>;
};

type SerialNav = Navigator & {
  serial?: { requestPort: () => Promise<SerialPortLike> };
};

export type SerialHandle = { close: () => Promise<void> };

export async function openSerialSniff(onLine: (line: string) => void): Promise<SerialHandle> {
  const serial = (navigator as SerialNav).serial;
  if (!serial) {
    throw new Error("This window has no serial nose.");
  }
  const port = await serial.requestPort();
  await port.open({ baudRate: 9600 });
  const reader = port.readable?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let cancelled = false;

  void (async () => {
    if (!reader) return;
    try {
      while (!cancelled) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n/);
        buffer = parts.pop() ?? "";
        for (const line of parts) {
          if (line.trim()) onLine(line);
        }
      }
    } catch {
      /* port closed */
    }
  })();

  return {
    close: async () => {
      cancelled = true;
      try {
        await reader?.cancel();
      } catch {
        /* already closed */
      }
      try {
        await port.close();
      } catch {
        /* already closed */
      }
    },
  };
}
