import * as docx from 'docx-preview';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentContext, useAlert } from '../layout/MainLayout';
import { BsZoomIn, BsZoomOut, BsCheckLg } from 'react-icons/bs';
import { CiRedo, CiUndo } from 'react-icons/ci';
import Button from '../common/Button';
import { DropdownItem, Dropdown, DropdownGroup } from '../common/Dropdown';
import ToolButton from '../common/ToolButton';
import {
  checkTermExist,
  extractAllParagraphs,
  getAllChangeData,
  getTermsFromDocument,
  highlightTerms,
} from '../utils/extract';
import Checkbox from '../common/Checkbox';
import { patterns } from '../utils/pattern';
import { BarLoader } from 'react-spinners';
import { MdArrowBackIosNew, MdOutlineRemove } from 'react-icons/md';
import { ResultEntity } from '../main/ner';
import { FaAngleRight, FaPlus, FaRegCopy } from 'react-icons/fa';
import { LuPlus } from 'react-icons/lu';
import NewCategory from '../components/NewCategory';
import ContextMenu from '../components/ContextMenu';
import Setting from '../components/Setting';
import { HiMenu } from 'react-icons/hi';
import { v4 as uuidv4 } from 'uuid';
import { getRandomHexColor } from '../utils/random';

type ACTION_TYPE = 'delete' | 'add' | 'apply' | 'unapply';

interface History {
  action: ACTION_TYPE;
  location?: string;
  key?: string;
  value?: string;
  count?: number;
  active?: boolean;
}

interface EntityItemProps {
  count?: number;
  title: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  onDelete?: (title: string) => void;
}

const EntityItem: React.FC<EntityItemProps> = ({
  count,
  title,
  checked,
  onChange,
  onDelete,
}) => {
  const handleChange = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (onChange) {
      onChange(!checked);
    }
  };

  return (
    <div
      className="p-3 w-full h-full flex justify-between items-center cursor-pointer hover:bg-[#f7f7f7] transition-colors duration-200 "
      title={title}
      onClick={handleChange}
    >
      <div className="flex items-center justify-start gap-10">
        <Checkbox
          checkboxState={checked ? 'selected' : 'not-selected'}
          readOnly
        />
        <h3 className="max-w-[150px] truncate">
          {title} <small>({count})</small>
        </h3>
      </div>

      {onDelete ? (
        <button
          className="w-[22px] h-[22px] flex items-center justify-center hover:bg-[#b8b8b8] rounded  transition-colors duration-200"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(title);
          }}
        >
          <MdOutlineRemove />
        </button>
      ) : null}
    </div>
  );
};

function getAbsoluteTopPosition(
  element: HTMLElement,
  stopElement: HTMLElement,
): number {
  let topPosition = 0;
  while (element && element !== stopElement) {
    topPosition += element.offsetTop - 15;
    element = element.offsetParent as HTMLElement; // Using offsetParent to traverse to the next positioned ancestor
  }
  return topPosition;
}

