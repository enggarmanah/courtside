import React from "react";
import logoSrc from "../../../images/logo.png";

interface LogoImageProps {
  className?: string;
}

export const LogoImage: React.FC<LogoImageProps> = ({ className }) => {
  return (
    <div
      className={className || "w-full h-full"}
      style={{
        backgroundColor: "rgb(var(--brand-600))",
        maskImage: `url(${logoSrc})`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskImage: `url(${logoSrc})`,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
      }}
    />
  );
};