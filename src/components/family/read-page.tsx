import { useEffect, useState } from "react";
import { BookOpenText, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

function pageText() {
  const main = document.querySelector("main");
  if (!main) return "";
  return (main.innerText || "").replace(/\s+\n/g, "\n").trim();
}

export function ReadPage() {
  const [speaking, setSpeaking] = useState(false);
  const [note, setNote] = useState("This mouth is the browser's. Not a Christman throat.");

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis.cancel();
    };
  }, []);

  function stop() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function read() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setNote("This window has no mouth.");
      return;
    }
    const text = pageText();
    if (!text) {
      setNote("Nothing on this page to read.");
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const en = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    if (en) utter.voice = en;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => {
      setSpeaking(false);
      setNote("The browser mouth failed. I will not fake a read.");
    };
    setSpeaking(true);
    setNote(en ? `Reading with ${en.name}.` : "Reading with the browser mouth.");
    window.speechSynthesis.speak(utter);
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <Button
        type="button"
        variant={speaking ? "secondary" : "outline"}
        size="sm"
        onClick={speaking ? stop : read}
        data-testid="read-page"
        aria-pressed={speaking}
      >
        {speaking ? <Square /> : <BookOpenText />}
        {speaking ? "Stop" : "Read page"}
      </Button>
      <p className="max-w-[14rem] text-right font-mono text-[0.5625rem] leading-tight tracking-[0.12em] text-subtle uppercase">
        {note}
      </p>
    </div>
  );
}
