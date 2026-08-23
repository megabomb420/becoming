/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BECOMING_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

