import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import ControlBar from '../components/ControlBar';
import StatusBar from '../components/StatusBar';
import Button from '../common/Button';
import { useFetcher } from 'react-router-dom';
import Setting from '../components/Setting';

type Document = {
  filepath?: string;
  filename?: string;
  buffer?: string | ArrayBuffer;
  type?: 'docx' | 'html';
};

interface MainLayoutProps {
  children: ReactNode;
}

interface AlertContextType {
  alert: (
    message?: string,
    type?: AlertType,
    oneButton?: boolean,
    download?: string,
  ) => Promise<boolean>;
}

interface AlertProviderProps extends React.DOMAttributes<HTMLDivElement> {
  children: ReactNode;
}

type AlertType = 'info' | 'error' | 'warning';

interface AlertProps extends React.DOMAttributes<HTMLDivElement> {
  message?: string;
  type?: AlertType;
  oneButton?: boolean;
  download?: string;
  onResolve?: (value: boolean | PromiseLike<boolean>) => void;
}

export type CategoryData = {
  title: string;
  defined: string[];
  color: string;
  default?: boolean;
};

export type Category = Record<string, CategoryData>;

interface DocumentContextProps {
  document: Document;
  setDocument: React.Dispatch<React.SetStateAction<Document>>;
  categories: Category;
  addCategory: (key: string, data: CategoryData) => void;
  removeCategory: (key: string) => void;
  updateCategory: (key: string, newData: CategoryData) => void;
}

export const DocumentContext = createContext<DocumentContextProps | null>(null);

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within a AlertProvider');
  }
  return context;
};

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alertState, setAlertState] = useState<{
    message?: string;
    type?: AlertType;
    oneButton?: boolean;
    download?: string;
    resolve?: (value: boolean | PromiseLike<boolean>) => void;
  }>({});

  const alert = (
    message?: string,
    type?: AlertType,
    oneButton?: boolean,
    download?: string,
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setAlertState({ message, type, oneButton, download, resolve });
    });
  };

  const handleResolve = (value: boolean | PromiseLike<boolean>) => {
    if (alertState.resolve) {
      alertState.resolve(value);
      setAlertState({});
    }
  };

  return (
    <AlertContext.Provider value={{ alert }}>
      {children}
      {alertState.message && (
        <Alert
          message={alertState.message}
          type={alertState.type}
          oneButton={alertState.oneButton}
          download={alertState.download}
          onResolve={handleResolve}
        />
      )}
    </AlertContext.Provider>
  );
};

const Alert: React.FC<AlertProps> = ({
  message,
  type,
  oneButton,
  download,
  onResolve,
}) => {
  const handleSureClick = () => {
    if (onResolve) onResolve(true);
  };

  const handleCancelClick = () => {
    if (onResolve) onResolve(false);
  };

  const handleOpenClick = () => {
    if (download) {
      window.electron.ipcRenderer.sendMessage('open-file', download);
    }
  };

  return (
    <div className="absolute rounded-lg w-full h-full top-0 left-0 z-10 flex justify-center items-center bg-[#00000054] backdrop-blur-sm">
      <div className="flex flex-col items-center justify-center p-5 bg-[#eeeeee] shadow-lg gap-5 rounded-lg">
        <h3 className="select-none">{message}</h3>
        <div className="flex justify-around w-full">
          {oneButton ? (
            <>
              <Button className="w-[100px] mr-5" onClick={handleSureClick}>
                Okay
              </Button>
              {download && (
                <Button
                  className="w-[100px]"
                  onClick={handleOpenClick}
                  variant="outline"
                >
                  Open
                </Button>
              )}
            </>
          ) : (
            <>
              <Button className="w-[100px]" onClick={handleSureClick}>
                Sure
              </Button>
              <Button
                className="w-[100px]"
                onClick={handleCancelClick}
                variant="outline"
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [myDocument, setMyDocument] = useState<Document>({});
  const [maximized, setMaximized] = useState(false);
  const [categories, setCategories] = useState<Category>({});

  const addCategory = (key: string, data: CategoryData) => {
    setCategories((prv) => {
      const newCategories = {
        ...prv,
        [key]: data,
      };
      window.electron.ipcRenderer.sendMessage('save-category', newCategories);
      return newCategories;
    });
  };

  const removeCategory = (key: string) => {
    setCategories((prv) => {
      delete prv[key];
      const newCategories = prv;
      window.electron.ipcRenderer.sendMessage('save-category', newCategories);
      return newCategories;
    });
  };

  const updateCategory = (key: string, newData: CategoryData) => {
    setCategories((prv) => {
      const newCategories = {
        ...prv,
        [key]: newData,
      };
      window.electron.ipcRenderer.sendMessage('save-category', newCategories);
      return newCategories;
    });
  };

  useEffect(() => {
    window.electron.ipcRenderer.on('maximized', () => {
      setMaximized(true);
    });
    window.electron.ipcRenderer.on('unmaximized', () => {
      setMaximized(false);
    });
  }, []);

  useEffect(() => {
    window.electron.ipcRenderer.sendMessage('load-category');

    const categoryUnsubscriber = window.electron.ipcRenderer.on(
      'load-category-result',
      (result: any) => {
        if (result.success) {
          setCategories(result.data);
        } else {
          console.error('Failed to load categories:', result.error);
        }
      },
    );

    return () => {
      categoryUnsubscriber();
    };
  }, []);

  return (
    <div className={`h-screen ${maximized ? 'p-0' : 'p-5'}`}>
      <div
        className={`relative h-full bg-[#f8f8f8] ${
          maximized
            ? 'rounded-none'
            : 'rounded-lg [box-shadow:0_4px_8px_0_rgba(0,_0,_0,_0.2),_0_6px_20px_0_rgba(0,_0,_0,_0.19)]'
        } border-[1px] border-solid`}
      >
        <AlertProvider>
          <DocumentContext.Provider
            value={{
              document: myDocument,
              setDocument: setMyDocument,
              categories,
              addCategory,
              removeCategory,
              updateCategory,
            }}
          >
            <ControlBar />
            <div className="flex flex-col h-[calc(100%_-_45px)]">
              <main className="h-full relative">{children}</main>
            </div>
            {/* <StatusBar /> */}
          </DocumentContext.Provider>
        </AlertProvider>
      </div>
    </div>
  );
};

export default MainLayout;
