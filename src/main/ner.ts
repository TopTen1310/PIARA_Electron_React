// @ts-ignore
import { env } from '@xenova/transformers';
import path from 'path';
import { app } from 'electron';

env.remoteModels = false;

if (process.env.NODE_ENV === 'development') {
  env.localURL = path.join(__dirname, '..', '..', 'models');
} else {
  // For packaged app
  env.localURL = path.join(path.dirname(app.getAppPath()), 'models');
}

export const task: string = 'token-classification';
export const model: string = 'dslim/bert-base-NER';

export type NEREntity = {
  entity: string;
  word: string;
  start: null | number;
  end: null | number;
};

export type ResultEntity = {
  word: string;
  entity: string;
};

export const processNEREntities = (entities: NEREntity[]): ResultEntity[] => {
  const result: ResultEntity[] = [];
  let currentWord = '';
  let currentEntity = '';

  for (let i = 0; i < entities.length; i++) {
    const { entity, word } = entities[i];

    // if it's a beginning entity
    if (entity.startsWith('B-')) {
      // if there's already a current word, push it to the result array
      if (currentWord) {
        result.push({ word: currentWord, entity: currentEntity });
        currentWord = '';
      }
      currentEntity = entity.slice(2);
    }

    if (word.startsWith('##')) {
      currentWord += word.slice(2);
    } else if (
      isSymbol(word) ||
      isSymbol(currentWord[currentWord.length - 1])
    ) {
      currentWord += word;
    } else {
      currentWord += (currentWord ? ' ' : '') + word;
    }

    function isSymbol(char: string) {
      // A simple check for symbols. You can extend this regex pattern
      // based on the specific symbols you're interested in.
      return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~]/.test(char);
    }

    // if it's the last entity, push it to the result array
    if (i === entities.length - 1) {
      result.push({ word: currentWord, entity: currentEntity });
    }
  }

  return result;
};
