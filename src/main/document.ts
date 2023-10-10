import { BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { DOMParser, XMLSerializer } from 'xmldom';
import path from 'path';
import { countCharacter } from './util';
// @ts-ignore
import htmlToDocx from 'html-to-docx';

export interface UpdateInfo {
  oldText: string;
  newText: string;
  st: number;
  en: number;
}

function findNthOccurrence(s: string, char: string, n: number): number {
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === char) {
      count++;
      if (count === n) {
        return i;
      }
    }
  }
  return -1;
}

export function manipulateXml(
  xmlString: string | string[],
  updateInformation: UpdateInfo[],
): string[] {
  const xmlDocs =
    typeof xmlString === 'string'
      ? [new DOMParser().parseFromString(xmlString, 'text/xml')]
      : xmlString.map((iXmlString) =>
          new DOMParser().parseFromString(iXmlString, 'text/xml'),
        );

  let textNodes = [];
  const paragraphs = xmlDocs
    .map((xmlDoc) => Array.from(xmlDoc.getElementsByTagName('w:p')))
    .flat();
  for (let i = 0; i < paragraphs.length; i++) {
    const runs = paragraphs[i].getElementsByTagName('w:r');
    for (let j = 0; j < runs.length; j++) {
      const tNodes = runs[j].getElementsByTagName('w:t');
      for (let k = 0; k < tNodes.length; k++) {
        textNodes.push(tNodes[k]);
      }
    }
  }

  let currentAllStText = '';
  let currentAllEnText = '';
  let stTextNode = null;
  let enTextNode = null;
  let idx = -1;
  let finish = false;
  while (updateInformation.length > 0) {
    const info = updateInformation.shift()!;
    const stKey = info.oldText[0];
    const enKey = info.oldText[info.oldText.length - 1];

    while (countCharacter(currentAllStText, stKey) < info.st) {
      stTextNode = textNodes.shift()!;
      if (stTextNode === undefined) {
        finish = true;
        break;
      }
      const currentText = stTextNode.textContent ?? '';
      currentAllStText += currentText;
    }
    if (finish) {
      break;
    }

    const currentStText = stTextNode!.textContent!;
    const prvSt = countCharacter(
      currentAllStText.slice(0, currentAllStText.length - currentStText.length),
      stKey,
    );
    idx = findNthOccurrence(currentStText, stKey, info.st - prvSt);
    stTextNode!.textContent = currentStText.slice(0, idx);

    // Add new term here
    let clonedRunNode = stTextNode!.parentNode!.cloneNode(true) as Element;
    let oldTextNodes = clonedRunNode.getElementsByTagName('w:t');
    while (oldTextNodes.length > 0) {
      clonedRunNode.removeChild(oldTextNodes[0]);
    }
    let newTextElement = stTextNode!.cloneNode(true) as Element;
    newTextElement.textContent = `${info.newText}`;
    clonedRunNode.appendChild(newTextElement);

    let runPropertiesList = clonedRunNode.getElementsByTagName('w:rPr');
    let runProperties: Element | null =
      runPropertiesList.length > 0 ? runPropertiesList[0] : null;

    if (!runProperties) {
      runProperties = clonedRunNode.ownerDocument.createElementNS(
        'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        'w:rPr',
      );
      clonedRunNode.insertBefore(runProperties, clonedRunNode.firstChild);
    }

    let underlineElement = clonedRunNode.ownerDocument.createElementNS(
      'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'w:u',
    );
    underlineElement.setAttribute('w:val', 'single');
    runProperties.appendChild(underlineElement);

    try {
      const parentParagraph = stTextNode!.parentNode!.parentNode;
      if (stTextNode!.parentNode!.nextSibling) {
        parentParagraph!.insertBefore(
          clonedRunNode,
          stTextNode!.parentNode!.nextSibling,
        );
      } else {
        parentParagraph!.appendChild(clonedRunNode);
      }
    } catch (err) {
      console.log(err);
    }

    // Add left term of stTextNode
    let newClonedRunNode = stTextNode!.parentNode!.cloneNode(true) as Element;
    let oldTextNodes1 = newClonedRunNode.getElementsByTagName('w:t');
    while (oldTextNodes1.length > 0) {
      newClonedRunNode.removeChild(oldTextNodes1[0]);
    }
    let lastStNode = stTextNode!.cloneNode(true) as Element;
    lastStNode.textContent = currentStText.slice(idx);
    newClonedRunNode.appendChild(lastStNode);

    try {
      const parentParagraph = stTextNode!.parentNode!.parentNode;
      if (clonedRunNode.nextSibling) {
        parentParagraph!.insertBefore(
          newClonedRunNode,
          clonedRunNode.nextSibling,
        );
      } else {
        parentParagraph!.appendChild(newClonedRunNode);
      }
    } catch (err) {
      console.log(err);
    }

    // Set the last node of st as current enTextNode
    enTextNode = lastStNode;
    currentAllEnText = currentAllStText;

    while (countCharacter(currentAllEnText, enKey) < info.en) {
      enTextNode!.textContent = '';
      enTextNode = textNodes.shift()!;
      if (enTextNode === undefined) {
        finish = true;
        break;
      }
      const currentText = enTextNode.textContent ?? '';
      currentAllEnText += currentText;
    }
    if (finish) {
      break;
    }

    const currentEnText = enTextNode!.textContent!;
    const prvEn = countCharacter(
      currentAllEnText.slice(0, currentAllEnText.length - currentEnText.length),
      enKey,
    );
    idx = findNthOccurrence(currentEnText, enKey, info.en - prvEn);
    enTextNode!.textContent = currentEnText.slice(idx + 1);

    stTextNode = enTextNode;
    currentAllStText = currentAllEnText;
  }

  return xmlDocs.map((xmlDoc) => new XMLSerializer().serializeToString(xmlDoc));
}