const DocumentAnalysis = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const innerContainerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyQueue, setHistoryQueue] = useState<History[]>([]);
  const [redoHistoryQueue, setRedoHistoryQueue] = useState<History[]>([]);
  const [terms, setTerms] = useState<
    Record<string, { term: string; count: number; active: boolean }[]>
  >({});
  const [lock, setLock] = useState(false);
  const { alert } = useAlert();
  const [selectedTerm, setSelectedTerm] = useState<string | undefined>();
  const [playAnimation, setPlayAnimation] = useState(false);
  const [selection, setSelection] = useState({
    top: 0,
    left: 0,
    width: 0,
    visible: false,
    text: '',
    existingDataTags: [] as string[],
  });
  const documentContext = useContext(DocumentContext);
  const { categories, addCategory, removeCategory, updateCategory } =
    documentContext!;
  const [contextMenuSize, setContextMenuSize] = useState({
    width: 0,
    height: 0,
  });
  const [copySuccess, setCopySuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [showSetting, setShowSetting] = useState(false);
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragged, setDragged] = useState(false);

  const handleShowSetting = () => {
    const removeKeys = Object.keys(categories).filter(
      (key) => !categories[key].default && categories[key].defined.length === 0,
    );
    removeKeys.forEach((key) => removeCategory(key));

    setShowSetting(true);
  };

  const handleHideSetting = () => {
    const removeKeys = Object.keys(categories).filter(
      (key) => !categories[key].default && categories[key].defined.length === 0,
    );
    removeKeys.forEach((key) => removeCategory(key));

    setShowSetting(false);
  };

  const handlePatternToggle = (
    checked: boolean,
    key: string,
    value: string,
  ) => {
    if (checked) {
      setTerms((prvTerms) => ({
        ...prvTerms,
        [key]: prvTerms[key].map((item) =>
          item.term === value
            ? {
                ...item,
                active: true,
              }
            : item,
        ),
      }));
      setSelectedTerm(value);
      setPlayAnimation(true);
    } else {
      setTerms((prvTerms) => ({
        ...prvTerms,
        [key]: prvTerms[key].map((item) =>
          item.term === value
            ? {
                ...item,
                active: false,
              }
            : item,
        ),
      }));
    }
  };

  const handleApply = () => {
    if (!lock) {
      addNewHistory({ action: 'apply' }, true);
      setLock(true);
    }
  };

  const handleDownload = async () => {
    if (documentContext!.document.type === 'docx') {
      const updateInformation = getAllChangeData('docx-wrapper');
      window.electron.ipcRenderer.sendMessage(
        'download-file',
        documentContext!.document.filepath,
        updateInformation,
      );
    } else if (documentContext!.document.type === 'html') {
      const clonedElement = document
        .getElementsByClassName('docx-wrapper')[0]
        ?.cloneNode(true) as HTMLElement;

      if (clonedElement) {
        // Remove spans with the 'hidden' class
        const spansToRemove = clonedElement.querySelectorAll('span.hidden');
        spansToRemove.forEach(
          (span: Element) => span.parentElement?.removeChild(span),
        );

        // Transform spans with the 'updated' class to be wrapped by <u>
        const spansToUnderline = clonedElement.querySelectorAll('span.updated');
        spansToUnderline.forEach((span: Element) => {
          const underlineElem = document.createElement('u');
          while (span.firstChild) {
            underlineElem.appendChild(span.firstChild);
          }
          span.parentElement?.replaceChild(underlineElem, span);
        });

        window.electron.ipcRenderer.sendMessage(
          'write-html-to-docx',
          clonedElement.innerHTML,
        );
      }
    }
  };

  const renderDocument = () => {
    return docx.renderAsync(
      documentContext!.document.buffer,
      document.getElementById('container')!,
      undefined,
      {
        ignoreWidth: false,
      },
    );
  };

  const addNewTerm = (key: string, value: string) => {
    let count = checkTermExist('docx-wrapper', value) ?? 0;
    if (count) {
      const existingDataTags = selection.existingDataTags;

      addNewHistory({ action: 'add', location: 'terms', key, value }, true);

      updateCategory(key, {
        ...categories[key],
        defined: [...categories[key].defined, value],
      });

      setTerms((prvTerms) => {
        const cleanedTerms = Object.keys(prvTerms).reduce(
          (result, key) => {
            existingDataTags.forEach((dtg) => {
              if (prvTerms[key].findIndex((term) => term.term === dtg) !== -1) {
                addNewHistory(
                  { action: 'delete', location: 'terms', key, value: dtg },
                  true,
                );
              }
            });

            return {
              ...result,
              [key]: prvTerms[key].filter(
                (term) => !existingDataTags.includes(term.term),
              ),
            };
          },
          {} as Record<string, any>,
        );
        return {
          ...cleanedTerms,
          [key]: [
            ...new Set([
              ...(cleanedTerms[key] ?? []),
              {
                term: value,
                count,
                active: true,
              },
            ]),
          ],
        };
      });

      setSelectedTerm(value);
      setSelection((selection) => ({
        ...selection,
        visible: false,
      }));
    } else {
      setSelection((selection) => ({
        ...selection,
        visible: false,
      }));
      alert(`"${value}" is not a completed word.`, 'error', true);
    }
  };

  const handleKeyUp = (
    event: React.KeyboardEvent<HTMLInputElement>,
    key: string,
  ) => {
    // Check if the key pressed was 'Enter'
    const value = (event.target as HTMLInputElement).value;
    if (event.key === 'Enter' && value && value.replace(/\W/g, '').length > 1) {
      if (key === 'category') {
        const isExist = Object.keys(categories)
          .map((categoryKey) => categories[categoryKey].title)
          .includes(value);
        if (isExist) {
          const existingKey = Object.keys(categories).find(
            (categoryKey) => categories[categoryKey].title === value,
          )!;
          setTerms((prvTerms) => ({
            ...prvTerms,
            [existingKey]: [],
          }));
        } else {
          const id = uuidv4();
          addCategory(id, {
            title: value,
            defined: [],
            color: getRandomHexColor(),
          });

          addNewHistory(
            {
              action: 'add',
              location: 'terms',
              key: id,
            },
            true,
          );

          setTerms((prvTerms) => ({
            ...prvTerms,
            [id]: [],
          }));
        }
      } else {
        let count = checkTermExist('docx-wrapper', value) ?? 0;
        if (count) {
          addNewHistory({ action: 'add', location: 'terms', key, value }, true);

          updateCategory(key, {
            ...categories[key],
            defined: [...categories[key].defined, value],
          });

          setTerms((prvTerms) => ({
            ...prvTerms,
            [key]: [
              ...new Set([
                ...prvTerms[key],
                {
                  term: value,
                  count,
                  active: true,
                },
              ]),
            ],
          }));

          setSelectedTerm(value);
          setPlayAnimation(true);
        } else {
          alert(
            `Can't find "${value}" from the document. Please attention to capitalized words.`,
            'error',
            true,
          );
        }
      }
      const termKeyElement = document.getElementById(value);
      termKeyElement?.scrollIntoView({ behavior: 'smooth' });

      (event.target as HTMLInputElement).value = '';
    }
  };

  const handleDeleteTerm = (key: string, term: string) => {
    setTerms((prvTerms) => {
      const newTerms = prvTerms[key].filter((item) => {
        if (item.term !== term) return true;
        else {
          updateCategory(key, {
            ...categories[key],
            defined: categories[key].defined.filter(
              (definedTerm) => definedTerm !== term,
            ),
          });

          addNewHistory(
            {
              action: 'delete',
              location: 'terms',
              key,
              value: term,
              count: item.count,
              active: item.active,
            },
            true,
          );
          return false;
        }
      });

      if (newTerms.length === 0) {
        delete prvTerms[key];
        return prvTerms;
      } else {
        return {
          ...prvTerms,
          [key]: newTerms,
        };
      }
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    }
  };

  const handleZoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.1, 2));
  };

  const handleZoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.1, 0.5));
  };

  const addNewHistory = (history: History, resetRedo?: boolean) => {
    if (resetRedo) {
      setRedoHistoryQueue([]);
    }

    setHistoryQueue((prvHis) => [
      ...prvHis,
      {
        action: history.action,
        location: history.location,
        key: history.key,
        value: history.value,
        count: history.count,
        active: history.active,
      },
    ]);
  };

  const addNewRedoHistory = (history: History) => {
    setRedoHistoryQueue((prvHis) => [
      ...prvHis,
      {
        action: history.action,
        location: history.location,
        key: history.key,
        value: history.value,
        count: history.count,
        active: history.active,
      },
    ]);
  };

  const actionByHistory = (history: History, backward: boolean) => {
    switch (history.action) {
      case 'add':
        if (history.location === 'terms') {
          if (history.value) {
            setTerms((prv) => ({
              ...prv,
              [history.key!]: prv[history.key!].filter((item) => {
                if (item.term !== history.value) return true;
                else {
                  if (backward) {
                    addNewRedoHistory({
                      action: 'delete',
                      location: 'terms',
                      key: history.key,
                      value: item.term,
                      active: item.active,
                      count: item.count,
                    });
                  } else {
                    addNewHistory({
                      action: 'delete',
                      location: 'terms',
                      key: history.key,
                      value: item.term,
                      active: item.active,
                      count: item.count,
                    });
                  }
                  return false;
                }
              }),
            }));
          } else {
            setTerms((prv) => {
              delete prv[history.key!];
              return prv;
            });
            if (backward) {
              addNewRedoHistory({
                action: 'delete',
                location: 'terms',
                key: history.key,
              });
            } else {
              addNewHistory({
                action: 'delete',
                location: 'terms',
                key: history.key,
              });
            }
          }
        }
        break;
      case 'delete':
        if (history.location === 'terms') {
          setTerms((prv) => ({
            ...prv,
            [history.key!]: [
              ...new Set([
                ...prv[history.key!],
                {
                  term: history.value!,
                  count: history.count!,
                  active: history.active!,
                },
              ]),
            ],
          }));
          if (backward) {
            addNewRedoHistory({
              action: 'add',
              location: 'terms',
              key: history.key,
              value: history.value!,
            });
          } else {
            addNewHistory({
              action: 'add',
              location: 'terms',
              key: history.key,
              value: history.value!,
            });
          }
        }
        break;
      case 'apply':
        setLock(false);
        if (backward) {
          addNewRedoHistory({
            action: 'unapply',
          });
        } else {
          addNewHistory({
            action: 'unapply',
          });
        }
        break;
      case 'unapply':
        setLock(true);
        if (backward) {
          addNewRedoHistory({
            action: 'apply',
          });
        } else {
          addNewHistory({
            action: 'apply',
          });
        }
        break;
    }
  };

  const handleUndo = () => {
    if (historyQueue.length === 0) return;
    const history = historyQueue[historyQueue.length - 1];
    setHistoryQueue((prv) => prv.slice(0, -1));

    actionByHistory(history, true);
  };

  const handleRedo = () => {
    if (redoHistoryQueue.length === 0) return;
    const history = redoHistoryQueue[redoHistoryQueue.length - 1];
    setRedoHistoryQueue((prv) => prv.slice(0, -1));

    actionByHistory(history, false);
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

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && containerRef.current?.contains(selection.anchorNode)) {
        if (!selection.rangeCount) {
          setSelection((selection) => ({
            ...selection,
            visible: false,
          }));
          return;
        }
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const scrollTop =
          window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft =
          window.pageXOffset || document.documentElement.scrollLeft;
        const containerRect = containerRef.current?.getBoundingClientRect();

        let top = rect.top + scrollTop - (containerRect?.top ?? 0);
        let left = rect.left + scrollLeft - (containerRect?.left ?? 0);

        setSelection({
          top,
          left,
          width: containerRect?.width ?? 0,
          visible: !!selection.toString(),
          text: selection.toString(),
          existingDataTags: [
            (selection?.anchorNode?.parentNode as HTMLElement)?.getAttribute(
              'data-tag',
            ),
            (selection?.focusNode?.parentNode as HTMLElement)?.getAttribute(
              'data-tag',
            ),
          ].filter((dtg) => typeof dtg === 'string') as string[],
        });
      } else {
        setSelection((selection) => ({
          ...selection,
          visible: false,
        }));
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const copyToClipboard = () => {
    const container = document.getElementsByClassName('docx-wrapper')[0];
    if (!container) return;

    const clonedContainer = container.cloneNode(true) as HTMLElement;

    const hiddenElements = clonedContainer.getElementsByClassName('hidden');

    while (hiddenElements.length > 0) {
      hiddenElements[0].parentNode?.removeChild(hiddenElements[0]);
    }

    const htmlToCopy = clonedContainer.outerHTML;

    const textToCopy = clonedContainer.textContent || '';

    const item = new ClipboardItem({
      'text/html': new Blob([htmlToCopy], { type: 'text/html' }),
      'text/plain': new Blob([textToCopy], { type: 'text/plain' }),
    });

    navigator.clipboard.write([item]).then(
      () => {
        setCopySuccess(true);
      },
      (error) => {
        console.error('Could not copy text: ', error);
      },
    );
  };

  const handleButtonClick = (index: number, termKey: string) => {
    const inputElement = inputRefs.current[index];
    if (inputElement) {
      const mockEvent = {
        target: inputElement,
        key: 'Enter',
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any;
      handleKeyUp(mockEvent, termKey);
    }
  };

  const handleBackClick = () => {
    alert('This document will be discarded.', 'info').then((res) => {
      if (res) {
        navigate('/');
      }
    });
  };

  const handleMouseDown = (e: any) => {
    setDragging(true);
  };

  const handleMouseMove = (e: any) => {
    if (dragging) {
      setDragged(true);
    }
  };

  const handleMouseUp = (e: any) => {
    setDragged(false);
    if (dragging) {
      setDragging(false);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (copySuccess) {
      timer = setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    }
    return () => {
      clearTimeout(timer);
    };
  }, [copySuccess]);

  useEffect(() => {
    const contextMenu = contextMenuRef.current;
    if (contextMenu) {
      setContextMenuSize({
        width: contextMenu.offsetWidth,
        height: contextMenu.offsetHeight,
      });
    }
  }, [contextMenuRef.current, selection.visible]);

  useEffect(() => {
    if (documentContext!.document.buffer) {
      renderDocument().then((x) => {
        setLoading(true);
        const paragraphs = extractAllParagraphs('docx-wrapper');
        if (paragraphs) {
          window.electron.ipcRenderer.sendMessage(
            'process-paragraphs',
            paragraphs,
          );
        }
      });
    } else {
      navigate('/');
    }
  }, [documentContext!.document]);

  useEffect(() => {
    // Listener for 'process-paragraphs-result'
    const unsubscribeProcessParagraphs = window.electron.ipcRenderer.on(
      'process-paragraphs-result',
      (result: any) => {
        const foundTerms = getTermsFromDocument(
          'docx-wrapper',
          result.bert as ResultEntity[][],
          result.spacy as ResultEntity[][],
          patterns,
          categories,
        );

        setTerms(foundTerms ?? {});
        setLoading(false);
      },
    );

    // Listener for 'file-write-success'
    const unsubscribeFileWriteSuccess = window.electron.ipcRenderer.on(
      'file-write-success',
      (filePath) => {
        alert(
          'Successfully downloaded!',
          'info',
          true,
          filePath as string,
        ).then((res) => {});
      },
    );

    // Listener for 'file-write-failed'
    const unsubscribeFileWriteFailed = window.electron.ipcRenderer.on(
      'file-write-failed',
      () => {
        alert('Failed to downloaded!', 'error', true);
      },
    );

    // Listener for 'undo'
    const unsubscribeUndo = window.electron.ipcRenderer.on(
      'undo-command',
      handleUndo,
    );

    // Listener for 'redo'
    const unsubscribeRedo = window.electron.ipcRenderer.on(
      'redo-command',
      handleRedo,
    );

    // Cleanup function to unsubscribe from all listeners
    return () => {
      unsubscribeProcessParagraphs();
      unsubscribeFileWriteSuccess();
      unsubscribeFileWriteFailed();
      unsubscribeUndo();
      unsubscribeRedo();
    };
  }, [handleUndo, handleRedo, categories]);

  const validCategories = useMemo(
    () =>
      Object.keys(categories)
        .filter((key) => terms[key])
        .map((key) => ({
          ...categories[key],
          key,
        })),
    [JSON.stringify(categories), JSON.stringify(terms)],
  );

  useEffect(() => {
    renderDocument().then(() => {
      highlightTerms('docx-wrapper', terms, categories, lock);

      if (selectedTerm && playAnimation) {
        setPlayAnimation(false);
        const element = document.querySelector(`[data-tag="${selectedTerm}"]`)
          ?.parentElement;
        const container = document.getElementById('container');
        const scrollView = container?.parentElement;

        if (element && scrollView) {
          let topPosition = getAbsoluteTopPosition(element, scrollView);
          scrollView.scrollTo({
            top: topPosition,
            behavior: 'smooth',
          });
        }
      }
    });
  }, [terms, lock, selectedTerm, playAnimation, validCategories]);

  useEffect(() => {
    setLock(false);
  }, [terms]);

  const contextMenuHeight = contextMenuSize.height;
  const contextMenuWidth = contextMenuSize.width;

  return (
    <div className="h-full">
      <div className="h-[50px] flex items-center justify-between border-b border-[#4537de]">
        <ToolButton
          className="h-full rounded-none rounded-tl-lg"
          onClick={handleBackClick}
        >
          <MdArrowBackIosNew />
        </ToolButton>
        <h4 className="font-bold">
          {documentContext!.document.filename ?? 'Unknown.docx'}
        </h4>
        <ToolButton onClick={handleShowSetting}>
          <HiMenu />
        </ToolButton>
      </div>
      <div className="relative h-[calc(100%_-_50px)]">
        <div className="relative max-w-[calc(100%_-_300px)] h-full pt-[50px]">
          <div className="w-full h-[50px] bg-[#ffffff] absolute top-0 left-0 z-[9] drop-shadow-lg app-region flex justify-between items-center border-b-[1px] border-[#9b9b9b]">
            <div className="flex h-full p-1 gap-1">
              <ToolButton title="Zoom In" onClick={handleZoomIn}>
                <BsZoomIn />
              </ToolButton>
              <ToolButton title="Zoom Out" onClick={handleZoomOut}>
                <BsZoomOut />
              </ToolButton>
            </div>

            <div className="flex h-full p-1 gap-1">
              <ToolButton
                title="Undo"
                onClick={handleUndo}
                disabled={historyQueue.length === 0}
              >
                <CiUndo />
              </ToolButton>
              <ToolButton
                title="Redo"
                onClick={handleRedo}
                disabled={redoHistoryQueue.length === 0}
              >
                <CiRedo />
              </ToolButton>
            </div>
          </div>
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            className="relative w-full h-full rounded-bl-lg bg-[#cecece]"
          >
            <div className="overflow-y-auto h-full">
              <div
                id="container"
                ref={innerContainerRef}
                onWheel={handleWheel}
                className={`w-full transition-all duration-300 h-[fit-content] origin-[left_top]`}
                style={{ transform: `scale(${scale})` }}
              />
            </div>

            {loading && (
              <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center backdrop-blur-sm">
                <BarLoader color="#4537de" />
              </div>
            )}

            {(!dragged || !dragging) && selection.visible && (
              <ContextMenu
                top={
                  selection.top - contextMenuHeight > 0
                    ? selection.top - contextMenuHeight - 44
                    : selection.top + 20
                }
                left={
                  selection.left + contextMenuWidth < selection.width
                    ? selection.left
                    : selection.left - contextMenuWidth
                }
                text={selection.text}
                onMenuClick={addNewTerm}
                keys={validCategories.map((category) => category.key)}
                ref={contextMenuRef}
              />
            )}

            {lock && (
              <ToolButton
                className={`absolute top-3 right-3 bg-[#FFFFFFA9] border text-[1.25rem] !p-2 text-[#bbbbbb] hover:text-white`}
                title="Copy to Clipboard"
                onClick={copyToClipboard}
              >
                {copySuccess ? <BsCheckLg /> : <FaRegCopy />}
              </ToolButton>
            )}
          </div>
        </div>
        <div className="absolute app-region top-0 right-0 w-[300px] h-full flex flex-col justify-between border-l-[1px] border-[#4537de]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <BarLoader color="#4537de" />
            </div>
          ) : (
            <>
              <div className="p-3 border-b-[1px] border-[#d6d6d6] bg-[#ebebeb]">
                <h3 className="font-bold my-2 text-[1.3rem]">
                  PIARA Work Panel
                </h3>
                {Object.keys(terms).length > 0 ? (
                  <p>
                    Found{' '}
                    {Object.keys(terms).reduce(
                      (result, key) =>
                        result +
                        terms[key].reduce(
                          (count, item) => count + item.count,
                          0,
                        ),
                      0,
                    )}{' '}
                    potential Sensitive Information
                  </p>
                ) : (
                  'No sensitive information found.'
                )}
              </div>
              <div className="h-full flex flex-col justify-start overflow-y-auto">
                <DropdownGroup>
                  {validCategories.map((category, idx) => {
                    const key = category.key;
                    const subTerms = terms[key] ?? [];
                    const flag1 = subTerms.some((x) => x.active === false);
                    const flag2 = subTerms.some((x) => x.active === true);

                    return (
                      <Dropdown
                        key={idx}
                        termKey={key}
                        title={category.title}
                        checkboxState={
                          !flag1 && flag2
                            ? 'selected'
                            : flag1 && flag2
                            ? 'sub-selected'
                            : 'not-selected'
                        }
                        handleSelectAll={() => {
                          if (flag1) {
                            setTerms((prvTerms) => ({
                              ...prvTerms,
                              [key]: prvTerms[key].map((item) => ({
                                ...item,
                                active: true,
                              })),
                            }));
                          } else if (!flag1 && flag2) {
                            setTerms((prvTerms) => ({
                              ...prvTerms,
                              [key]: prvTerms[key].map((item) => ({
                                ...item,
                                active: false,
                              })),
                            }));
                          }
                        }}
                      >
                        {subTerms.map((item, itemIdx) => (
                          <DropdownItem key={itemIdx}>
                            <EntityItem
                              title={item.term}
                              checked={item.active}
                              onChange={(checked) =>
                                handlePatternToggle(
                                  checked,
                                  key.toLowerCase(),
                                  item.term,
                                )
                              }
                              onDelete={(term) => handleDeleteTerm(key, term)}
                              count={item.count}
                            />
                          </DropdownItem>
                        ))}
                        <DropdownItem key={'new'}>
                          <div className="flex justify-between items-center w-full p-3">
                            <div className="flex gap-3">
                              <Checkbox disabled />
                              <input
                                ref={(el) => (inputRefs.current[idx] = el)}
                                className="bg-[#ebebeb] outline-none flex-1"
                                placeholder="Add new term"
                                onKeyUp={(e) => handleKeyUp(e, key)}
                                onKeyDown={disableSpecialCommand}
                              />
                            </div>
                            <button
                              className="w-[22px] h-[22px] flex items-center justify-center hover:bg-[#b8b8b8] rounded  transition-colors duration-200"
                              onClick={() => handleButtonClick(idx, key)}
                            >
                              <LuPlus />
                            </button>
                          </div>
                        </DropdownItem>
                      </Dropdown>
                    );
                  })}
                  <NewCategory handleKeyUp={handleKeyUp} />
                </DropdownGroup>
              </div>
              <div className="p-2">
                {!loading ? (
                  <Button
                    className="w-full mb-2 bg-[#FF0000] hover:bg-[#EE0000A0]"
                    onClick={handleApply}
                    disabled={lock}
                  >
                    Apply
                  </Button>
                ) : null}
                <Button
                  className="w-full"
                  onClick={handleDownload}
                  disabled={!lock}
                >
                  Download
                </Button>
              </div>
            </>
          )}
        </div>
        {showSetting && (
          <Setting
            onHide={handleHideSetting}
            onNew={handleKeyUp}
            onDelete={handleDeleteTerm}
          />
        )}
      </div>
    </div>
  );
};

export default DocumentAnalysis;
