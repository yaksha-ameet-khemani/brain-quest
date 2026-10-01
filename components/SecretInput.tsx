"use client";

import { useEffect, useState, type CSSProperties, type InputHTMLAttributes } from "react";

/** A password/PIN box that phones and browsers don't offer to save.
 *
 * Browsers only show "Save password?" (and fill passwords in later) when
 * they see an <input type="password">. Kids use these phones and tablets, so a
 * parent's saved password would let a child open Parent Mode. This renders a
 * plain text box instead and hides the characters with the
 * `-webkit-text-security` style (Chrome, Safari, Edge, Samsung Internet and
 * newer Firefox), and tells password-manager apps to ignore it. On a browser
 * that can't hide text that way it falls back to a real password box -
 * possibly offering to save, but never showing the password. */
export default function SecretInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [masked, setMasked] = useState(true);

  useEffect(() => {
    setMasked(typeof CSS !== "undefined" && CSS.supports("-webkit-text-security", "disc"));
  }, []);

  return (
    <input
      {...props}
      type={masked ? "text" : "password"}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      data-lpignore="true"
      data-1p-ignore="true"
      data-bwignore="true"
      data-form-type="other"
      style={masked ? ({ ...props.style, WebkitTextSecurity: "disc" } as CSSProperties) : props.style}
    />
  );
}
