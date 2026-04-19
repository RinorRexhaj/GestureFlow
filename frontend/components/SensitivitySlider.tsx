import { useState } from "react";

const SensitivitySlider = ({
  label,
  defaultValue,
}: {
  label: string;
  defaultValue: number;
}) => {
  const [val, setVal] = useState(defaultValue);
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-headline uppercase tracking-wider text-on-surface-variant/70">
          {label}
        </span>
        <span className="text-xs font-headline text-primary tabular-nums w-10 text-right">
          {(val / 100).toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "#89ceff" }}
      />
    </div>
  );
};

export default SensitivitySlider;
