"use client";

import { type HTMLAttributes } from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";

export function FocusTrappedDiv(props: HTMLAttributes<HTMLDivElement>) {
  const ref = useFocusTrap<HTMLDivElement>();
  return <div ref={ref} {...props} />;
}
