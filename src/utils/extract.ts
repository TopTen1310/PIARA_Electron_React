import { Paragraph } from 'docx';
import { ResultEntity } from '../main/ner';
import { getRandomData } from './random';

export function countCharacter(s: string, char: string): number {
  return s.split(char).length - 1;
}

function replaceWithHash(
  text: string,
  startIndex: number,
  length: number,
): string {
  const prefix = text.slice(0, startIndex);
  const hashString = '#'.repeat(length);
  const suffix = text.slice(startIndex + length);

  return prefix + hashString + suffix;
}

const escapeRegex = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const isEnglishCharacter = (char: string) => {
  return /^[a-zA-Z]$/.test(char);
};

function extractTextWithSupHandling(node: HTMLElement): string {
  let resultText = '';

  for (let child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      resultText += child.nodeValue;
    } else if (
      child.nodeType === Node.ELEMENT_NODE &&
      child.nodeName.toLowerCase() === 'span'
    ) {
      for (let spanChild of child.childNodes) {
        if (spanChild.nodeType === Node.TEXT_NODE) {
          resultText += spanChild.nodeValue;
        } else if (
          spanChild.nodeType === Node.ELEMENT_NODE &&
          (spanChild.nodeName.toLowerCase() === 'sup' ||
            spanChild.nodeName.toLowerCase() === 'sub')
        ) {
          resultText += `\`${spanChild.textContent}\``;
        } else if (
          spanChild.nodeType === Node.ELEMENT_NODE &&
          spanChild.nodeName.toLowerCase() === 'span'
        ) {
          resultText += spanChild.textContent;
        }
      }
    }
  }

  return resultText;
}

function extractTextWithoutTicks(node: HTMLElement): string {
  let resultText = '';
  for (let child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      resultText += child.nodeValue;
    } else if (
      child.nodeType === Node.ELEMENT_NODE &&
      child.nodeName.toLowerCase() === 'span'
    ) {
      for (let spanChild of child.childNodes) {
        if (spanChild.nodeType === Node.TEXT_NODE) {
          resultText += spanChild.nodeValue;
        } else if (
          spanChild.nodeType === Node.ELEMENT_NODE &&
          spanChild.nodeName.toLowerCase() === 'sup'
        ) {
          resultText += spanChild.textContent;
        }
      }
    }
  }
  return resultText;
}

const getSpecificNodes = (node: Node, tag: string): HTMLElement[] => {
  let specificNodes: HTMLElement[] = [];

  if (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).tagName === tag
  ) {
    specificNodes.push(node as HTMLElement);
  } else {
    for (let child of Array.from(node.childNodes)) {
      specificNodes = specificNodes.concat(getSpecificNodes(child, tag));
    }
  }

  return specificNodes;
};

const getParagraphNodes = (node: Node): HTMLElement[] => {
  let paragraphNodes: HTMLElement[] = [];

  if (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).tagName === 'P'
  ) {
    paragraphNodes.push(node as HTMLElement);
  } else {
    for (let child of Array.from(node.childNodes)) {
      paragraphNodes = paragraphNodes.concat(getParagraphNodes(child));
    }
  }

  return paragraphNodes;
};

const getTextNodes = (node: Node): Node[] => {
  let textNodes: Node[] = [];

  if (node.nodeType === Node.TEXT_NODE) {
    textNodes.push(node);
  } else {
    for (let child of Array.from(node.childNodes)) {
      textNodes = textNodes.concat(getTextNodes(child));
    }
  }

  return textNodes;
};

export function extractAllParagraphs(parentClass: string) {
  const paragraphs = [];
  const parentElement = document.querySelector(`.${parentClass}`);
  if (!parentElement) {
    return;
  }

  const paragraphNodes = getParagraphNodes(parentElement);

  for (let i = 0; i < paragraphNodes.length; i++) {
    const text = paragraphNodes[i]?.textContent;

    if (text) {
      paragraphs.push(text);
    }
  }
  return paragraphs;
}

