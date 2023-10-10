import React, {
  useState,
  ReactNode,
  useRef,
  useEffect,
  createContext,
  useContext,
} from 'react';
import { FaAngleDown } from 'react-icons/fa';
import Checkbox, { CheckboxState } from './Checkbox';

interface DropdownItemProps {
  children: ReactNode;
}

interface DropdownProps {
  termKey?: string;
  title: string;
  children?: ReactNode;
  showCount?: boolean;
  handleSelectAll?: () => void;
  checkboxState?: CheckboxState;
}

interface ContextProps {
  activeDropdown: string | null;
  setActiveDropdown: React.Dispatch<React.SetStateAction<string | null>>;
}

interface DropdownGroupProps {
  children: ReactNode;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({ children }) => {
  return (
    <div className="border-b-[1px] border-[#b8b8b8] flex justify-between items-center transform transition-transform duration-300 bg-[#ebebeb]">
      {children}
    </div>
  );
};

export const Dropdown: React.FC<DropdownProps> = ({
  termKey,
  title,
  children,
  showCount = true,
  handleSelectAll,
  checkboxState,
}) => {
  const context = useContext(DropdownContext);
  const childCount = React.Children.count(children);
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    undefined,
  );

  const toggleDropdown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (context) {
      const { activeDropdown, setActiveDropdown } = context;
      if (activeDropdown === title) {
        setIsOpen(false);
        setActiveDropdown(null);
      } else {
        setIsOpen(true);
        setActiveDropdown(title);
      }
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children, contentRef]);

  useEffect(() => {
    if (context && context.activeDropdown !== title) {
      setIsOpen(false);
    }
  }, [context]);

  useEffect(() => {
    if (context && context.activeDropdown === title) {
      setIsOpen(true);
    }
  }, []);

  const meaningColor = termKey
    ? `bg-highlight-${termKey.toLowerCase()}`
    : 'transparent';

  return (
    <div className="no-app-region">
      <div
        className="p-3 border-b-[1px] border-[#b8b8b8] flex justify-between items-center cursor-pointer transform transition-all duration-300 hover:bg-[#ebebeb]"
        onClick={toggleDropdown}
      >
        <div className="flex items-center gap-3">
          <Checkbox
            checkboxState={checkboxState}
            onClick={(e) => {
              e.stopPropagation();
              if (handleSelectAll) {
                handleSelectAll();
              }
            }}
          />
          <h4
            className="font-bold truncate w-[150px]"
            title={`${title} (${showCount ? childCount - 1 : ''})`}
          >
            {title} {showCount ? `(${childCount - 1})` : ''}
          </h4>
        </div>
        <div className="flex items-center gap-5">
          <div className={`w-[20px] h-[20px] rounded ${meaningColor}`}></div>
          <FaAngleDown
            className={`transform transition-transform duration-300 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: isOpen ? `${contentHeight}px` : '0px' }}
      >
        <ul>{children}</ul>
      </div>
    </div>
  );
};

export const DropdownContext = createContext<ContextProps | undefined>(
  undefined,
);

export const DropdownGroup: React.FC<DropdownGroupProps> = ({ children }) => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>('');

  return (
    <DropdownContext.Provider value={{ activeDropdown, setActiveDropdown }}>
      {children}
    </DropdownContext.Provider>
  );
};
