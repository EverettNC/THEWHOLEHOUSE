/**
 * Honest microphone diagnosis. Do not collapse every failure to "denied."
 */

export type MicBlockCode =
  | "INSECURE"
  | "NO_API"
  | "FRAMED"
  | "DENIED"
  | "MISSING"
  | "BUSY"
  | "UNKNOWN";

export type MicInspect =
  | { ok: true; framed: boolean }
  | { ok: false; framed: boolean; code: MicBlockCode; message: string };

function framed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function policyAllowsMic(): boolean | null {
  const doc = document as Document & {
    permissionsPolicy?: { allowsFeature: (n: string) => boolean };
    featurePolicy?: { allowsFeature: (n: string) => boolean };
  };
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  if (!policy || typeof policy.allowsFeature !== "function") return null;
  try {
    return policy.allowsFeature("microphone");
  } catch {
    return null;
  }
}

export function inspectMic(): MicInspect {
  const isFramed = framed();
  if (!window.isSecureContext) {
    return {
      ok: false,
      framed: isFramed,
      code: "INSECURE",
      message:
        "This page is not a secure context. The browser will not open a microphone over plain HTTP.",
    };
  }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    return {
      ok: false,
      framed: isFramed,
      code: isFramed ? "FRAMED" : "NO_API",
      message: isFramed
        ? "The preview frame is not allowed to see the microphone. Open Corti in its own window, then press Listen."
        : "This browser has no getUserMedia. I cannot hear a room that the engine cannot open.",
    };
  }
  const allowed = policyAllowsMic();
  if (allowed === false) {
    return {
      ok: false,
      framed: isFramed,
      code: "FRAMED",
      message:
        "The preview frame has no microphone permission. Open Corti in its own window, then press Listen. I will not invent a room.",
    };
  }
  return { ok: true, framed: isFramed };
}

export function classifyMicError(err: unknown): MicInspect {
  const isFramed = framed();
  const name = err instanceof DOMException ? err.name : "";
  const raw = err instanceof Error ? err.message : String(err);

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    if (isFramed) {
      return {
        ok: false,
        framed: true,
        code: "FRAMED",
        message:
          "The preview frame blocked the microphone. Open Corti in its own window, then press Listen.",
      };
    }
    return {
      ok: false,
      framed: false,
      code: "DENIED",
      message:
        "The browser or the OS refused the microphone. Allow it for this site, then press Listen again.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      ok: false,
      framed: isFramed,
      code: "MISSING",
      message: "No microphone is attached to this machine.",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      ok: false,
      framed: isFramed,
      code: "BUSY",
      message: "The microphone is already open in another app.",
    };
  }
  if (name === "SecurityError") {
    return {
      ok: false,
      framed: isFramed,
      code: isFramed ? "FRAMED" : "INSECURE",
      message: isFramed
        ? "The preview frame is not allowed to use the microphone. Open Corti in its own window."
        : "The browser blocked the microphone as a security error.",
    };
  }
  return {
    ok: false,
    framed: isFramed,
    code: "UNKNOWN",
    message: raw || "The microphone failed. I will not invent a room.",
  };
}
