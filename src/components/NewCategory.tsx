import { FaAngleRight } from 'react-icons/fa';
import { DropdownContext } from '../common/Dropdown';
import { useContext, useRef } from 'react';
import { LuPlus } from 'react-icons/lu';

interface NewCategoryProps {
  handleKeyUp?: (
    event: React.KeyboardEvent<HTMLInputElement>,
    key: string,
    category?: string,
  ) => void;
}

const NewCategory: React.FC<NewCategoryProps> = ({ handleKeyUp }) => {
  const context = useContext(DropdownContext);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const value = (e.target as HTMLInputElement).value;
    if (e.key === 'Enter' && value) {
      if (context) {
        const { setActiveDropdown } = context;
        setActiveDropdown(value);
      }
      if (handleKeyUp) handleKeyUp(e, 'category');
    }
  };

  const handleButtonClick = () => {
    const inputElement = inputRef.current;
    if (inputElement) {
      const mockEvent = {
        target: inputElement,
        key: 'Enter',
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any;
      onKeyUp(mockEvent);
    }
  };

  return (
    <div className="flex justify-between items-center w-full no-app-region p-3 border-b-[1px] border-[#b8b8b8]">
      <input
        ref={inputRef}
        className="bg-transparent outline-none flex-1"
        placeholder="Add Category"
        onKeyUp={onKeyUp}
      />
      <button
        className="w-[22px] h-[22px] flex items-center justify-center hover:bg-[#b8b8b8] rounded  transition-colors duration-200"
        onClick={handleButtonClick}
      >
        <LuPlus />
      </button>
    </div>
  );
};

export default NewCategory;
