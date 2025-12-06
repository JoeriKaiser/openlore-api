import { pipeline, env as tfenv } from "@huggingface/transformers";
import { config } from "./env";

type Extractor = (text: string, opts?: { pooling?: string; normalize?: boolean }) => 
  Promise<{ data: Float32Array | number[] }>;

let extractor: Extractor | null = null;

async function getExtractor(): Promise<Extractor> {
  if (extractor) return extractor;
  
  const tfe = tfenv as any;
  Object.assign(tfe, {
    cacheDir: config.embeddingsLocalPath,
    localModelPath: config.embeddingsLocalPath,
    useBrowserCache: false,
    allowLocalModelsOnly: true,
  });
  tfe.backends.onnx.executionProviders = ["cpu"];
  
  extractor = await pipeline("feature-extraction", config.embeddingsModelId) as unknown as Extractor;
  return extractor;
}

export async function embedText({ text }: { text: string }): Promise<number[]> {
  const fe = await getExtractor();
  const { data } = await fe(text, { pooling: "mean", normalize: true });
  return Array.from(data).map(Number);
}