function getUpdateInformation(parentElement: Element, location: string) {
  let updateInformation: {
    oldText: string;
    newText: string;
    st: number;
    en: number;
  }[] = [];

  const bodyNodes = getSpecificNodes(parentElement, location);

  let allTexts = '';
  for (let bodyNode of bodyNodes) {
    let oldText = '';
    let newText = '';
    var prvDataTag: string | null = '';
    // Selecting all <span> child nodes of the bodyNode
    const spanNodes = bodyNode.querySelectorAll('span');
    for (let span of spanNodes) {
      if (
        span.hasAttribute('data-tag') &&
        span.classList.contains('hidden') &&
        span.classList.contains('updated')
      ) {
        continue; // skip the span node
      }

      if (span.hasAttribute('data-tag') && span.classList.contains('updated')) {
        newText = span.textContent ?? '';
        continue;
      }

      if (
        span.hasAttribute('data-tag') &&
        span.classList.contains('original') &&
        span.classList.contains('hidden')
      ) {
        oldText = span.textContent ?? '';
        const currentDataTag = span.getAttribute('data-tag');
        if (currentDataTag !== null && prvDataTag === currentDataTag) {
          updateInformation = [
            ...updateInformation.slice(0, updateInformation.length - 1),
            {
              oldText:
                updateInformation[updateInformation.length - 1].oldText +
                oldText,
              newText:
                updateInformation[updateInformation.length - 1].newText +
                newText,
              st: updateInformation[updateInformation.length - 1].st,
              en: oldText
                ? countCharacter(
                    allTexts + oldText,
                    oldText[oldText.length - 1],
                  )
                : updateInformation[updateInformation.length - 1].en,
            },
          ];
        } else {
          updateInformation.push({
            oldText,
            newText,
            st: countCharacter(allTexts, oldText[0]) + 1,
            en: countCharacter(allTexts + oldText, oldText[oldText.length - 1]),
          });
        }
        prvDataTag = currentDataTag;
      } else {
        if (span.textContent) {
          prvDataTag = '';
        }
      }

      const text = span.textContent;
      if (text) {
        allTexts += text;
      }
    }
  }

  return updateInformation;
}

export function getAllChangeData(parentClass: string) {
  const parentElement = document.querySelector(`.${parentClass}`);
  if (!parentElement) {
    return;
  }

  // Headers
  const headersInformation = getUpdateInformation(parentElement, 'HEADER');

  // Footers
  const footersInformation = getUpdateInformation(parentElement, 'FOOTER');

  // Footnotes
  const footnotesInformation = getUpdateInformation(parentElement, 'OL');

  // Body
  const bodyInformation = getUpdateInformation(parentElement, 'ARTICLE');

  return {
    headers: headersInformation,
    footers: footersInformation,
    footnotes: footnotesInformation,
    body: bodyInformation,
  };
}

export function checkTermExist(parentClass: string, term: string) {
  const parentElement = document.querySelector(`.${parentClass}`);
  if (!parentElement) {
    return;
  }

  const paragraphNodes = getParagraphNodes(parentElement);
  let count = 0;
  for (let i = 0; i < paragraphNodes.length; i++) {
    const text = extractTextWithSupHandling(paragraphNodes[i]);

    if (text) {
      let pattern;

      // Check if the start and end characters of item.term are English characters
      if (
        isEnglishCharacter(term.charAt(0)) &&
        isEnglishCharacter(term.charAt(term.length - 1))
      ) {
        pattern = new RegExp(`\\b${escapeRegex(term)}\\b`, 'g');
      } else {
        pattern = new RegExp(escapeRegex(term), 'g');
      }

      const matches = [...text.matchAll(pattern)];
      count += matches.length;
    }
  }
  return count;
}

