import { useCallback, useRef, useState } from "react";

// Lightweight toast state: const { toast, show } = useToast(); show("Saved");
export default function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((text, type = "success") => {
    clearTimeout(timer.current);
    setToast({ text, type });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  return { toast, show };
}
