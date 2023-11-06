import React, {
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import NewCategory from './NewCategory';
import { DocumentContext } from '../layout/MainLayout';

interface ContextMenuProps {
  left: number;
  top: number;
  text: string;
  onMenuClick: (key: string, value: string) => void;
  keys: string[];
}

const ContextMenu = React.forwardRef<HTMLDivElement, ContextMenuProps>(
  ({ left, top, text, onMenuClick, keys }, ref) => {
    const documentContext = useContext(DocumentContext);
    const { categories } = documentContext!;

    const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
    };

    const innerRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(ref, () => innerRef.current!, []);

    useEffect(() => {
      if (innerRef.current) {
        innerRef.current.classList.remove('opacity-0');
        innerRef.current.classList.add('opacity-100');
      }
    }, []);

    return (
      <div
        className="bg-white rounded shadow-lg border transition-opacity ease-in duration-200 opacity-0 min-w-[200px] "
        style={{
          position: 'absolute',
          top: top,
          left: left,
          zIndex: 999,
          opacity: 1,
          userSelect: 'none',
        }}
      >
        <h2 className="text-center p-2 font-bold bg-[#f5f5f5]">
          Add term to category
        </h2>
        <div
          ref={innerRef}
          className="overflow-y-auto overflow-hidden max-h-[250px]"
          onMouseDown={handleMouseDown}
        >
          {keys.map((key, idx) => {
            const meaningColor = categories[key].color;
            return (
              <div
                key={idx}
                className={`p-2 cursor-pointer hover:bg-gray-200 transition-all duration-200 flex justify-between items-center ${
                  idx !== 0 ? 'border-t' : ''
                }`}
                onClick={(e) => {
                  onMenuClick(key, text);
                }}
              >
                {categories[key].title}
                <div
                  className={`w-[20px] h-[20px] rounded`}
                  style={{
                    backgroundColor: meaningColor,
                  }}
                ></div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

export default ContextMenu;