export function getTermsFromDocument(
  parentClass: string,
  bertAnalysisResult: ResultEntity[][],
  regexPatterns: Record<string, RegExp[]>,
) {
  const parentElement = document.querySelector(`.${parentClass}`);
  if (!parentElement) {
    return;
  }

  const paragraphNodes = getParagraphNodes(parentElement);
  let results: Record<string, string[]> = {};
  let countMap: Record<string, number> = {};

  let cnt = 0;
  for (let i = 0; i < paragraphNodes.length; i++) {
    const text = extractTextWithSupHandling(paragraphNodes[i]);
    let copyOfText = text;

    if (text) {
      let bertResult = bertAnalysisResult[cnt];
      cnt += 1;
      let stSearchIndex = 0;
      if (bertResult && bertResult.length > 0) {
        for (let bertItem of bertResult) {
          let regex = new RegExp(
            `\\b${bertItem.word}${bertItem.word.endsWith('.') ? '' : '\\b'}`,
            'g',
          );

          regex.lastIndex = stSearchIndex;

          let match = regex.exec(copyOfText!);
          let st = match ? match.index : -1;

          let key = bertItem.entity.toLowerCase();

          if (st > -1) {
            results = {
              ...results,
              [key]: [...new Set([...(results[key] ?? []), bertItem.word])],
            };
            countMap = {
              ...countMap,
              [bertItem.word]: (countMap[bertItem.word] ?? 0) + 1,
            };
            stSearchIndex = st + bertItem.word.length;
          }
        }
      }

      for (let key of Object.keys(regexPatterns)) {
        for (let pattern of regexPatterns[key]) {
          const matches = [...copyOfText!.matchAll(pattern)];
          for (const match of matches) {
            results = {
              ...results,
              [key]: [...new Set([...(results[key] ?? []), match[0]])],
            };
            countMap = {
              ...countMap,
              [match[0]]: (countMap[match[0]] ?? 0) + 1,
            };

            // Replace matched string with hash to avoid next match
            copyOfText = replaceWithHash(
              copyOfText!,
              match.index!,
              match[0].length,
            );
          }
        }
      }
    }
  }

  const finalResult = Object.keys(results)
    .filter((key) => key)
    .reduce(
      (result, key) => ({
        ...result,
        [key]: results[key].map((term) => ({
          term,
          count: countMap[term],
          active: false,
        })),
      }),
      {} as Record<string, { term: string; count: number; active: boolean }[]>,
    );

  return finalResult;
}

