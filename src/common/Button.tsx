import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline';
}

const Button: React.FC<ButtonProps> = ({
  variant = 'solid',
  children,
  className,
  disabled,
  ...rest
}) => {
  const getButtonClasses = () => {
    let baseStyles = 'px-4 py-2 transition-all duration-300 rounded-lg';

    if (disabled) {
      return `${baseStyles} bg-gray-300 cursor-not-allowed opacity-60`;
    }

    switch (variant) {
      case 'solid':
        return `${baseStyles} bg-[#4537de] text-white border-none hover:bg-[#2b1cc1]`;
      case 'outline':
        return `${baseStyles} bg-transparent text-[#4537de] border-[1px] border-[#4537de] hover:bg-[#4537de] hover:text-white`;
      default:
        return baseStyles;
    }
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

export default Button;
