import { FaAngleRight } from 'react-icons/fa';
import { DropdownContext } from '../common/Dropdown';
import { useContext } from 'react';

interface NewCategoryProps {
  handleKeyUp: (
    event: React.KeyboardEvent<HTMLInputElement>,
    key: string,
    category?: string,
  ) => void;
}

const NewCategory: React.FC<NewCategoryProps> = ({ handleKeyUp }) => {
  const context = useContext(DropdownContext);

  const onKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const value = (e.target as HTMLInputElement).value;
    if (e.key === 'Enter' && value) {
      if (context) {
        const { setActiveDropdown } = context;
        setActiveDropdown(value);
      }
      handleKeyUp(e, 'category');
    }
  };

  return (
    <div className="flex justify-between items-center w-full no-app-region p-3 border-b-[1px] border-[#b8b8b8]">
      <input
        className="bg-transparent outline-none flex-1"
        placeholder="New Categories"
        onKeyUp={onKeyUp}
      />
      <button className="w-[22px] h-[22px] flex items-center justify-center hover:bg-[#b8b8b8] rounded  transition-colors duration-200">
        <FaAngleRight />
      </button>
    </div>
  );
};

export default NewCategory;
