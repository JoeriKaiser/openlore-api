import { pipeline, env as tfenv } from "@huggingface/transformers";
import { config } from "./env";

type FeatureExtractionOutput = { data: Float32Array | number[] };

type FeatureExtraction = (
  text: string,
  options?: { pooling?: "mean" | "none"; normalize?: boolean }
) => Promise<FeatureExtractionOutput>;

let extractor: FeatureExtraction | null = null;

async function getExtractor(): Promise<FeatureExtraction> {
  if (extractor) return extractor;
  const tfe = tfenv as unknown as {
    localModelPath: string;
    allowLocalModelsOnly: boolean;
    useBrowserCache: boolean;
    cacheDir?: string;
    backends: {
      onnx: {
        wasm: {
          wasmPaths?: string;
          proxy?: boolean;
          numThreads?: number;
        };
        executionProviders?: string[];
      };
    };
  };
  tfe.cacheDir = config.embeddingsLocalPath;
  tfe.localModelPath = config.embeddingsLocalPath;
  tfe.useBrowserCache = false;
  tfe.allowLocalModelsOnly = true;
  tfe.backends.onnx.executionProviders = ["cpu"];
  const p = (await pipeline(
    "feature-extraction",
    config.embeddingsModelId
  )) as unknown as FeatureExtraction;
  extractor = p;
  return extractor;
}

export async function embedText(params: { text: string }): Promise<number[]> {
  const fe = await getExtractor();
  const out = await fe(params.text, { pooling: "mean", normalize: true });
  const arr =
    out.data instanceof Float32Array
      ? Array.from(out.data)
      : (out.data as number[]);
  return arr.map((x) => Number(x));
}