export function highlightTerms(
  parentClass: string,
  terms: Record<
    string,
    {
      term: string;
      count: number;
      active: boolean;
    }[]
  >,
  keyMap: Record<string, string>,
  lock: boolean,
) {
  const parentElement = document.querySelector(`.${parentClass}`);
  if (!parentElement) {
    return;
  }

  const paragraphNodes = getParagraphNodes(parentElement);
  let keyCount: Record<string, string[]> = {};
  for (let i = 0; i < paragraphNodes.length; i++) {
    let textWithTicks = extractTextWithSupHandling(paragraphNodes[i]);

    if (textWithTicks) {
      let results: {
        st: number;
        text: string;
        length: number;
        key: string;
      }[] = [];

      if (terms) {
        const flatTerms = Object.keys(terms)
          .map((key) =>
            terms[key].map((item) => ({
              ...item,
              key,
            })),
          )
          .flat()
          .sort((a, b) => b.term.length - a.term.length)
          .filter((item) => item.active);

        for (let i = 0; i < flatTerms.length; i++) {
          const item = flatTerms[i];

          let pattern;

          // Check if the start and end characters of item.term are English characters
          if (
            isEnglishCharacter(item.term.charAt(0)) &&
            isEnglishCharacter(item.term.charAt(item.term.length - 1))
          ) {
            pattern = new RegExp(`\\b${escapeRegex(item.term)}\\b`, 'g');
          } else {
            pattern = new RegExp(escapeRegex(item.term), 'g');
          }

          const matches = [...textWithTicks.matchAll(pattern)];

          for (const match of matches) {
            const backtickCountUpToMatch = (
              textWithTicks.substring(0, match.index!).match(/`/g) || []
            ).length;
            const adjustedIndex = match.index! - backtickCountUpToMatch;

            results.push({
              st: adjustedIndex,
              text: match[0],
              length: match[0].length,
              key: item.key,
            });

            // Replace matched string with hash to avoid next match
            textWithTicks = replaceWithHash(
              textWithTicks!,
              match.index!,
              match[0].length,
            );
          }
        }
      }
      results = results.filter((x) => x.st >= 0).sort((a, b) => a.st - b.st);

      const textNodes = getTextNodes(paragraphNodes[i]);

      let currentTextStartIndex = 0;
      let currentTextEndIndex = 0;
      let currentTextNode = null;

      while (results.length > 0 && currentTextNode !== undefined) {
        const resultItem = results.shift()!;
        if (!resultItem.key) {
          continue;
        }

        let termKeyNumber = -1;
        if (keyCount[resultItem.key]) {
          termKeyNumber = keyCount[resultItem.key].findIndex(
            (x) => x === resultItem.text,
          );
          if (termKeyNumber === -1) {
            keyCount = {
              ...keyCount,
              [resultItem.key]: [...keyCount[resultItem.key], resultItem.text],
            };
            termKeyNumber = keyCount[resultItem.key].length;
          } else {
            termKeyNumber += 1;
          }
        } else {
          keyCount = {
            ...keyCount,
            [resultItem.key]: [resultItem.text],
          };
          termKeyNumber = 1;
        }

        const randomText = `[${keyMap[resultItem.key]} ${termKeyNumber}]`;

        let discoveredLength = 0;
        let usedLength = 0;

        while (
          currentTextEndIndex <= resultItem.st ||
          currentTextNode === null
        ) {
          currentTextNode = textNodes.shift();

          currentTextStartIndex = currentTextEndIndex;

          currentTextEndIndex =
            currentTextStartIndex + currentTextNode!.textContent!.length;
        }

        while (
          currentTextStartIndex <= resultItem.st + resultItem.length &&
          currentTextNode
        ) {
          const currentText = currentTextNode.textContent!;

          // Only left head of current text node
          currentTextNode.textContent = currentText.slice(
            0,
            resultItem.st - currentTextEndIndex,
          );

          // Add term node
          let originalTerm = currentText.slice(
            resultItem.st - currentTextEndIndex,
            currentText.length -
              currentTextEndIndex +
              resultItem.st +
              resultItem.length,
          );
          let newTerm = '';
          if (originalTerm.length + discoveredLength >= resultItem.length) {
            newTerm = randomText.slice(usedLength);
            usedLength = randomText.length;
          } else {
            newTerm = randomText.slice(
              usedLength,
              usedLength + originalTerm.length,
            );
            usedLength += originalTerm.length;
          }
          discoveredLength += originalTerm.length;

          let clonedNode = currentTextNode.parentNode!.cloneNode(false);
          clonedNode.appendChild(new Text(newTerm));
          (clonedNode as HTMLElement).classList.add(`updated`);
          (clonedNode as HTMLElement).classList.add(
            `bg-highlight-${resultItem.key}`,
          );
          if (!lock) (clonedNode as HTMLElement).classList.add(`hidden`);
          (clonedNode as HTMLElement).setAttribute('data-tag', resultItem.text);

          try {
            if (currentTextNode.parentNode!.nextSibling) {
              paragraphNodes[i].insertBefore(
                clonedNode,
                currentTextNode.parentNode!.nextSibling,
              );
            } else {
              paragraphNodes[i].appendChild(clonedNode);
            }
          } catch (err) {}

          // Add term node
          let originClonedNode = currentTextNode.parentNode!.cloneNode(false);
          originClonedNode.appendChild(
            new Text(
              currentText.slice(
                resultItem.st - currentTextEndIndex,
                currentText.length -
                  currentTextEndIndex +
                  resultItem.st +
                  resultItem.length,
              ),
            ),
          );
          (originClonedNode as HTMLElement).classList.add(`original`);
          (originClonedNode as HTMLElement).classList.add(
            `bg-highlight-${resultItem.key}`,
          );
          if (lock) (originClonedNode as HTMLElement).classList.add(`hidden`);
          (originClonedNode as HTMLElement).setAttribute(
            'data-tag',
            resultItem.text,
          );

          if (clonedNode.nextSibling) {
            paragraphNodes[i].insertBefore(
              originClonedNode,
              clonedNode.nextSibling,
            );
          } else {
            paragraphNodes[i].appendChild(originClonedNode);
          }

          // Add left part of current text node
          let tailClonedNode = currentTextNode.parentNode!.cloneNode(false);
          const tailNodeText = currentText.slice(
            currentText.length -
              currentTextEndIndex +
              resultItem.st +
              resultItem.length,
          );
          tailClonedNode.appendChild(new Text(tailNodeText));

          if (originClonedNode.nextSibling) {
            paragraphNodes[i].insertBefore(
              tailClonedNode,
              originClonedNode.nextSibling,
            );
          } else {
            paragraphNodes[i].appendChild(tailClonedNode);
          }

          if (tailNodeText.length > 0) {
            currentTextNode = tailClonedNode.lastChild;
            if (currentTextNode === null || !currentTextNode) break;
            currentTextStartIndex = currentTextEndIndex - tailNodeText.length;
            break;
          } else {
            currentTextNode = textNodes.shift();
            if (!currentTextNode) break;
            currentTextStartIndex = currentTextEndIndex;
            currentTextEndIndex =
              currentTextStartIndex + currentTextNode.textContent!.length;
          }
        }
      }
    }
  }
}
