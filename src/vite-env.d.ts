/// <reference types="vite/client" />
declare const __BUILD_VERSION__: string;

declare module '*?raw' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.csv' {
  const value: string;
  export default value;
}

declare module '*.txt' {
  const value: string;
  export default value;
}
