import { pipeline } from '@xenova/transformers';

const task: string = 'token-classification';
const model: string = 'Xenova/bert-base-NER';

const modelPromise: Promise<any> = new Promise(async (resolve, reject) => {
  try {
    resolve(await pipeline(task, model));
  } catch (err) {
    reject(err);
  }
});

// The run function is used by the `transformers:run` event handler.
async function run(event: any, text: string): Promise<any> {
  let model = await modelPromise;
  return await model(text);
}

export { run };
