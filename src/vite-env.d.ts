/// <reference types="vite/client" />
declare const __BUILD_VERSION__: string;

// Unica dichiarazione asset necessaria: tutti gli import di asset del
// progetto sono `*.csv?raw` (coperti da questo pattern) o `kit.json`
// (coperto da resolveJsonModule). Le vecchie dichiarazioni *.png/*.csv/*.txt
// non corrispondevano ad alcun import reale e sono state rimosse.
declare module '*?raw' {
  const content: string;
  export default content;
}
