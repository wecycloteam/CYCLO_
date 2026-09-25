"use client";

import { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";

// Passwords are stored as one-way bcrypt hashes server-side (see apps/api/src/auth) —
// there is no plaintext to "view" for an existing password, only what's currently typed
// into a field. This toggle covers that: reveal/hide whatever the user is typing right now.
export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative w-full">
        <input {...props} ref={ref} type={visible ? "text" : "password"} className={className} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-current opacity-60 hover:opacity-100"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  }
);
