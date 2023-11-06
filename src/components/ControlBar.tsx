import { useEffect } from 'react';
import { RxCross1 } from 'react-icons/rx';
import { FiMinimize } from 'react-icons/fi';
import { MdMinimize } from 'react-icons/md';
import { useAlert } from '../layout/MainLayout';
import { useLocation, useNavigate } from 'react-router-dom';

const ControlBar = () => {
  const { alert } = useAlert();
  const navigate = useNavigate();
  const location = useLocation();

  const handleMinimizeToTaskbar = () => {
    window.electron.ipcRenderer.sendMessage('minimize-to-taskbar');
  };

  const handleToggleMaximize = () => {
    window.electron.ipcRenderer.sendMessage('toggle-maximize');
  };

  const handleCloseWindow = () => {
    window.electron.ipcRenderer.sendMessage('close-window');
  };

  useEffect(() => {
    const closeHandler = () => {
      if (location.pathname !== '/') {
        alert('This document will be discarded.', 'info').then((res) => {
          if (res) {
            window.electron.ipcRenderer.sendMessage('confirm-close-app');
          }
        });
      } else {
        window.electron.ipcRenderer.sendMessage('confirm-close-app');
      }
    };

    const unsubscribe = window.electron.ipcRenderer.on(
      'app-close-initiated',
      closeHandler,
    );

    return unsubscribe;
  }, [location.pathname]);

  return (
    <div
      className="flex justify-between items-center bg-[#f3f3f3] app-region h-[45px] rounded-tl-lg rounded-tr-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center h-full"></div>
      <h3 className="ml-4 flex gap-2 items-center text-gray-800 text-[0.85rem]">
        PIARA - Keep your data secure
      </h3>
      <div className="h-full flex justify-end text-gray-800">
        <button
          className="w-[45px] h-[45px] hover:bg-[#d1d1d1] duration-200 ease-in-out flex items-center justify-center"
          onClick={handleMinimizeToTaskbar}
        >
          <MdMinimize />
        </button>
        <button
          className="w-[45px] h-[45px] hover:bg-[#d1d1d1] duration-200 ease-in-out flex items-center justify-center"
          onClick={handleToggleMaximize}
        >
          <FiMinimize />
        </button>
        <button
          className="w-[45px] h-[45px] hover:bg-[#d63939] hover:text-white duration-200 ease-in-out flex items-center justify-center rounded-tr-lg"
          onClick={handleCloseWindow}
        >
          <RxCross1 />
        </button>
      </div>
    </div>
  );
};

export default ControlBar;
