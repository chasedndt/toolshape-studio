import type { Asset, AssetDerivative } from "@toolshape/studio-domain";

export type PreviewResolver = (sourceRef: string) => string | null;

const FIXTURE_PREVIEW_URLS = new Map<string, string>([
  [
    "content://sha256/3347e5bac582026c1de26bd45e5b0722bc48a21a28e4642dc14f9712dc7c0116",
    new URL("../../../fixtures/studio/previews/source-product-film.thumbnail.png", import.meta.url).href,
  ],
  [
    "content://sha256/882cf6f7da00cf04c078efff9c651fff2e95deef0550d4fadd10b0b5ea794014",
    new URL("../../../fixtures/studio/previews/source-product-film.waveform.png", import.meta.url).href,
  ],
]);

export const resolveFixturePreview: PreviewResolver = (sourceRef) => FIXTURE_PREVIEW_URLS.get(sourceRef) ?? null;

export interface ResolvedAssetPreview {
  derivative: AssetDerivative;
  url: string;
}

export function resolveAssetPreview(
  asset: Asset | undefined,
  kind: Extract<AssetDerivative["kind"], "thumbnail" | "waveform">,
  resolver: PreviewResolver,
): ResolvedAssetPreview | null {
  const derivative = asset?.derivatives.find((candidate) => candidate.kind === kind);
  if (!derivative) return null;
  const url = resolver(derivative.sourceRef);
  return url ? { derivative, url } : null;
}
