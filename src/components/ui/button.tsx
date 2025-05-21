import * as React from "react"

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, ...props }, ref) => {
    React.useEffect(() => {
      // @ts-expect-error: mdc is injected by Material Components Web CDN and not typed in TS
      if (window.mdc && window.mdc.autoInit) window.mdc.autoInit();
    }, []);
    return (
      <button className="mdc-button" ref={ref} {...props}>
        <span className="mdc-button__label">{children}</span>
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
