import React, { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../common/Button';
import { BsImages } from 'react-icons/bs';
import { DocumentContext } from '../layout/MainLayout';

const FileLoad = () => {
  const navigate = useNavigate();
  const { setDocument } = useContext(DocumentContext);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [canProcess, setCanProcess] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const buffer = e.target?.result;
        if (buffer) {
          // Get the filename from the file object
          const filename = file.name;
          const filepath = file.path;

          // Handle the buffer and filename here
          setDocument({
            type: 'docx',
            filepath,
            filename,
            buffer,
          });
          navigate('/analysis');
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleProcess = () => {
    fileInputRef.current?.click();
  };

  const handleContentChange = () => {
    if (contentRef.current) {
      if (contentRef.current.textContent) {
        setCanProcess(true);
        return;
      }
    }
    setCanProcess(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const tab = '\u00a0\u00a0\u00a0\u00a0';
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(tab);
        range.insertNode(node);

        range.setStartAfter(node);
        range.setEndAfter(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  const handleHTMLProcess = async () => {
    if (contentRef.current) {
      window.electron.ipcRenderer.sendMessage(
        'convert-html-to-docx',
        contentRef.current.innerHTML,
      );
    }
  };

  useEffect(() => {
    window.electron.ipcRenderer.on('convert-html-result', (result) => {
      setDocument({
        type: 'html',
        filepath: '',
        filename: 'Untitled Document',
        buffer: result as Buffer,
      });
      navigate('/analysis');
    });
  }, []);

  return (
    <div className="flex justify-between h-full items-center">
      <div className="w-1/2 h-full p-[30px] app-region">
        <div className="flex flex-col justify-center items-center gap-[20px] h-full border-[#4d525d] border-[2px] border-dashed">
          <span className="text-[8.25rem] text-[#4d525d]">
            <BsImages />
          </span>
          <p className="text-lg font-bold">Upload Word documents here</p>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            accept=".docx"
            onChange={handleFileChange}
          />
          <Button onClick={handleProcess}>Select from computer</Button>
        </div>
      </div>
      <p className="font-bold">Or</p>
      <div className="w-1/2 h-full p-[30px]">
        <div className="rounded-sm h-full bg-[#ffffff] no-app-region">
          <div className="h-[calc(100%_-_70px)] p-3 pb-0">
            <div className="relative h-full overflow-y-auto px-2">
              <div
                ref={contentRef}
                className="min-h-full outline-none"
                onInput={handleContentChange}
                onKeyDown={handleKeyDown}
                contentEditable
              ></div>
              {!canProcess && (
                <p className="absolute top-0 left-2 text-[#868686]">
                  Enter your text here
                </p>
              )}
            </div>
          </div>
          <div className="h-[70px] flex justify-center items-center p-3">
            <Button
              className="w-full"
              disabled={!canProcess}
              onClick={handleHTMLProcess}
            >
              Process
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileLoad;
