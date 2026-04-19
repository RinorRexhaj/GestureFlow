import { useState } from "react";

const PillToggle = ({
  label,
  defaultOn = false,
  checked,
  onChange,
}: {
  label: string;
  defaultOn?: boolean;
  checked?: boolean;
  onChange?: (value: boolean) => void;
}) => {
  const [internal, setInternal] = useState(defaultOn);
  const on = checked !== undefined ? checked : internal;
  const toggle = () => {
    const next = !on;
    setInternal(next);
    onChange?.(next);
  };
  return (
    <label className="flex items-center justify-between group cursor-pointer">
      <span className="text-on-surface-variant group-hover:text-primary transition-colors duration-200 text-sm">
        {label}
      </span>
      <button
        role="switch"
        aria-checked={on}
        onClick={toggle}
        className={`relative w-10 h-5 rounded-full transition-all duration-300
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                    ${on ? "bg-secondary-container" : "bg-surface-container-highest"}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300
                      ${on ? "right-0.5 bg-on-surface" : "left-0.5 bg-on-surface-variant"}`}
        />
      </button>
    </label>
  );
};

export default PillToggle;
