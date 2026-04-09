import React from "react";
import SensitivitySlider from "./SensitivitySlider";

const SensitivityComponent = () => {
  return (
    <div
      className="bg-surface-variant/40 backdrop-blur-xl p-6 rounded-2xl
                         border border-outline-variant/10"
    >
      <h3 className="font-headline text-base mb-5 text-on-surface-variant flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-lg">
          tune
        </span>
        Sensitivity
      </h3>
      <div className="space-y-5">
        <SensitivitySlider label="Motion Threshold" defaultValue={85} />
        <SensitivitySlider label="Speed Sensitivity" defaultValue={72} />
        <SensitivitySlider label="Smoothing" defaultValue={45} />
      </div>
    </div>
  );
};

export default SensitivityComponent;
