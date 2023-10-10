import React, { useState, useRef, useEffect } from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  checkboxState?: CheckboxState;
  onClick?: (event: React.MouseEvent<HTMLInputElement>) => void;
}

export type CheckboxState = 'selected' | 'sub-selected' | 'not-selected';

const Checkbox: React.FC<CheckboxProps> = ({
  label,
  className,
  onChange,
  checkboxState,
  onClick,
  ...props
}) => {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = checkboxState === 'sub-selected';
    }
  }, [checkboxState]);

  const toggleCheckboxState = () => {
    let newState: CheckboxState;

    if (checkboxState === 'selected') {
      newState = 'not-selected';
    } else {
      newState = 'selected';
    }

    // If you have an external onChange event, call it here.
    if (onChange) {
      // @ts-ignore
      onChange(newState);
    }
  };

  return (
    <label
      className="flex items-center space-x-2"
      onClick={toggleCheckboxState}
    >
      <input
        type="checkbox"
        className={`custom-checkbox relative form-checkbox border-gray-300 rounded h-5 w-5 ${className}`}
        data-state={checkboxState}
        checked={checkboxState === 'selected'}
        ref={checkboxRef}
        onClick={onClick}
        readOnly
        {...props}
      />
      {label && <span className="text-white">{label}</span>}
    </label>
  );
};

export default Checkbox;
