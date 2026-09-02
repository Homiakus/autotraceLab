/**
 * Isomorphic WASM loader and runner for AutoTrace Go Core.
 */

export interface WasmBridgeInstance {
  isReady: boolean;
  request: (jsonRequest: string) => string;
}

declare global {
  interface Window {
    Go?: new () => {
      importObject: WebAssembly.Imports;
      run: (instance: WebAssembly.Instance) => Promise<void>;
    };
    businessOSAutoTraceRequest?: (jsonStr: string) => string;
  }
}

export interface WasmLoaderOptions {
  wasmUrl?: string;
  wasmBinary?: ArrayBuffer | Uint8Array;
  customRunner?: (jsonRequest: string) => string;
}

export class WasmLoader {
  private instance: WasmBridgeInstance | null = null;
  private loadPromise: Promise<WasmBridgeInstance> | null = null;

  async load(options: string | WasmLoaderOptions = '/autotrace.wasm'): Promise<WasmBridgeInstance> {
    if (this.instance && this.instance.isReady) {
      return this.instance;
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }

    const opts: WasmLoaderOptions = typeof options === 'string' ? { wasmUrl: options } : options;
    this.loadPromise = this.initWasm(opts);
    return this.loadPromise;
  }

  private async initWasm(options: WasmLoaderOptions): Promise<WasmBridgeInstance> {
    // 1. Custom runner provided directly by embedder
    if (options.customRunner) {
      this.instance = {
        isReady: true,
        request: options.customRunner,
      };
      return this.instance;
    }

    // 2. Check if global function already available
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).businessOSAutoTraceRequest === 'function') {
      this.instance = {
        isReady: true,
        request: (jsonStr: string) => (globalThis as any).businessOSAutoTraceRequest(jsonStr),
      };
      return this.instance;
    }

    try {
      const g = typeof globalThis !== 'undefined' ? (globalThis as any) : typeof window !== 'undefined' ? (window as any) : (self as any);
      if (g && g.Go) {
        const go = new g.Go();
        let wasmModule: WebAssembly.WebAssemblyInstantiatedSource;

        if (options.wasmBinary) {
          const bytes = options.wasmBinary instanceof Uint8Array ? options.wasmBinary.buffer : options.wasmBinary;
          wasmModule = await WebAssembly.instantiate(bytes, go.importObject);
        } else if (typeof fetch === 'function' && options.wasmUrl) {
          if (WebAssembly.instantiateStreaming) {
            try {
              wasmModule = await WebAssembly.instantiateStreaming(fetch(options.wasmUrl), go.importObject);
            } catch {
              const response = await fetch(options.wasmUrl);
              const bytes = await response.arrayBuffer();
              wasmModule = await WebAssembly.instantiate(bytes, go.importObject);
            }
          } else {
            const response = await fetch(options.wasmUrl);
            const bytes = await response.arrayBuffer();
            wasmModule = await WebAssembly.instantiate(bytes, go.importObject);
          }
        } else {
          throw new Error('No WASM binary or valid URL provided');
        }

        // Run Go runtime in background
        go.run(wasmModule.instance);

        if (g.businessOSAutoTraceRequest) {
          this.instance = {
            isReady: true,
            request: (jsonStr: string) => g.businessOSAutoTraceRequest(jsonStr),
          };
          return this.instance;
        }
      }
    } catch (err) {
      console.warn('[WasmLoader] Go WASM instantiate skipped or unavailable in current env:', err);
    }

    // Fallback instance
    const isReady = typeof globalThis !== 'undefined' && typeof (globalThis as any).businessOSAutoTraceRequest === 'function';
    this.instance = {
      isReady,
      request: (jsonStr: string) => {
        if (typeof globalThis !== 'undefined' && (globalThis as any).businessOSAutoTraceRequest) {
          return (globalThis as any).businessOSAutoTraceRequest(jsonStr);
        }
        throw new Error('Go WASM engine is not loaded');
      },
    };
    return this.instance;
  }
}

export const defaultWasmLoader = new WasmLoader();
