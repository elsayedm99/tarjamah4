/// <reference types="vite/client" />

// Allow importing assets with ?url suffix
declare module '*?url' {
  const url: string;
  export default url;
}
