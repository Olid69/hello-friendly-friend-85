import { useEffect, useState } from "react";

const KEY = "sonora:data-saver";
const EVT = "sonora:data-saver-changed";

export function getDataSaver(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function setDataSaver(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new CustomEvent(EVT));
}

export function useDataSaver() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(getDataSaver());
    const h = () => setOn(getDataSaver());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return {
    dataSaver: on,
    toggle: () => setDataSaver(!on),
    setDataSaver,
  };
}
