import { RxCross1 } from 'react-icons/rx';
import { Dropdown, DropdownGroup, DropdownItem } from '../common/Dropdown';
import { useContext, useEffect, useState } from 'react';
import { DocumentContext } from '../layout/MainLayout';
import { MdCancel } from 'react-icons/md';
import { v4 as uuidv4 } from 'uuid';
import { getRandomHexColor } from '../utils/random';

interface SettingProps {
  onHide: () => void;
  onNew: (event: React.KeyboardEvent<HTMLInputElement>, key: string) => void;
  onDelete: (key: string, term: string) => void;
}

const Setting: React.FC<SettingProps> = ({ onHide, onNew, onDelete }) => {
  const documentContext = useContext(DocumentContext);
  const { categories, updateCategory, addCategory, removeCategory } =
    documentContext!;
  const [showCategoryKeys, setShowCategoryKeys] = useState<string[]>([]);

  const handleRemoveUserDefinedTerm = (termKey: string, item: string) => {
    updateCategory(termKey, {
      ...categories[termKey],
      defined: categories[termKey].defined.filter((term) => term !== item),
    });
  };

  const disableSpecialCommand = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === 'z' || event.key === 'Z')
    ) {
      event.preventDefault();
    }
  };

  const handleKeyUp = (
    event: React.KeyboardEvent<HTMLInputElement>,
    key: string,
  ) => {
    // Check if the key pressed was 'Enter'
    const value = (event.target as HTMLInputElement).value;
    if (event.key === 'Enter' && value) {
      if (key === 'category') {
        const isExist = Object.keys(categories)
          .map((categoryKey) => categories[categoryKey].title)
          .includes(value);

        if (isExist) {
          const existingKey = Object.keys(categories).find(
            (categoryKey) => categories[categoryKey].title === value,
          )!;

          setShowCategoryKeys((prv) => [...prv, existingKey]);
        } else {
          const id = uuidv4();
          addCategory(id, {
            title: value,
            defined: [],
            color: getRandomHexColor(),
          });

          setShowCategoryKeys((prv) => [...prv, id]);
        }
      } else {
        updateCategory(key, {
          ...categories[key],
          defined: [...categories[key].defined, value],
        });
      }
      (event.target as HTMLInputElement).value = '';
    }
  };

  return (
    <div
      className="w-full h-full backdrop-blur-sm absolute top-0 left-0 rounded-b-md flex justify-center items-center"
      style={{
        zIndex: 9,
      }}
    >
      <div className="w-[600px] rounded-md bg-[#ffffff] shadow-xl border border-[#b8b8b8]">
        <div className="flex p-3 justify-between items-center border-b border-[#b8b8b8]">
          <p></p>
          <h3 className="font-bold text-[#616161]">Settings</h3>
          <button onClick={onHide}>
            <RxCross1 />
          </button>
        </div>
        <div className="flex h-[350px]">
          <ul className="w-[150px] border-r border-[#b8b8b8] text-center no-app-region overflow-y-auto">
            <li className="p-3 hover:bg-[#ebebeb] cursor-pointer transition-all duration-300">
              User-defined Term Library
            </li>
          </ul>
          <div className="flex-1 overflow-y-auto">
            <DropdownGroup>
              {Object.keys(categories)
                .filter(
                  (termKey) =>
                    categories[termKey].defined.length > 0 ||
                    showCategoryKeys.includes(termKey),
                )
                .map((termKey, idx) => {
                  return (
                    <Dropdown
                      key={idx}
                      termKey={termKey}
                      title={categories[termKey.toLowerCase()].title}
                      showColor={false}
                    >
                      {categories[termKey].defined.map((item, itemIdx) => (
                        <DropdownItem
                          key={itemIdx}
                          className="bg-white border-none"
                        >
                          <div className="flex p-3 gap-3 items-center text-[#616161]">
                            <button
                              className="text-[1.2rem] flex items-center"
                              onClick={() => onDelete(termKey, item)}
                            >
                              <MdCancel />
                            </button>
                            {item}
                          </div>
                        </DropdownItem>
                      ))}
                      <DropdownItem key={'new'} className="bg-white">
                        <div className="flex justify-between items-center w-full p-3">
                          <div className="flex gap-3">
                            <input
                              className="bg-[#fff] outline-none flex-1"
                              placeholder="Add new term"
                              onKeyUp={(e) => onNew(e, termKey)}
                              onKeyDown={disableSpecialCommand}
                            />
                          </div>
                        </div>
                      </DropdownItem>
                    </Dropdown>
                  );
                })}
              <div className="flex justify-between items-center w-full no-app-region p-3 border-[#b8b8b8]">
                <input
                  className="bg-transparent outline-none flex-1"
                  placeholder="Add Category"
                  onKeyUp={(e) => onNew(e, 'category')}
                  onKeyDown={disableSpecialCommand}
                />
              </div>
            </DropdownGroup>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Setting;
