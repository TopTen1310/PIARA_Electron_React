import React, { ReactNode } from 'react';

interface ToolButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

const ToolButton: React.FC<ToolButtonProps> = ({
  children,
  className,
  disabled,
  ...rest
}) => {
  const getButtonClasses = () => {
    let baseStyles = 'px-4 py-2 transition-all duration-300 rounded-lg';

    if (disabled) {
      return `${baseStyles} cursor-not-allowed opacity-60`;
    }

    return `${baseStyles} bg-transparent text-black hover:bg-[#d1d1d1]`;
  };

  return (
    <button
      className={`${getButtonClasses()} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

export default ToolButton;
