import * as docx from 'docx-preview';
import { useContext, useEffect, useRef, useState, WheelEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentContext, useAlert } from '../layout/MainLayout';
import { BsZoomIn, BsZoomOut, BsDownload, BsCheckLg } from 'react-icons/bs';
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
import { MdOutlineAdd, MdOutlineRemove } from 'react-icons/md';
import { ResultEntity } from '../main/ner';
import { FaAngleRight } from 'react-icons/fa';
import NewCategory from '../components/NewCategory';
import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';

type ACTION_TYPE = 'delete' | 'add' | 'apply' | 'unapply';

interface History {
  action: ACTION_TYPE;
  location?: string;
  key?: string;
  value?: string;
  count?: number;
  active?: boolean;
}

let keyMap: Record<string, string> = {
  org: 'Organization',
  loc: 'Location',
  date: 'Date',
  per: 'Person',
  time: 'Time',
  domain: 'Domain',
  email: 'Email',
  phone: 'Phone Number',
};

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
    topPosition += element.offsetTop;
    element = element.offsetParent as HTMLElement; // Using offsetParent to traverse to the next positioned ancestor
  }
  return topPosition;
}

const DocumentAnalysis = () => {
  const navigate = useNavigate();
  const documentContext = useContext(DocumentContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerContainerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startScrollTop, setStartScrollTop] = useState(0);
  const [startX, setStartX] = useState(0);
  const [startScrollLeft, setStartScrollLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState<number>(1);
  const [historyQueue, setHistoryQueue] = useState<History[]>([]);
  const [redoHistoryQueue, setRedoHistoryQueue] = useState<History[]>([]);
  const [terms, setTerms] = useState<
    Record<string, { term: string; count: number; active: boolean }[]>
  >({});
  const [lock, setLock] = useState(false);
  const { alert } = useAlert();
  const [selectedTerm, setSelectedTerm] = useState<string | undefined>();
  const [playAnimation, setPlayAnimation] = useState(false);
  const [customCategoryCount, setCustomCategoryCount] = useState(0);
  const transformComponentRef = useRef<ReactZoomPanPinchRef | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setStartY(e.clientY);
    setStartScrollLeft(containerRef.current?.scrollLeft || 0);
    setStartScrollTop(containerRef.current?.scrollTop || 0);
  };

  const handleMouseUp = (e: MouseEvent) => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const x = e.clientX;
    const y = e.clientY;
    const walkX = x - startX;
    const walkY = y - startY;
    if (containerRef.current) {
      containerRef.current.scrollLeft = startScrollLeft - walkX;
      containerRef.current.scrollTop = startScrollTop - walkY;
    }
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
    if (documentContext.document.type === 'docx') {
      const updateInformation = getAllChangeData('docx-wrapper');
      window.electron.ipcRenderer.sendMessage(
        'download-file',
        documentContext.document.filepath,
        updateInformation,
      );
    } else if (documentContext.document.type === 'html') {
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
      documentContext.document.buffer,
      document.getElementById('container')!,
      undefined,
      {
        ignoreWidth: false,
      },
    );
  };

  const handleKeyUp = (
    event: React.KeyboardEvent<HTMLInputElement>,
    key: string,
  ) => {
    // Check if the key pressed was 'Enter'
    const value = (event.target as HTMLInputElement).value;
    if (event.key === 'Enter' && value) {
      if (key === 'category') {
        keyMap = {
          ...keyMap,
          [`custom${customCategoryCount}`]: value,
        };

        addNewHistory(
          {
            action: 'add',
            location: 'terms',
            key: `custom${customCategoryCount}`,
          },
          true,
        );

        setTerms((prvTerms) => ({
          ...prvTerms,
          [`custom${customCategoryCount}`]: [],
        }));

        setCustomCategoryCount((prv) => prv + 1);
      } else {
        let count = checkTermExist('docx-wrapper', value) ?? 0;
        if (count) {
          addNewHistory({ action: 'add', location: 'terms', key, value }, true);

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
      (event.target as HTMLInputElement).value = '';
    }
  };

  const handleDeleteTerm = (key: string, term: string) => {
    setTerms((prvTerms) => ({
      ...prvTerms,
      [key]: prvTerms[key].filter((item) => {
        if (item.term !== term) return true;
        else {
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
      }),
    }));
  };

  const handleZoomIn = () => {
    if (transformComponentRef.current) {
      const { zoomIn } = transformComponentRef.current!;
      zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (transformComponentRef.current) {
      const { zoomOut } = transformComponentRef.current!;
      zoomOut();
    }
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
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (documentContext.document.buffer) {
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
  }, [documentContext.document]);

  useEffect(() => {
    // Listener for 'process-paragraphs-result'
    const unsubscribeProcessParagraphs = window.electron.ipcRenderer.on(
      'process-paragraphs-result',
      (result) => {
        const foundTerms = getTermsFromDocument(
          'docx-wrapper',
          result as ResultEntity[][],
          patterns,
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
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    renderDocument().then(() => {
      highlightTerms('docx-wrapper', terms, keyMap, lock);

      if (selectedTerm && playAnimation) {
        setPlayAnimation(false);

        if (transformComponentRef.current) {
          const { zoomToElement } = transformComponentRef.current!;
          const element = document.querySelector(`[data-tag="${selectedTerm}"]`)
            ?.parentElement;
          if (element) zoomToElement(element, 1);
        }
      }
    });
  }, [terms, lock, selectedTerm, playAnimation]);

  useEffect(() => {
    setLock(false);
  }, [terms]);

  return (
    <div className="relative h-full">
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
          <h4 className="font-bold">
            {documentContext.document.filename ?? 'Unknown.docx'}
          </h4>
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
          className="relative w-full h-full rounded-bl-lg bg-[#cecece]"
        >
          <TransformWrapper ref={transformComponentRef}>
            <TransformComponent
              wrapperStyle={{
                width: '100%',
                height: '100%',
                borderBottomLeftRadius: '0.5rem',
              }}
            >
              <div
                id="container"
                ref={innerContainerRef}
                className="w-full cursor-grab select-none transition-all duration-300 h-[fit-content] origin-[center_top]"
              />
            </TransformComponent>
          </TransformWrapper>

          {loading && (
            <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center backdrop-blur-sm">
              <BarLoader color="#4537de" />
            </div>
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
              <h3 className="font-bold my-2 text-[1.3rem]">PIARA Work Panel</h3>
              {Object.keys(terms).length > 0 ? (
                <p>
                  Found{' '}
                  {Object.keys(terms).reduce(
                    (result, key) =>
                      result +
                      terms[key].reduce((count, item) => count + item.count, 0),
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
                {terms !== undefined &&
                  Object.keys(terms).map((termKey, idx) => {
                    const flag1 = terms[termKey].some(
                      (x) => x.active === false,
                    );
                    const flag2 = terms[termKey].some((x) => x.active === true);

                    return (
                      <Dropdown
                        key={idx}
                        termKey={termKey}
                        title={keyMap[termKey.toLowerCase()]}
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
                              [termKey]: prvTerms[termKey].map((item) => ({
                                ...item,
                                active: true,
                              })),
                            }));
                          } else if (!flag1 && flag2) {
                            setTerms((prvTerms) => ({
                              ...prvTerms,
                              [termKey]: prvTerms[termKey].map((item) => ({
                                ...item,
                                active: false,
                              })),
                            }));
                          }
                        }}
                      >
                        {terms[termKey].map((item, itemIdx) => (
                          <DropdownItem key={itemIdx}>
                            <EntityItem
                              title={item.term}
                              checked={item.active}
                              onChange={(checked) =>
                                handlePatternToggle(
                                  checked,
                                  termKey.toLowerCase(),
                                  item.term,
                                )
                              }
                              onDelete={(term) =>
                                handleDeleteTerm(termKey, term)
                              }
                              count={item.count}
                            />
                          </DropdownItem>
                        ))}
                        <DropdownItem key={'new'}>
                          <div className="flex justify-between items-center w-full p-3">
                            <div className="flex gap-3">
                              <Checkbox disabled />
                              <input
                                className="bg-[#ebebeb] outline-none flex-1"
                                placeholder="Add new term"
                                onKeyUp={(e) => handleKeyUp(e, termKey)}
                                onKeyDown={disableSpecialCommand}
                              />
                            </div>
                            <button className="w-[22px] h-[22px] flex items-center justify-center hover:bg-[#b8b8b8] rounded  transition-colors duration-200">
                              <FaAngleRight />
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
                >
                  Apply
                </Button>
              ) : null}
              <Button className="w-full" onClick={handleDownload}>
                Download
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentAnalysis;