export async function modifyWordFile(
  filePath: string,
  updateInformation: {
    headers: UpdateInfo[];
    footers: UpdateInfo[];
    footnotes: UpdateInfo[];
    body: UpdateInfo[];
  },
) {
  // Load the Word document
  const content: Buffer = fs.readFileSync(filePath);
  const zip = new PizZip(content);

  // Manipulate main document
  const mainDocumentXml = zip.file('word/document.xml')?.asText();
  zip.file(
    'word/document.xml',
    manipulateXml(mainDocumentXml!, updateInformation.body)[0],
  );

  // Manipulate headers
  let headerXmls = [];
  for (let i = 1; ; i++) {
    const headerXml = zip.file(`word/header${i}.xml`)?.asText();
    if (!headerXml) break;
    headerXmls.push(headerXml);
  }
  manipulateXml(headerXmls!, updateInformation.headers).forEach(
    (headerXml, idx) => {
      zip.file(`word/header${idx + 1}.xml`, headerXml);
    },
  );

  // Manipulate footers
  let footerXmls = [];
  for (let i = 1; ; i++) {
    const footerXml = zip.file(`word/footer${i}.xml`)?.asText();
    if (!footerXml) break;
    footerXmls.push(footerXml);
  }
  manipulateXml(footerXmls!, updateInformation.footers).forEach(
    (footerXml, idx) => {
      zip.file(`word/footer${idx + 1}.xml`, footerXml);
    },
  );

  // Manipulate footnotes
  const footnotesXml = zip.file('word/footnotes.xml')?.asText();
  if (footnotesXml) {
    zip.file(
      'word/footnotes.xml',
      manipulateXml(footnotesXml, updateInformation.footnotes)[0],
    );
  }

  // Generate the modified Word document using docxtemplater and save it
  const doc = new Docxtemplater().loadZip(zip);
  const buffer: Buffer = doc.getZip().generate({ type: 'nodebuffer' });

  // Ask the user where to save the .docx file using Electron's dialog module
  const mainWindow = BrowserWindow.getFocusedWindow();
  const { filePath: outputPath } = await dialog.showSaveDialog(mainWindow!, {
    title: 'Save as DOCX',
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  });

  if (outputPath) {
    fs.writeFileSync(outputPath, buffer);
    return outputPath;
  }

  return false;
}

export async function convertHTMLtoDocxBuffer(html: string) {
  return await htmlToDocx(html);
}

export async function writeDocxFileFromHTML(html: string) {
  try {
    // Convert the HTML to a .docx format buffer
    const docxBuffer = await htmlToDocx(html);

    // Ask the user where to save the .docx file using Electron's dialog module
    const mainWindow = BrowserWindow.getFocusedWindow();
    const { filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save as DOCX',
      filters: [{ name: 'Word Document', extensions: ['docx'] }],
    });

    // If the user selects a file path, save the buffer to that file
    if (filePath) {
      fs.promises.writeFile(filePath, docxBuffer);
      return filePath;
    }
  } catch (error) {
    console.error('Error saving DOCX:', error);
    // Here you could also handle the error more gracefully, perhaps showing an error dialog to the user
  }
}
