import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ ...props }, ref) => {
    React.useEffect(() => {
      if (window.mdc && window.mdc.autoInit) window.mdc.autoInit();
    }, []);
    return (
      <label className="mdc-text-field mdc-text-field--filled" style={{ width: '100%' }}>
        <span className="mdc-text-field__ripple"></span>
        <input className="mdc-text-field__input" ref={ref} {...props} aria-labelledby={props.id || undefined} />
        <span className="mdc-line-ripple"></span>
      </label>
    );
  }
)
Input.displayName = "Input"

export { Input }
